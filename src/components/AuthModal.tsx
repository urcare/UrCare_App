import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, ShieldCheck, X, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { registerWithFirebase, loginWithFirebase, sendFirebasePasswordReset } from '../utils/firebase';
import { UserAccount } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (account: UserAccount) => void;
  initialMode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  initialMode = 'signin',
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (mode === 'reset') {
      setLoading(true);
      const res = await sendFirebasePasswordReset(email);
      setLoading(false);
      if (res.success) {
        setSuccessMessage(res.message);
      } else {
        setError(res.message);
      }
      return;
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    if (mode === 'signup') {
      const res = await registerWithFirebase(email, password, displayName || email.split('@')[0]);
      setLoading(false);
      if (res.success && res.account) {
        onAuthSuccess(res.account);
        onClose();
      } else {
        setError(res.error || 'Failed to create account.');
      }
    } else {
      const res = await loginWithFirebase(email, password);
      setLoading(false);
      if (res.success && res.account) {
        onAuthSuccess(res.account);
        onClose();
      } else {
        setError(res.error || 'Invalid credentials or user does not exist.');
      }
    }
  };

  const cardBg = isDark ? 'bg-zinc-950 border border-zinc-800 text-white' : 'bg-white border border-zinc-200 text-zinc-950 shadow-2xl';
  const inputBg = isDark ? 'bg-zinc-900 border-zinc-800 text-white focus:border-emerald-500' : 'bg-zinc-50 border-zinc-300 text-zinc-950 focus:border-emerald-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className={`w-full max-w-md p-6 sm:p-8 rounded-3xl ${cardBg} space-y-6 text-left relative`}>
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-500">Firebase Authentication</span>
          </div>
          <h3 className="text-xl font-black">
            {mode === 'signup' && 'Create UrCare Account'}
            {mode === 'signin' && 'Sign In to Your Account'}
            {mode === 'reset' && 'Reset Your Password'}
          </h3>
          <p className="text-xs opacity-65 mt-1">
            {mode === 'signup' && 'Access clinical meal logs, biomarker records, and physician sync.'}
            {mode === 'signin' && 'Welcome back. Enter your verified email credentials to proceed.'}
            {mode === 'reset' && 'Enter your registered email address to receive password reset instructions.'}
          </p>
        </div>

        {/* Error / Success Notifications */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-bold opacity-75 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs font-medium outline-none transition-all ${inputBg}`}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold opacity-75 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40" />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs font-medium outline-none transition-all ${inputBg}`}
              />
            </div>
          </div>

          {mode !== 'reset' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold opacity-75">Password</label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setMode('reset');
                    }}
                    className="text-[11px] text-emerald-500 hover:underline font-semibold"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs font-medium outline-none transition-all ${inputBg}`}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Processing with Firebase...</span>
              </>
            ) : (
              <>
                <span>{mode === 'signup' ? 'Create Account' : mode === 'signin' ? 'Sign In Securely' : 'Send Reset Link'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Mode Switcher */}
        <div className="pt-2 border-t border-zinc-800/40 text-center text-xs opacity-80">
          {mode === 'signin' && (
            <p>
              Do not have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('signup');
                }}
                className="text-emerald-500 font-bold hover:underline"
              >
                Sign Up
              </button>
            </p>
          )}

          {mode === 'signup' && (
            <p>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('signin');
                }}
                className="text-emerald-500 font-bold hover:underline"
              >
                Sign In
              </button>
            </p>
          )}

          {mode === 'reset' && (
            <p>
              Remembered your credentials?{' '}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('signin');
                }}
                className="text-emerald-500 font-bold hover:underline"
              >
                Back to Sign In
              </button>
            </p>
          )}
        </div>

        {/* Clinical Security Notice */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] opacity-60 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>256-bit Encrypted Medical Data Storage</span>
        </div>

      </div>
    </div>
  );
};
