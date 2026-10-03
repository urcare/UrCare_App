import React from 'react';

/** The doctor who reviews lab reports in the admin panel. Shown on a report
 *  ONLY after that report was actually reviewed there (lab_reports.
 *  admin_reviewed) — never on an AI-only analysis. Change it here if the
 *  reviewing doctor changes. */
export const REVIEWING_DOCTOR_NAME = 'Dr. Aakarshak Saini';

/** A round, rubber-stamp style "VERIFIED" seal. Pure SVG, so it stays crisp
 *  at any size and prints cleanly. */
export const VerifiedSeal: React.FC<{ size?: number }> = ({ size = 76 }) => (
  <svg width={size} height={size} viewBox="0 0 120 120" className="shrink-0 -rotate-[8deg]" aria-hidden="true">
    <defs>
      <path id="urcare-seal-top" d="M 20 60 A 40 40 0 0 1 100 60" />
      <path id="urcare-seal-bottom" d="M 16 60 A 44 44 0 0 0 104 60" />
    </defs>
    <circle cx="60" cy="60" r="56" fill="none" stroke="#047857" strokeWidth="3.5" />
    <circle cx="60" cy="60" r="49" fill="none" stroke="#047857" strokeWidth="1.2" />
    <circle cx="60" cy="60" r="30" fill="#ecfdf5" stroke="#047857" strokeWidth="1.2" />
    <text fill="#047857" fontSize="10.5" fontWeight="800" letterSpacing="2.2" fontFamily="system-ui, sans-serif">
      <textPath href="#urcare-seal-top" startOffset="50%" textAnchor="middle">URCARE CLINICAL</textPath>
    </text>
    <text fill="#047857" fontSize="10.5" fontWeight="800" letterSpacing="2.2" fontFamily="system-ui, sans-serif">
      <textPath href="#urcare-seal-bottom" startOffset="50%" textAnchor="middle">★ REVIEW ★</textPath>
    </text>
    <path d="M 47 57 L 56 66 L 74 47" fill="none" stroke="#047857" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    <text x="60" y="81" fill="#047857" fontSize="9" fontWeight="900" letterSpacing="1.5" textAnchor="middle" fontFamily="system-ui, sans-serif">VERIFIED</text>
  </svg>
);
