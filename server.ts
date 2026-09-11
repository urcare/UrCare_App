import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// Body parser middleware for large image payloads
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Every AI call in this app goes through Groq's free tier (get a key at
// https://console.groq.com/keys, then set GROQ_API_KEY in .env).
// Two different models, picked by whether THIS call includes an image —
// verified directly against the real Groq API before shipping this:
// - qwen/qwen3.8-27b: the vision-capable model, used whenever an image is
//   attached. It reliably follows a strict JSON schema for image input, but
//   (tested) flatly refuses pure-text input ("I'm a vision-based AI").
// - openai/gpt-oss-20b: text-only, used whenever there's no image (typed
//   report text, a food description, the daily quote). Reliable with a
//   strict JSON schema; the larger openai/gpt-oss-120b was tried first and
//   occasionally emitted malformed JSON that failed schema validation.
const GROQ_VISION_MODEL = 'qwen/qwen3.8-27b';
const GROQ_TEXT_MODEL = 'openai/gpt-oss-20b';

// Lazy Groq client helper
function getGroqClient(): Groq | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn('GROQ_API_KEY is not set in environment.');
    return null;
  }
  return new Groq({ apiKey });
}

// Strips the data-URL prefix ("data:image/jpeg;base64," or "data:application/pdf;base64,") if present.
function toRawBase64(fileBase64: string): string {
  return fileBase64.replace(/^data:[a-zA-Z0-9.+/-]+;base64,/, '');
}

function fileMediaType(fileBase64: string): string {
  const match = /^data:([a-zA-Z0-9.+/-]+);base64,/.exec(fileBase64);
  return match?.[1] || 'image/jpeg';
}

/** Thrown by callGroqForJson when the input was a PDF — Groq's vision model
 *  reads images only, not PDF bytes, unlike the old Claude setup.
 *  Callers that accept a PDF upload (report/daily-plan) must catch this and
 *  return a real, honest rejection instead of silently misreading it. */
class PdfNotSupportedError extends Error {}

/** Fills in any top-level required key missing from a salvaged partial
 *  result (see callGroqForJson's json_validate_failed handling) with a
 *  type-appropriate empty default — [] for an array-typed field, null for
 *  everything else — never a fabricated value. */
function fillMissingRequiredKeys(partial: Record<string, any>, schema: Record<string, any>): Record<string, any> {
  const required: string[] = schema.required || [];
  const properties: Record<string, any> = schema.properties || {};
  const result = { ...partial };
  for (const key of required) {
    if (result[key] !== undefined) continue;
    const propType = properties[key]?.type;
    const isArrayType = propType === 'array' || (Array.isArray(propType) && propType.includes('array'));
    result[key] = isArrayType ? [] : null;
  }
  return result;
}

