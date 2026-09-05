import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// Body parser middleware for large image payloads
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

const CLAUDE_MODEL = 'claude-sonnet-5';

// Lazy Anthropic (Claude) client helper
function getClaudeClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('ANTHROPIC_API_KEY is not set in environment.');
    return null;
  }
  return new Anthropic({ apiKey });
}

// Strips the data-URL prefix ("data:image/jpeg;base64," or "data:application/pdf;base64,") if present, Claude wants raw base64.
function toRawBase64(fileBase64: string): string {
  return fileBase64.replace(/^data:[a-zA-Z0-9.+/-]+;base64,/, '');
}

function fileMediaType(fileBase64: string): string {
  const match = /^data:([a-zA-Z0-9.+/-]+);base64,/.exec(fileBase64);
  return match?.[1] || 'image/jpeg';
}

// Runs a Claude vision/document/text call and forces structured JSON output via a single tool call.
// `fileBase64` accepts either an image (photo of a report) or a PDF document — Claude Sonnet
// can read PDF text/tables natively via a "document" content block, so a PDF report no longer
// needs the user to manually retype its values.
async function callClaudeForJson(opts: {
  client: Anthropic;
  system: string;
  text: string;
  imageBase64?: string;
  toolName: string;
  toolDescription: string;
  inputSchema: Record<string, any>;
}): Promise<Record<string, any>> {
  const content: Anthropic.MessageParam['content'] = [];
  if (opts.imageBase64) {
    const mediaType = fileMediaType(opts.imageBase64);
    const data = toRawBase64(opts.imageBase64);
    if (mediaType === 'application/pdf') {
      content.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data,
        },
      } as any);
    } else {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType as any,
          data,
        },
      } as any);
    }
  }
  content.push({ type: 'text', text: opts.text });

  const response = await opts.client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1536,
    system: opts.system,
    tools: [
      {
        name: opts.toolName,
        description: opts.toolDescription,
        input_schema: opts.inputSchema as any,
      },
    ],
    tool_choice: { type: 'tool', name: opts.toolName },
    messages: [{ role: 'user', content }],
  });

  const toolUse = response.content.find((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use');
  return (toolUse?.input as Record<string, any>) || {};
}

// ============================================================================
// SUPABASE — service-role client (server-only, bypasses RLS). Every real
// record lives in Postgres; nothing here is cached in memory.
// ============================================================================

function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured.');
    return null;
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Verifies the caller's real Supabase session (Google or email login) from the Authorization header. */
async function verifyUser(req: express.Request): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email || '' };
}

function requireUser(handler: (req: express.Request, res: express.Response, user: { id: string; email: string }) => any) {
  return async (req: express.Request, res: express.Response) => {
    const user = await verifyUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in again.' });
    return handler(req, res, user);
  };
}

// ============================================================================
// ADMIN AUTH — checked ONLY here on the server against ADMIN_EMAIL/PASSWORD
// in .env. Never shipped to the browser bundle. Issues a signed, expiring
// session token (HMAC-SHA256) — no admin password is ever stored client-side.
// ============================================================================

