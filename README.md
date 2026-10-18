# StoryByte

**Listen. Escape. Repeat.** Hindi and English audio stories: a new devotional katha every morning, festival kathas, long video episodes and stories written by the community.

- Android app: [Google Play](https://play.google.com/store/apps/details?id=com.storybyte.app)
- Website (every story's page, with audio and text): https://storybyte-76716.web.app
- Daily katha on WhatsApp: https://whatsapp.com/channel/0029VbEOIuxAojZ0Wgg11J2l

Everything runs on free tiers: Firebase Spark, GitHub Actions, Groq, edge-tts and Cloudflare Workers AI.

## How it fits together

```
GitHub Actions (scripts/)                     Firebase (Spark plan)
  Groq writes the katha                         Hosting: public/ — website, audio, covers
  edge-tts narrates it          ── deploy ──▶   Firestore: stories, users, wallets…
  Cloudflare Workers AI draws the art            ▲
  ffmpeg renders the Short                        │ reads/writes directly
  posts to YouTube / Facebook / Instagram         │ (security rules are the only check)
                                                StoryByte app (Expo / React Native)
```

There are no Cloud Functions (they need the paid Blaze plan). The app talks to Firestore directly, so `firestore/firestore.rules.json` decides what every client may read or write.

## Repository

| Path | What |
|---|---|
| `App.js`, `src/` | The app: screens, contexts (auth, audio, video, wallet, notifications), `services/api.js` (Firestore) |
| `scripts/` | The content pipeline (own `package.json`); `scripts/lib/` holds TTS, art, video and social-posting helpers |
| `scripts/occasions.js`, `scripts/lib/devotional-calendar.js` | What each day's katha is: weekday deity, Navratri, festival days |
| `.github/workflows/` | Daily stories (5:17 AM IST, plus a 12:53 PM festival-eve run), community stories (hourly), weekly long katha (Sunday), rules deploy, social analytics |
| `public/` | Firebase Hosting: website, story pages, audio and covers (committed so each deploy keeps them) |
| `firestore/` | Security rules, indexes and their emulator tests (`firestore/tests/`) |
| `docs/play-store/` | Play Store listing text and screenshots |
| `CHANNEL-IDENTITY.md` | Channel strategy, posting schedule, festival calendar, WhatsApp |

## Run the app

```bash
npm install
cp .env.example .env      # Firebase web config (public) and Google client IDs
npx expo start
```

Google Sign-In needs a development or release build, not Expo Go. Without an account, people can still browse and listen (guest mode); favourites, likes, ratings, comments, coins and creating stories ask them to sign in.

## Build and release (Android)

```bash
eas build -p android --profile preview      # APK to install and test
eas build -p android --profile production   # AAB for Play Console
```

Release builds shrink code and resources (`app.json` → `expo-build-properties`), so test a preview APK before uploading.

## Security rules

```bash
cd firestore/tests
npm i --no-save @firebase/rules-unit-testing@4 firebase@11 firebase-tools@14
npm test                  # needs Java (the Firestore emulator)
```

The **Deploy Firestore Rules** workflow runs the same tests and then deploys the rules and indexes.

## Pipeline secrets

Set in GitHub → Settings → Secrets and variables → Actions: `GROQ_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`, and optionally the social accounts' tokens (`YOUTUBE-SETUP.md`, `INSTAGRAM-SETUP.md`), `GEMINI_API_KEY`, `SARVAM_API_KEY` and `CLOUDFLARE_*` (`CLOUDFLARE-SETUP.md`: add several free accounts via `CLOUDFLARE_ACCOUNTS`). Never put a secret in the app (`EXPO_PUBLIC_*`, `app.json`, `eas.json`) or in a Firestore document the app can read.

## License

MIT, see `LICENSE`.
**Built with ❤️ using Firebase Free Tier**
