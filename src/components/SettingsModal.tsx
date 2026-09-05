import React, { useState } from 'react';
import { X, Database, ShieldCheck, User, RefreshCw, LogOut, CheckCircle2, Sliders, Scale, Trash2 } from 'lucide-react';
import { UserHealthProfile, UserAccount } from '../types';
import { upsertProfile } from '../utils/supabase';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserHealthProfile;
  account: UserAccount;
  onUpdateWeight: (newWeight: number) => void;
  onResetOnboarding: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  account,
  onUpdateWeight,
  onResetOnboarding,
}) => {
  const [weightInput, setWeightInput] = useState(profile.currentWeightKg.toString());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSaveWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(weightInput);
    if (!isNaN(val) && val > 30 && val < 250) {
      onUpdateWeight(val);
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 2000);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await upsertProfile(account.uid, profile);
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div id="settings-modal-backdrop" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div id="settings-modal" className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl p-6 text-white shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-zinc-800 text-emerald-400 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Account & App Settings</h3>
              <p className="text-xs text-zinc-400">Database sync & profile metrics</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User profile card */}
        <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-400 text-black font-extrabold flex items-center justify-center text-sm">
              {account.displayName ? account.displayName[0].toUpperCase() : 'C'}
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">{account.displayName}</h4>
              <p className="text-xs text-zinc-400">{account.email}</p>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Firebase Auth
          </span>
        </div>

        {/* Database & Cloud Sync Status (Supabase & Firebase) */}
        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-emerald-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">Database Sync (Supabase & Firebase)</h4>
            </div>
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Live & Connected</span>
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            User registration and daily logs are stored in Firebase & Supabase schema table <code className="text-emerald-300">user_profiles</code>.
          </p>
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="w-full py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing to Cloud...' : syncSuccess ? 'Synced Successfully!' : 'Sync Now to Supabase'}</span>
          </button>
        </div>

        {/* Update Current Weight */}
        <form onSubmit={handleSaveWeight} className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-emerald-400" />
              <span>Update Today's Body Weight (kg):</span>
            </label>
            <span className="text-xs text-zinc-400">Target: {profile.targetWeightKg} kg</span>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              className="flex-1 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-sm text-white"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl transition-colors"
            >
              Update
            </button>
          </div>
        </form>

        {/* Retake Onboarding Flow */}
        <div className="pt-2 border-t border-zinc-800 space-y-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onResetOnboarding();
            }}
            className="w-full py-3 rounded-xl border border-rose-500/30 hover:bg-rose-950/20 text-rose-300 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retake UrCare Onboarding Flow</span>
          </button>
        </div>

      </div>
    </div>
  );
};
