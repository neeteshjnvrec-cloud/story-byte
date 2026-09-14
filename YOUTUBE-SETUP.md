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
3. Scopes: add `.../auth/youtube.upload`.
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
