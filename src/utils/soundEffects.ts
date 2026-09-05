// Web Audio API Sound Effects for Interactive Feedback (Scroll Ticks & Button Clicks)

let audioCtx: AudioContext | null = null;
let isSoundEnabled = true;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
};

export const setSoundEnabled = (enabled: boolean) => {
  isSoundEnabled = enabled;
};

export const getSoundEnabled = () => isSoundEnabled;

/**
 * Plays a clean, subtle acoustic click sound on button press / option selection.
 */
export const playClickSound = (pitch = 600) => {
  if (!isSoundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.4, ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.045);
  } catch (e) {
    // Ignore audio errors silently
  }
};

/**
 * Plays a crisp, tactile tick sound as a wheel/ruler picker glides past each notch —
 * layers a tiny high "click" transient over a soft low "tock" body, with a touch of
 * randomized pitch so a fast flurry of ticks feels mechanical rather than robotic.
 */
let lastTickTime = 0;
export const playScrollTickSound = (frequency = 1200) => {
  if (!isSoundEnabled) return;
  const now = Date.now();
  // Throttle tick sounds slightly so high-speed scrolls don't overload
  if (now - lastTickTime < 32) return;
  lastTickTime = now;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const jitter = 0.94 + Math.random() * 0.12; // subtle per-tick variance
    const t0 = ctx.currentTime;

    // Body: soft, round "tock" — gives the tick weight
    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(frequency * jitter, t0);
    body.frequency.exponentialRampToValueAtTime(frequency * 0.45, t0 + 0.02);
    bodyGain.gain.setValueAtTime(0.06, t0);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.024);
    body.connect(bodyGain);
    bodyGain.connect(ctx.destination);
    body.start(t0);
    body.stop(t0 + 0.026);

    // Click: a brief, bright transient layered on top — the "aesthetic" mechanical snap
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = 'square';
    click.frequency.setValueAtTime(frequency * 2.3 * jitter, t0);
    clickGain.gain.setValueAtTime(0.025, t0);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.008);
    click.connect(clickGain);
    clickGain.connect(ctx.destination);
    click.start(t0);
    click.stop(t0 + 0.01);
  } catch (e) {
    // Silent
  }
};

/**
 * Plays a soft, celebratory harmonic chime on completing steps or onboarding.
 */
export const playSuccessChime = () => {
  if (!isSoundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

      gain.gain.setValueAtTime(0.08, ctx.currentTime + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.08);
      osc.stop(ctx.currentTime + idx * 0.08 + 0.32);
    });
  } catch (e) {
    // Silent
  }
};
