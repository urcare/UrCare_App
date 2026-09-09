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

/** Writes one real notification row for a real event — never called
 *  speculatively/on a timer, only right after something has actually
 *  happened to this user (a prescription was issued, a report was
 *  reviewed, an order changed). Swallows its own errors: a notification
 *  failing to write should never fail the request that triggered it. */
async function createNotification(
  supabase: SupabaseClient,
  userId: string,
  type: 'prescription' | 'report' | 'order' | 'plan' | 'system',
  title: string,
  body?: string,
  data?: Record<string, any>,
): Promise<void> {
  try {
    await supabase.from('notifications').insert({ user_id: userId, type, title, body: body || null, data: data || {} });
  } catch (err) {
    console.warn('createNotification failed:', err);
  }
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
// DAILY QUOTE — one real Claude-generated line per calendar day, cached in
// memory so every user gets the same quote for the day and Claude is only
// called once per day (on the first request after midnight), not once per
// page load. Not personalized, so no auth needed.
// ----------------------------------------------------------------------------
let dailyQuoteCache: { date: string; en: string; hi: string } | null = null;
const DAILY_QUOTE_FALLBACK = { en: 'Discipline today, freedom tomorrow.', hi: 'आज अनुशासन, कल आज़ादी।' };

app.get('/api/daily-quote', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  if (dailyQuoteCache && dailyQuoteCache.date === today) {
    return res.json({ en: dailyQuoteCache.en, hi: dailyQuoteCache.hi });
  }

  const ai = getClaudeClient();
  if (!ai) return res.json(DAILY_QUOTE_FALLBACK);

  try {
    const parsed = await callClaudeForJson({
      client: ai,
      system: 'You write one short, original, motivating line for a metabolic-health/diabetes-reversal app\'s home screen, in the spirit of "Discipline today, freedom tomorrow." Under 10 words, no clichés about "journeys", no medical claims, no emoji. Provide an English version and a natural (not literally/machine-translated-sounding) Hindi version with the same meaning.',
      text: `Write today's motivational line (today is ${today}).`,
      toolName: 'record_daily_quote',
      toolDescription: 'Record the short motivational quote in English and Hindi.',
      inputSchema: {
        type: 'object',
        properties: {
          en: { type: 'string', description: "The English quote, under 10 words." },
          hi: { type: 'string', description: 'The Hindi quote, same meaning, natural Hindi phrasing.' },
        },
        required: ['en', 'hi'],
      },
    });
    if (!parsed.en || !parsed.hi) throw new Error('Incomplete quote from Claude');
    dailyQuoteCache = { date: today, en: parsed.en, hi: parsed.hi };
    res.json({ en: parsed.en, hi: parsed.hi });
  } catch (error) {
    console.error('Error generating daily quote:', error);
    res.json(DAILY_QUOTE_FALLBACK);
  }
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
      return res.status(503).json({ analysisFailed: true, rejectionReason: 'The scanner is not configured right now. Please try again later.' });
    }

    const systemInstruction = `You are UrCare's world-class Clinical Nutritionist and Metabolic Health AI.
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
      await createNotification(supabase, user.id, 'report', 'Report uploaded', parsed.reportName || 'Your report was analyzed and saved.', { reportId });
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
      return res.status(503).json({ analysisFailed: true, rejectionReason: 'The scanner is not configured right now. Please try again later.' });
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
      rejectionReason: 'Could not reach the scanner right now. Please check your connection and try scanning again.',
    });
  }
}));

// 3. Daily Plan — NOT AI-generated. Deterministically assembled from the
//    static `reversal_plan_sections` table (the UrCare reversal protocol),
//    filtered to this user's own selected conditions and how many days
//    they've been on the program. Same inputs always produce the same
//    output — nothing here is written by a model.

// Mirrors the condition checkboxes in OnboardingFlow.tsx / EditHealthProfileModal.tsx
// — keep this in sync if that list changes. Maps the label the user picked
// (stored verbatim in health_profiles.existing_concerns) to the canonical
// tag used on reversal_plan_sections.condition_tags.
const CONDITION_LABEL_TO_TAG: Record<string, string> = {
  'Diabetes / Pre-Diabetes': 'diabetes',
  'Obesity': 'obesity',
  'High Blood Pressure': 'hypertension',
  'High Cholesterol / Fatty Liver': 'fatty_liver',
  'Thyroid (Hypo/Hyper)': 'thyroid',
  'PCOS / PCOD': 'pcos',
  'Neuropathy (Nerve Pain/Tingling)': 'neuropathy',
  'Diabetic Retinopathy': 'retinopathy',
  'Heart Disease': 'heart_disease',
  'Kidney Disease': 'kidney_disease',
  'Joint Pain / Arthritis': 'joint_pain',
  'Chronic Fatigue': 'chronic_fatigue',
  'Sleep Apnea / Sleep Issues': 'sleep_apnea',
  'Erectile Dysfunction': 'erectile_dysfunction',
  'Uric Acid / Gout': 'uric_acid_gout',
  'Digestive / IBS': 'digestive_issues',
};

function conditionLabelsToTags(labels: string[] | null | undefined): Set<string> {
  const tags = new Set<string>();
  for (const label of labels || []) {
    const tag = CONDITION_LABEL_TO_TAG[label];
    if (tag) tags.add(tag);
  }
  return tags;
}

/** Program day is 1-14, counted from the day the plan was first opened — capped
 *  at 14 (Day 14's protocol repeats as maintenance guidance after that).
 *  `referenceDateIso` lets the calendar look back at what a past date's step
 *  would have been, instead of always answering for today. */
function computeProgramDay(startedAtIso: string, referenceDateIso?: string): number {
  const start = new Date(startedAtIso);
  start.setHours(0, 0, 0, 0);
  const reference = referenceDateIso ? new Date(referenceDateIso) : new Date();
  reference.setHours(0, 0, 0, 0);
  const diffDays = Math.round((reference.getTime() - start.getTime()) / 86400000);
  return Math.min(14, Math.max(1, diffDays + 1));
}

// Upload-your-own daily plan — a photo or PDF of a schedule the user already
// has (from their own doctor/nutritionist, or their own handwritten
// routine). Claude extracts it into the same {timeLabel, title, body} shape
// the built-in reversal plan uses, and it replaces that plan for 35 days.
app.post('/api/analyze-daily-plan', requireUser(async (req, res, user) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body as { imageBase64?: string; mimeType?: string };
    if (!imageBase64) {
      return res.json({ isValidPlan: false, rejectionReason: 'Please upload a photo or PDF of your daily plan.' });
    }
    const ai = getClaudeClient();
    if (!ai) {
      return res.status(503).json({ analysisFailed: true, rejectionReason: 'The plan scanner is not configured right now. Please try again later.' });
    }

    const systemInstruction = `You are UrCare's clinical scheduling assistant. You are given a photo or PDF of a person's own daily routine/schedule — it may be typed, handwritten, or a printout from their doctor or nutritionist. It could be a full 24-hour schedule or just a partial list of habits/timings.
CRITICAL FIRST STEP: Decide whether the input is genuinely someone's daily routine/schedule/plan (e.g. wake-up time, meal times, exercise, medication times, sleep time, any timed daily activity list) versus something unrelated (a random photo, a selfie, a lab report, an unreadable/blank image, or text with no actual schedule content).
- If it is NOT a daily routine/schedule, set isValidPlan to false, explain what was actually provided in rejectionReason, and leave sections empty.
- If it IS a genuine daily routine, set isValidPlan to true and extract EVERY distinct step into "sections", ordered chronologically by time of day. For each step: timeLabel is REQUIRED and must always be a clock time like "7:00 AM" — use the exact time if one is stated, otherwise infer the single most reasonable clock time from context (e.g. "morning walk" → "6:30 AM", "after lunch" → "1:30 PM", "before bed" → "10:00 PM") so that every step gets a real time and none are ever left blank. title is a short (3-8 word) name for the step; body is one or two sentences describing what to do, written the way a clinical daily-plan instruction reads (clear, encouraging, second person). Never invent steps that aren't in the source — only structure what's actually there, and never drop a step just because it lacked a stated time.
Call the record_daily_plan tool exactly once with the complete result.`;

    const parsed = await callClaudeForJson({
      client: ai,
      system: systemInstruction,
      text: 'Please extract this daily routine/schedule into structured, time-ordered steps.',
      imageBase64: imageBase64.startsWith('data:') ? imageBase64 : `data:${mimeType};base64,${imageBase64}`,
      toolName: 'record_daily_plan',
      toolDescription: 'Record whether the input is a genuine daily routine/schedule, and if so, its structured time-ordered steps.',
      inputSchema: {
        type: 'object',
        properties: {
          isValidPlan: { type: 'boolean', description: 'true only if the image/PDF is genuinely a daily routine, schedule, or timed habit list.' },
          rejectionReason: { type: 'string', description: 'Required when isValidPlan is false — a short, specific description of what was actually provided instead.' },
          sections: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                timeLabel: { type: 'string', description: 'A clock time like "7:00 AM" — always required, even if it must be your best inferred estimate.' },
                title: { type: 'string' },
                body: { type: 'string' },
              },
              required: ['timeLabel', 'title', 'body'],
            },
          },
        },
        required: ['isValidPlan'],
      },
    });

    if (parsed.isValidPlan === false || !parsed.isValidPlan) {
      return res.json({
        isValidPlan: false,
        rejectionReason: parsed.rejectionReason || 'This does not look like a daily routine or schedule. Please upload a photo or PDF of your actual daily plan.',
      });
    }

    const rawSections = Array.isArray(parsed.sections) ? parsed.sections : [];
    if (rawSections.length === 0) {
      return res.json({ isValidPlan: false, rejectionReason: 'No timed steps could be found in this — please upload a clearer photo or PDF of your plan.' });
    }

    const uploadedAt = new Date();
    const expiresAt = new Date(uploadedAt.getTime() + 35 * 24 * 60 * 60 * 1000);
    // Belt-and-suspenders: the prompt asks Claude for a timeLabel on every
    // step, but if one still comes back empty, a step with no time falls out
    // of the visible timeline entirely on the client (it's treated as
    // untimed reference material instead) — so no step from the user's own
    // plan is ever silently dropped, spread any missing ones evenly across
    // a waking day (6 AM–10 PM) in the order Claude already returned them.
    const wakingStartMin = 6 * 60;
    const wakingSpanMin = 16 * 60;
    const sections = rawSections.map((s: any, i: number) => {
      let timeLabel = typeof s.timeLabel === 'string' ? s.timeLabel.trim() : '';
      if (!timeLabel) {
        const totalMin = wakingStartMin + Math.round((wakingSpanMin * i) / Math.max(1, rawSections.length));
        const h24 = Math.floor(totalMin / 60) % 24;
        const min = totalMin % 60;
        const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
        timeLabel = `${h12}:${String(min).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
      }
      return {
        id: 'custom_' + i,
        timeLabel,
        title: s.title || 'Step',
        body: s.body || '',
      };
    });

    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error: upsertError } = await supabase.from('custom_daily_plans').upsert({
        user_id: user.id,
        uploaded_at: uploadedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        source_image_url: fileMediaType(imageBase64).startsWith('image/') ? imageBase64 : null,
        sections,
      }, { onConflict: 'user_id' });
      if (upsertError) throw upsertError;
      await createNotification(supabase, user.id, 'plan', 'Your custom daily plan is ready', `${sections.length} steps extracted and active for the next 35 days.`, {});
    }

    return res.json({
      isValidPlan: true,
      uploadedAt: uploadedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      sections,
    });
  } catch (error: any) {
    console.error('Error analyzing daily plan with Claude:', error);
    return res.status(200).json({
      isValidPlan: null,
      analysisFailed: true,
      rejectionReason: 'Could not read this plan right now. Please check your connection and try again.',
    });
  }
}));

