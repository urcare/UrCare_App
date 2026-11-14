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

## Release builds

### Android (Play Store)
Signed release builds work from Android Studio or the command line. Gradle
is pinned to JDK 21 in `C:/Users/singh/.gradle/gradle.properties`
(`org.gradle.java.home`), because Android Studio's bundled Java 25 can't run
this Gradle version.
```
npm run build && npx cap sync android
cd android
gradlew.bat bundleRelease
```
Output: `android/app/build/outputs/bundle/release/app-release.aab`, signed
with the upload key in `C:/Users/singh/Documents/UrCare-Keys/` (via
`android/keystore.properties`). **Back up that .jks file and its passwords.**
Losing them means you can't ship updates without a key reset from Google.
Bump `versionCode` in `android/app/build.gradle` for every upload.

### iOS (App Store)
The iOS build **bundles the screens inside the app** (App Store Guideline
4.2 rejects remote-website wrappers) and only fetches data from the live
server (see `capacitor.config.ts`, `src/utils/apiBase.ts`, and the CORS block
in `server.ts`). So a screen change on iOS needs a new App Store build, and
you must always run `npx cap sync ios` with the platform named (plain
`npx cap sync` would give iOS the Android live-URL config).

The `ios/` project is generated and configured with permission texts, the
login return URL scheme (`org.urcare.app`), the export-compliance flag and
icons. It can only be **built on a Mac with Xcode** (or a cloud Mac such as
Codemagic). On the Mac:
```
npm install && npx cap sync ios
npx cap open ios
```
In Xcode: choose your Team under Signing & Capabilities, add the **Push
Notifications** and **Sign in with Apple** capabilities, then Product →
Archive → Distribute → App Store Connect.

### Store-policy notes (so review doesn't reject it)
- The ₹499 "app unlock" is never offered inside the native app (Play
  Payments policy / App Store 3.1.1 forbid non-store payment for app
  features). The app shows only "account being activated". Physical
  products in the store can keep using UPI.
- Apple requires **Sign in with Apple** whenever Google login is offered.
  The button is shown on iOS. Enable the Apple provider in Supabase →
  Authentication → Providers before submitting.
- Ready-to-paste listing text, Data safety answers and reviewer notes:
  `store/listing.md`.
- Give reviewers a working **demo account** (email + password) in the
  review notes. If the paywall is ever switched on, that account must
  already be unlocked.
