import React, { useEffect, useState } from 'react';
import { Stethoscope, Plus, Trash2, RefreshCw, PhoneCall, X } from 'lucide-react';

type DoctorRow = {
  id: string;
  name: string;
  qualification?: string | null;
  specialization?: string | null;
  registration_number?: string | null;
  phone?: string | null;
  availability?: string | null;
  hospital_affiliation?: string | null;
  active: boolean;
};

const EMPTY = { name: '', qualification: '', specialization: '', registrationNumber: '', phone: '', availability: '', hospitalAffiliation: '' };

/** Admin: the doctors patients can call from the app's Doctor Hotline.
 *  Add, show/hide (active) or remove — saved in the `doctors` table. */
export const AdminDoctorsPanel: React.FC<{ adminFetch: (path: string, options?: RequestInit) => Promise<Response> }> = ({ adminFetch }) => {
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    adminFetch('/api/admin/doctors').then((r) => r.json()).then((d) => setDoctors(d.doctors || [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async () => {
    if (!form.name.trim()) { setError('Doctor name is required.'); return; }
    if (!form.phone.trim()) { setError('A phone number is required — patients call this number.'); return; }
    setSaving(true); setError(null);
    try {
      const res = await adminFetch('/api/admin/doctors', { method: 'POST', body: JSON.stringify(Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || undefined]))) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add the doctor.');
      setDoctors((prev) => [data.doctor, ...prev]);
      setForm(EMPTY); setIsFormOpen(false);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const toggle = async (doc: DoctorRow) => {
    const res = await adminFetch(`/api/admin/doctors/${doc.id}`, { method: 'PATCH', body: JSON.stringify({ active: !doc.active }) });
    if (res.ok) setDoctors((prev) => prev.map((d) => (d.id === doc.id ? { ...d, active: !d.active } : d)));
  };

  const remove = async (doc: DoctorRow) => {
    if (!window.confirm(`Remove ${doc.name} from the Doctor Hotline?`)) return;
    const res = await adminFetch(`/api/admin/doctors/${doc.id}`, { method: 'DELETE' });
    if (res.ok) setDoctors((prev) => prev.filter((d) => d.id !== doc.id));
  };

  const field = (key: keyof typeof EMPTY, label: string, placeholder: string, required = false) => (
    <label className="block">
      <span className="block text-[11px] font-bold text-zinc-600 mb-1">{label}{required && <span className="text-rose-500"> *</span>}</span>
      <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder}
        className="w-full p-2.5 rounded-xl border border-zinc-200 bg-white text-xs font-semibold text-zinc-900 focus:border-emerald-500 focus:outline-none" />
    </label>
  );

  return (
    <div className="p-5 rounded-3xl bg-white border border-zinc-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-zinc-950 flex items-center gap-2"><Stethoscope className="w-5 h-5 text-emerald-600" /> Doctors on the Hotline ({doctors.filter((d) => d.active).length} active)</h3>
          <p className="text-xs text-zinc-500">These doctors appear in the app's Doctor Hotline, with a Call button for patients.</p>
        </div>
        <button type="button" onClick={() => { setIsFormOpen((v) => !v); setError(null); }}
          className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shrink-0">
          {isFormOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {isFormOpen ? 'Cancel' : 'Add Doctor'}
        </button>
      </div>

      {isFormOpen && (
        <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {field('name', 'Full name', 'e.g. Dr. Aakarshak Saini', true)}
            {field('phone', 'Phone number patients will call', 'e.g. +91 98xxx xxxxx', true)}
            {field('qualification', 'Qualification', 'e.g. MBBS, MD (Medicine)')}
            {field('registrationNumber', 'Medical registration no. (NMC/State)', 'Shown to patients — required for telemedicine')}
            {field('specialization', 'Specialisation', 'e.g. Diabetes & Metabolic Health')}
            {field('availability', 'Available timings', 'e.g. Mon–Sat, 10 AM – 6 PM')}
            {field('hospitalAffiliation', 'Clinic / hospital', 'e.g. UrCare Clinic, Saharanpur')}
          </div>
          {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
          <button type="button" onClick={add} disabled={saving}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-60">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Save Doctor
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-zinc-500">Loading…</p>
      ) : doctors.length === 0 ? (
        <p className="text-xs text-zinc-500">No doctors yet — patients see "No doctors available right now". Add one above.</p>
      ) : (
        <div className="space-y-2">
          {doctors.map((doc) => (
            <div key={doc.id} className={`p-3 rounded-2xl border flex flex-wrap items-center gap-3 ${doc.active ? 'border-emerald-200 bg-emerald-50/40' : 'border-zinc-200 bg-zinc-50 opacity-70'}`}>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black text-zinc-950">{doc.name}{doc.qualification ? <span className="font-semibold text-zinc-500"> · {doc.qualification}</span> : null}</div>
                <div className="text-[11px] text-zinc-500">
                  {[doc.specialization, doc.availability, doc.registration_number ? `Reg. ${doc.registration_number}` : null].filter(Boolean).join(' · ') || '—'}
                </div>
                {doc.phone && <div className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 mt-0.5"><PhoneCall className="w-3 h-3" /> {doc.phone}</div>}
              </div>
              <button type="button" onClick={() => toggle(doc)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black cursor-pointer ${doc.active ? 'bg-emerald-600 text-white' : 'bg-white border border-zinc-200 text-zinc-600'}`}>
                {doc.active ? 'Shown to patients' : 'Hidden'}
              </button>
              <button type="button" onClick={() => remove(doc)} className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 cursor-pointer" title="Remove"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
