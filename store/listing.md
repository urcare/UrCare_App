# UrCare: store listing text (Play Console + App Store Connect)

Wording rules this text follows, because both stores reject health apps
for claims like these:
- No "cure", "guaranteed", "100% safe", "stop/get off insulin or medicines".
- "Reversal" only appears as the plan's name, never as a promised result.
- A disclaimer is included.

## App name
UrCare: Metabolic Health Coach

## Short description (Play, max 80 chars)
Daily diet, exercise & lifestyle plan for diabetes, BP and metabolic health.

## Subtitle (App Store, max 30 chars)
Diet & lifestyle health coach

## Full description
UrCare helps you manage diabetes, blood pressure, thyroid, PCOS, fatty liver
and other metabolic conditions through daily diet, exercise and lifestyle
habits, with guidance from the UrCare care team.

What you can do:
• Get a personalised daily plan of meals, exercise, sleep and habits, timed to your day
• Upload lab reports and track your biomarkers (HbA1c, sugar, lipids and more) over time
• Scan your meals with the camera to see whether they suit your plan, with healthier swaps
• Chat with the UrCare care team and request a doctor consultation
• Get reminders so you never miss a step of your plan
• Use Health Circle to link family members, share progress, chat and call
• Track your streaks, points and badges
• Use the app in English and Hindi

Important: UrCare provides general wellness and lifestyle information. It is
not a substitute for professional medical advice, diagnosis or treatment.
AI-generated results can be wrong, so check them with your doctor. Never
start, stop or change any medicine, including insulin, without your doctor.
UrCare is not an emergency service. In an emergency, call 112.

## Category
Play: Health & Fitness · App Store: Health & Fitness (secondary: Medical is NOT recommended; it triggers stricter review)

## URLs
- Support URL (App Store requires it): https://urcare-app.onrender.com/support.html
- Marketing URL (optional): https://urcare.org
- Privacy policy: https://urcare-app.onrender.com/privacy.html
- Terms: https://urcare-app.onrender.com/terms.html
- Account deletion: https://urcare-app.onrender.com/delete-account.html
- Support email: urcarein@gmail.com

## Content rating / audience
Target audience 18+. No violence, no gambling. Users can communicate with each
other (Health Circle chat/calls between people who accepted each other's request).

## Play "Health apps" declaration
Select: Disease prevention & management, Nutrition & weight management,
Activity & fitness, Medical reports. Not a medical device. Not regulated software.

## Play Console: Data safety (checked against the code, 14 Nov 2026)

**Overview questions**
- Does your app collect or share any of the required user data types? **Yes**
- Is all of the user data collected by your app encrypted in transit? **Yes** (HTTPS everywhere; calls use WebRTC DTLS-SRTP)
- Which way can users request their data be deleted? **In-app (Settings → Delete account)** and **web URL**: https://urcare-app.onrender.com/delete-account.html
- Account creation: **Username and password** + **OAuth (Google; Apple on iOS)**

**"Shared" = No for every row below.** The only outside parties are service
providers that process data on UrCare's behalf (Supabase, Render, Anthropic,
Groq, Firebase, ip-api.com), and Play's definition of "sharing" excludes
service providers. Delivery addresses go on the parcel when the UrCare team
ships an order by hand; that's a transfer the user asked for, which is also
excluded. There is no courier integration.

| Play category → data type | Collected | Optional? | Purposes |
|---|---|---|---|
| Personal info → Name | Yes | Required | App functionality, Account management |
| Personal info → Email address | Yes | Required | App functionality, Account management |
| Personal info → User IDs | Yes | Required | App functionality, Account management |
| Personal info → Address | Yes | Optional (only for store orders) | App functionality |
| Personal info → Phone number | Yes | Optional | App functionality |
| Personal info → Other info (age, gender, height, weight) | Yes | Required | App functionality, Personalization |
| Financial info → Purchase history | Yes | Optional | App functionality |
| Financial info → Other financial info (UPI payment screenshot, UPI reference no.) | Yes | Optional | App functionality |
| Health and fitness → Health info | Yes | Required | App functionality, Personalization |
| Health and fitness → Fitness info | Yes | Optional | App functionality, Personalization |
| Messages → Other in-app messages | Yes | Optional | App functionality |
| Photos and videos → Photos | Yes | Optional | App functionality |
| Photos and videos → Videos (chat attachments) | Yes | Optional | App functionality |
| Files and docs | Yes | Optional | App functionality |
| Location → Approximate location (city/country from IP) | Yes | Required (automatic) | Analytics |
| App activity → App interactions | Yes | Required (automatic) | Analytics |
| Device or other IDs (push-notification token) | Yes | Optional (only if notifications allowed) | App functionality |