// Runs a Groq vision/text call and asks for structured JSON output via
// response_format's JSON schema (OpenAI-compatible Chat Completions API —
// see console.groq.com/docs/structured-outputs). `fileBase64`, when present,
// MUST be an image — see PdfNotSupportedError above.
async function callGroqForJson(opts: {
  client: Groq;
  system: string;
  text: string;
  imageBase64?: string;
  toolName: string;
  inputSchema: Record<string, any>;
  /** Defaults to 1536 — plenty for a single short structured answer (a
   *  quote, one food item). Callers whose schema can legitimately grow large
   *  (many biomarkers each with their own explanation, many daily-plan
   *  steps) MUST pass a bigger budget — the model silently truncates
   *  mid-JSON when it runs out, which drops whole fields (like biomarkers)
   *  rather than erroring, so this was previously a real, hard-to-notice bug. */
  maxTokens?: number;
}): Promise<Record<string, any>> {
  const content: Groq.Chat.ChatCompletionContentPart[] = [];
  let hasImage = false;
  if (opts.imageBase64) {
    const mediaType = fileMediaType(opts.imageBase64);
    if (mediaType === 'application/pdf') throw new PdfNotSupportedError();
    const dataUrl = opts.imageBase64.startsWith('data:') ? opts.imageBase64 : `data:${mediaType};base64,${toRawBase64(opts.imageBase64)}`;
    content.push({ type: 'image_url', image_url: { url: dataUrl } });
    hasImage = true;
  }
  content.push({ type: 'text', text: opts.text });

  // Tested directly against the real API: this Groq account's free tier
  // enforces a HARD 1000 output-tokens-PER-MINUTE ceiling on the vision
  // model specifically — asking for more doesn't just get truncated, the
  // ENTIRE request is rejected (429) before it even runs. So a vision call
  // must always stay at or under 1000, no matter what the caller requested;
  // the text model wasn't observed to hit this in testing.
  const requestedMaxTokens = opts.maxTokens ?? 1536;
  const effectiveMaxTokens = hasImage ? Math.min(requestedMaxTokens, 1000) : requestedMaxTokens;

  let completion: Groq.Chat.Completions.ChatCompletion;
  try {
    completion = await opts.client.chat.completions.create({
      model: hasImage ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL,
      max_completion_tokens: effectiveMaxTokens,
      // Deterministic — this is structured data extraction, not creative
      // writing; temperature 0 measurably reduced garbled/inconsistent output
      // in testing (e.g. a biomarker value coming back as literal "}, {").
      temperature: 0,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content },
      ],
      response_format: {
        type: 'json_schema',
        // strict — every schema passed to this function must mark ALL its
        // properties (at every nesting level) required, using a ['x','null']
        // type union for anything actually optional, plus additionalProperties:
        // false on every object. Tested: best-effort (strict:false) was
        // unreliable — it sometimes returned only isValidReport and dropped
        // every other field, which is exactly the silent-data-loss bug this
        // whole file is already once bitten by (see maxTokens comment above).
        json_schema: { name: opts.toolName, schema: opts.inputSchema, strict: true },
      },
    });
  } catch (err: any) {
    // Tested directly against the real API: on a long/dense generation (a
    // 19-row lab report), the model sometimes emits a real, complete,
    // internally-valid `biomarkers` array but stops without also writing
    // the other required top-level keys — Groq's strict mode then rejects
    // the WHOLE call with a 400 before ever returning it to us, discarding
    // a perfectly good extraction. If that's what happened, salvage the
    // model's own JSON (in `failed_generation`) instead of failing outright —
    // real data it already read, just missing bookkeeping fields we can
    // safely default (never fabricating what it didn't find).
    const apiError = err?.error?.error;
    if (apiError?.code === 'json_validate_failed' && typeof apiError?.failed_generation === 'string') {
      try {
        const partial = JSON.parse(apiError.failed_generation);
        console.error(`callGroqForJson: '${opts.toolName}' failed strict validation — salvaged a partial result instead of discarding it.`);
        return fillMissingRequiredKeys(partial, opts.inputSchema);
      } catch {
        // The salvaged text wasn't valid JSON either — nothing to recover, fall through.
      }
    }
    throw err;
  }

  const choice = completion.choices[0];
  if (choice?.finish_reason === 'length') {
    // The JSON was cut off mid-generation — whatever fields hadn't been
    // emitted yet (often the biggest ones, like `biomarkers`) are just
    // missing, not present-but-empty, so this MUST be surfaced rather than
    // silently returned as a valid-looking partial result.
    console.error(`callGroqForJson: '${opts.toolName}' hit max_completion_tokens (${effectiveMaxTokens}) — response was truncated.`);
  }

  try {
    return JSON.parse(choice?.message?.content || '{}');
  } catch {
    console.error(`callGroqForJson: '${opts.toolName}' returned non-JSON output:`, choice?.message?.content);
    return {};
  }
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

/** Writes one "My Timeline" row for a real server-side/admin-driven action
 *  (a prescription issued, an order updated, a report/plan uploaded) — the
 *  same audit-trail table the client writes its own entries into directly
 *  for user-initiated actions, just via service_role here since these are
 *  actions done TO the user's account, not BY it. */
async function createActivityLog(
  supabase: SupabaseClient,
  userId: string,
  action: 'created' | 'uploaded' | 'updated' | 'deleted',
  category: 'report' | 'plan' | 'profile' | 'target' | 'prescription' | 'order' | 'assessment' | 'meal',
  title: string,
  detail?: string,
  data?: Record<string, any>,
): Promise<void> {
  try {
    await supabase.from('activity_log').insert({ user_id: userId, action, category, title, detail: detail || null, data: data || {} });
  } catch (err) {
    console.warn('createActivityLog failed:', err);
  }
}

// ================= API ENDPOINTS =================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    aiConfigured: !!process.env.GROQ_API_KEY,
    supabaseConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
});