function signAdminToken(email: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET || '';
  const expiry = Date.now() + 12 * 60 * 60 * 1000; // 12 hours
  const payload = `${email}:${expiry}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64');
}

function verifyAdminToken(token: string): boolean {
  try {
    const secret = process.env.ADMIN_SESSION_SECRET || '';
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [email, expiryStr, sig] = decoded.split(':');
    const expiry = Number(expiryStr);
    if (!email || !expiry || !sig) return false;
    if (Date.now() > expiry) return false;
    const expectedSig = crypto.createHmac('sha256', secret).update(`${email}:${expiry}`).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
  } catch {
    return false;
  }
}

function requireAdmin(handler: (req: express.Request, res: express.Response) => any) {
  return (req: express.Request, res: express.Response) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token || !verifyAdminToken(token)) {
      return res.status(401).json({ error: 'Admin session expired or invalid. Please log in again.' });
    }
    return handler(req, res);
  };
}

// ================= API ENDPOINTS =================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    claudeConfigured: !!process.env.ANTHROPIC_API_KEY,
    supabaseConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
});

// ----------------------------------------------------------------------------
// ADMIN LOGIN
// ----------------------------------------------------------------------------
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  const adminEmail = process.env.ADMIN_EMAIL || '';
  const adminPassword = process.env.ADMIN_PASSWORD || '';

  if (!adminEmail || !adminPassword) {
    return res.status(500).json({ error: 'Admin login is not configured on the server.' });
  }

  const emailOk = typeof email === 'string' && email.trim().toLowerCase() === adminEmail.toLowerCase();
  const passwordOk = typeof password === 'string' &&
    Buffer.from(password).length === Buffer.from(adminPassword).length &&
    crypto.timingSafeEqual(Buffer.from(password), Buffer.from(adminPassword));

  if (!emailOk || !passwordOk) {
    return res.status(401).json({ error: 'Invalid admin email or password.' });
  }

  res.json({ success: true, token: signAdminToken(adminEmail) });
});

// 1. Medical & Health Report AI Analysis — persists to `lab_reports`
app.post('/api/analyze-report', requireUser(async (req, res, user) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', reportText, reportType } = req.body;
    const ai = getClaudeClient();
    if (!ai) {
      return res.status(503).json({ analysisFailed: true, rejectionReason: 'The AI scanner is not configured right now. Please try again later.' });
    }

    const systemInstruction = `You are a world-class Clinical Nutritionist and Metabolic Health AI (like in Cal AI).
CRITICAL FIRST STEP: Decide whether the provided image/text is actually a genuine medical/health lab report or prescription (e.g. Blood test, Lipid profile, CBC, Thyroid panel, Liver panel, HbA1c/Diabetes, Vitamin test, doctor's prescription, or clearly-stated lab values as text).
- If it is NOT a medical/health report (e.g. a random photo, an unrelated document, a screenshot, a selfie, blank/unreadable image, or text with no actual lab values/clinical content), you MUST set isValidReport to false, explain in rejectionReason what was actually provided, and leave biomarkers/risks/recommendations empty. Do NOT invent biomarkers for a non-report input.
- Only if it IS a genuine medical/health report, set isValidReport to true, then extract meaningful biomarkers, identify potential health risks or dietary implications, and provide personalized dietary & macro adjustments.
Only report biomarkers you can actually read from the provided report/text — never invent numbers that aren't present. Call the record_report_analysis tool exactly once with the complete structured result.`;

    const parsed = await callClaudeForJson({
      client: ai,
      system: systemInstruction,
      text: `Please analyze this health/medical report${reportText ? `: "${reportText}"` : ''} and output structured clinical nutrition recommendations.`,
      imageBase64: imageBase64 ? (imageBase64.startsWith('data:') ? imageBase64 : `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`) : undefined,
      toolName: 'record_report_analysis',
      toolDescription: 'Record whether the input is a genuine medical/health report, and if so, its structured clinical analysis.',
      inputSchema: {
        type: 'object',
        properties: {
          isValidReport: { type: 'boolean', description: 'true only if the image/text is genuinely a medical/health lab report, biomarker panel, or prescription.' },
          rejectionReason: { type: 'string', description: 'Required when isValidReport is false — a short, specific description of what was actually provided instead of a report.' },
          reportName: { type: 'string' },
          summary: { type: 'string' },
          biomarkers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                value: { type: 'string' },
                status: { type: 'string', enum: ['normal', 'low', 'high', 'critical'] },
                referenceRange: { type: 'string' },
                impactOnDiet: { type: 'string' },
              },
              required: ['name', 'value', 'status', 'referenceRange', 'impactOnDiet'],
            },
          },
          identifiedRisks: { type: 'array', items: { type: 'string' } },
          dietaryRecommendations: { type: 'array', items: { type: 'string' } },
          macroAdjustments: {
            type: 'object',
            properties: {
              proteinMultiplier: { type: 'number' },
              carbAdjustment: { type: 'string' },
              fatAdjustment: { type: 'string' },
              keyNutrientsToBoost: { type: 'array', items: { type: 'string' } },
              foodsToAvoid: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        required: ['isValidReport'],
      },
    });

    if (parsed.isValidReport === false) {
      return res.json({
        isValidReport: false,
        rejectionReason: parsed.rejectionReason || 'This does not look like a medical/health lab report. Please upload an actual lab report, blood test, or prescription.',
      });
    }

    const reportId = 'rep_' + Date.now();
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data: profileRow } = await supabase.from('profiles').select('full_name').eq('user_id', user.id).maybeSingle();
      await supabase.from('lab_reports').insert({
        id: reportId,
        user_id: user.id,
        user_name: profileRow?.full_name || user.email,
        report_name: parsed.reportName || reportType || 'Diagnostic Lab Report',
        uploaded_at: new Date().toISOString(),
        image_url: imageBase64 && fileMediaType(imageBase64).startsWith('image/') ? imageBase64 : null,
        report_text: reportText || null,
        summary: parsed.summary || '',
        biomarkers: parsed.biomarkers || [],
        identified_risks: parsed.identifiedRisks || [],
        dietary_recommendations: parsed.dietaryRecommendations || [],
        macro_adjustments: parsed.macroAdjustments || {},
        admin_reviewed: false,
      });
    }

    return res.json({ ...parsed, id: reportId, uploadedAt: new Date().toISOString() });
  } catch (error: any) {
    console.error('Error analyzing report with Claude:', error);
    return res.status(200).json({
      isValidReport: null,
      analysisFailed: true,
      rejectionReason: 'Could not analyze this report right now. Please check your connection and try again.',
    });
  }
}));

