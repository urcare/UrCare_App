import React, { useEffect, useState } from 'react';
import {
  X, ShieldCheck, RefreshCw, Lock, User, Mail, AlertCircle, ArrowRight
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { playClickSound, playSuccessChime } from '../utils/soundEffects';
import { signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset, isSupabaseConfigured } from '../utils/supabase';

interface AuthScreenProps {
  onOpenAdmin?: () => void;
  /** Set when the native app's own Google sign-in flow (a real browser tab,
   *  since Google blocks embedded WebViews — see completeNativeOAuthSignIn
   *  in utils/supabase.ts) finishes and failed. Without this, a failure
   *  there just silently lands back on this same screen with no
   *  explanation — which reads as "it sent me back to signup for no
   *  reason" — so this pops the sign-in modal back open with the real
   *  reason shown instead. */
  externalError?: string | null;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onOpenAdmin, externalError }) => {
  const { language, setLanguage } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);
  const [authModal, setAuthModal] = useState<'signin' | 'signup' | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (externalError) {
      setAuthModal('signin');
      setError(externalError);
    }
  }, [externalError]);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const toggleLanguage = () => {
    playClickSound(650);
    setLanguage(language === 'en' ? 'hi' : 'en');
  };

  const resetFormState = () => {
    setError(null);
    setInfo(null);
    setPassword('');
  };

  const openModal = (mode: 'signin' | 'signup') => {
    playClickSound(600);
    resetFormState();
    setAuthModal(mode);
  };

  const handleGoogleSignIn = async () => {
    playClickSound(680);
    setError(null);
    if (!isSupabaseConfigured()) {
      setError(tr('Sign-in is not configured yet. Please try again shortly.', 'साइन-इन अभी कॉन्फ़िगर नहीं है। कृपया थोड़ी देर बाद पुनः प्रयास करें।'));
      return;
    }
    setGoogleLoading(true);
    const { error: err } = await signInWithGoogle();
    setGoogleLoading(false);
    if (err) {
      setError(err);
    }
    // On success, Supabase redirects the whole page to Google and back —
    // App.tsx's auth-state listener picks up the session automatically.
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email.trim() || !password.trim()) {
      setError(language === 'hi' ? 'कृपया ईमेल और पासवर्ड दर्ज करें' : 'Please enter your email and password');
      return;
    }
    if (authModal === 'signup' && !fullName.trim()) {
      setError(language === 'hi' ? 'कृपया अपना नाम दर्ज करें' : 'Please enter your name');
      return;
    }
    if (!isSupabaseConfigured()) {
      setError(tr('Sign-in is not configured yet. Please try again shortly.', 'साइन-इन अभी कॉन्फ़िगर नहीं है। कृपया थोड़ी देर बाद पुनः प्रयास करें।'));
      return;
    }

    setLoading(true);
    const result = authModal === 'signup'
      ? await signUpWithEmail(email.trim(), password, fullName.trim())
      : await signInWithEmail(email.trim(), password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (authModal === 'signup') {
      // Supabase may require email confirmation depending on project settings.
      setInfo(language === 'hi'
        ? 'खाता बन गया! अगर ईमेल पुष्टिकरण चालू है, तो कृपया अपना इनबॉक्स देखें, फिर साइन इन करें।'
        : 'Account created! If email confirmation is enabled on this project, check your inbox, then sign in.');
      playSuccessChime();
      return;
    }

    playSuccessChime();
    // App.tsx's global auth-state listener now loads the real profile and
    // transitions away from this screen automatically.
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError(language === 'hi' ? 'पहले अपना ईमेल दर्ज करें' : 'Enter your email first');
      return;
    }
    setError(null);
    const { error: err } = await sendPasswordReset(email.trim());
    if (err) setError(err);
    else setInfo(language === 'hi' ? 'पासवर्ड रीसेट लिंक भेज दिया गया है।' : 'Password reset link sent — check your inbox.');
  };

  return (
    <div className="relative w-full h-dvh overflow-hidden bg-zinc-950 text-white flex flex-col justify-between items-center px-4 sm:px-6 py-3 sm:py-4 selection:bg-emerald-500/30">

      {/* Full-screen cinematic background — the real BEFORE→AFTER
          transformation poster, kept sharp (not blurred away) and darkened
          under an emerald/black scrim so it reads as premium depth behind
          the UI, exactly like the reference: photo clearly visible, just
          tinted dark enough for white text and glass cards to sit on top. */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/background.png')" }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-emerald-950/50 to-black/85" aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40" aria-hidden="true" />

      {/* Top Header: Language Switcher only */}
      <header className="relative w-full max-w-md mx-auto flex items-center justify-end shrink-0">
        <button
          type="button"
          onClick={toggleLanguage}
          className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/25 text-xs font-bold text-white flex items-center gap-1.5 backdrop-blur-md transition-all shadow-lg shadow-black/20 cursor-pointer"
        >
          <span>{language === 'en' ? '🇺🇸 EN' : '🇮🇳 HI'}</span>
        </button>
      </header>

      {/* Main Content Area: left empty on purpose — the full-screen
          background above already carries the before/after story, so
          nothing sits here but open space between the header and footer. */}
      <main className="relative w-full max-w-sm sm:max-w-md mx-auto flex-1 min-h-0" />

      {/* Bottom Hero Headline & Action Controls */}
      <footer className="relative w-full max-w-sm sm:max-w-md mx-auto space-y-2.5 sm:space-y-3.5 pt-1 sm:pt-2 pb-1 text-center shrink-0">

        {/* Main Headline — two-tone treatment matching the reference: plain
            white for most of the line, a soft emerald-teal gradient for the
            emphasized word, same exact copy as before. */}
        <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight [text-wrap:balance]">
          {language === 'hi' ? (
            <>
              <span className="text-white">रिवर्सल हुआ </span>
              <span className="bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent">बिल्कुल आसान</span>
            </>
          ) : (
            <>
              <span className="text-white">Reversal made </span>
              <span className="bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent">easy</span>
            </>
          )}
        </h1>

        {/* Primary CTA Button: Get Started */}
        <button
          type="button"
          onClick={() => openModal('signup')}
          className="w-full py-3.5 sm:py-4.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 active:scale-[0.99] text-zinc-950 font-black text-base sm:text-lg tracking-tight shadow-xl shadow-emerald-500/30 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <span>{language === 'hi' ? 'शुरू करें (Get Started)' : 'Get Started'}</span>
          <ArrowRight className="w-5 h-5" />
        </button>

        {/* Subtext: Already have an account? Sign in */}
        <div className="text-xs sm:text-sm font-semibold text-zinc-300">
          <span>{language === 'hi' ? 'क्या आपके पास पहले से खाता है? ' : 'Already have an account? '}</span>
          <button
            type="button"
            onClick={() => openModal('signin')}
            className="font-black text-emerald-300 underline hover:text-emerald-200 cursor-pointer ml-1"
          >
            {language === 'hi' ? 'साइन इन करें (Sign in)' : 'Sign in'}
          </button>
        </div>

        {/* Hidden / Subtle Admin access */}
        {onOpenAdmin && (
          <div className="pt-1">
            <button
              type="button"
              onClick={onOpenAdmin}
              className="text-[10px] text-white/40 hover:text-white/70 font-bold transition-colors cursor-pointer"
            >
              {tr('Admin Console Portal', 'एडमिन कंसोल पोर्टल')}
            </button>
          </div>
        )}
      </footer>

      {/* ========================================================================= */}
      {/* SIGN IN / SIGN UP MODAL — real Supabase Auth (Google + email/password)     */}
      {/* ========================================================================= */}
      {authModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm bg-zinc-900/90 backdrop-blur-xl rounded-3xl p-6 sm:p-7 shadow-2xl shadow-emerald-950/40 border border-white/10 text-left relative space-y-4">

            {/* Close */}
            <button
              type="button"
              onClick={() => setAuthModal(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-400/30">
                {authModal === 'signup' ? tr('Get Started', 'शुरू करें') : tr('Welcome Back', 'वापसी पर स्वागत है')}
              </span>
              <h2 className="text-xl font-black text-white mt-1">
                {authModal === 'signup' ? tr('Create Your Account', 'अपना खाता बनाएं') : tr('Sign In to Your Account', 'अपने खाते में साइन इन करें')}
              </h2>
              <p className="text-xs text-zinc-400">
                {authModal === 'signup'
                  ? tr('Your health data is saved securely to your account.', 'आपका स्वास्थ्य डेटा आपके खाते में सुरक्षित रूप से सहेजा जाता है।')
                  : tr('Your saved health profile and data will load automatically.', 'आपकी सहेजी गई स्वास्थ्य प्रोफ़ाइल व डेटा अपने आप लोड हो जाएगा।')}
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-400/30 text-rose-300 text-xs font-bold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            {info && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
                {info}
              </div>
            )}

            {/* One-Click Google Sign In Button — kept a light/white pill even
                on the dark card, matching Google's own branding guidelines
                for its logo button. */}
            <button
              type="button"
              disabled={googleLoading}
              onClick={handleGoogleSignIn}
              className="w-full py-3.5 px-4 rounded-2xl border border-white/20 hover:border-white/30 bg-white hover:bg-zinc-50 active:scale-98 font-bold text-xs sm:text-sm text-zinc-800 flex items-center justify-center gap-3 shadow-lg shadow-black/20 transition-all cursor-pointer disabled:opacity-60"
            >
              {googleLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-zinc-600" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
              )}
              <span>{googleLoading ? tr('Redirecting to Google...', 'Google पर भेजा जा रहा है...') : tr('Continue with Google', 'Google से जारी रखें')}</span>
            </button>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-1">
              <div className="border-t border-white/10 w-full" />
              <span className="bg-zinc-900 px-2.5 text-[10px] font-bold text-zinc-500 uppercase">{tr('or use email', 'या ईमेल का उपयोग करें')}</span>
            </div>

            {/* Email / Password Form */}
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              {authModal === 'signup' && (
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">{tr('Full Name', 'पूरा नाम')}</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      required
                      placeholder={tr('Your name', 'आपका नाम')}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-white/15 bg-white/5 focus:bg-white/10 text-white placeholder:text-zinc-500 text-xs font-semibold focus:border-emerald-400 outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">{tr('Email', 'ईमेल')}</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-white/15 bg-white/5 focus:bg-white/10 text-white placeholder:text-zinc-500 text-xs font-semibold focus:border-emerald-400 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">{tr('Password', 'पासवर्ड')}</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-white/15 bg-white/5 focus:bg-white/10 text-white placeholder:text-zinc-500 text-xs font-semibold focus:border-emerald-400 outline-none"
                  />
                </div>
              </div>

              {authModal === 'signin' && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-[11px] font-bold text-zinc-400 hover:text-white cursor-pointer"
                >
                  {tr('Forgot password?', 'पासवर्ड भूल गए?')}
                </button>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-zinc-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/25 transition-all cursor-pointer disabled:opacity-60"
              >
                {loading ? tr('Please wait...', 'कृपया प्रतीक्षा करें...') : authModal === 'signup' ? tr('Create Account', 'खाता बनाएं') : tr('Sign In', 'साइन इन करें')}
              </button>
            </form>

            <div className="text-center text-[11px] text-zinc-400">
              {authModal === 'signup' ? (
                <span>{tr('Already have an account?', 'क्या आपके पास पहले से खाता है?')} <button type="button" onClick={() => openModal('signin')} className="font-black text-emerald-300 underline cursor-pointer">{tr('Sign in', 'साइन इन करें')}</button></span>
              ) : (
                <span>{tr('New here?', 'नए हैं?')} <button type="button" onClick={() => openModal('signup')} className="font-black text-emerald-300 underline cursor-pointer">{tr('Create an account', 'खाता बनाएं')}</button></span>
              )}
            </div>

            <div className="flex items-center justify-center gap-1 text-[10px] text-zinc-500 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{tr('Secure encrypted healthcare login', 'सुरक्षित एन्क्रिप्टेड हेल्थकेयर लॉगिन')}</span>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
