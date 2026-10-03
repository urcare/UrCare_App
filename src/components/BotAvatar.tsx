import React from 'react';

/** Illustrated (drawn, not photographed) avatars for the AI Health Bots —
 *  deliberately cartoon-style so nobody mistakes a bot for a real person. */
export type BotLook = {
  gender: 'male' | 'female';
  skin: string;
  hair: string;
  outfit: 'coat' | 'kurta' | 'tee';
  outfitColor: string;
  bg: [string, string];
  extras?: Array<'tilak' | 'bindi' | 'moustache' | 'ponytail' | 'glasses'>;
};

export const BotAvatar: React.FC<{ look: BotLook; size?: number; id: string }> = ({ look, size = 44, id }) => {
  const { gender, skin, hair, outfit, outfitColor, bg, extras = [] } = look;
  const has = (x: (typeof extras)[number]) => extras.includes(x);
  const gid = `botbg-${id}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="rounded-full shrink-0">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={bg[0]} />
          <stop offset="100%" stopColor={bg[1]} />
        </linearGradient>
        <clipPath id={`${gid}-clip`}><circle cx="32" cy="32" r="32" /></clipPath>
      </defs>
      <g clipPath={`url(#${gid}-clip)`}>
        <rect width="64" height="64" fill={`url(#${gid})`} />

        {/* long hair behind the head */}
        {gender === 'female' && !has('ponytail') && <path d="M15 30 C15 14 49 14 49 30 L50 50 L14 50 Z" fill={hair} />}
        {has('ponytail') && <path d="M44 22 C54 24 54 40 47 46 C49 36 47 28 43 25 Z" fill={hair} />}

        {/* shoulders / outfit */}
        <path d="M8 64 C8 50 18 44 32 44 C46 44 56 50 56 64 Z" fill={outfit === 'coat' ? '#ffffff' : outfitColor} />
        {outfit === 'coat' && (
          <>
            <path d="M26 45 L32 56 L38 45 Z" fill={outfitColor} />
            <path d="M23 47 C21 54 25 58 29 57" fill="none" stroke="#334155" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="29.5" cy="57" r="1.8" fill="#64748b" />
          </>
        )}
        {outfit === 'kurta' && <path d="M32 45 L32 58" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.5" />}
        {outfit === 'tee' && <path d="M27 44.5 C29 47 35 47 37 44.5" fill="none" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="1.5" />}

        {/* neck + head */}
        <rect x="28" y="36" width="8" height="9" rx="3" fill={skin} />
        <ellipse cx="32" cy="28" rx="11.5" ry="13" fill={skin} />

        {/* hair on top */}
        {gender === 'male'
          ? <path d="M20.5 26 C20 15 27 13 32 13 C38 13 44 15 43.5 26 C41 20 37 19 32 19 C27 19 23 20 20.5 26 Z" fill={hair} />
          : <path d="M20.5 27 C20 15 27 13.5 32 13.5 C38 13.5 44 15 43.5 27 C40 21 35 18.5 29 19 C25 19.5 22 22 20.5 27 Z" fill={hair} />}

        {/* face */}
        <circle cx="27.5" cy="28.5" r="1.4" fill="#1f2937" />
        <circle cx="36.5" cy="28.5" r="1.4" fill="#1f2937" />
        <path d="M28 34 C30 36 34 36 36 34" fill="none" stroke="#7c2d12" strokeWidth="1.5" strokeLinecap="round" />
        {has('moustache') && <path d="M27.5 32.3 C30 31 34 31 36.5 32.3 C34.5 33.3 29.5 33.3 27.5 32.3 Z" fill={hair} />}
        {has('tilak') && <path d="M32 18.5 L32 23" stroke="#dc2626" strokeWidth="1.6" strokeLinecap="round" />}
        {has('bindi') && <circle cx="32" cy="23.2" r="1.2" fill="#dc2626" />}
        {has('glasses') && (
          <g fill="none" stroke="#1f2937" strokeWidth="1.1">
            <circle cx="27.5" cy="28.5" r="3.2" /><circle cx="36.5" cy="28.5" r="3.2" /><path d="M30.7 28.5 L33.3 28.5" />
          </g>
        )}
      </g>
    </svg>
  );
};
