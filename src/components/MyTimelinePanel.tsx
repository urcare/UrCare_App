import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, GitCommit, FileText, ClipboardCheck, User, Target as TargetIcon, Pill,
  Package, Stethoscope, Utensils, History,
} from 'lucide-react';
import { ActivityLogEntry } from '../types';
import { getActivityLog } from '../utils/supabase';
import { useLanguage } from '../context/LanguageContext';

/** Per-action accent — mirrors GitHub's own commit-graph convention of one
 *  colored dot per kind of change, so the eye can scan the shape of a day
 *  ("mostly green edits, one purple upload") without reading every line. */
export const ACTION_META: Record<ActivityLogEntry['action'], { dot: string; chip: string; label: [string, string] }> = {
  created: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700', label: ['Created', 'बनाया'] },
  uploaded: { dot: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700', label: ['Uploaded', 'अपलोड'] },
  updated: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700', label: ['Updated', 'अपडेट'] },
  deleted: { dot: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700', label: ['Deleted', 'हटाया'] },
};

export const CATEGORY_META: Record<ActivityLogEntry['category'], { icon: React.ComponentType<{ className?: string }>; label: [string, string] }> = {
  report: { icon: FileText, label: ['Report', 'रिपोर्ट'] },
  plan: { icon: ClipboardCheck, label: ['Plan', 'योजना'] },
  profile: { icon: User, label: ['Profile', 'प्रोफ़ाइल'] },
  target: { icon: TargetIcon, label: ['Target', 'लक्ष्य'] },
  prescription: { icon: Pill, label: ['Prescription', 'प्रिस्क्रिप्शन'] },
  order: { icon: Package, label: ['Order', 'ऑर्डर'] },
  assessment: { icon: Stethoscope, label: ['Assessment', 'मूल्यांकन'] },
  meal: { icon: Utensils, label: ['Meal', 'भोजन'] },
};

/** "3h ago" / "2d ago" — same convention as NotificationsPanel's relativeTime. */
export function relativeTime(iso: string, tr: (en: string, hi: string) => string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return tr('Just now', 'अभी');
  if (mins < 60) return tr(`${mins}m ago`, `${mins} मिनट पहले`);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return tr(`${hours}h ago`, `${hours} घंटे पहले`);
  const days = Math.floor(hours / 24);
  if (days < 7) return tr(`${days}d ago`, `${days} दिन पहले`);
  return new Date(iso).toLocaleDateString();
}

/** Groups entries (already newest-first) into "Today" / "Yesterday" /
 *  "Mon, 8 Sep" day buckets — the same shape GitHub's commit history uses. */
function dayLabel(iso: string, tr: (en: string, hi: string) => string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  // Always carries the full date (day, month, year) — even "Today"/"Yesterday"
  // — so the header never leaves the actual calendar date ambiguous.
  const fullDate = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  if (diffDays === 0) return `${tr('Today', 'आज')} · ${fullDate}`;
  if (diffDays === 1) return `${tr('Yesterday', 'कल')} · ${fullDate}`;
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

interface MyTimelinePanelProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

/** "My Timeline" — a real, append-only audit trail of every meaningful
 *  thing this user has actually done (uploaded, edited, deleted) across
 *  the whole app, styled like a GitHub commit history: grouped by day,
 *  one connected dot per entry, colored by action, tagged by category.
 *  Nothing here is invented — every row is a real `activity_log` row
 *  written the moment the real action happened (see logActivity). */
export const MyTimelinePanel: React.FC<MyTimelinePanelProps> = ({ isOpen, onClose, userId }) => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);
  const [items, setItems] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!userId) return;
    setIsLoading(true);
    getActivityLog(userId, 200).then(setItems).finally(() => setIsLoading(false));
  }, [userId]);

  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen, refresh]);

  // Live refresh — any logActivity() call anywhere in the app dispatches
  // this, so a still-open timeline updates itself instead of going stale.
  useEffect(() => {
    if (!isOpen) return;
    const handler = () => refresh();
    window.addEventListener('urcare:activity-logged', handler);
    return () => window.removeEventListener('urcare:activity-logged', handler);
  }, [isOpen, refresh]);

  const groups = useMemo(() => {
    const out: { label: string; items: ActivityLogEntry[] }[] = [];
    for (const item of items) {
      const label = dayLabel(item.createdAt, tr);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(item);
      else out.push({ label, items: [item] });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `tr` closes over `language`, listed directly
  }, [items, language]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="relative w-full sm:max-w-lg max-h-[88vh] sm:max-h-[80vh] rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl flex flex-col text-left overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-100 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-zinc-950 text-white flex items-center justify-center shrink-0">
                    <GitCommit className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-zinc-950 leading-tight">{tr('My Timeline', 'मेरी टाइमलाइन')}</h2>
                    <p className="text-[11px] text-zinc-400 font-semibold">{tr('Every real change, in order', 'हर वास्तविक बदलाव, क्रम में')}</p>
                  </div>
                </div>
                <button type="button" onClick={onClose} className="p-1.5 rounded-full hover:bg-zinc-100 cursor-pointer shrink-0">
                  <X className="w-4 h-4 text-zinc-500" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 px-4 sm:px-5 py-3">
                {isLoading ? (
                  <div className="space-y-3 py-2">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-zinc-100 animate-pulse shrink-0" />
                        <div className="h-12 flex-1 rounded-xl bg-zinc-50 animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : items.length === 0 ? (
                  <div className="py-14 text-center">
                    <History className="w-8 h-8 text-zinc-300 mx-auto mb-2" strokeWidth={1.5} />
                    <p className="text-sm font-bold text-zinc-400">{tr('No activity yet', 'अभी तक कोई गतिविधि नहीं')}</p>
                    <p className="text-xs text-zinc-400 mt-1 max-w-[240px] mx-auto">
                      {tr('Every upload, edit and update you make will show up here, like a commit history.', 'आपका हर अपलोड, संपादन और अपडेट यहां कमिट हिस्ट्री की तरह दिखेगा।')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5 pb-3">
                    {groups.map((group) => (
                      <div key={group.label}>
                        <div className="sticky top-0 z-10 -mx-4 sm:-mx-5 px-4 sm:px-5 py-1.5 bg-white/95 backdrop-blur-sm">
                          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">{group.label}</span>
                        </div>
                        <div className="relative mt-1.5">
                          {/* Connecting line — the "commit graph" spine. */}
                          <div className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-zinc-100" aria-hidden="true" />
                          <div className="space-y-3">
                            {group.items.map((item) => {
                              const action = ACTION_META[item.action] || ACTION_META.updated;
                              const category = CATEGORY_META[item.category];
                              const CategoryIcon = category?.icon || GitCommit;
                              return (
                                <div key={item.id} className="relative pl-6 flex items-start gap-2.5">
                                  <span className={`absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-white ${action.dot}`} aria-hidden="true" />
                                  <div className="min-w-0 flex-1 flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-zinc-50 transition-colors">
                                    <div className="w-7 h-7 rounded-lg bg-zinc-50 text-zinc-400 flex items-center justify-center shrink-0 mt-0.5">
                                      <CategoryIcon className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="text-sm font-bold text-zinc-800 leading-snug">{item.title}</p>
                                        <span className="text-[10px] font-bold text-zinc-400 shrink-0 tabular-nums mt-0.5">{clockTime(item.createdAt)}</span>
                                      </div>
                                      {item.detail && <p className="text-xs text-zinc-500 mt-0.5">{item.detail}</p>}
                                      <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide ${action.chip}`}>
                                        {tr(...action.label)} · {category ? tr(...category.label) : item.category}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