**Not collected (answer No):** Precise location, Contacts, Calendar, Audio
(calls go phone-to-phone and are never sent to or stored by UrCare), Web
browsing, Search history, Installed apps, Crash logs, Diagnostics, Race/
ethnicity, Political/religious beliefs, Sexual orientation, Credit/debit card
or bank details (the user pays inside their own UPI app).

**Processed ephemerally?** No (the rows above are stored). **Used for ads or
tracking?** No for every row.

## App Store Connect: App Privacy
- Tracking: **No** (no data used for tracking, no ad SDKs)
- **Data Linked to You:**
  - Contact Info: Name, Email Address, Phone Number, Physical Address
  - Health & Fitness: Health, Fitness
  - Financial Info: Other Financial Info (UPI screenshot / reference)
  - Location: Coarse Location
  - User Content: Photos or Videos, Other User Content (reports, documents), Customer Support, Emails or Text Messages (in-app chat)
  - Identifiers: User ID, Device ID (push token)
  - Purchases: Purchase History
  - Usage Data: Product Interaction
- Purpose for every item: **App Functionality**. Also **Analytics** for Coarse Location and Product Interaction, and **Product Personalization** for Health & Fitness.
- Data Not Collected: Audio Data, Contacts, Precise Location, Browsing/Search History, Sensitive Info, Diagnostics.

## Reviewer notes / App access
Paste this into Play Console → App content → App access ("All or some
functionality is restricted" → add instructions) and App Store Connect →
App Review Information. **The email and password are in
`store/reviewer-login.local`. That file is kept out of git because the repo
is public. Don't commit it.**

> Sign in with email and password (not Google). The demo account already has
> a completed health profile and a sample lab report (sample data, clearly
> labelled), so the app opens straight to the home screen.
> Camera is used to scan meals and lab reports. The microphone is used only
> for Health Circle voice calls between two users who have accepted each
> other's request. Calls go directly between the phones and are not recorded.
> The in-app store sells physical nutrition products that are shipped to the
> user and paid by UPI, which is allowed for physical goods. No digital
> content, subscriptions or app features are sold inside the app.
> UrCare gives general wellness guidance and shows a medical disclaimer on the
> sign-in screen, in Settings and in the Terms.

The demo account is exempt from the app-unlock paywall on the server
(`APP_ACCESS_EXEMPT_EMAILS` in server.ts), so reviewers always get full access.
To recreate it or reset its password, ask Claude Code, or rerun the same
steps: Supabase admin creates the user, then a profile + health_profiles +
one lab_reports row.

## App Store Connect: fields that differ from Play
| Field | Value |
|---|---|
| Name (max 30) | UrCare: Metabolic Health Coach |
| Subtitle (max 30) | Diet & lifestyle health coach |
| Keywords (max 100) | diabetes,blood pressure,diet plan,HbA1c,sugar,thyroid,PCOS,fatty liver,meal scanner,lab report,habit |
| Promotional text | Your daily diet, exercise and lifestyle plan for diabetes, BP and metabolic health, with lab report tracking and meal scan. |
| Description | Same as "Full description" above |
| Primary category | Health & Fitness (not Medical) |
| Price | Free |
| Bundle ID | org.urcare.app |
| SKU | urcare-ios-001 |
| Copyright | 2026 UrCare |
| Availability | All countries, or India only if you prefer |

**Age rating questionnaire:** answer **Medical or Treatment Information:
Yes (Infrequent/Mild)**. UrCare gives wellness guidance and shows lab
values, but doesn't diagnose or prescribe. Answer **None/No** to everything
else (violence, gambling, mature themes, unrestricted web access).
"User-generated content / messaging" = Yes (Health Circle chat between people who
accepted each other's request; users can remove a connection). Apple
calculates the rating itself.

**App Review Information:**
- Sign-in required: Yes. Use the same demo email and password (`store/reviewer-login.local`).
- Notes: same reviewer notes as above, plus: "On iOS, sign-in is email and
  password only. There is no third-party sign-in, so Sign in with Apple is
  not required (Guideline 4.8)."
- Contact: your name, phone, urcarein@gmail.com

**Screenshots:** iPhone 6.9" display (1320 × 2868 or 1290 × 2796), 3–10 images.
The app is iPhone-only, so no iPad screenshots are needed.

**Later, if you turn on Google login for iOS:** first set up Sign in with
Apple (Apple Developer → Identifiers → Services ID + key, then Supabase →
Authentication → Providers → Apple). The app then shows both buttons
automatically.
