import React, { useState, useEffect } from 'react';
import { UserHealthProfile, UserAccount } from './types';
import { AuthScreen } from './components/AuthScreen';
import { OnboardingFlow } from './components/OnboardingFlow';
import { WowCelebration } from './components/WowCelebration';
import { Dashboard } from './components/Dashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';

function MainApp() {
  const [profile, setProfile] = useState<UserHealthProfile | null>(null);
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [showWowCelebration, setShowWowCelebration] = useState(false);
  const [isAdminPortalOpen, setIsAdminPortalOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Restore stored session if exists
  useEffect(() => {
    try {
      const storedProfile = localStorage.getItem('urcare_user_profile');
      const storedAccount = localStorage.getItem('urcare_user_account');
      if (storedProfile && storedAccount) {
        setProfile(JSON.parse(storedProfile));
        setAccount(JSON.parse(storedAccount));
      }
    } catch (e) {
      console.warn('Could not load local session:', e);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  const handleAuthSuccess = (authenticatedAccount: UserAccount, existingProfile?: UserHealthProfile | null) => {
    setAccount(authenticatedAccount);
    try {
      localStorage.setItem('urcare_user_account', JSON.stringify(authenticatedAccount));
    } catch (e) {}

    if (existingProfile) {
      setProfile(existingProfile);
      try {
        localStorage.setItem('urcare_user_profile', JSON.stringify(existingProfile));
      } catch (e) {}
    } else {
      // New user or no profile yet -> will automatically transition into OnboardingFlow
      setProfile(null);
    }
  };

  const handleOnboardingComplete = (completedProfile: UserHealthProfile, registeredAccount: UserAccount) => {
    setProfile(completedProfile);
    setAccount(registeredAccount);
    setShowWowCelebration(true);

    try {
      localStorage.setItem('urcare_user_profile', JSON.stringify(completedProfile));
      localStorage.setItem('urcare_user_account', JSON.stringify(registeredAccount));
    } catch (e) {
      console.warn('Could not save local session:', e);
    }
  };

  const handleUpdateProfile = (updatedProfile: UserHealthProfile) => {
    setProfile(updatedProfile);
    try {
      localStorage.setItem('urcare_user_profile', JSON.stringify(updatedProfile));
    } catch (e) {
      console.warn('Could not save updated session:', e);
    }
  };

  const handleUpdateAccount = (updatedAccount: UserAccount) => {
    setAccount(updatedAccount);
    try {
      localStorage.setItem('urcare_user_account', JSON.stringify(updatedAccount));
    } catch (e) {
      console.warn('Could not save updated account session:', e);
    }
  };

  const handleResetOnboarding = () => {
    setProfile(null);
    setAccount(null);
    setShowWowCelebration(false);
    try {
      localStorage.removeItem('urcare_user_profile');
      localStorage.removeItem('urcare_user_account');
      localStorage.removeItem('urcare_lab_reports');
    } catch (e) {
      console.warn('Could not clear local session:', e);
    }
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
        onAuthSuccess={handleAuthSuccess}
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
