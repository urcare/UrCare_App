import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { GitCommit, ChevronRight } from 'lucide-react';
import { MagicCard } from './magicui/magic-card';
import { MyTimelinePanel, ACTION_META, CATEGORY_META, relativeTime } from './MyTimelinePanel';
import { getActivityLog } from '../utils/supabase';
import { ActivityLogEntry } from '../types';

/** My Timeline card (in My Reports): the 3 most recent things the user did in
 *  the app, live-refreshed; "View all" opens the full history. */
export const MyTimelineCard: React.FC<{ userId: string; tr: (en: string, hi: string) => string }> = ({ userId, tr }) => {
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [recentActivity, setRecentActivity] = useState<ActivityLogEntry[]>([]);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const loadRecent = () => getActivityLog(userId, 3).then((list) => { if (!cancelled) setRecentActivity(list); });
    loadRecent();
    window.addEventListener('urcare:activity-logged', loadRecent);
    window.addEventListener('urcare:refresh', loadRecent);
    return () => { cancelled = true; window.removeEventListener('urcare:activity-logged', loadRecent); window.removeEventListener('urcare:refresh', loadRecent); };
  }, [userId]);

  return (
    <>
      <MagicCard className="rounded-2xl shadow-depth" gradientSize={240} gradientColor="#ede9fe" gradientOpacity={0.6} gradientFrom="#16a34a" gradientTo="#10b981">
      <motion.button
        type="button"
        onClick={() => setIsTimelineOpen(true)}
        whileTap={{ scale: 0.99 }}
        className="group w-full p-4 sm:p-5 rounded-2xl bg-transparent text-left cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/25">
            <GitCommit className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black text-zinc-950">{tr('My Timeline', 'मेरी टाइमलाइन')}</h2>
            <p className="text-[11px] text-zinc-500 font-semibold">{tr('Everything you have added or changed', 'आपने जो कुछ जोड़ा या बदला')}</p>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-black group-hover:bg-emerald-100 transition-colors">
            {tr('View all', 'सभी देखें')}
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>

        {recentActivity.length === 0 ? (
          <div className="mt-4 p-4 rounded-2xl bg-zinc-50/80 border border-dashed border-zinc-200 text-center">
            <p className="text-xs font-semibold text-zinc-500">{tr('No activity yet — your uploads and edits will show up here.', 'अभी तक कोई गतिविधि नहीं — आपके अपलोड व संपादन यहां दिखेंगे।')}</p>
          </div>
        ) : (
          <ol className="mt-4 space-y-3">
            {recentActivity.map((item, i) => {
              const action = ACTION_META[item.action];
              const category = CATEGORY_META[item.category];
              const CategoryIcon = category?.icon || GitCommit;
              const isLast = i === recentActivity.length - 1;
              return (
                <li key={item.id} className="relative flex items-start gap-3">
                  {/* the line that joins one event to the next */}
                  {!isLast && <span className="absolute left-[17px] top-9 -bottom-3 w-px bg-gradient-to-b from-zinc-200 to-transparent" aria-hidden="true" />}
                  <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${action?.chip || 'bg-zinc-50 text-zinc-500'}`}>
                    <CategoryIcon className="w-4 h-4" />
                    <span className={`absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${action?.dot || 'bg-zinc-300'}`} />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-xs font-bold text-zinc-900 truncate">{item.title}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-semibold text-zinc-400">
                      {action && <span className={`px-1.5 py-0.5 rounded-md font-black ${action.chip}`}>{tr(action.label[0], action.label[1])}</span>}
                      {category && <span>{tr(category.label[0], category.label[1])}</span>}
                      <span>·</span>
                      <span>{relativeTime(item.createdAt, tr)}</span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </motion.button>
      </MagicCard>
      <MyTimelinePanel isOpen={isTimelineOpen} onClose={() => setIsTimelineOpen(false)} userId={userId} />
    </>
  );
};