// 2. AI Food Scanner & Meal Analyzer — persists to `food_scans`
app.post('/api/analyze-food', requireUser(async (req, res, user) => {
  try {
    const { imageBase64, description, mealCategory = 'lunch', profile } = req.body;
    const ai = getClaudeClient();

    const profileContext = profile
      ? [
          profile.goal ? `Goal: ${profile.goal}` : '',
          profile.gender ? `Gender: ${profile.gender}` : '',
          profile.age ? `Age: ${profile.age}` : '',
          profile.dietaryPreference ? `Dietary preference: ${profile.dietaryPreference}` : '',
          Array.isArray(profile.medicalConditions) && profile.medicalConditions.length
            ? `Medical conditions: ${profile.medicalConditions.join(', ')}`
            : '',
          profile.calculatedPlan?.targetCalories ? `Daily calorie target: ${profile.calculatedPlan.targetCalories} kcal` : '',
        ].filter(Boolean).join('. ')
      : '';

    if (!ai) {
      return res.status(503).json({ analysisFailed: true, rejectionReason: 'The AI scanner is not configured right now. Please try again later.' });
    }

    const systemInstruction = `You are UrCare's food identification and nutrition vision intelligence.
CRITICAL FIRST STEP: Decide whether the image (or, if no image, the text description) actually shows/describes real, edible food or a drink meant for human consumption.
- If it is NOT food or a drink (e.g. a person, an object, an animal, a document, a screenshot, blank/unclear image, or any other non-food item), you MUST set isFood to false, explain in rejectionReason what you actually see, and leave the nutrition fields at 0 / empty. Do NOT invent or guess nutrition numbers for a non-food item.
- Only if it IS genuinely food/drink, set isFood to true, then identify the food items, estimate a realistic portion size, and calculate calories, protein (g), carbs (g), fats (g), fiber (g) as accurately as you can from what is visible/described — never fabricate implausible values.
- When isFood is true, also use the user's health profile context provided to decide whether THIS SPECIFIC MEAL is a "good", "moderate" or "avoid" choice for THIS user, and briefly explain why (consider their goal, dietary preference, and any medical conditions).
Call the record_food_analysis tool exactly once with the complete result.`;

    const parsed = await callClaudeForJson({
      client: ai,
      system: systemInstruction,
      text: `Analyze this food image/description: "${description || 'Meal on plate'}". Category: ${mealCategory}.${
        profileContext ? ` User health profile context: ${profileContext}.` : ''
      }`,
      imageBase64: imageBase64 || undefined,
      toolName: 'record_food_analysis',
      toolDescription: 'Record whether the scanned item is real food, and if so, its structured nutrition analysis.',
      inputSchema: {
        type: 'object',
        properties: {
          isFood: { type: 'boolean', description: 'true only if the image/description clearly shows or describes actual edible food or a drink.' },
          rejectionReason: { type: 'string', description: 'Required when isFood is false — a short, specific description of what was actually scanned instead of food.' },
          name: { type: 'string' },
          calories: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fats: { type: 'number' },
          fiber: { type: 'number' },
          servingSize: { type: 'string' },
          confidence: { type: 'number' },
          healthNote: { type: 'string' },
          suitability: { type: 'string', enum: ['good', 'moderate', 'avoid'] },
          suitabilityReason: { type: 'string' },
        },
        required: ['isFood'],
      },
    });

    if (parsed.isFood) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        await supabase.from('food_scans').insert({
          user_id: user.id,
          image_url: imageBase64 || null,
          food_name: parsed.name || description || 'Scanned meal',
          calories: parsed.calories || 0,
          protein: parsed.protein || 0,
          carbs: parsed.carbs || 0,
          fat: parsed.fats || 0,
          fiber: parsed.fiber || 0,
          verdict: parsed.suitability || null,
          explanation: parsed.suitabilityReason || parsed.healthNote || null,
          confidence: parsed.confidence || null,
          model_version: CLAUDE_MODEL,
        });
      }
    }

    return res.json(parsed);
  } catch (error: any) {
    console.error('Error analyzing food:', error);
    return res.status(200).json({
      isFood: null,
      analysisFailed: true,
      rejectionReason: 'Could not reach the AI scanner right now. Please check your connection and try scanning again.',
    });
  }
}));

