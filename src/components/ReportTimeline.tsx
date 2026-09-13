import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, History } from 'lucide-react';
import { ActivityLogEntry, MedicalReportAnalysis } from '../types';
import { getActivityLog } from '../utils/supabase';
import { useLanguage } from '../context/LanguageContext';
import { ACTION_META, dayLabel, clockTime } from './MyTimelinePanel';
import { ReportPhotoViewer } from './ReportPhotoViewer';

interface ReportTimelineProps {
  userId: string;
  /** The user's current live reports — used to resolve an "uploaded"/
   *  "updated" entry back to its real, still-existing record. */
  reports: MedicalReportAnalysis[];
  userName?: string;
  onReupload: () => void;
  onRequestDoctorReview?: () => void;
  onDelete?: (reportId?: string, reportName?: string) => void;
  onSaveReportText?: (reportId: string, reportName: string | undefined, newText: string) => Promise<void>;
}

/** Whether a timeline entry's report is still live — i.e. actually
 *  resolvable in the user's current report list, not just a historical
 *  snapshot. Used to gate delete/edit/doctor-review (only meaningful on a
 *  report that still exists) and to decide when to show the "no longer on
 *  file" banner. */
function isLiveEntry(entry: ActivityLogEntry, reports: MedicalReportAnalysis[]): boolean {
  const reportId = entry.data?.reportId as string | undefined;
  return entry.action !== 'deleted' && !!reportId && reports.some((r) => r.id === reportId);
}

/** What a timeline entry should open to when clicked — the live report if
 *  it still exists, or a full snapshot otherwise. A report's OWN "Deleted"
 *  entry always carries its own snapshot (captured the instant it was
 *  removed — see Dashboard's handleDeleteReport), but an earlier "Uploaded"/
 *  "Edited" entry for that same, now-deleted report has no snapshot of its
 *  own — so it falls back to that sibling deletion entry's snapshot
 *  (matched by the same reportId) instead of coming up empty. Never
 *  invents data: if no snapshot exists anywhere for this reportId (e.g. it
 *  was deleted before this feature existed), there's simply nothing to show. */
function resolveReport(
  entry: ActivityLogEntry,
  reports: MedicalReportAnalysis[],
  snapshotByReportId: Record<string, MedicalReportAnalysis>,
): MedicalReportAnalysis | undefined {
  const reportId = entry.data?.reportId as string | undefined;
  if (entry.action !== 'deleted' && reportId) {
    const found = reports.find((r) => r.id === reportId);
    if (found) return found;
  }
  if (entry.data?.reportSnapshot) {
    return entry.data.reportSnapshot as MedicalReportAnalysis;
  }
  if (reportId && snapshotByReportId[reportId]) {
    return snapshotByReportId[reportId];
  }
  return undefined;
}

/** "Report Timeline" — a dedicated, date/month/year-ordered history of
 *  every report this user has ever uploaded or deleted, lives only inside
 *  the Reports screen (not the general My Timeline, not the Tracker
 *  module). Every row is a real `activity_log` entry (category: 'report'),
 *  and clicking one opens the exact report it refers to — its real photo
 *  and extracted data — not a re-summarized guess. */
