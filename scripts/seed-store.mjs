// Loads scripts/store-catalog.json into the live `products` table (upsert by
// id, so existing carts and orders keep pointing at the same products).
// Needs SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.
//   node scripts/seed-store.mjs           -> shows what would change
//   node scripts/seed-store.mjs --apply   -> writes it
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }),
);
const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env'); process.exit(1); }

const { products } = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'store-catalog.json'), 'utf8'));
const rows = products.map((p) => {
  const packs = (p.packs || []).map((pk) => ({ months: pk.months, price: pk.price, inStock: pk.inStock !== false, ...(pk.isDefault ? { isDefault: true } : {}) }));
  const inStockPacks = packs.filter((pk) => pk.inStock);
  const price = p.price ?? (inStockPacks[0] || packs[0]).price;
  const listing = { badge: p.badge || null, packs, ...(p.gallery?.length ? { gallery: p.gallery } : {}) };
  return {
    id: p.id, name: p.name, category: p.category, price, discount_price: price, image: p.image,
    description: p.description, benefits: p.benefits || [],
    nutrition_info: (p.badge || packs.length || p.gallery?.length) ? { listing } : null,
    in_stock: true, featured: false,
  };
});

for (const r of rows) console.log(`${r.id.padEnd(34)} ${r.category.padEnd(5)} ₹${String(r.price).padStart(6)}  ${r.name}`);
if (!process.argv.includes('--apply')) { console.log('\nDry run. Add --apply to write these rows.'); process.exit(0); }

const res = await fetch(`${url}/rest/v1/products?on_conflict=id`, {
  method: 'POST',
  headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify(rows),
});
if (!res.ok) { console.error('Upsert failed:', res.status, await res.text()); process.exit(1); }
console.log(`\nSaved ${rows.length} products.`);
