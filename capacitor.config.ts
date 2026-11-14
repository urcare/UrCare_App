import type { CapacitorConfig } from '@capacitor/cli';

// UrCare is a single Express server (server.ts) that serves both the built
// frontend AND every /api/* route.
//
// ANDROID: the WebView shell loads the live server directly, so a server
// redeploy updates the app's screens with no Play Store release.
//
// iOS: App Store Guideline 4.2 rejects apps that are just a remote website
// in a WebView, so the iOS build bundles the screens (dist/) inside the app
// and only talks to the live server for data — src/utils/apiBase.ts sends
// every relative /api/* call there, and server.ts allows the app's origin
// (CORS). Data, accounts and products are the same for website, Android
// and iOS. A screen change on iOS needs a new App Store build.
//
// Capacitor has no per-platform `server` setting, so the platform is read
// from the CLI command (`npx cap sync ios`, `npx cap copy ios`, …). Always
// name the platform when syncing iOS.
const PRODUCTION_URL = 'https://urcare-app.onrender.com';
const isIosCommand = process.argv.includes('ios');

const config: CapacitorConfig = {
  appId: 'org.urcare.app',
  appName: 'UrCare',
  webDir: 'dist',
  server: isIosCommand
    ? { iosScheme: 'capacitor' }
    : {
        url: PRODUCTION_URL,
        // Local page shown when the server can't be reached (no internet).
        errorPath: 'offline.html',
      },
};

export default config;
