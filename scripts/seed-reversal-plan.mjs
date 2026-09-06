// One-time/idempotent seed for the static reversal-plan content.
// Usage: node scripts/seed-reversal-plan.mjs
// Requires supabase/patches.sql (the reversal_plan_sections table) to have
// been run in the Supabase SQL Editor first.
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    if (!line.includes('=') || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim().replace(/\r$/, '').replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
  return env;
}

async function main() {
  const env = loadEnv();
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const seedPath = path.join(__dirname, 'reversal-plan-seed.json');
  const rows = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

  const { error: probeError } = await supabase.from('reversal_plan_sections').select('id').limit(1);
  if (probeError) {
    console.error('Could not read reversal_plan_sections — has the SQL patch been run yet?');
    console.error(probeError.message);
    process.exit(1);
  }

  const { error } = await supabase.from('reversal_plan_sections').upsert(rows, { onConflict: 'id' });
  if (error) {
    console.error('Seed failed:', error.message);
    process.exit(1);
  }

  console.log(`Seeded ${rows.length} reversal_plan_sections rows.`);
}

main();