// ----------------------------------------------------------------------------
// DAILY QUOTE — one real Groq-generated line per calendar day, cached in
// memory so every user gets the same quote for the day and Groq is only
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

  const ai = getGroqClient();
  if (!ai) return res.json(DAILY_QUOTE_FALLBACK);

  try {
    const parsed = await callGroqForJson({
      client: ai,
      system: 'You write one short, original, motivating line for a metabolic-health/diabetes-reversal app\'s home screen, in the spirit of "Discipline today, freedom tomorrow." Under 10 words, no clichés about "journeys", no medical claims, no emoji. Provide an English version and a natural (not literally/machine-translated-sounding) Hindi version with the same meaning.',
      text: `Write today's motivational line (today is ${today}).`,
      toolName: 'record_daily_quote',
      inputSchema: {
        type: 'object',
        properties: {
          en: { type: 'string', description: "The English quote, under 10 words." },
          hi: { type: 'string', description: 'The Hindi quote, same meaning, natural Hindi phrasing.' },
        },
        required: ['en', 'hi'],
        additionalProperties: false,
      },
    });
    if (!parsed.en || !parsed.hi) throw new Error('Incomplete quote from Groq');
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

// ----------------------------------------------------------------------------
// CONDITION ↔ REVERSAL-PLAN-TAG VOCABULARY — shared by report analysis below
// (which can ADD to a user's real conditions) and /api/daily-plan further
// down (which reads them back to pick sections). Nothing here is AI — it's
// the same static lookup table either way.
// ----------------------------------------------------------------------------

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

// Inverse lookup — turns a derived tag back into the exact condition label
// stored in health_profiles.existing_concerns.
const TAG_TO_CONDITION_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(CONDITION_LABEL_TO_TAG).map(([label, tag]) => [tag, label])
);

// Deterministic (NOT AI) biomarker-name → condition-tag rules. Only an
// ABNORMAL (low/high/critical) biomarker whose name matches one of these
// counts — a normal reading never adds a condition. This is what lets a lab
// report automatically WIDEN (never shrink) which reversal_plan_sections a
// user's Daily Plan pulls from, the moment a real report is uploaded.
const BIOMARKER_NAME_TO_TAG: { pattern: RegExp; tag: string }[] = [
  { pattern: /hba1c|glucose|blood sugar|fasting sugar|post.?prandial|insulin/i, tag: 'diabetes' },
  { pattern: /cholesterol|\bldl\b|\bhdl\b|triglyceride|\bsgot\b|\bsgpt\b|\balt\b|\bast\b|liver/i, tag: 'fatty_liver' },
  { pattern: /\btsh\b|\bt3\b|\bt4\b|thyroid/i, tag: 'thyroid' },
  { pattern: /creatinine|\begfr\b|\burea\b|\bbun\b|kidney/i, tag: 'kidney_disease' },
  { pattern: /uric acid/i, tag: 'uric_acid_gout' },
  { pattern: /vitamin d|vitamin b12|hemoglobin|\bhb\b/i, tag: 'chronic_fatigue' },
];

// Same idea, scanning the free-text risks Groq already extracted from THIS
// report (e.g. "Risk of hypertension") — still a rule-based match against
// already-extracted text, not a second model judgment call.
const RISK_TEXT_TO_TAG: { pattern: RegExp; tag: string }[] = [
  { pattern: /diabet|blood sugar|glycemic/i, tag: 'diabetes' },
  { pattern: /hypertension|blood pressure|\bbp\b/i, tag: 'hypertension' },
  { pattern: /obes|overweight/i, tag: 'obesity' },
  { pattern: /fatty liver|cholesterol|lipid|triglyceride/i, tag: 'fatty_liver' },
  { pattern: /thyroid|hypothyroid|hyperthyroid/i, tag: 'thyroid' },
  { pattern: /\bpcos\b|\bpcod\b/i, tag: 'pcos' },
  { pattern: /neuropath|nerve/i, tag: 'neuropathy' },
  { pattern: /retinopathy|diabetic eye/i, tag: 'retinopathy' },
  { pattern: /heart|cardiac|cardiovascular/i, tag: 'heart_disease' },
  { pattern: /kidney|renal/i, tag: 'kidney_disease' },
  { pattern: /joint|arthritis/i, tag: 'joint_pain' },
  { pattern: /fatigue/i, tag: 'chronic_fatigue' },
  { pattern: /sleep apnea|sleep issue/i, tag: 'sleep_apnea' },
  { pattern: /uric acid|gout/i, tag: 'uric_acid_gout' },
  { pattern: /digestive|\bibs\b|\bgut\b/i, tag: 'digestive_issues' },
];

/** Deterministically derives which reversal condition tags THIS report
 *  supports — only from its own abnormal biomarker names and its own
 *  already-extracted risk text, never a fresh AI judgment call. */
function deriveConditionTagsFromReport(biomarkers: any[], identifiedRisks: any[]): Set<string> {
  const tags = new Set<string>();
  for (const b of biomarkers || []) {
    if (!b || typeof b.name !== 'string') continue;
    if (b.status !== 'high' && b.status !== 'low' && b.status !== 'critical') continue;
    for (const rule of BIOMARKER_NAME_TO_TAG) {
      if (rule.pattern.test(b.name)) tags.add(rule.tag);
    }
  }
  for (const risk of identifiedRisks || []) {
    if (typeof risk !== 'string') continue;
    for (const rule of RISK_TEXT_TO_TAG) {
      if (rule.pattern.test(risk)) tags.add(rule.tag);
    }
  }
  return tags;
}

