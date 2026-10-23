import React, { useEffect, useState } from 'react';
import { ShoppingBag, ChevronRight } from 'lucide-react';
import { Product } from '../types';
import { getProducts } from '../utils/supabase';

/** Shop products that fit a plan step. A step that names a product gets that
 *  product; a medicine/supplement step for a condition gets the UrCare
 *  product made for that condition. */
const BY_NAME: [RegExp, string][] = [
  [/pancre\s*re\s*viv/i, 'prod_pancrereviv'],
  [/beta\s*re\s*viv/i, 'prod_betareviv'],
  [/gluco\s*low/i, 'prod_glucolow'],
  [/cardiol/i, 'prod_cardiol'],
  [/re\s*nerve/i, 'prod_renerve_h2t'],
  [/kidney\s*protector/i, 'prod_kidney_protector3'],
  [/lv\s*re\s*verse/i, 'prod_lv_reverse_max'],
  [/nutri\s*absorb/i, 'prod_nutriabsorb_max'],
];
const BY_CONDITION: [RegExp, string][] = [
  [/neuropath|nerve|numb|tingl/i, 'prod_renerve_h2t'],
  [/heart|hypertension|blood pressure|cholesterol|cardi/i, 'prod_cardiol'],
  [/kidney|creatinine|renal/i, 'prod_kidney_protector3'],
  [/fatty liver|liver/i, 'prod_lv_reverse_max'],
  [/fatigue|weakness|malabsor|appetite/i, 'prod_nutriabsorb_max'],
];
const IS_MEDICINE = /medicine|supplement|tablet|capsule|churna|vati|guggul|herbal|syrup|dose|\bmg\b|tablespoon|ayurved/i;

export function productIdsForStep(title: string, body = ''): string[] {
  const text = `${title}\n${body}`;
  const ids: string[] = [];
  const add = (id: string) => { if (!ids.includes(id)) ids.push(id); };
  BY_NAME.forEach(([re, id]) => { if (re.test(text)) add(id); });
  if (IS_MEDICINE.test(text)) BY_CONDITION.forEach(([re, id]) => { if (re.test(title)) add(id); });
  return ids.slice(0, 2);
}

// One product list for every plan step on the page.
let cache: Promise<Product[]> | null = null;
const loadProducts = () => (cache ||= getProducts().catch(() => { cache = null; return []; }));

export const PlanProductSuggest: React.FC<{ title: string; body?: string; isDark?: boolean; tr: (en: string, hi: string) => string }> = ({ title, body, isDark, tr }) => {
  const ids = productIdsForStep(title, body);
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    if (!ids.length) return;
    let alive = true;
    loadProducts().then((list) => { if (alive) setProducts(list); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')]);

  const picks = ids.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[];
  if (!picks.length) return null;

  return (
    <div className="pt-1 space-y-1.5">
      <div className={`text-[10px] font-black uppercase tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
        {tr('UrCare product for this step', 'इस स्टेप के लिए UrCare प्रोडक्ट')}
      </div>
      {picks.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('urcare:open-product', { detail: p.id })); }}
          className={`plan-product w-full flex items-center gap-3 p-2 rounded-xl border text-left cursor-pointer transition active:scale-[0.99] ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-emerald-100 hover:border-emerald-300 shadow-sm'}`}
        >
          <img src={p.image} alt="" loading="lazy" className="w-12 h-12 rounded-lg object-contain bg-emerald-50 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className={`block text-[13px] font-black truncate ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>{p.name}</span>
            <span className={`block text-[11px] font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>₹{(p.discountPrice || p.price).toLocaleString('en-IN')} · {tr('Free delivery', 'फ्री डिलीवरी')}</span>
          </span>
          <span className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-700 text-white text-[11px] font-black">
            <ShoppingBag className="w-3.5 h-3.5" />{tr('Shop Now', 'अभी खरीदें')}<ChevronRight className="w-3 h-3" />
          </span>
        </button>
      ))}
    </div>
  );
};
