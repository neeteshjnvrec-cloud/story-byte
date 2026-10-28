# ▶️ YouTube Auto-Upload — Setup Guide (quick path, weekly upkeep)

## ✅ What's done

- `scripts/lib/youtube.js` uploads a story's full narrated video (the same
  full-length one Facebook gets — no ~90s Reel-style duration cap) to your
  connected YouTube channel, right after a story publishes.
- It's a **silent no-op until you add three secrets** — nothing breaks, no
  videos are uploaded, until you finish the steps below.
- `scripts/youtube-auth.js` is a small local script that does the one-time
  (well — weekly, see below) Google login dance for you.

## The tradeoff you're choosing here

Real YouTube uploads need OAuth (Google won't allow this via a simple API
key). Google's OAuth apps start in **Testing** mode, where the refresh
token that lets the pipeline upload without you present **expires every ~7
days**. Making that permanent means submitting the app for Google's
verification review, which needs a privacy policy page + demo video and
can take days to weeks to approve — out of your control once submitted.

This setup takes the fast path instead: stay in Testing mode, get it
working in minutes, and re-mint the refresh token yourself about once a
week. If that gets old, ask to move to the verified path later — the code
doesn't change either way, just how long the token lasts.

## 🔧 Setup (~15 minutes, one-time)

### Step 1: Enable the YouTube Data API
Your Firebase project is already a Google Cloud project, so reuse it:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and
   select the `storybyte-76716` project (top-left project picker).
2. Go to **APIs & Services → Library**, search **"YouTube Data API v3"**,
   click it, then **Enable**.

### Step 2: Configure the OAuth consent screen
1. **APIs & Services → OAuth consent screen**.
2. User type: **External**. App name: `StoryByte` (or anything). Your email
   for support/developer contact.
3. Scopes: add `.../auth/youtube.upload` and `.../auth/youtube.force-ssl`
   (the second lets the pipeline post a question as the first comment on
   each Short; without it uploads still work and the comment is skipped).
   Also add `.../auth/yt-analytics.readonly`: the weekly Social Analytics
   report reads each video's retention (how many viewers are still there
   at 3 seconds) with it; enable **YouTube Analytics API** under APIs &
   Services → Library too.
   If your refresh token was minted before `force-ssl` or
   `yt-analytics.readonly` was added, re-run `node scripts/youtube-auth.js`
   and update `YOUTUBE_REFRESH_TOKEN`.
4. **Test users**: add the Google account that owns your YouTube channel.
5. Save — leave the app in **Testing** publishing status (don't submit for
   verification for this quick path).

### Step 3: Create OAuth credentials
1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **Web application** (not "Desktop app" — that type is
   *supposed* to auto-allow any localhost redirect without registering it,
   but the current Cloud Console doesn't reliably honor that, and shows up
   as `Error 400: redirect_uri_mismatch` when you try to authorize).
3. Name it anything.
4. Under **Authorized redirect URIs**, click **+ ADD URI** and paste
   exactly:
   ```
   http://localhost:53682/
   ```
   (trailing slash included — it has to match `youtube-auth.js`'s
   `REDIRECT_URI` byte-for-byte.)
5. **Create**, then save the **Client ID** and **Client Secret** it gives
   you.

### Step 4: Mint a refresh token (on your own machine, not CI)
```bash
cd scripts
npm install   # if you haven't already
YOUTUBE_CLIENT_ID=your-client-id \
YOUTUBE_CLIENT_SECRET=your-client-secret \
node youtube-auth.js
```
It prints a URL — open it in a browser **signed into the YouTube channel's
Google account**, approve access. You'll likely see Google's "unverified
app" warning screen first (expected, since we skipped verification) — click
**Advanced → Go to StoryByte (unsafe)** to proceed; this is you approving
your own app for your own account, not a real security risk. The script
then prints a refresh token.