export const ReportTimeline: React.FC<ReportTimelineProps> = ({
  userId, reports, userName, onReupload, onRequestDoctorReview, onDelete, onSaveReportText,
}) => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);
  const [items, setItems] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openEntry, setOpenEntry] = useState<ActivityLogEntry | null>(null);

  const refresh = useCallback(() => {
    if (!userId) return;
    setIsLoading(true);
    getActivityLog(userId, 200)
      .then((list) => setItems(list.filter((e) => e.category === 'report')))
      .finally(() => setIsLoading(false));
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Any upload/edit/delete anywhere in the app fires this — keeps an
  // already-open timeline live instead of going stale.
  useEffect(() => {
    window.addEventListener('urcare:activity-logged', refresh);
    return () => window.removeEventListener('urcare:activity-logged', refresh);
  }, [refresh]);

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

  // Every deletion's own snapshot, indexed by reportId — so an earlier
  // "Uploaded"/"Edited" entry for that same (now-deleted) report can reuse
  // it too, instead of only the deletion entry itself being able to preview
  // that report's photo and data.
  const snapshotByReportId = useMemo(() => {
    const map: Record<string, MedicalReportAnalysis> = {};
    for (const item of items) {
      const reportId = item.data?.reportId as string | undefined;
      if (reportId && item.data?.reportSnapshot) map[reportId] = item.data.reportSnapshot as MedicalReportAnalysis;
    }
    return map;
  }, [items]);

  const openReport = openEntry ? resolveReport(openEntry, reports, snapshotByReportId) : undefined;
  const isOpenEntryLive = openEntry ? isLiveEntry(openEntry, reports) : false;

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-white border border-zinc-200 shadow-xs space-y-4">
      <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
        <motion.span
          className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 18 }}
        >
          <History className="w-4.5 h-4.5" />
        </motion.span>
        <div>
          <h3 className="text-sm font-black text-zinc-950 uppercase tracking-tight">
            {tr('Report Timeline', 'रिपोर्ट टाइमलाइन')}
          </h3>
          <p className="text-[11px] text-zinc-400 font-semibold">
            {tr('Every upload & deletion, date-wise — tap any entry to open it', 'हर अपलोड व डिलीट, दिनांकवार — किसी भी प्रविष्टि को खोलने के लिए टैप करें')}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3 py-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-100 animate-pulse shrink-0" />
              <div className="h-12 flex-1 rounded-xl bg-zinc-50 animate-pulse" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center">
          <FileText className="w-8 h-8 text-zinc-300 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-sm font-bold text-zinc-400">{tr('No report activity yet', 'अभी तक कोई रिपोर्ट गतिविधि नहीं')}</p>
          <p className="text-xs text-zinc-400 mt-1 max-w-[280px] mx-auto">
            {tr('Every report you upload or delete will show up here, in order, with the date, month and year.', 'आप जो भी रिपोर्ट अपलोड या डिलीट करेंगे, वह यहां दिनांक, महीने व वर्ष के साथ क्रम में दिखेगी।')}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">{group.label}</span>
              <div className="relative mt-2">
                {/* Connecting line — same "commit graph" spine as My Timeline. */}
                <div className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-zinc-100" aria-hidden="true" />
                <div className="space-y-1.5">
                  {group.items.map((item) => {
                    const action = ACTION_META[item.action] || ACTION_META.updated;
                    const canOpen = !!resolveReport(item, reports, snapshotByReportId);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setOpenEntry(item)}
                        className="w-full relative pl-6 flex items-start gap-2.5 text-left cursor-pointer group"
                      >
                        <span className={`absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-white ${action.dot}`} aria-hidden="true" />
                        <div className="min-w-0 flex-1 flex items-start justify-between gap-2.5 p-2.5 rounded-xl group-hover:bg-zinc-50 transition-colors">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-zinc-800 leading-snug truncate">{item.title}</p>
                            {item.detail && <p className="text-xs text-zinc-500 mt-0.5 truncate">{item.detail}</p>}
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide ${action.chip}`}>
                                {tr(...action.label)}
                              </span>
                              {!canOpen && (
                                <span className="text-[9px] font-bold text-zinc-300 uppercase tracking-wide">
                                  {tr('No preview', 'कोई पूर्वावलोकन नहीं')}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-zinc-400 shrink-0 tabular-nums mt-0.5">{clockTime(item.createdAt)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DETAIL MODAL — opens the exact report a clicked entry refers to:
          its real photo + extracted data, live if the report still exists,
          or the full snapshot taken the moment it was deleted. Delete/
          re-upload/edit actions only apply to a still-live report — a
          deleted one is shown strictly read-only, since acting on it again
          makes no sense. */}
      {createPortal(
        <AnimatePresence>
          {openEntry && (
            <>
              <motion.div
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                onClick={() => setOpenEntry(null)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setOpenEntry(null)}>
                <motion.div
                  onClick={(e) => e.stopPropagation()}
                  initial={{ opacity: 0, y: 24, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.98 }}
                  transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                  className="relative w-full sm:max-w-2xl max-h-[90vh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl bg-zinc-50 shadow-2xl flex flex-col text-left overflow-hidden"
                >
                  <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${(ACTION_META[openEntry.action] || ACTION_META.updated).dot}`} />
                      <div className="min-w-0">
                        <h2 className="text-sm font-black text-zinc-950 leading-tight truncate">{openEntry.title}</h2>
                        <p className="text-[11px] text-zinc-400 font-semibold">
                          {dayLabel(openEntry.createdAt, tr)} · {clockTime(openEntry.createdAt)}
                        </p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setOpenEntry(null)} className="p-1.5 rounded-full hover:bg-zinc-200 cursor-pointer shrink-0">
                      <X className="w-4 h-4 text-zinc-500" />
                    </button>
                  </div>

                  <div className="overflow-y-auto flex-1 px-4 sm:px-5 pb-5">
                    {!isOpenEntryLive && openReport && (
                      <div className="mb-3 px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] font-bold text-rose-700">
                        {tr('This report is no longer on file — shown exactly as it looked before it was deleted.', 'यह रिपोर्ट अब फाइल में नहीं है — डिलीट होने से पहले यह जैसी दिखती थी, वैसी ही दिखाई जा रही है।')}
                      </div>
                    )}
                    {openReport ? (
                      <ReportPhotoViewer
                        report={openReport}
                        onReupload={onReupload}
                        onRequestDoctorReview={isOpenEntryLive ? onRequestDoctorReview : undefined}
                        onDelete={isOpenEntryLive && openReport.id && onDelete ? () => onDelete(openReport.id, openReport.reportName) : undefined}
                        onSaveReportText={
                          isOpenEntryLive && openReport.id && onSaveReportText
                            ? (text) => onSaveReportText(openReport.id!, openReport.reportName, text)
                            : undefined
                        }
                        userName={userName}
                        theme="light"
                      />
                    ) : (
                      <div className="py-10 text-center">
                        <FileText className="w-8 h-8 text-zinc-300 mx-auto mb-2" strokeWidth={1.5} />
                        <p className="text-sm font-bold text-zinc-400">{tr('No preview available for this entry', 'इस प्रविष्टि के लिए कोई पूर्वावलोकन उपलब्ध नहीं')}</p>
                        {openEntry.detail && <p className="text-xs text-zinc-400 mt-1">{openEntry.detail}</p>}
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