app.post('/api/daily-plan', requireUser(async (req, res, user) => {
  try {
    const { date } = req.body as { date?: string };
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(503).json({ error: 'Database is not configured right now.' });

    // These three reads are all independent of each other — running them in
    // parallel instead of one-after-another roughly a-thirds the round-trip
    // time, which matters most for a brand-new user opening their plan for
    // the very first time right after onboarding.
    const [{ data: customPlan }, { data: hp }, { data: sections, error: sectionsError }] = await Promise.all([
      supabase.from('custom_daily_plans').select('sections, uploaded_at, expires_at').eq('user_id', user.id).maybeSingle(),
      supabase.from('health_profiles').select('existing_concerns, program_started_at').eq('user_id', user.id).maybeSingle(),
      supabase.from('reversal_plan_sections').select('*').order('order_index', { ascending: true }),
    ]);
    if (sectionsError) throw sectionsError;

    // A user's own uploaded daily plan (see /api/analyze-daily-plan) takes
    // over completely for 35 days from upload — same schedule every day,
    // no program-day/condition filtering, since it's THEIR plan, not ours.
    if (customPlan && new Date(customPlan.expires_at).getTime() > Date.now()) {
      return res.json({
        plan: {
          isCustom: true,
          uploadedAt: customPlan.uploaded_at,
          expiresAt: customPlan.expires_at,
          sections: customPlan.sections || [],
        },
      });
    }

    // First time this user opens their plan — pin "Day 1" to today. Never
    // overwritten again, so later profile edits don't reset their progress.
    // The write is fire-and-forget: today's response can already use the
    // value we just computed, it doesn't need to wait for it to land in the
    // DB — only a future request does, and by then it'll have committed.
    let startedAt = hp?.program_started_at as string | undefined;
    if (!startedAt) {
      startedAt = new Date().toISOString();
      supabase.from('health_profiles').update({ program_started_at: startedAt }).eq('user_id', user.id).is('program_started_at', null)
        .then(({ error }) => { if (error) console.error('Could not pin program_started_at:', error); });
    }

    const programDay = computeProgramDay(startedAt, date);
    const userTags = conditionLabelsToTags(hp?.existing_concerns);

    const matched = (sections || []).filter((s: any) => {
      const inDayRange = (s.day_start == null || programDay >= s.day_start) && (s.day_end == null || programDay <= s.day_end);
      if (!inDayRange) return false;
      const tags: string[] = s.condition_tags || [];
      if (tags.length === 0) return true; // universal — shown to everyone
      return tags.some((t) => userTags.has(t));
    });

    return res.json({
      plan: {
        programDay,
        startedAt,
        sections: matched.map((s: any) => ({
          id: s.id,
          timeLabel: s.time_label,
          title: s.title,
          body: s.body,
        })),
      },
    });
  } catch (error: any) {
    console.error('Error assembling daily plan:', error);
    return res.status(500).json({ error: 'Could not load today’s plan right now. Please try again.' });
  }
}));

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
    if (receiptImageUrl) {
      await createNotification(supabase, user.id, 'order', 'Payment receipt uploaded', `Order #${req.params.id} — awaiting verification.`, { orderId: req.params.id });
    }
    res.json({ success: true, order: data });
  } catch (e: any) {
    console.error('Order update failed:', e);
    res.status(500).json({ error: e.message });
  }
}));

