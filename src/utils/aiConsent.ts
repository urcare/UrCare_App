// Apple (App Review Guideline 5.1.2) requires telling users — and getting
// their permission — before their personal data is sent to a third-party AI
// service. Every feature that sends a report, photo, or plan to the AI calls
// ensureAIConsent() first; the first time, AIConsentGate (mounted once in
// App.tsx) shows the explanation and resolves with the user's choice. The
// answer is saved to the account (see accountState.ts), so it holds on every
// device, with this device's copy as a fallback.

import { getCachedAccountState, saveAccountState } from './accountState';

const STORAGE_KEY = 'urcare_ai_consent_v1';
const REQUEST_EVENT = 'urcare:ai-consent-request';

export type AIConsentRequest = { resolve: (granted: boolean) => void };

export function hasAIConsent(): boolean {
  if (getCachedAccountState().aiConsent) return true;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'granted';
  } catch {
    return false;
  }
}

export function saveAIConsent(granted: boolean): void {
  if (granted) saveAccountState({ aiConsent: true }, { immediate: true });
  try {
    if (granted) localStorage.setItem(STORAGE_KEY, 'granted');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable — the user will simply be asked again next time.
  }
}

/** Resolves true once the user has agreed (immediately, if they already
 *  have), false if they decline. */
export function ensureAIConsent(): Promise<boolean> {
  if (hasAIConsent()) return Promise.resolve(true);
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent<AIConsentRequest>(REQUEST_EVENT, { detail: { resolve } }));
  });
}

export function onAIConsentRequest(handler: (request: AIConsentRequest) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<AIConsentRequest>).detail);
  window.addEventListener(REQUEST_EVENT, listener);
  return () => window.removeEventListener(REQUEST_EVENT, listener);
}

export const AI_CONSENT_DECLINED_MESSAGE = {
  en: 'AI analysis needs your permission. You can allow it the next time you try.',
  hi: 'AI विश्लेषण के लिए आपकी अनुमति ज़रूरी है। अगली बार कोशिश करने पर आप अनुमति दे सकते हैं।',
};