// 3. AI Daily Plan — generates (once per day, via Claude) and persists to `ai_daily_plans`.
//    Explicitly varies from the previous day's plan so it never repeats.
// De-dupes concurrent "generate today's plan" calls for the same user+date —
// e.g. React StrictMode double-mounting a component, or two tabs open at
// once — so a second caller piggybacks on the first's in-flight Claude call
// instead of firing (and waiting out) its own redundant one. This was making
// the "slow" complaint worse: two full generations competing for the same
// Anthropic rate-limit slot, both taking longer than a single call would.
const inFlightPlanGeneration = new Map<string, Promise<any>>();

app.post('/api/daily-plan', requireUser(async (req, res, user) => {
  const { date, profile } = req.body;
  if (!date) return res.status(400).json({ error: 'A date is required.' });
  const lockKey = `${user.id}:${date}`;

  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(503).json({ error: 'Database is not configured right now.' });

    // Already generated for this date? Return it as-is (never regenerate a past day).
    const { data: existing } = await supabase.from('ai_daily_plans').select('*').eq('user_id', user.id).eq('plan_date', date).maybeSingle();
    if (existing) return res.json({ plan: existing });

    // Someone else's request for this exact user+date is already generating —
    // wait for that one instead of starting a second Claude call.
    const pending = inFlightPlanGeneration.get(lockKey);
    if (pending) {
      const plan = await pending;
      return res.json({ plan });
    }

    const generation = generateAndSavePlan(supabase, user, date, profile);
    inFlightPlanGeneration.set(lockKey, generation);
    try {
      const plan = await generation;
      return res.json({ plan });
    } finally {
      inFlightPlanGeneration.delete(lockKey);
    }
  } catch (error: any) {
    console.error('Error generating daily plan:', error);
    return res.status(500).json({ error: 'Could not generate today’s plan right now. Please try again.' });
  }
}));