// ----------------------------------------------------------------------------
// NOTIFICATIONS — real `notifications` rows only (see createNotification
// above for where they're actually written: a prescription issued, a report
// reviewed, an order's status/payment changed, a report/plan uploaded). These
// endpoints only ever read/update the caller's own rows, scoped by user.id
// server-side (the service-role client bypasses RLS, so this filter IS the
// access control here, not just belt-and-suspenders).
// ----------------------------------------------------------------------------
app.get('/api/notifications', requireUser(async (req, res, user) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured right now.' });
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ notifications: data || [] });
}));

app.post('/api/notifications/:id/read', requireUser(async (req, res, user) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured right now.' });
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', req.params.id).eq('user_id', user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
}));

app.post('/api/notifications/read-all', requireUser(async (req, res, user) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured right now.' });
  const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
}));

// The client detects "the next plan step starts in <=5 minutes" itself (it
// already has the day's real timeline) and calls this to actually write the
// reminder — this endpoint's only job is turning that into one real
// notification, once, per section per day. `dedupeKey` is a stable id the
// client derives from the section + date; a second call with the same key
// (a re-render, a second tab, whatever) is a no-op rather than a duplicate
// notification.
app.post('/api/notifications/reminder', requireUser(async (req, res, user) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured right now.' });
  const { title, body, dedupeKey } = req.body as { title?: string; body?: string; dedupeKey?: string };
  if (!title || !dedupeKey) return res.status(400).json({ error: 'title and dedupeKey are required.' });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', user.id)
    .eq('type', 'plan')
    .gte('created_at', since)
    .contains('data', { dedupeKey })
    .maybeSingle();
  if (existing) return res.json({ success: true, deduped: true });

  await createNotification(supabase, user.id, 'plan', title, body, { dedupeKey });
  res.json({ success: true });
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
      message: 'Welcome to UrCare Premium! UrCare Food Scan & your Daily Personalized Plan are now unlocked.',
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
    await createNotification(supabase, userId, 'report', 'Your lab report has been reviewed', 'A clinician has reviewed your report.', { reportId });
  }

  await createNotification(
    supabase, userId, 'prescription',
    `New prescription from ${doctorName || 'the UrCare Clinical Team'}`,
    diagnosis || 'Your prescription is ready to view.',
    { prescriptionId },
  );

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

  if (data?.user_id) {
    if (status) {
      await createNotification(supabase, data.user_id, 'order', `Your order is now ${status}`, `Order #${id}`, { orderId: id, status });
    }
    if (paymentStatus) {
      await createNotification(supabase, data.user_id, 'order', `Payment ${paymentStatus} for your order`, `Order #${id}`, { orderId: id, paymentStatus });
    }
  }

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
