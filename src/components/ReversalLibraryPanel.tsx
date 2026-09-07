import React, { useMemo, useState } from 'react';
import { FileText, ChevronDown, Search, X } from 'lucide-react';

/** One row of the static reversal-plan content (see reversal_plan_sections in
 *  the DB). A row with no timeLabel is reference material, not a scheduled
 *  step — that's what this panel renders. */
export interface PlanSection {
  id: string;
  timeLabel: string | null;
  title: string;
  body: string;
}

/** Groups the reference library into readable categories, purely from the id
 *  prefix each row was seeded with — no extra DB column needed. Keep this in
 *  sync if new id prefixes are added to the seed data. */
function categoryFor(id: string): string {
  if (id.startsWith('p1-ref-')) return 'Herbal Reference by Condition';
  if (id.startsWith('p3-vit-')) return 'Vitamins';
  if (id.startsWith('p3-min-')) return 'Minerals';
  if (id.startsWith('p3-supp-')) return 'Therapeutic Supplements';
  if (id.startsWith('p3-meal-')) return 'Enhanced Meal Plans';
  if (id.startsWith('p4-b')) return 'Breakfast Recipes';
  if (id.startsWith('p4-l')) return 'Lunch Recipes';
  if (id === 'p4-formula' || id === 'p4-shopping-list') return 'Meal List Basics';
  if (id.startsWith('p1-advanced-exercise-')) return 'Advanced Exercise Plans';
  if (id.startsWith('p1-advanced-')) return 'Advanced Therapies';
  if (id.startsWith('p1-intensive-')) return 'Intensive Add-On Plans';
  if (id.startsWith('p1-diet-mod-')) return 'Condition-Specific Diet';
  if (id === 'p1-troubleshoot-guide' || id === 'p1-safety-reminders' || id === 'p1-supplement-schedule') {
    return 'Help, Safety & Quick Reference';
  }
  return 'Other';
}

const CATEGORY_ORDER = [
  'Herbal Reference by Condition',
  'Condition-Specific Diet',
  'Intensive Add-On Plans',
  'Advanced Exercise Plans',
  'Advanced Therapies',
  'Vitamins',
  'Minerals',
  'Therapeutic Supplements',
  'Enhanced Meal Plans',
  'Meal List Basics',
  'Breakfast Recipes',
  'Lunch Recipes',
  'Help, Safety & Quick Reference',
  'Other',
];

function useToggleSet(): [Set<string>, (id: string) => void] {
  const [set, setSet] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSet((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return [set, toggle];
}

interface ReversalLibraryPanelProps {
  /** Non-time-labeled rows only (see RecommendationsView's referenceSections). */
  sections: PlanSection[];
  isDark?: boolean;
}

/** A self-contained, always-visible reference card — condition-specific
 *  herbal notes, vitamins, recipes and the rest of the reversal library —
 *  meant to sit statically in a sidebar next to (not inside) the daily plan,
 *  so it's always in view without needing a menu to reach it. */
export const ReversalLibraryPanel: React.FC<ReversalLibraryPanelProps> = ({ sections, isDark = false }) => {
  const [refSearch, setRefSearch] = useState('');
  const [expandedCategories, toggleCategory] = useToggleSet();
  const [expandedItems, toggleItem] = useToggleSet();

  const cardClass = isDark ? 'bg-zinc-950 border border-zinc-800' : 'bg-white border border-zinc-200 shadow-sm';
  const subCardClass = isDark ? 'bg-zinc-900/70 border border-zinc-800' : 'bg-zinc-50 border border-zinc-200';

  const search = refSearch.trim().toLowerCase();
  const referenceByCategory = useMemo(() => {
    const map = new Map<string, PlanSection[]>();
    for (const s of sections) {
      if (search && !s.title.toLowerCase().includes(search) && !s.body.toLowerCase().includes(search)) continue;
      const cat = categoryFor(s.id);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    }
    return CATEGORY_ORDER
      .filter((cat) => map.has(cat))
      .map((cat) => ({ category: cat, items: map.get(cat)! }));
  }, [sections, search]);

  if (sections.length === 0) return null;

  return (
    <div className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl ${cardClass} space-y-4 min-w-0`}>
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40 flex-wrap gap-2">
        <div className="flex items-center gap-2 text-emerald-500 min-w-0">
          <FileText className="w-5 h-5 shrink-0" />
          <h3 className="text-sm font-black tracking-tight truncate">Your Reversal Library</h3>
        </div>
        <span className="text-[10px] font-bold opacity-50 shrink-0">{sections.length} items</span>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
        <input
          type="text"
          value={refSearch}
          onChange={(e) => setRefSearch(e.target.value)}
          placeholder="Search recipes, herbs, vitamins…"
          className={`w-full pl-9 pr-9 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/40 ${subCardClass} ${isDark ? 'placeholder:text-zinc-500' : 'placeholder:text-zinc-400'}`}
        />
        {refSearch && (
          <button type="button" onClick={() => setRefSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-90 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {referenceByCategory.length === 0 ? (
        <p className="text-xs opacity-60 text-center py-4">No matches for "{refSearch}".</p>
      ) : (
        <div className="space-y-2">
          {referenceByCategory.map(({ category, items }) => {
            const catOpen = !!search || expandedCategories.has(category);
            return (
              <div key={category} className={`rounded-xl sm:rounded-2xl border overflow-hidden ${subCardClass}`}>
                <button
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center gap-2 px-3.5 py-3 text-left cursor-pointer"
                >
                  <span className="text-xs font-black flex-1 min-w-0 truncate">{category}</span>
                  <span className="text-[10px] font-bold opacity-50 shrink-0">{items.length}</span>
                  <ChevronDown className={`w-4 h-4 opacity-40 shrink-0 transition-transform ${catOpen ? 'rotate-180' : ''}`} />
                </button>
                {catOpen && (
                  <div className={`px-2.5 sm:px-3 pb-2.5 sm:pb-3 space-y-2 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                    {items.map((section) => {
                      const open = expandedItems.has(section.id);
                      return (
                        <div key={section.id} className={`rounded-xl border overflow-hidden mt-2.5 ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                          <button
                            type="button"
                            onClick={() => toggleItem(section.id)}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-left cursor-pointer"
                          >
                            <span className="text-xs font-bold flex-1 min-w-0 break-words">{section.title}</span>
                            <ChevronDown className={`w-3.5 h-3.5 opacity-40 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                          </button>
                          {open && (
                            <p className={`text-xs leading-relaxed whitespace-pre-line break-words px-3 pb-3 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                              {section.body}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