async function generateAndSavePlan(supabase: SupabaseClient, user: { id: string; email: string }, date: string, profile: any): Promise<any> {
    const ai = getClaudeClient();
    if (!ai) throw new Error('The AI planner is not configured right now.');

    // Look at the most recent previous plan so today's plan is told to differ from it.
    const { data: previous } = await supabase
      .from('ai_daily_plans')
      .select('plan_date, morning_plan, afternoon_plan, evening_plan, night_plan')
      .eq('user_id', user.id)
      .lt('plan_date', date)
      .order('plan_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const profileContext = profile
      ? [
          profile.goal ? `Goal: ${profile.goal}` : '',
          profile.gender ? `Gender: ${profile.gender}` : '',
          profile.age ? `Age: ${profile.age}` : '',
          profile.dietaryPreference ? `Dietary preference: ${profile.dietaryPreference}` : '',
          Array.isArray(profile.medicalConditions) && profile.medicalConditions.length ? `Medical conditions: ${profile.medicalConditions.join(', ')}` : '',
          profile.calculatedPlan ? `Targets — Calories: ${profile.calculatedPlan.targetCalories} kcal, Protein: ${profile.calculatedPlan.proteinGrams}g, Carbs: ${profile.calculatedPlan.carbsGrams}g, Fats: ${profile.calculatedPlan.fatsGrams}g, Water: ${profile.calculatedPlan.waterLiters}L` : '',
        ].filter(Boolean).join('. ')
      : '';

    const systemInstruction = `You are UrCare's clinical nutrition & lifestyle planning AI. Generate ONE full day's personalized health plan for ${date}, in simple, beginner-friendly language (avoid heavy medical jargon).
${previous ? `IMPORTANT: The user already had a plan yesterday (${previous.plan_date}). Today's plan MUST be meaningfully different — vary the specific meals, exercises, and tips — while still meeting the same nutrition targets. Do not repeat yesterday's plan verbatim.` : ''}
Call the record_daily_plan tool exactly once with the complete structured result.`;

    const parsed = await callClaudeForJson({
      client: ai,
      system: systemInstruction,
      text: `Generate today's (${date}) personalized plan.${profileContext ? ` User profile: ${profileContext}.` : ''}${previous ? ` Yesterday's plan (vary from this): ${JSON.stringify({ morning: previous.morning_plan, afternoon: previous.afternoon_plan, evening: previous.evening_plan, night: previous.night_plan })}` : ''}`,
      toolName: 'record_daily_plan',
      toolDescription: 'Record one full day of personalized health guidance.',
      inputSchema: {
        type: 'object',
        properties: {
          morning_plan: { type: 'object', properties: { meal: { type: 'string' }, tip: { type: 'string' } }, required: ['meal', 'tip'] },
          afternoon_plan: { type: 'object', properties: { meal: { type: 'string' }, tip: { type: 'string' } }, required: ['meal', 'tip'] },
          evening_plan: { type: 'object', properties: { meal: { type: 'string' }, tip: { type: 'string' } }, required: ['meal', 'tip'] },
          night_plan: { type: 'object', properties: { meal: { type: 'string' }, tip: { type: 'string' } }, required: ['meal', 'tip'] },
          exercise_plan: {
            type: 'object',
            properties: {
              activities: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, duration: { type: 'string' }, benefit: { type: 'string' } }, required: ['name', 'duration', 'benefit'] } },
              avoid: { type: 'array', items: { type: 'string' } },
            },
            required: ['activities'],
          },
          hydration_plan: { type: 'object', properties: { targetLiters: { type: 'number' }, tip: { type: 'string' } }, required: ['targetLiters', 'tip'] },
          nutrition_guidance: {
            type: 'object',
            properties: {
              eat: { type: 'array', items: { type: 'string' } },
              avoid: { type: 'array', items: { type: 'string' } },
            },
            required: ['eat', 'avoid'],
          },
          general_advice: { type: 'string' },
          daily_quote: { type: 'string' },
          medical_disclaimer: { type: 'string' },
        },
        required: ['morning_plan', 'afternoon_plan', 'evening_plan', 'night_plan', 'exercise_plan', 'hydration_plan', 'nutrition_guidance', 'general_advice', 'daily_quote', 'medical_disclaimer'],
      },
    });

    // ai_daily_plans has NOT NULL constraints on every one of these columns —
    // Claude's structured output occasionally omits/nulls a text field even
    // when the schema marks it required, so fall back rather than 500ing.
    const row = {
      user_id: user.id,
      plan_date: date,
      morning_plan: parsed.morning_plan || {},
      afternoon_plan: parsed.afternoon_plan || {},
      evening_plan: parsed.evening_plan || {},
      night_plan: parsed.night_plan || {},
      exercise_plan: parsed.exercise_plan || {},
      hydration_plan: parsed.hydration_plan || {},
      nutrition_guidance: parsed.nutrition_guidance || {},
      general_advice: parsed.general_advice || 'Stay consistent with your meals, movement, and water today — small steady habits add up the most.',
      daily_quote: parsed.daily_quote || 'Small daily habits build big lifelong results.',
      medical_disclaimer: parsed.medical_disclaimer || 'This plan is general wellness guidance, not a substitute for professional medical advice. Consult your doctor before making major changes, especially if you have an existing health condition.',
    };

    const { data: inserted, error: insertErr } = await supabase.from('ai_daily_plans').insert(row).select().single();
    if (insertErr) {
      // Two requests raced to generate the same day's plan (e.g. a double-mounted
      // component in dev). Whoever lost the race just reads back the winner's row
      // instead of erroring — the plan itself is still correct either way.
      if (insertErr.code === '23505') {
        const { data: winner } = await supabase.from('ai_daily_plans').select('*').eq('user_id', user.id).eq('plan_date', date).maybeSingle();
        if (winner) return winner;
      }
      throw insertErr;
    }

    return inserted;
}

