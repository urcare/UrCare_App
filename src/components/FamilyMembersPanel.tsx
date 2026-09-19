import React, { useEffect, useState } from 'react';
import { Users, Plus, Trash2, Edit3, X, Check, RefreshCw } from 'lucide-react';
import { FamilyMember } from '../types';
import { getFamilyMembers, addFamilyMember, updateFamilyMember, deleteFamilyMember } from '../utils/supabase';

interface FamilyMembersPanelProps {
  tr: (en: string, hi: string) => string;
}

const RELATIONS: { value: FamilyMember['relation']; label: [string, string] }[] = [
  { value: 'spouse', label: ['Spouse', 'जीवनसाथी'] },
  { value: 'child', label: ['Child', 'बच्चा'] },
  { value: 'parent', label: ['Parent', 'माता-पिता'] },
  { value: 'sibling', label: ['Sibling', 'भाई-बहन'] },
  { value: 'other', label: ['Other', 'अन्य'] },
];

const RELATION_LABEL: Record<string, [string, string]> = Object.fromEntries(RELATIONS.map((r) => [r.value, r.label]));

interface FormState {
  name: string;
  relation: FamilyMember['relation'];
  age: string;
  gender: string;
  conditionsText: string;
}

const EMPTY_FORM: FormState = { name: '', relation: 'child', age: '', gender: '', conditionsText: '' };

/** Lets the primary account add dependents (a spouse, child, parent...) with
 *  no login of their own — under the hood each one is a real but
 *  login-disabled account (see family_members in supabase/patches.sql), so
 *  they get their own Daily Plan and Tracker (via a "Viewing as" switcher on
 *  those two screens) and can be given files/a personalized plan from the
 *  admin panel exactly like the primary account, without ever signing in
 *  themselves. */
export const FamilyMembersPanel: React.FC<FamilyMembersPanelProps> = ({ tr }) => {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setIsLoading(true);
    getFamilyMembers().then((m) => { setMembers(m); setIsLoading(false); });
  };

  useEffect(() => { reload(); }, []);

  const openAddForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setIsFormOpen(true);
  };

  const openEditForm = (m: FamilyMember) => {
    setEditingId(m.id);
    setForm({ name: m.name, relation: m.relation, age: m.age ? String(m.age) : '', gender: m.gender || '', conditionsText: (m.conditions || []).join(', ') });
    setError(null);
    setIsFormOpen(true);
  };

  const closeForm = () => { setIsFormOpen(false); setEditingId(null); setForm(EMPTY_FORM); setError(null); };

  const handleSave = async () => {
    if (!form.name.trim()) { setError(tr('A name is required.', 'नाम आवश्यक है।')); return; }
    setIsSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      relation: form.relation,
      age: form.age ? Number(form.age) : null,
      gender: form.gender || null,
      conditions: form.conditionsText.split(',').map((c) => c.trim()).filter(Boolean),
    };
    const result = editingId ? await updateFamilyMember(editingId, payload) : await addFamilyMember(payload);
    setIsSaving(false);
    if (result.error) { setError(result.error); return; }
    closeForm();
    reload();
  };

  const handleDelete = async (m: FamilyMember) => {
    if (!window.confirm(tr(`Remove ${m.name} and all their data? This can't be undone.`, `${m.name} व उनका सारा डेटा हटाएं? यह वापस नहीं लिया जा सकता।`))) return;
    await deleteFamilyMember(m.id);
    reload();
  };

  return (
    <div className="rounded-3xl bg-white border border-zinc-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Users className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-zinc-900">{tr('Family Members', 'परिवार के सदस्य')}</h3>
            <p className="text-[11px] text-zinc-500">{tr('Manage a Daily Plan & Tracker for your family — no separate login needed.', 'अपने परिवार के लिए डेली प्लान व ट्रैकर प्रबंधित करें — अलग लॉगिन की ज़रूरत नहीं।')}</p>
          </div>
        </div>
        {!isFormOpen && (
          <button
            type="button"
            onClick={openAddForm}
            className="shrink-0 w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-zinc-400">{tr('Loading...', 'लोड हो रहा है...')}</p>
      ) : members.length === 0 && !isFormOpen ? (
        <p className="text-xs text-zinc-500">{tr('No family members added yet.', 'अभी तक कोई परिवार सदस्य नहीं जोड़ा गया।')}</p>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 border border-zinc-200">
              <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-xs shrink-0">
                {m.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-zinc-900 truncate">{m.name}</div>
                <div className="text-[11px] text-zinc-500 flex items-center gap-1.5 flex-wrap">
                  <span>{tr(...(RELATION_LABEL[m.relation] || RELATION_LABEL.other))}</span>
                  {m.age && <><span>·</span><span>{m.age} {tr('yrs', 'वर्ष')}</span></>}
                  {m.gender && <><span>·</span><span className="capitalize">{m.gender}</span></>}
                </div>
                {m.conditions?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {m.conditions.map((c, i) => (
                      <span key={i} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">{c}</span>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => openEditForm(m)} className="shrink-0 p-1.5 rounded-lg text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 cursor-pointer">
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => handleDelete(m)} className="shrink-0 p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {isFormOpen && (
        <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              placeholder={tr('Name', 'नाम')}
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-bold text-zinc-900 placeholder:text-zinc-400 placeholder:font-medium focus:outline-none focus:border-emerald-600"
            />
            <select
              value={form.relation}
              onChange={(e) => setForm((p) => ({ ...p, relation: e.target.value as FamilyMember['relation'] }))}
              className="px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-bold text-zinc-900 focus:outline-none focus:border-emerald-600"
            >
              {RELATIONS.map((r) => (
                <option key={r.value} value={r.value}>{tr(...r.label)}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder={tr('Age', 'उम्र')}
              value={form.age}
              onChange={(e) => setForm((p) => ({ ...p, age: e.target.value }))}
              className="px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-bold text-zinc-900 placeholder:text-zinc-400 placeholder:font-medium focus:outline-none focus:border-emerald-600"
            />
            <input
              type="text"
              placeholder={tr('Gender', 'लिंग')}
              value={form.gender}
              onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}
              className="px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-bold text-zinc-900 placeholder:text-zinc-400 placeholder:font-medium focus:outline-none focus:border-emerald-600"
            />
          </div>
          <input
            type="text"
            placeholder={tr('Health conditions, comma separated (optional)', 'स्वास्थ्य स्थितियां, कॉमा से अलग (वैकल्पिक)')}
            value={form.conditionsText}
            onChange={(e) => setForm((p) => ({ ...p, conditionsText: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-emerald-600"
          />
          {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>{editingId ? tr('Save Changes', 'बदलाव सहेजें') : tr('Add Family Member', 'परिवार सदस्य जोड़ें')}</span>
            </button>
            <button type="button" onClick={closeForm} className="px-4 py-2.5 rounded-xl bg-white border border-zinc-200 text-zinc-600 text-xs font-bold cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