// 1. Medical & Health Report AI Analysis — persists to `lab_reports`
// Max lab reports a user can have on file — every upload (including a
// "Re-upload" from an existing report's card) inserts a brand new row, so
// this cap applies uniformly everywhere a report gets analyzed. The user
// deletes an existing report (already-built feature) to free up a slot.
const MAX_REPORTS_PER_USER = 2;

app.post('/api/analyze-report', requireUser(async (req, res, user) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', reportText, reportType } = req.body;
    const ai = getGroqClient();
    if (!ai) {
      return res.status(503).json({ analysisFailed: true, rejectionReason: 'The scanner is not configured right now. Please try again later.' });
    }

    const supabaseForLimitCheck = getSupabaseAdmin();
    if (supabaseForLimitCheck) {
      const { count } = await supabaseForLimitCheck.from('lab_reports').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
      if ((count || 0) >= MAX_REPORTS_PER_USER) {
        return res.json({
          isValidReport: false,
          reportLimitReached: true,
          rejectionReason: `You already have ${MAX_REPORTS_PER_USER} reports on file — the maximum allowed. Please delete an old one before uploading a new one.`,
        });
      }
    }

    const systemInstruction = `You are UrCare's world-class Clinical Nutritionist and Metabolic Health AI.
CRITICAL FIRST STEP: Decide whether the provided image/text is actually a genuine medical/health lab report or prescription (e.g. Blood test, Lipid profile, CBC, Thyroid panel, Liver panel, HbA1c/Diabetes, Vitamin test, doctor's prescription, or clearly-stated lab values as text).
- If it is NOT a medical/health report (e.g. a random photo, an unrelated document, a screenshot, a selfie, blank/unreadable image, or text with no actual lab values/clinical content), you MUST set isValidReport to false, explain in rejectionReason what was actually provided, and leave biomarkers/risks/recommendations empty. Do NOT invent biomarkers for a non-report input.
- Only if it IS a genuine medical/health report, set isValidReport to true, then extract EVERY SINGLE individual test row shown in the report as its OWN separate biomarker entry — do NOT group, merge, summarize, or combine multiple test rows into one entry (e.g. Fasting Blood Sugar, Post-Prandial Blood Sugar and HbA1c are THREE separate biomarkers, never one combined entry). Never invent a generic/summary entry — every entry must be one real, specific, named test that is actually printed in the report, with its own actual value.
Only report biomarkers you can actually read from the provided report/text — never invent numbers that aren't present.
OUTPUT LENGTH IS STRICTLY LIMITED — you must fit ALL test rows within a small token budget, so keep every other field extremely brief:
- summary: max 1 short sentence.
- identifiedRisks / dietaryRecommendations: at most 2 short items each, only for genuinely abnormal findings — empty arrays are correct and expected for a mostly-normal report.
- macroAdjustments: only fill fields truly warranted by an abnormal finding; leave the rest null.
Prioritize including EVERY test row over writing any explanatory text — completeness of the biomarker list matters more than prose anywhere else.
MANDATORY OUTPUT SHAPE — your JSON MUST always contain ALL EIGHT top-level keys, every single time, with no exceptions: isValidReport, rejectionReason, reportName, summary, biomarkers, identifiedRisks, dietaryRecommendations, macroAdjustments. Never stop generating after only "biomarkers" — a response missing any of these keys is invalid and will be rejected outright. If a key doesn't apply, its value is null (for a string/object) or an empty array [] (for a list) — but the key itself must still be written. Write the short/empty top-level keys (isValidReport, rejectionReason, reportName, summary) FIRST, then biomarkers, then the remaining keys — never let a long biomarkers list be the last thing you write. Call the record_report_analysis tool exactly once with the complete result.`;

    const parsed = await callGroqForJson({
      client: ai,
      system: systemInstruction,
      text: `Please analyze this health/medical report${reportText ? `: "${reportText}"` : ''} and output structured clinical nutrition recommendations.`,
      imageBase64: imageBase64 ? (imageBase64.startsWith('data:') ? imageBase64 : `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`) : undefined,
      toolName: 'record_report_analysis',
      // A dense multi-panel report (CBC + biochemistry + thyroid etc.) can
      // have 20+ rows — tested directly: this account's free-tier vision
      // model has a hard 1000 completion-token/minute ceiling (see
      // callGroqForJson), so there's no budget left for a per-biomarker
      // explanation (`impactOnDiet` was dropped from this schema entirely —
      // general diet notes now live in the top-level dietaryRecommendations
      // instead) — every token has to go toward listing every real row.
      maxTokens: 1000,
      inputSchema: {
        type: 'object',
        properties: {
          isValidReport: { type: 'boolean', description: 'true only if the image/text is genuinely a medical/health lab report, biomarker panel, or prescription.' },
          rejectionReason: { type: ['string', 'null'], description: 'Required when isValidReport is false — a short, specific description of what was actually provided instead of a report.' },
          reportName: { type: ['string', 'null'] },
          summary: { type: ['string', 'null'] },
          biomarkers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                value: { type: 'string' },
                status: { type: 'string', enum: ['normal', 'low', 'high', 'critical'] },
                referenceRange: { type: 'string' },
              },
              required: ['name', 'value', 'status', 'referenceRange'],
              additionalProperties: false,
            },
          },
          identifiedRisks: { type: 'array', items: { type: 'string' } },
          dietaryRecommendations: { type: 'array', items: { type: 'string' } },
          macroAdjustments: {
            type: ['object', 'null'],
            properties: {
              proteinMultiplier: { type: ['number', 'null'] },
              carbAdjustment: { type: ['string', 'null'] },
              fatAdjustment: { type: ['string', 'null'] },
              keyNutrientsToBoost: { type: 'array', items: { type: 'string' } },
              foodsToAvoid: { type: 'array', items: { type: 'string' } },
            },
            required: ['proteinMultiplier', 'carbAdjustment', 'fatAdjustment', 'keyNutrientsToBoost', 'foodsToAvoid'],
            additionalProperties: false,
          },
        },
        required: ['isValidReport', 'rejectionReason', 'reportName', 'summary', 'biomarkers', 'identifiedRisks', 'dietaryRecommendations', 'macroAdjustments'],
        additionalProperties: false,
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
    let addedConditions: string[] = [];
    let recommendedConditionsForResponse: string[] = [];
    let preExistingConditionsForResponse: string[] = [];
    if (supabase) {
      const { data: profileRow } = await supabase.from('profiles').select('full_name').eq('user_id', user.id).maybeSingle();

      // Daily Plan integration — a real abnormal finding on this report can
      // WIDEN (never shrink) which of the static reversal_plan_sections this
      // user's Daily Plan pulls from, exactly as if they'd ticked that
      // condition themselves in Edit Health Profile. Deterministic and
      // additive only — a report never removes a condition already on file.
      // Computed BEFORE the insert so the report's own row can permanently
      // record what it recommended/added/found-already-present — a real,
      // honest point-wise history shown on the report itself (ReportPhotoViewer),
      // not just a one-time toast that's gone once the upload screen closes.
      const { data: hpRow } = await supabase.from('health_profiles').select('existing_concerns').eq('user_id', user.id).maybeSingle();
      const preExistingConditions: string[] = (hpRow?.existing_concerns || []).filter((c: string) => c !== 'None');
      const existingTags = conditionLabelsToTags(preExistingConditions);
      const derivedTags = deriveConditionTagsFromReport(parsed.biomarkers || [], parsed.identifiedRisks || []);
      const recommendedConditions = Array.from(derivedTags).map((tag) => TAG_TO_CONDITION_LABEL[tag]).filter(Boolean);
      const newLabels = Array.from(derivedTags)
        .filter((tag) => !existingTags.has(tag))
        .map((tag) => TAG_TO_CONDITION_LABEL[tag])
        .filter(Boolean);
      recommendedConditionsForResponse = recommendedConditions;
      preExistingConditionsForResponse = preExistingConditions;

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
        recommended_conditions: recommendedConditions,
        pre_existing_conditions: preExistingConditions,
        added_conditions: newLabels,
      });
      await createNotification(supabase, user.id, 'report', 'Report uploaded', parsed.reportName || 'Your report was analyzed and saved.', { reportId });
      await createActivityLog(supabase, user.id, 'uploaded', 'report', `Uploaded report: ${parsed.reportName || 'Diagnostic Lab Report'}`, undefined, { reportId });

      if (newLabels.length > 0) {
        const merged = Array.from(new Set([...preExistingConditions, ...newLabels]));
        await supabase.from('health_profiles').update({ existing_concerns: merged, updated_at: new Date().toISOString() }).eq('user_id', user.id);
        addedConditions = newLabels;
        await createNotification(supabase, user.id, 'plan', 'Your Daily Plan was updated', `Based on this report, we added ${newLabels.join(', ')} to your reversal focus.`, { reportId, addedConditions: newLabels });
        await createActivityLog(supabase, user.id, 'updated', 'plan', 'Daily Plan updated from report', `Added: ${newLabels.join(', ')}`, { reportId, addedConditions: newLabels });
      }
    }

    return res.json({
      ...parsed,
      id: reportId,
      uploadedAt: new Date().toISOString(),
      addedConditions,
      recommendedConditions: recommendedConditionsForResponse,
      preExistingConditions: preExistingConditionsForResponse,
    });
  } catch (error: any) {
    if (error instanceof PdfNotSupportedError) {
      return res.json({ isValidReport: false, rejectionReason: 'PDF reports aren\'t supported right now — please upload a clear photo of your report instead.' });
    }
    console.error('Error analyzing report with Groq:', error);
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
    const ai = getGroqClient();

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

    const parsed = await callGroqForJson({
      client: ai,
      system: systemInstruction,
      text: `Analyze this food image/description: "${description || 'Meal on plate'}". Category: ${mealCategory}.${
        profileContext ? ` User health profile context: ${profileContext}.` : ''
      }`,
      imageBase64: imageBase64 || undefined,
      toolName: 'record_food_analysis',
      inputSchema: {
        type: 'object',
        properties: {
          isFood: { type: 'boolean', description: 'true only if the image/description clearly shows or describes actual edible food or a drink.' },
          rejectionReason: { type: ['string', 'null'], description: 'Required when isFood is false — a short, specific description of what was actually scanned instead of food.' },
          name: { type: ['string', 'null'] },
          calories: { type: ['number', 'null'] },
          protein: { type: ['number', 'null'] },
          carbs: { type: ['number', 'null'] },
          fats: { type: ['number', 'null'] },
          fiber: { type: ['number', 'null'] },
          servingSize: { type: ['string', 'null'] },
          confidence: { type: ['number', 'null'] },
          healthNote: { type: ['string', 'null'] },
          suitability: { type: ['string', 'null'], enum: ['good', 'moderate', 'avoid', null] },
          suitabilityReason: { type: ['string', 'null'] },
        },
        required: ['isFood', 'rejectionReason', 'name', 'calories', 'protein', 'carbs', 'fats', 'fiber', 'servingSize', 'confidence', 'healthNote', 'suitability', 'suitabilityReason'],
        additionalProperties: false,
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
          model_version: imageBase64 ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL,
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
//    output — nothing here is written by a model. (CONDITION_LABEL_TO_TAG /
//    conditionLabelsToTags now live above, next to /api/analyze-report,
//    which also needs them to fold a report's findings into these same tags.)

/** Program day is 1-14, counted from the day the plan was first opened — capped
 *  at 14 (Day 14's protocol repeats as maintenance guidance after that).
 *  `referenceDateIso` lets the calendar look back at what a past date's step
 *  would have been, instead of always answering for today. */
/** Reduces any timestamp/date string to a UTC calendar-day number. Never
 *  Date.setHours(0,0,0,0) to "zero out" a time-of-day — that mutates in
 *  the server PROCESS's own local timezone, which can silently land on a
 *  different calendar day whenever that isn't UTC. That was the actual bug
 *  behind a brand-new user's real Day 1 sometimes rendering as Day 2. */
function toUtcDayNumber(dateOrIso: string): number {
  const d = new Date(dateOrIso);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000);
}

function computeProgramDay(startedAtIso: string, referenceDateIso?: string): number {
  const startDay = toUtcDayNumber(startedAtIso);
  const referenceDay = toUtcDayNumber(referenceDateIso || new Date().toISOString());
  const diffDays = referenceDay - startDay;
  return Math.min(14, Math.max(1, diffDays + 1));
}

// Upload-your-own daily plan — a photo or PDF of a schedule the user already
// has (from their own doctor/nutritionist, or their own handwritten
// routine). Groq extracts it into the same {timeLabel, title, body} shape
// the built-in reversal plan uses, and it replaces that plan for 35 days.
app.post('/api/analyze-daily-plan', requireUser(async (req, res, user) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body as { imageBase64?: string; mimeType?: string };
    if (!imageBase64) {
      return res.json({ isValidPlan: false, rejectionReason: 'Please upload a photo or PDF of your daily plan.' });
    }
    const ai = getGroqClient();
    if (!ai) {
      return res.status(503).json({ analysisFailed: true, rejectionReason: 'The plan scanner is not configured right now. Please try again later.' });
    }

    const systemInstruction = `You are UrCare's clinical scheduling assistant. You are given a photo or PDF of a person's own daily routine/schedule — it may be typed, handwritten, or a printout from their doctor or nutritionist. It could be a full 24-hour schedule or just a partial list of habits/timings.
CRITICAL FIRST STEP: Decide whether the input is genuinely someone's daily routine/schedule/plan (e.g. wake-up time, meal times, exercise, medication times, sleep time, any timed daily activity list) versus something unrelated (a random photo, a selfie, a lab report, an unreadable/blank image, or text with no actual schedule content).
- If it is NOT a daily routine/schedule, set isValidPlan to false, explain what was actually provided in rejectionReason, and leave sections empty.
- If it IS a genuine daily routine, set isValidPlan to true and extract EVERY distinct step into "sections", ordered chronologically by time of day. For each step: timeLabel is REQUIRED and must always be a clock time like "7:00 AM" — use the exact time if one is stated, otherwise infer the single most reasonable clock time from context (e.g. "morning walk" → "6:30 AM", "after lunch" → "1:30 PM", "before bed" → "10:00 PM") so that every step gets a real time and none are ever left blank. title is a short (3-8 word) name for the step; body is ONE short sentence (max ~12 words) describing what to do. Never invent steps that aren't in the source — only structure what's actually there, and never drop a step just because it lacked a stated time.
OUTPUT LENGTH IS STRICTLY LIMITED — a full day can have a dozen+ steps, so keep every title/body as brief as possible: prioritize including EVERY real step over writing a longer description for any one of them.
Call the record_daily_plan tool exactly once with the complete result.`;

    const parsed = await callGroqForJson({
      client: ai,
      system: systemInstruction,
      text: 'Please extract this daily routine/schedule into structured, time-ordered steps.',
      imageBase64: imageBase64.startsWith('data:') ? imageBase64 : `data:${mimeType};base64,${imageBase64}`,
      toolName: 'record_daily_plan',
      // Same free-tier ceiling as the report analyzer above (see
      // callGroqForJson) — this gets clamped to 1000 either way since it's
      // always a vision call, but declaring it here keeps the intent honest.
      maxTokens: 1000,
      inputSchema: {
        type: 'object',
        properties: {
          isValidPlan: { type: 'boolean', description: 'true only if the image/PDF is genuinely a daily routine, schedule, or timed habit list.' },
          rejectionReason: { type: ['string', 'null'], description: 'Required when isValidPlan is false — a short, specific description of what was actually provided instead.' },
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
              additionalProperties: false,
            },
          },
        },
        required: ['isValidPlan', 'rejectionReason', 'sections'],
        additionalProperties: false,
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
    // Belt-and-suspenders: the prompt asks Groq for a timeLabel on every
    // step, but if one still comes back empty, a step with no time falls out
    // of the visible timeline entirely on the client (it's treated as
    // untimed reference material instead) — so no step from the user's own
    // plan is ever silently dropped, spread any missing ones evenly across
    // a waking day (6 AM–10 PM) in the order Groq already returned them.
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
      await createActivityLog(supabase, user.id, 'uploaded', 'plan', 'Uploaded a custom daily plan', `${sections.length} steps extracted, active for 35 days`);
    }

    return res.json({
      isValidPlan: true,
      uploadedAt: uploadedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      sections,
    });
  } catch (error: any) {
    if (error instanceof PdfNotSupportedError) {
      return res.json({ isValidPlan: false, rejectionReason: 'PDF plans aren\'t supported right now — please upload a clear photo of your schedule instead.' });
    }
    console.error('Error analyzing daily plan with Groq:', error);
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
    // Pinned as the caller's own local date key (e.g. "2026-09-10", same
    // format toDateKey sends as `date`) rather than a server-clock
    // timestamp — toUtcDayNumber reads it back exactly, with nothing left
    // to a server-vs-client timezone mismatch. The write is fire-and-forget:
    // today's response can already use the value we just computed, it
    // doesn't need to wait for it to land in the DB — only a future
    // request does, and by then it'll have committed.
    let startedAt = hp?.program_started_at as string | undefined;
    if (!startedAt) {
      startedAt = date || new Date().toISOString().slice(0, 10);
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

// Custom plan steps — a user's OWN addition to their Daily Plan timeline
// (Plan tab → Edit → Add). Reviewed once here against their real conditions
// (health_profiles.existing_concerns) and recent lab findings (their own
// abnormal biomarkers), then stamped with a real verdict — never inserted
// unreviewed. This is the one place a Daily Plan write legitimately needs
// AI: there's no fixed rule for "is this specific custom activity/food safe
// for this specific person", unlike the deterministic condition-tag
// filtering everywhere else in this file.
app.post('/api/custom-plan-steps', requireUser(async (req, res, user) => {
  try {
    const { timeLabel, title, body } = req.body as { timeLabel?: string; title?: string; body?: string };
    if (!timeLabel?.trim() || !title?.trim()) {
      return res.status(400).json({ error: 'A time and title are required.' });
    }
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(503).json({ error: 'Database is not configured right now.' });
    const ai = getGroqClient();
    if (!ai) return res.status(503).json({ error: 'The safety check is not configured right now. Please try again later.' });

    const [{ data: hp }, { data: reports }] = await Promise.all([
      supabase.from('health_profiles').select('existing_concerns').eq('user_id', user.id).maybeSingle(),
      supabase.from('lab_reports').select('biomarkers').eq('user_id', user.id).order('uploaded_at', { ascending: false }).limit(2),
    ]);

    const conditions: string[] = (hp?.existing_concerns || []).filter((c: string) => c !== 'None');
    const abnormalBiomarkers = (reports || []).flatMap((r: any) =>
      (r.biomarkers || [])
        .filter((b: any) => b.status && b.status !== 'normal')
        .map((b: any) => `${b.name}: ${b.value} (${b.status}, ref ${b.referenceRange})`)
    );
    const contextLines = [
      conditions.length ? `Real medical conditions on file: ${conditions.join(', ')}.` : 'No medical conditions on file.',
      abnormalBiomarkers.length ? `Recent abnormal lab findings: ${abnormalBiomarkers.join('; ')}.` : 'No abnormal lab findings on file.',
    ].join(' ');

    const systemInstruction = `You are UrCare's clinical safety reviewer. A user is adding their OWN custom step to their personal daily reversal-plan timeline, alongside their existing doctor-designed built-in plan. Given their real medical conditions and recent lab findings below, decide whether THIS SPECIFIC addition is safe/appropriate for THIS person, or whether it conflicts with their real health data.
${contextLines}
Set verdict to "yellow" whenever the step is safe, neutral, or beneficial given their profile — including whenever there simply isn't enough real data on file to raise a concern (never invent a conflict that isn't actually supported by the conditions/findings above). Set verdict to "red" ONLY when the step genuinely conflicts with a real condition or lab finding on file (e.g. a high-sugar food/drink for someone with diabetes or high blood sugar, a high-sodium habit for someone with hypertension or kidney disease, an intense activity contraindicated by a real condition). Always give a short, specific, one-sentence reason either way — never a generic one. Call the record_step_review tool exactly once.`;

    const parsed = await callGroqForJson({
      client: ai,
      system: systemInstruction,
      text: `The user wants to add this step to their daily plan. Time: "${timeLabel}". Title: "${title}".${body ? ` Details: "${body}"` : ''}`,
      toolName: 'record_step_review',
      inputSchema: {
        type: 'object',
        properties: {
          verdict: { type: 'string', enum: ['yellow', 'red'] },
          reason: { type: 'string' },
        },
        required: ['verdict', 'reason'],
        additionalProperties: false,
      },
    });

    const verdict: 'yellow' | 'red' = parsed.verdict === 'red' ? 'red' : 'yellow';
    const reason = parsed.reason || (verdict === 'red'
      ? 'This may conflict with your health profile — check with your doctor before adding it.'
      : 'No conflict found with your current health profile.');

    const { data: inserted, error: insertError } = await supabase.from('custom_plan_steps').insert({
      user_id: user.id,
      time_label: timeLabel.trim(),
      title: title.trim(),
      body: body?.trim() || null,
      verdict,
      verdict_reason: reason,
    }).select().single();
    if (insertError) throw insertError;

    await createActivityLog(supabase, user.id, 'created', 'plan', `Added to Daily Plan: ${title.trim()}`, verdict === 'red' ? `⚠ ${reason}` : reason);

    return res.json({
      step: {
        id: inserted.id,
        timeLabel: inserted.time_label,
        title: inserted.title,
        body: inserted.body || '',
        verdict: inserted.verdict,
        verdictReason: inserted.verdict_reason,
        createdAt: inserted.created_at,
      },
    });
  } catch (error: any) {
    console.error('Error reviewing custom plan step:', error);
    return res.status(500).json({ error: 'Could not add this step right now. Please try again.' });
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

    await createActivityLog(supabase, user.id, 'created', 'order', `Placed an order — ₹${total ?? subtotal ?? 0}`, undefined, { orderId: order.id });
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
      await createActivityLog(supabase, user.id, 'uploaded', 'order', 'Uploaded payment receipt', `Order #${req.params.id}`, { orderId: req.params.id });
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
  await createActivityLog(
    supabase, userId, 'created', 'prescription',
    `Prescription issued by ${doctorName || 'the UrCare Clinical Team'}`,
    diagnosis || undefined,
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
      await createActivityLog(supabase, data.user_id, 'updated', 'order', `Order status changed to ${status}`, `Order #${id}`, { orderId: id, status });
    }
    if (paymentStatus) {
      await createNotification(supabase, data.user_id, 'order', `Payment ${paymentStatus} for your order`, `Order #${id}`, { orderId: id, paymentStatus });
      await createActivityLog(supabase, data.user_id, 'updated', 'order', `Payment marked ${paymentStatus}`, `Order #${id}`, { orderId: id, paymentStatus });
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
