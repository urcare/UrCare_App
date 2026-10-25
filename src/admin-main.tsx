import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from './context/LanguageContext';
import { AdminDashboard } from './components/AdminDashboard';
import './index.css';

// The UrCare admin dashboard — its own page (/admin), separate from the user
// app and never bundled into it. Same server and database as the app, with
// its own admin login (checked server-side).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <div className="min-h-screen bg-[#F8FAFC] text-zinc-950">
        <AdminDashboard onExitAdmin={() => { window.location.href = '/'; }} />
      </div>
    </LanguageProvider>
  </StrictMode>,
);
