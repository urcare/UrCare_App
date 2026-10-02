import React, { useState } from 'react';
import { X, Plus, Trash2, Save, RefreshCw, Clock } from 'lucide-react';
import { UploadedPlan } from '../utils/supabase';

/** "7:30 AM" → "07:30" for an <input type="time">; '' if unreadable. */
function toTimeInput(label: string | null): string {
  const m = (label || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return '';
  let h = parseInt(m[1], 10) % 12;
  if (/PM/i.test(m[3])) h += 12;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

/** "07:30" → "7:30 AM". */
function fromTimeInput(value: string): string {
  const [hStr, mStr] = value.split(':');
  const h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return '';
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${mStr} ${suffix}`;
}

type Row = { key: string; time: string; title: string; body: string };

interface UploadedPlanEditorProps {
  plan: UploadedPlan;
  isDark: boolean;
  tr: (en: string, hi: string) => string;
  onClose: () => void;
  /** Resolves with an error message, or nothing on success. */
  onSave: (sections: { timeLabel: string; title: string; body: string }[]) => Promise<string | undefined>;
}

/** Edit the steps of the user's own uploaded plan — change a time, title or
 *  details, remove a step, or add one. Only this uploaded plan changes; the
 *  UrCare plan is never touched from here. */
export const UploadedPlanEditor: React.FC<UploadedPlanEditorProps> = ({ plan, isDark, tr, onClose, onSave }) => {
  const [rows, setRows] = useState<Row[]>(() => plan.sections.map((s, i) => ({
    key: `${s.id}_${i}`, time: toTimeInput(s.timeLabel), title: s.title, body: s.body,
  })));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: string, patch: Partial<Row>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key));
  const add = () => setRows((prev) => [...prev, { key: `new_${Date.now()}`, time: '', title: '', body: '' }]);

  const handleSave = async () => {
    const filled = rows.filter((r) => r.title.trim());
    if (filled.length === 0) {
      setError(tr('Add at least one step with a name. To remove the whole plan, use "Delete plan" instead.', 'कम से कम एक step का नाम लिखें। पूरा प्लान हटाने के लिए "प्लान डिलीट करें" का उपयोग करें।'));
      return;
    }
    if (filled.some((r) => !r.time)) {
      setError(tr('Every step needs a time.', 'हर step का समय भरना ज़रूरी है।'));
      return;
    }
    setIsSaving(true);
    setError(null);
    const err = await onSave(filled.map((r) => ({ timeLabel: fromTimeInput(r.time), title: r.title.trim(), body: r.body.trim() })));
    setIsSaving(false);
    if (err) setError(err);
  };

  const inputClass = `w-full rounded-xl border px-3 py-2 text-sm font-medium focus:outline-none focus:border-emerald-500 ${
    isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'
  }`;

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className={`w-full sm:max-w-2xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl shadow-2xl ${isDark ? 'bg-zinc-950 text-white' : 'bg-white text-zinc-900'}`}>
        <div className={`p-4 sm:p-5 border-b flex items-start justify-between gap-3 ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
          <div>
            <h3 className="text-lg font-black">{tr('Edit my uploaded plan', 'मेरा अपलोड किया प्लान बदलें')}</h3>
            <p className="text-xs opacity-60 mt-0.5">
              {tr('Change any time, name or details, remove a step, or add a new one. Your UrCare plan is not affected.', 'कोई भी समय, नाम या जानकारी बदलें, step हटाएँ या नया जोड़ें। आपके UrCare प्लान पर कोई असर नहीं पड़ेगा।')}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full opacity-60 hover:opacity-100 cursor-pointer" aria-label={tr('Close', 'बंद करें')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {rows.map((row, index) => (
            <div key={row.key} className={`p-3 rounded-2xl border space-y-2 ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-zinc-50'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider opacity-50">{tr('Step', 'Step')} {index + 1}</span>
                <button
                  type="button"
                  onClick={() => remove(row.key)}
                  className="text-[11px] font-bold text-rose-500 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-rose-500/10 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> {tr('Remove', 'हटाएँ')}
                </button>
              </div>
              <div className="grid grid-cols-[7.5rem_1fr] gap-2">
                <label className="relative">
                  <Clock className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
                  <input
                    type="time"
                    value={row.time}
                    onChange={(e) => update(row.key, { time: e.target.value })}
                    className={`${inputClass} pl-7`}
                    aria-label={tr('Time', 'समय')}
                  />
                </label>
                <input
                  type="text"
                  value={row.title}
                  onChange={(e) => update(row.key, { title: e.target.value })}
                  placeholder={tr('What to do (e.g. Morning walk)', 'क्या करना है (जैसे सुबह की सैर)')}
                  className={inputClass}
                />
              </div>
              <textarea
                value={row.body}
                onChange={(e) => update(row.key, { body: e.target.value })}
                rows={2}
                placeholder={tr('Details (optional)', 'जानकारी (वैकल्पिक)')}
                className={`${inputClass} resize-y`}
              />
            </div>
          ))}

          <button
            type="button"
            onClick={add}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-emerald-400/60 text-emerald-600 text-sm font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-500/5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> {tr('Add a step', 'नया step जोड़ें')}
          </button>
        </div>

        <div className={`p-4 sm:p-5 border-t space-y-2 ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
          {error && <p className="text-xs font-bold text-rose-500">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className={`flex-1 py-3 rounded-2xl font-bold text-sm cursor-pointer ${isDark ? 'bg-zinc-900 text-zinc-300' : 'bg-zinc-100 text-zinc-700'}`}
            >
              {tr('Cancel', 'रद्द करें')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {tr('Save changes', 'बदलाव सेव करें')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
