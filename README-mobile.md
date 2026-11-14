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

### iOS (App Store) — no Mac needed
The iOS build **bundles the screens inside the app** (App Store Guideline
4.2 rejects remote-website wrappers) and only fetches data from the live
server (see `capacitor.config.ts`, `src/utils/apiBase.ts`, and the CORS block
in `server.ts`). A screen change on iOS needs a new App Store build. Always
run `npx cap sync ios` with the platform named. A plain `npx cap sync` gives
iOS the Android live-URL config.

iOS-specific behaviour:
- iPhone only, portrait only (no iPad screenshots or iPad review needed).
- Sign-in on iOS is **email only** until Apple sign-in is switched on in
  Supabase. Then the Google and Apple buttons both appear (Guideline 4.8).
- No remote push on iOS yet. The server sends via FCM, which needs the
  Firebase iOS SDK and an APNs key. Plan reminders still work, because
  they're local notifications.

**Build and upload with GitHub Actions** (`.github/workflows/ios-release.yml`,
free macOS runners because the repo is public):
1. Join the Apple Developer Program (developer.apple.com/programs/enroll,
   US$99/year). You need an Apple ID with two-factor authentication.
2. App Store Connect → Apps → **+ New App**: platform iOS, name, language,
   bundle ID `org.urcare.app` (if it isn't listed, register it first at
   developer.apple.com → Certificates, IDs & Profiles → Identifiers), SKU
   `urcare-ios-001`.
3. App Store Connect → Users and Access → Integrations → **App Store Connect
   API** → generate a key with the **Admin** role. Note the Key ID and the
   Issuer ID, and download the `.p8` file (it can only be downloaded once).
4. Find your **Team ID** at developer.apple.com → Account → Membership details.
5. GitHub repo → Settings → Secrets and variables → Actions → add:
   `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` (paste the
   whole .p8 text), `SUPABASE_URL`, `SUPABASE_ANON_KEY` (same as `.env`).
6. GitHub → Actions → **iOS release** → Run workflow (about 15–25 min). The
   build shows up in App Store Connect → TestFlight a little later.
7. Fill in the listing from `store/listing.md`, attach the build to the
   version, and Submit for Review.

With a Mac instead: `npm install && npx cap sync ios && npx cap open ios`.
Then in Xcode, choose your Team and use Product → Archive → Distribute.

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