### Step 5: Add all three as GitHub secrets
Repo → **Settings → Secrets and variables → Actions → New repository
secret**, one each for:
- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN` (from Step 4)

Both `daily-stories.yml` and `community-stories.yml` already read these —
no code changes needed on your end.

## 🔁 The weekly chore

Once uploads start failing with an auth error in the Actions log (roughly
every 7 days), just repeat **Step 4** and update the
`YOUTUBE_REFRESH_TOKEN` secret with the new value from Step 5. Nothing
else changes — same Client ID/Secret, just a fresh refresh token.

## Troubleshooting

**"Error 400: redirect_uri_mismatch"** — the redirect URI `youtube-auth.js`
sends (`http://localhost:53682/`) isn't registered on the OAuth client
you're using. This means either you created a "Desktop app" client (its
redirect URIs aren't editable after creation — make a new **Web
application** client instead, per Step 3) or the URI wasn't pasted exactly
(check for a missing trailing slash, `http` vs `https`, or a typo'd port).

**"invalid_client"** — a refresh token is tied to the specific OAuth
client that issued it. This error means the `YOUTUBE_CLIENT_ID` /
`YOUTUBE_CLIENT_SECRET` GitHub secrets don't match the client
`youtube-auth.js` was run with when it printed the current
`YOUTUBE_REFRESH_TOKEN` — usually from switching to a new client (e.g.
Desktop app → Web application, per the redirect_uri_mismatch fix above)
and only updating the refresh token secret, not the ID/secret to match.
Fix: update all three secrets together from the same client — the
Client ID and Client Secret from Google Cloud Console's Credentials
page for that client, and a refresh token minted by running
`youtube-auth.js` with those exact same two values.

## 📺 A second channel (Life of Jesus)

The Life of Jesus series (`.github/workflows/life-of-jesus.yml`) uploads to
its own YouTube channel, [@TheMysteryJesus](https://www.youtube.com/channel/UCVAOB3qVcF_xeW0yuPEr5Pg),
never StoryByte's: the workflow sets that channel's ID, and an upload stops
if the token belongs to any other channel. It needs that channel's own
refresh token; the Client ID and Secret above can be reused.

1. If the channel is on a different Google account from StoryByte's, add
   that account under **OAuth consent screen → Test users** first.
2. Mint a token as in Step 4, but in the browser pick **TheMysteryJesus** when Google
   asks which account or channel to use:
   ```bash
   cd scripts
   YOUTUBE_CLIENT_ID=your-client-id YOUTUBE_CLIENT_SECRET=your-client-secret node youtube-auth.js
   ```
3. Add it as the GitHub secret **`JESUS_YOUTUBE_REFRESH_TOKEN`**. Only if
   you made a separate OAuth client for it, also add
   `JESUS_YOUTUBE_CLIENT_ID` and `JESUS_YOUTUBE_CLIENT_SECRET`.
4. Verify the new channel's phone number (youtube.com/verify) so custom
   thumbnails work.

Like StoryByte's, this token expires about every 7 days while the app is in
Testing mode: re-mint it the same way when the run fails with an auth error.
Without the secret nothing is uploaded and the run fails; it never falls back
to StoryByte's channel.

## 🎙️ Backup voice (free)

Narration normally uses Microsoft's free edge-tts voice. That service is
unofficial, and sometimes refuses every request for hours (`403 Invalid
response status`). When it does, the daily Short, community stories and the
15-minute videos switch to a backup voice after a few retries
(`scripts/lib/backup-voice.js`).

**Gemini (free, no card)**: add one secret:

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey), sign in with your Google account, and click **Create API key** (on a new project if asked). No billing is needed.
2. GitHub → this repository → **Settings → Secrets and variables → Actions → New repository secret**: name `GEMINI_API_KEY`, value the key.

Gemini's free tier allows only about 10 speech requests a day, which is
enough as a backup: a daily Short with its teaser takes about 3, and a
15-minute episode about 4. The voice is Kore (female) or Charon (male),
matching the usual narrator.

**Google Cloud Text-to-Speech (optional, needs billing)**: tried after
Gemini, using the `FIREBASE_SERVICE_ACCOUNT` secret. In
[console.cloud.google.com](https://console.cloud.google.com), project
`storybyte-76716`: **APIs & Services → Library → "Cloud Text-to-Speech API" →
Enable**. Google requires a billing account for this, even though the first
1 million Neural2 characters a month are free.

With neither set up, an edge-tts outage still fails the run.
