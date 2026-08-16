# Deploy + Google Sign-In — setup steps

These require your own free accounts (Expo, Google Cloud). Code is already wired;
you just add credentials and run the build.

## A. Deploy an installable app (EAS Build — free for Android)

Prereqs: a free **Expo account** (expo.dev).

```bash
npm i -g eas-cli          # or use: npx eas-cli@latest <cmd>
eas login                 # your Expo account
eas init                  # links the repo to an Expo project (writes projectId to app.json)

# Android — FREE, produces an installable .apk you can share via a link:
eas build -p android --profile preview

# iOS — needs a paid Apple Developer account ($99/yr) for a device/TestFlight build:
eas build -p ios --profile preview
```

The build link is shareable; installing the APK gives a real app (no dev server,
no Expo Go). Over-the-air JS updates after a build exist:
```bash
eas update --branch preview -m "update"
```

> Google Sign-In only works in a **real build** (dev/standalone), not in Expo Go
> on SDK 51+. So build via EAS to test Google login.

## B. Enable Google Sign-In

### 1. Turn it on in Firebase
Firebase Console → **Authentication → Sign-in method → Google → Enable** (set a
support email). This auto-creates a **Web client** OAuth credential.

### 2. Get / create the OAuth client IDs (Google Cloud Console → APIs & Services → Credentials)
- **Web client ID** — the one Firebase auto-created ("Web client (auto created…)").
- **iOS client ID** — Create Credentials → OAuth client ID → iOS → bundle id `com.storybyte.app`.
- **Android client ID** — OAuth client ID → Android → package `com.storybyte.app` +
  the SHA‑1 of your EAS build keystore (`eas credentials` → Android → show SHA‑1).

### 3. Add them to `.env` (gitignored)
```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=xxxxx.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=xxxxx.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=xxxxx.apps.googleusercontent.com
```
The app reads these automatically ([src/hooks/useGoogleAuth.js](src/hooks/useGoogleAuth.js)).
Until they're set, the "Continue with Google" button shows "not set up yet."

### 4. iOS redirect scheme (for iOS builds)
Add the **reversed iOS client ID** as a URL scheme in `app.json` →
`expo.ios.infoPlist.CFBundleURLTypes` (e.g. `com.googleusercontent.apps.xxxxx`).
Android uses the app scheme `storybyte` (already set).

Once the IDs are in `.env` and you've made a build, tap **Continue with Google** →
Google account picker → you're signed in (Firebase `signInWithCredential`).
