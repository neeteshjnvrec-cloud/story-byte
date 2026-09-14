# 🎨 Pollinations.ai Image Rate Limit — Setup Guide

## ✅ What's done

- Story covers, carousel slides, and narrated-video scenes all fetch
  bespoke AI art from pollinations.ai's free image API
  (`scripts/lib/scene-image.js`).
- Every request is paced through one shared gate so a story's dozen-plus
  requests never fire faster than pollinations' own rate limit allows.
- **It's a silent no-op until you add one secret** — everything above
  already works anonymously, just paced at pollinations' slower anonymous
  rate (1 request/15s) until you finish the step below.

## Why this matters

Pollinations' **anonymous** tier only allows **one request every 15
seconds**. A single story needs up to ~12 of these (up to 6 carousel slides
+ up to 6 video scenes), so generating all of a story's art can take a
couple of minutes even when everything succeeds — and under load, a
request can still time out and fall back to generic art instead of a
bespoke illustration.

Free registration lifts this to the **Seed tier: one request every 5
seconds** — about 3x faster, and comfortably inside what pollinations
expects from a real client, so fewer timeouts too.

## 🔧 Setup (~2 minutes, one-time)

### Step 1: Get a token
1. Go to **[auth.pollinations.ai](https://auth.pollinations.ai)**.
2. Sign in / register (free — no payment info).
3. Copy the Bearer token it gives you.

### Step 2: Add it as a GitHub secret
1. Repo → **Settings → Secrets and variables → Actions**.
2. **New repository secret**:
   - Name: `POLLINATIONS_API_TOKEN`
   - Value: the token from Step 1
3. Done — both `daily-stories.yml` and `community-stories.yml` already read
   this secret (`scripts/lib/scene-image.js` picks it up automatically via
   `POLLINATIONS_API_TOKEN`). No code changes needed on your end.

### Verifying it worked
Next run's log won't say anything different on success (the pacing is
invisible when it works) — but you should see meaningfully fewer
`⚠️ Scene image fetch failed (... timed out ...)` warnings, and the
"Generate + host stories" step should finish noticeably faster than before.

If the secret is ever missing or wrong, nothing breaks — the pipeline just
falls back to the slower anonymous pace automatically.
