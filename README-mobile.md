# UrCare — Android (and, later, iOS) app via Capacitor

UrCare is one Express server (`server.ts`) that serves the built React
frontend **and** every `/api/*` route from the same origin — it's not a
static site. The native app is a thin WebView shell
([Capacitor](https://capacitorjs.com)) that points at the real deployed
server, so every screen still works exactly as it does on the web.

## Current setup: production (Render)

`capacitor.config.ts` points at the real deployed instance:

```ts
server: { url: 'https://urcare-app.onrender.com' }
```

This means the built APK works **anywhere** — no same-WiFi requirement, no
dev server needed on any particular machine. Install it and open it; it
talks straight to Render over HTTPS, same as the web version.

One thing worth knowing: Render's `/api/health` currently reports
`aiConfigured: false` — `GROQ_API_KEY` isn't set on that deployment, so
AI-backed features (report scanning, the daily-plan extractor, the daily
quote) won't work there until that key is added in Render's environment
variables. Everything else (auth, Supabase-backed data, the reversal plan,
orders, etc.) is unaffected.

## Building the debug APK

The project's own folder path (`...\urcare_updated (1)\urcare`) has spaces
and parentheses in it, which trips up one specific thing on Windows: writing
`android/local.properties` with backslash-escaped paths silently mangles
them (Java's `.properties` format treats `\U`, `\A`, etc. as escape
sequences and drops the backslash). Fix: always use **forward slashes** in
that file, e.g.:
```
sdk.dir=C:/Users/singh/AppData/Local/Android/Sdk
```
With that, building directly from this project folder works fine — the
"clean path" workaround people usually reach for isn't actually needed here
(and breaks Capacitor's relative link to `node_modules` if you copy just
the `android/` folder elsewhere).

- **Recommended**: open the `android/` folder in **Android Studio**
  (`File → Open` → select `android`) and build from there — ▶ Run, or
  `Build → Build Bundle(s) / APK(s) → Build APK(s)`.
- **Command line**:
  ```
  cd android
  set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
  gradlew.bat assembleDebug
  ```
  APK lands at `android\app\build\outputs\apk\debug\app-debug.apk`.

After changing any frontend code (the deployed Render server picks up its
own changes on redeploy — this step is only about the *native shell* itself,
e.g. changing `capacitor.config.ts`):
```
npm run build           # rebuilds dist/ (webDir Capacitor points to before it swaps to the remote URL)
npx cap sync android     # copies dist/ + config into the android project
```
then rebuild the APK.

## Moving to a real release build (Play Store) and iOS

1. **Android**: this is currently a **debug** build — fine for installing
   directly on a phone, not for the Play Store. For that, build a **signed
   release** from Android Studio (`Build → Generate Signed Bundle / APK`),
   which needs a real signing keystore (Android Studio can create one).
2. **iOS**: Capacitor supports iOS from this exact codebase, but building an
   `.ipa` requires **Xcode on a Mac** — not possible on this Windows
   machine. Once you have Mac access: `npx cap add ios`, then open
   `ios/App/App.xcworkspace` in Xcode to build/run. It'll talk to the same
   `https://urcare-app.onrender.com` — no server-side changes needed.
