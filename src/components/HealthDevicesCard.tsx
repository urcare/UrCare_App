import React, { useState } from 'react';
import { siApple, siAndroid, siFitbit, siGarmin, siSamsung, siXiaomi, siWearos, siHuawei, siBoat, siStrava } from 'simple-icons';
import { Watch, Bell, Check } from 'lucide-react';

/** Wearables & health apps. None are connected yet — every one is shown as
 *  "Coming soon", and the member can ask to be told when theirs is ready. */
const DEVICES: { key: string; name: string; note: [string, string]; icon: { path: string; hex: string } }[] = [
  { key: 'apple', name: 'Apple Health', note: ['iPhone & Apple Watch', 'iPhone व Apple Watch'], icon: siApple },
  { key: 'health-connect', name: 'Health Connect', note: ['Android (Google)', 'Android (Google)'], icon: siAndroid },
  { key: 'samsung', name: 'Samsung Health', note: ['Galaxy Watch', 'Galaxy Watch'], icon: siSamsung },
  { key: 'wearos', name: 'Wear OS', note: ['Smartwatches', 'स्मार्टवॉच'], icon: siWearos },
  { key: 'fitbit', name: 'Fitbit', note: ['Bands & watches', 'बैंड व वॉच'], icon: siFitbit },
  { key: 'garmin', name: 'Garmin', note: ['Watches', 'वॉच'], icon: siGarmin },
  { key: 'xiaomi', name: 'Mi Fitness', note: ['Mi Band, Amazfit', 'Mi Band, Amazfit'], icon: siXiaomi },
  { key: 'huawei', name: 'Huawei Health', note: ['Watches & bands', 'वॉच व बैंड'], icon: siHuawei },
  { key: 'boat', name: 'boAt / Noise', note: ['Smartwatches', 'स्मार्टवॉच'], icon: siBoat },
  { key: 'strava', name: 'Strava', note: ['Walks & runs', 'वॉक व रन'], icon: siStrava },
];

const NOTIFY_KEY = 'urcare_device_notify';

export const HealthDevicesCard: React.FC<{ tr: (en: string, hi: string) => string }> = ({ tr }) => {
  const [asked, setAsked] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(NOTIFY_KEY) || '[]'); } catch { return []; } });
  const toggle = (key: string) => {
    const next = asked.includes(key) ? asked.filter((k) => k !== key) : [...asked, key];
    setAsked(next);
    try { localStorage.setItem(NOTIFY_KEY, JSON.stringify(next)); } catch {}
  };
  return (
    <section className="rounded-2xl bg-white border border-zinc-200 shadow-depth overflow-hidden text-left">
      <div className="p-4 flex items-center gap-3 border-b border-zinc-100">
        <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center shrink-0"><Watch className="w-5 h-5" /></span>
        <div className="min-w-0">
          <h3 className="text-sm font-black text-zinc-900">{tr('Connect health devices', 'हेल्थ डिवाइस जोड़ें')}</h3>
          <p className="text-[11px] text-zinc-500 font-semibold">{tr('Steps, heart rate, sleep and sugar from your watch — coming soon', 'वॉच से स्टेप्स, हार्ट रेट, नींद व शुगर — जल्द आ रहा है')}</p>
        </div>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2">
        {DEVICES.map((d) => {
          const on = asked.includes(d.key);
          return (
            <li key={d.key} className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100 sm:odd:border-r">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `#${d.icon.hex}14`, color: `#${d.icon.hex}` }}>
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true"><path d={d.icon.path} /></svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold text-zinc-900 truncate">{d.name}</span>
                <span className="block text-[10px] font-semibold text-zinc-400 truncate">{tr(d.note[0], d.note[1])}</span>
              </span>
              <button
                type="button"
                onClick={() => toggle(d.key)}
                className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border cursor-pointer transition-colors ${on ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-zinc-50 border-zinc-200 text-zinc-500'}`}
                title={tr('Tell me when it is ready', 'तैयार होने पर बताएं')}
              >
                {on ? <Check className="w-3 h-3" /> : <Bell className="w-3 h-3" />}{on ? tr("We'll tell you", 'हम बताएंगे') : tr('Coming soon', 'जल्द आ रहा है')}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
