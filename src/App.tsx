import React, { useState, useEffect, useCallback } from 'react';
import { UserHealthProfile, UserAccount } from './types';
import { AuthScreen } from './components/AuthScreen';
import { OnboardingFlow } from './components/OnboardingFlow';
import { WowCelebration } from './components/WowCelebration';
import { Dashboard } from './components/Dashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { getCurrentSession, onAuthStateChange, fetchProfileBundle, upsertProfile, activatePremium } from './utils/supabase';

function MainApp() {
  const [profile, setProfile] = useState<UserHealthProfile | null>(null);
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [showWowCelebration, setShowWowCelebration] = useState(false);
  const [isAdminPortalOpen, setIsAdminPortalOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const loadFromSession = useCallback(async (userId: string, email: string) => {
    const bundle = await fetchProfileBundle(userId, email);
    setAccount(bundle.account);
    setProfile(bundle.profile);
  }, []);

  // Restore the real Supabase session on load, and react to sign-in/out anywhere
  // in the app (including the redirect back from Google OAuth).
  useEffect(() => {
    let active = true;

    (async () => {
      const session = await getCurrentSession();
      if (active && session?.user) {
        await loadFromSession(session.user.id, session.user.email || '');
      }
      if (active) setIsInitialized(true);
    })();

    const subscription = onAuthStateChange((session) => {
      if (!active) return;
      if (session?.user) {
        loadFromSession(session.user.id, session.user.email || '');
      } else {
        setAccount(null);
        setProfile(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadFromSession]);

  const handleOnboardingComplete = async (completedProfile: UserHealthProfile, registeredAccount: UserAccount) => {
    await upsertProfile(registeredAccount.uid, completedProfile);
    // A trial (or any Pro grant) must be saved to the DB immediately — otherwise
    // it only lives in this local state, and the next session/token refresh
    // re-fetches 'inactive' from Supabase and silently revokes it a moment later.
    if (registeredAccount.isPro && registeredAccount.proExpiry) {
      await activatePremium(registeredAccount.uid, registeredAccount.proExpiry);
    }
    setProfile(completedProfile);
    setAccount(registeredAccount);
    setShowWowCelebration(true);
  };

  const handleUpdateProfile = async (updatedProfile: UserHealthProfile) => {
    if (account) await upsertProfile(account.uid, updatedProfile);
    setProfile(updatedProfile);
  };

  const handleUpdateAccount = (updatedAccount: UserAccount) => {
    setAccount(updatedAccount);
  };

  const handleResetOnboarding = () => {
    setProfile(null);
    setAccount(null);
    setShowWowCelebration(false);
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-emerald-600 flex items-center justify-center">
        <div className="w-9 h-9 rounded-full border-3 border-emerald-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  // 1. Admin Portal View
  if (isAdminPortalOpen) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-zinc-950">
        <AdminDashboard onExitAdmin={() => setIsAdminPortalOpen(false)} />
      </div>
    );
  }

  // 2. Auth Flow: If user is not authenticated yet, show Login & Sign Up Screen at the start!
  if (!account) {
    return (
      <AuthScreen
        onOpenAdmin={() => setIsAdminPortalOpen(true)}
      />
    );
  }

  // 3. Wow Celebration Screen post-onboarding
  if (profile && account && showWowCelebration) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-zinc-950">
        <WowCelebration
          profile={profile}
          onEnterDashboard={() => setShowWowCelebration(false)}
        />
      </div>
    );
  }

  // 4. User Authenticated with Active Health Profile -> Dashboard
  if (profile && account) {
    return (
      <Dashboard
        profile={profile}
        account={account}
        onUpdateProfile={handleUpdateProfile}
        onUpdateAccount={handleUpdateAccount}
        onResetOnboarding={handleResetOnboarding}
        onOpenAdminPortal={() => setIsAdminPortalOpen(true)}
      />
    );
  }

  // 5. User Authenticated without Profile -> Onboarding Flow
  return (
    <OnboardingFlow
      initialAccount={account}
      onComplete={handleOnboardingComplete}
      onOpenAdmin={() => setIsAdminPortalOpen(true)}
    />
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <MainApp />
      </ThemeProvider>
    </LanguageProvider>
  );
}
