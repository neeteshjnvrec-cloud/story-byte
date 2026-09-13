# 📸 Instagram Auto-Post — Setup Guide

## ✅ What's Done

- ✅ Every published story (daily AI + community) renders a 4–7 slide
  Instagram carousel: no separate title card — slide 1 goes straight into
  the story's cover art + opening teaser, each following slide gets its own
  AI-illustrated scene for that beat (via Groq + pollinations.ai), and the
  last slide is a "play the story" CTA.
- ✅ `scripts/lib/instagram.js` posts that carousel to your Instagram account
  via the Graph API, right after a story flips to `published`.
- ✅ It's a **silent no-op until you add two secrets** — nothing breaks, no
  stories are published to Instagram, until you finish the steps below.
- ✅ `node scripts/preview-carousel.js` renders the slide design locally with
  no credentials, so you can see/tweak the look before going live.

Instagram's Graph API only supports **silent image carousels** — there is no
API for posting a video/Reel with your TTS narration baked in, so the audio
narration stays an in-app/on-page feature; the Instagram post is the visual
teaser that drives people to listen.

---

## 🔧 Setup (~20 minutes, one-time)

You need an Instagram **Business or Creator** account (not personal — the API
flatly does not support personal accounts) linked to a Facebook Page, plus a
Meta developer app to mint an access token.

### Step 1: Convert your Instagram account
1. Instagram app → Settings → Account type and tools → **Switch to
   professional account** → choose **Business** (or Creator).
2. During setup, link it to a **Facebook Page** you control (create a new one
   if you don't have one — it can be minimal, it's just the technical bridge
   Meta's API requires).

### Step 2: Create a Meta developer app
1. Go to https://developers.facebook.com/apps → **Create App** → type
   **Business**.
2. In the app dashboard, add the **Instagram Graph API** product.
3. Under **App Roles → Roles**, make sure your Facebook account is an admin
   (it will be, since you created the app).

### Step 3: Get a long-lived access token
1. Go to https://developers.facebook.com/tools/explorer/, select your app.
2. Click **Get Token → Get User Access Token**, and check these permissions:
   `instagram_basic`, `instagram_content_publish`, `pages_show_list`,
   `pages_read_engagement`.
3. Generate the token, then exchange it for a **long-lived** one (valid ~60
   days) by calling, once, in your browser or via curl:
   ```
   https://graph.facebook.com/v21.0/oauth/access_token?
     grant_type=fb_exchange_token&
     client_id=<YOUR_APP_ID>&
     client_secret=<YOUR_APP_SECRET>&
     fb_exchange_token=<SHORT_LIVED_TOKEN_FROM_STEP_2>
   ```
   Copy the `access_token` from the response — that's your `IG_ACCESS_TOKEN`.

   ⚠️ It still expires (~60 days). Set a reminder to redo this step, or look
   into Meta's token-refresh endpoint if you want to automate renewal later.

### Step 4: Find your Instagram Business Account ID
With the same token, call:
```
https://graph.facebook.com/v21.0/me/accounts?access_token=<YOUR_TOKEN>
```
Find your Page in the list, copy its `id`, then call:
```
https://graph.facebook.com/v21.0/<PAGE_ID>?fields=instagram_business_account&access_token=<YOUR_TOKEN>
```
The `instagram_business_account.id` in the response is your
`IG_BUSINESS_ACCOUNT_ID`.

### Step 5: Add the two GitHub secrets
Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret name | Value |
|---|---|
| `IG_BUSINESS_ACCOUNT_ID` | the id from Step 4 |
| `IG_ACCESS_TOKEN` | the long-lived token from Step 3 |

That's it — both `daily-stories.yml` and `community-stories.yml` already pass
these through as env vars. The very next story either pipeline publishes will
also post to Instagram automatically.

---

## 🧪 Test it

- **Design only, no credentials needed:**
  ```bash
  cd scripts && node preview-carousel.js
  ```
  Renders sample slides to `.carousel-preview/` so you can eyeball the look.

- **End-to-end, after adding the secrets:** trigger either workflow manually
  from the **Actions** tab (`workflow_dispatch`). For community stories you
  can target one story with the `story_id` input. Watch the job log for
  `✅ Instagram carousel published` or a `⚠️ Instagram post failed: …` line
  explaining why.

---

## 📐 How the carousel is built

- `scripts/lib/carousel-copy.js` asks Groq for a spoiler-free hook line, plus
  one teaser line *and* a scene description per slide — so the copy is
  curiosity-driven rather than a raw excerpt of the story text. Falls back to
  evenly-sampled sentences (no scene description) if Groq is unavailable.
- `scripts/lib/carousel-slides.js` turns each teaser into a slide: when a
  scene description exists, it fetches a bespoke illustration for it from
  pollinations.ai (same free service already used for story covers) and
  composites the teaser text over it; otherwise it falls back to a themed
  gradient card. All done with `sharp` + inline SVG — no browser needed.
- `scripts/lib/instagram.js` does the three Graph API calls per post (upload
  each image as a carousel child → create the carousel container → publish
  it), and is a no-op whenever the two secrets above aren't set.

## ⚠️ Limits worth knowing
- Instagram caps a carousel at **10 items** — the pipeline uses at most 7
  (up to 6 story-arc slides + CTA).
- The Graph API caps an account at **25 published posts per 24 hours**, so a
  burst of many stories publishing at once won't all necessarily go out.
- Captions can't contain a clickable link — the pipeline drops the story's
  page URL into the caption text (for context/copy-paste) and points people to
  "link in bio" for the tap-through.