// ----------------------------------------------------------------------------
// ORDERS & CHECKOUT — real `orders` + `order_items` rows.
// ----------------------------------------------------------------------------
app.post('/api/orders', requireUser(async (req, res, user) => {
  try {
    const { items = [], shippingAddress, subtotal, discount = 0, total, paymentMethod, transactionId, razorpayOrderId, razorpayPaymentId } = req.body;
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(503).json({ error: 'Database is not configured right now.' });

    const { data: profileRow } = await supabase.from('profiles').select('full_name, email').eq('user_id', user.id).maybeSingle();

    const { data: order, error: orderErr } = await supabase.from('orders').insert({
      user_id: user.id,
      customer_name: profileRow?.full_name || shippingAddress?.fullName || 'Member',
      customer_email: profileRow?.email || user.email,
      total_amount: total ?? subtotal ?? 0,
      shipping_address: shippingAddress || null,
      payment_status: 'paid',
      razorpay_order_id: razorpayOrderId || null,
      razorpay_payment_id: razorpayPaymentId || null,
      status: 'processing',
    }).select().single();
    if (orderErr) throw orderErr;

    if (Array.isArray(items) && items.length) {
      const orderItems = items.map((it: any) => ({
        order_id: order.id,
        product_id: it.product?.id || it.productId,
        quantity: it.quantity || 1,
        price: it.product?.discountPrice ?? it.product?.price ?? it.price ?? 0,
        product_name: it.product?.name,
        product_image: it.product?.image,
      }));
      await supabase.from('order_items').insert(orderItems);
    }

    res.json({ success: true, order, message: 'Order placed successfully! Delivery in 2-3 business days.' });
  } catch (e: any) {
    console.error('Order creation failed:', e);
    res.status(500).json({ error: e.message });
  }
}));

// Update an order the caller owns — used to attach a UPI payment reference /
// receipt screenshot after the order was created, and to mark it verified.
app.patch('/api/orders/:id', requireUser(async (req, res, user) => {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(503).json({ error: 'Database is not configured right now.' });

    const { data: existing } = await supabase.from('orders').select('user_id').eq('id', req.params.id).maybeSingle();
    if (!existing || existing.user_id !== user.id) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const { transactionId, receiptImageUrl, paymentStatus } = req.body;
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (transactionId) patch.razorpay_payment_id = transactionId;
    if (receiptImageUrl) {
      patch.receipt_image_url = receiptImageUrl;
      patch.receipt_uploaded_at = new Date().toISOString();
    }
    if (paymentStatus) patch.payment_status = paymentStatus;

    const { data, error } = await supabase.from('orders').update(patch).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ success: true, order: data });
  } catch (e: any) {
    console.error('Order update failed:', e);
    res.status(500).json({ error: e.message });
  }
}));

// ----------------------------------------------------------------------------
// RAZORPAY — real REST API when configured, clearly-labelled simulation otherwise.
// ----------------------------------------------------------------------------
function isRazorpayConfigured() {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

app.post('/api/razorpay/order', async (req, res) => {
  const { amount, currency = 'INR', receipt, notes } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'A valid amount is required.' });
  }

  if (isRazorpayConfigured()) {
    try {
      const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
      const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100),
          currency,
          receipt: receipt || `receipt_${Date.now()}`,
          notes: notes || {},
        }),
      });

      if (!rzpResponse.ok) {
        const errBody = await rzpResponse.text();
        console.error('Razorpay order creation failed:', errBody);
        throw new Error('Razorpay order creation failed');
      }

      const rzpOrder: any = await rzpResponse.json();
      return res.json({ ...rzpOrder, keyId: process.env.RAZORPAY_KEY_ID, mode: 'live' });
    } catch (err) {
      console.error('Falling back to simulated Razorpay order due to error:', err);
    }
  }

  const rzpOrderId = 'order_sim_' + Math.random().toString(36).substring(2, 12);
  res.json({
    id: rzpOrderId,
    entity: 'order',
    amount: Math.round(amount * 100),
    amount_paid: 0,
    amount_due: Math.round(amount * 100),
    currency,
    receipt: receipt || 'receipt_' + Date.now(),
    status: 'created',
    keyId: process.env.RAZORPAY_KEY_ID || '',
    mode: 'simulated',
  });
});

app.post('/api/razorpay/verify', (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (isRazorpayConfigured() && razorpay_order_id && razorpay_payment_id && razorpay_signature) {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET as string)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const verified = expectedSignature === razorpay_signature;
    return res.json({ success: verified, verified, paymentId: razorpay_payment_id, orderId: razorpay_order_id, mode: 'live' });
  }

  res.json({
    success: true,
    verified: true,
    paymentId: razorpay_payment_id || 'pay_sim_' + Math.random().toString(36).substring(2, 10),
    orderId: razorpay_order_id,
    mode: 'simulated',
  });
});

