import type { CapacitorConfig } from '@capacitor/cli';

// UrCare is a single Express server (server.ts) that serves both the built
// frontend AND every /api/* route from the same origin — it isn't a static
// site. That means the native app can't just bundle the built dist/ files
// and run offline: every screen needs the real server to answer its API
// calls, so this WebView shell points at wherever that server is actually
// reachable — now the real deployed instance, over HTTPS.
const PRODUCTION_URL = 'https://urcare-app.onrender.com';

const config: CapacitorConfig = {
  appId: 'org.urcare.app',
  appName: 'UrCare',
  webDir: 'dist',
  server: {
    url: PRODUCTION_URL,
  },
};

export default config;
