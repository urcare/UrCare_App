import React from 'react';
import { DotLottieReact, setWasmUrl } from '@lottiefiles/dotlottie-react';

// Lottie engine from our own server (copied by scripts/copy-lottie-wasm.mjs).
setWasmUrl('/lottie/dotlottie-player.wasm');

// Lotties are drawn on the CPU; phones report a pixel ratio of 3, which makes
// every frame ~4x more work than needed. 1.5 still looks sharp at these sizes.
const DPR = typeof window !== 'undefined' ? Math.min(1.5, window.devicePixelRatio || 1) : 1;

/** DotLottieReact with app-wide settings: lighter rendering, paused while off screen. */
export const Lottie: React.FC<React.ComponentProps<typeof DotLottieReact>> = (props) => (
  <DotLottieReact renderConfig={{ devicePixelRatio: DPR, autoResize: true, freezeOnOffscreen: true }} {...props} />
);
