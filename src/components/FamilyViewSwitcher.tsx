import React from 'react';
import { User, Users } from 'lucide-react';
import { FamilyMember } from '../types';

interface FamilyViewSwitcherProps {
  members: FamilyMember[];
  activeDependentId: string | null;
  onChange: (dependentId: string | null) => void;
  isDark?: boolean;
  tr: (en: string, hi: string) => string;
}

/** A small "who are we looking at" pill row — shown only once the primary
 *  account has actually added a family member (see FamilyMembersPanel).
 *  Selecting one switches the Daily Plan / Tracker screen it's placed on to
 *  that dependent's own data instead of the signed-in account's. */
export const FamilyViewSwitcher: React.FC<FamilyViewSwitcherProps> = ({ members, activeDependentId, onChange, isDark, tr }) => {
  if (members.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black transition-colors cursor-pointer whitespace-nowrap ${
          !activeDependentId
            ? 'bg-emerald-600 text-white'
            : isDark ? 'bg-zinc-900 text-zinc-400 hover:text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
        }`}
      >
        <User className="w-3 h-3" />
        {tr('Myself', 'मैं खुद')}
      </button>
      {members.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onChange(m.id)}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black transition-colors cursor-pointer whitespace-nowrap ${
            activeDependentId === m.id
              ? 'bg-emerald-600 text-white'
              : isDark ? 'bg-zinc-900 text-zinc-400 hover:text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          <Users className="w-3 h-3" />
          {m.name}
        </button>
      ))}
    </div>
  );
};
