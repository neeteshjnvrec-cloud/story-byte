# StoryByte

Audio short-stories app: Expo SDK 57 / React Native 0.86 / React 19, Firebase on the free **Spark** plan. README.md has the overview.

## Layout
- `App.js`, `src/` — the app. Screens in `src/screens/`, state in `src/context/`, Firestore access in `src/services/api.js`, theme in `src/theme/tokens.js` + `src/hooks/useTheme.js`.
- `scripts/` — the content pipeline (its own `package.json`), run by `.github/workflows/*.yml`. `scripts/lib/` holds shared helpers (TTS, images, video, social posting, push).
- `public/` — Firebase Hosting: the website plus story audio (`public/audio`) and covers (`public/covers`), committed so each deploy keeps them.
- `firestore/firestore.rules.json` — the live Firestore rules (`firebase.json` points here).
- `scripts/occasions.js` — festival days (2026–2027) with an `eveKatha` (posted the afternoon before by the 12:53 PM IST festival-eve run) and a morning `katha`; `scripts/lib/devotional-calendar.js` — weekday deities and Navratri. Add the next year's dates before January.
- `firestore/tests/` — emulator tests for the rules. The **Deploy Firestore Rules** workflow runs them before deploying.

## Rules that aren't obvious from the code
- No Cloud Functions: they need the paid Blaze plan. The app reads and writes Firestore directly, so **security rules are the only server-side check**. Any field a client can write must be validated in the rules, with a test in `firestore/tests/`.
- Never put secrets in a Firestore doc the app can read, in an `EXPO_PUBLIC_*` variable, or in `app.json`/`eas.json`: all of them ship to every user. Secrets live in GitHub Actions secrets and are used only by `scripts/`.
- Story lifecycle: `under_review` → `published` | `failed`. Only the pipeline (Admin SDK) publishes. `status: 'active'` is retired. `isCommunityStory` is the only thing separating Home (false) from Community (true).
- Push notifications go through the Expo Push API (`scripts/lib/notify.js`), not `admin.messaging()`: the app registers Expo tokens.
- Auth persistence imports from `@firebase/auth` (see `src/services/firebase.js`): the `firebase/auth` meta bundle doesn't export `getReactNativePersistence`.
- Firestore rules: `path.to(...)` isn't a rules function. It passes locally but fails at deploy.
- Dates in the pipeline are India dates (`istDate()`): the daily run starts at 5:17 AM IST, still the previous day in UTC.
- Guests (no account) can browse and listen; account-only actions go through `src/hooks/useRequireAccount.js`, and auth screens are also routes in the main stack for them.
- `functions/` holds no code (Cloud Functions need Blaze), only local, gitignored credentials some scripts fall back to.
- `ios/` and `android/` are local prebuild output (gitignored); EAS builds regenerate them from `app.json`.

## Commands
- Run the app: `npx expo start`
- Rules tests (needs Java): `cd firestore/tests && npm i --no-save @firebase/rules-unit-testing@4 firebase@11 firebase-tools@14 && npm test`
- Android build: `EAS_NO_VCS=1 eas build -p android --profile preview` (APK) or `--profile production`. `EAS_NO_VCS=1` keeps the git history (~210 MB of old audio) out of the upload; `.easignore` decides what goes in.