// ----------------------------------------------------------------------------
// PRO / PREMIUM UPGRADE — updates `profiles.premium_status` + `premium_transactions`.
// ----------------------------------------------------------------------------
app.post('/api/user/upgrade-pro', requireUser(async (req, res, user) => {
  try {
    const {
      planType = 'yearly',
      amount = 0,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (isRazorpayConfigured() && razorpay_order_id && razorpay_payment_id && razorpay_signature) {
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET as string)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');
      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ success: false, message: 'Payment verification failed. Please try again.' });
      }
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(503).json({ error: 'Database is not configured right now.' });

    const durationDays = planType === 'monthly' ? 30 : 365;
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    await supabase.from('profiles').update({
      premium_status: 'active',
      premium_started_at: new Date().toISOString(),
      premium_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id);

    await supabase.from('premium_transactions').insert({
      user_id: user.id,
      amount,
      plan_name: planType,
      plan_duration_days: durationDays,
      razorpay_order_id: razorpay_order_id || null,
      razorpay_payment_id: razorpay_payment_id || null,
      payment_status: 'paid',
      premium_started_at: new Date().toISOString(),
      premium_expires_at: expiresAt,
    });

    res.json({
      success: true,
      isPro: true,
      proPlanType: planType,
      proExpiry: expiresAt,
      message: 'Welcome to UrCare Premium! AI Food Scan & your Daily Personalized Plan are now unlocked.',
    });
  } catch (e: any) {
    console.error('Upgrade failed:', e);
    res.status(500).json({ error: e.message });
  }
}));

// ----------------------------------------------------------------------------
// PUBLIC STORE CATALOG (products, doctors, QR settings) — no auth required.
// ----------------------------------------------------------------------------
app.get('/api/qr-settings', async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.json({});
  const { data } = await supabase.from('qr_settings').select('*').eq('id', 'default').maybeSingle();
  res.json(data || {});
});

// ============================================================================
// ADMIN ENDPOINTS — every one behind requireAdmin, using the service-role
// client to read/write real data across all users.
// ============================================================================

app.get('/api/admin/stats', requireAdmin(async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured right now.' });

  const [{ count: totalUsers }, { count: proUsers }, { count: totalOrders }, { count: totalReviews }, { count: pendingReports }, { data: orders }] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('premium_status', 'active'),
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase.from('reviews').select('*', { count: 'exact', head: true }),
    supabase.from('lab_reports').select('*', { count: 'exact', head: true }).eq('admin_reviewed', false),
    supabase.from('orders').select('total_amount'),
  ]);

  const totalRevenue = (orders || []).reduce((sum: number, o: any) => sum + (Number(o.total_amount) || 0), 0);
  const totalBuyers = new Set((orders || []).map((o: any) => o.user_id)).size;

  res.json({
    totalUsers: totalUsers || 0,
    proUsers: proUsers || 0,
    freeUsers: (totalUsers || 0) - (proUsers || 0),
    totalBuyers,
    nonBuyers: (totalUsers || 0) - totalBuyers,
    totalReviews: totalReviews || 0,
    totalRevenue,
    totalOrders: totalOrders || 0,
    pendingReportsCount: pendingReports || 0,
  });
}));

app.get('/api/admin/users', requireAdmin(async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured right now.' });
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ users: data || [] });
}));

// Full detail for one patient (profile + health profile + activity counts) —
// needs the service-role client since it reads across users, unlike the
// patient's own RLS-scoped view of their own data.
app.get('/api/admin/patient/:userId', requireAdmin(async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured right now.' });
  const userId = req.params.userId;

  const [{ data: profileRow }, { data: healthProfileRow }, { data: dailyLogs }] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('health_profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('daily_logs').select('date, meals, task_completion').eq('user_id', userId),
  ]);

  if (!profileRow) return res.status(404).json({ error: 'Patient not found.' });

  const mealDaysCount = (dailyLogs || []).filter((d: any) => Array.isArray(d.meals) && d.meals.length > 0).length;
  const tasksDoneCount = (dailyLogs || []).reduce((sum: number, d: any) => {
    const tc = d.task_completion || {};
    return sum + Object.values(tc).filter(Boolean).length;
  }, 0);

  res.json({ profile: profileRow, healthProfile: healthProfileRow, mealDaysCount, tasksDoneCount });
}));

app.get('/api/admin/reports', requireAdmin(async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured right now.' });
  const { data, error } = await supabase.from('lab_reports').select('*').order('uploaded_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ reports: data || [] });
}));

app.post('/api/admin/prescribe', requireAdmin(async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured right now.' });
  const { userId, userName, reportId, doctorName, diagnosis, medicines, recommendedSupplements, dietaryAdjustments, notes } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required.' });

  const prescriptionId = 'rx_' + Date.now();
  const { data: prescription, error } = await supabase.from('prescriptions').insert({
    id: prescriptionId,
    user_id: userId,
    user_name: userName || null,
    report_id: reportId || null,
    doctor_name: doctorName || 'UrCare Clinical Team',
    date: new Date().toISOString().split('T')[0],
    diagnosis: diagnosis || '',
    medicines: medicines || [],
    recommended_supplements: recommendedSupplements || [],
    dietary_adjustments: dietaryAdjustments || [],
    notes: notes || '',
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });

  if (reportId) {
    await supabase.from('lab_reports').update({ admin_reviewed: true, admin_notes: notes || null }).eq('id', reportId);
  }

  res.json({ success: true, prescription, message: 'Prescription issued and attached to the patient’s health profile.' });
}));

app.get('/api/admin/orders', requireAdmin(async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured right now.' });
  const { data, error } = await supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ orders: data || [] });
}));

app.patch('/api/admin/orders/:id', requireAdmin(async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured right now.' });
  const { id } = req.params;
  const { status, paymentStatus } = req.body;
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (status) patch.status = status;
  if (paymentStatus) patch.payment_status = paymentStatus;
  const { data, error } = await supabase.from('orders').update(patch).eq('id', id).select().single();
  if (error) return res.status(404).json({ error: error.message });
  res.json({ success: true, order: data });
}));

app.get('/api/admin/qr-settings', requireAdmin(async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured right now.' });
  const { data } = await supabase.from('qr_settings').select('*').eq('id', 'default').maybeSingle();
  res.json(data || {});
}));

app.post('/api/admin/qr-settings', requireAdmin(async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured right now.' });
  const { qrImageUrl, upiId, payeeName, merchantNote } = req.body;
  const { data, error } = await supabase.from('qr_settings').upsert({
    id: 'default',
    qr_image_url: qrImageUrl,
    upi_id: upiId,
    payee_name: payeeName,
    merchant_note: merchantNote,
    updated_at: new Date().toISOString(),
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, qrSettings: data });
}));

// ---- Doctors (admin-managed directory) ----
app.get('/api/admin/doctors', requireAdmin(async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured right now.' });
  const { data, error } = await supabase.from('doctors').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ doctors: data || [] });
}));

app.post('/api/admin/doctors', requireAdmin(async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured right now.' });
  const { name, qualification, specialization, registrationNumber, phone, directDialNumber, availability, hospitalAffiliation } = req.body;
  if (!name) return res.status(400).json({ error: 'Doctor name is required.' });
  const { data, error } = await supabase.from('doctors').insert({
    name, qualification, specialization, registration_number: registrationNumber,
    phone, direct_dial_number: directDialNumber || (phone ? `tel:${phone}` : null),
    availability, hospital_affiliation: hospitalAffiliation, active: true,
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, doctor: data });
}));

app.patch('/api/admin/doctors/:id', requireAdmin(async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured right now.' });
  const { active } = req.body;
  const { data, error } = await supabase.from('doctors').update({ active }).eq('id', req.params.id).select().single();
  if (error) return res.status(404).json({ error: error.message });
  res.json({ success: true, doctor: data });
}));

app.delete('/api/admin/doctors/:id', requireAdmin(async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured right now.' });
  const { error } = await supabase.from('doctors').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
}));

// ---- Products (admin-managed catalog) ----
app.get('/api/products', async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.json({ products: [] });
  const { data } = await supabase.from('products').select('*').order('created_at');
  res.json({ products: data || [] });
});

app.post('/api/admin/products', requireAdmin(async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured right now.' });
  const { id, name, category, price, discountPrice, image, description, benefits, nutritionInfo, inStock, featured } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'Product id and name are required.' });
  const { data, error } = await supabase.from('products').upsert({
    id, name, category, price, discount_price: discountPrice, image, description,
    benefits: benefits || [], nutrition_info: nutritionInfo || null,
    in_stock: inStock !== false, featured: !!featured,
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, product: data });
}));

app.delete('/api/admin/products/:id', requireAdmin(async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured right now.' });
  const { error } = await supabase.from('products').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
}));

// Start Vite / Express server
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`UrCare Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
