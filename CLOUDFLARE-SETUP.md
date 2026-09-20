# 🖼️ Cloudflare Workers AI Image Fallback — Setup Guide

## ✅ What's done

- `scripts/lib/cloudflare-image.js` generates images via Cloudflare
  Workers AI's free tier (model: `@cf/black-forest-labs/flux-1-schnell`).
- `scripts/lib/scene-image.js` tries pollinations.ai first (unchanged) and
  automatically falls back to Cloudflare if it fails, for **both** the
  story cover and the carousel/video scene art.
- **Silent no-op until you add two secrets** — until then, a pollinations
  failure falls straight to the existing local fallback (a themed gradient
  cover, or plainer carousel/video art) exactly as it does today.

## Why this (and not Gemini)

pollinations.ai has had real multi-hour outages in production. Gemini was
tried first as a fallback, but turned out to require billing enabled on
the Google Cloud project — its free tier no longer covers image models as
of a December 2025 policy change (confirmed directly against the live
API: every image model returned a hard quota of 0 with no billing linked).

Cloudflare Workers AI was verified working with a real, no-card-required
free account before being wired in: 10,000 free "neurons"/day (resets
daily), and a Flux-1-schnell image costs under 10 neurons — over 1,000
free images/day, comfortably more than any story needs.

## 🔧 Setup (~3 minutes, one-time)

### Step 1: Create a free Cloudflare account
1. Go to **[dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)**.
2. Sign up with just an email + password — no credit card required.

### Step 2: Get an API token
1. In the dashboard, go to **Workers AI** (left sidebar, under "AI").
2. Click **Use REST API**, then **Create a Workers AI API Token** (or go
   to **My Profile → API Tokens → Create Token** and use the "Workers AI"
   template, which prefills the **Workers AI - Read** and **Workers AI -
   Edit** permissions it needs).
3. Copy the token it gives you.

### Step 3: Get your Account ID
Still on the Workers AI REST API page, copy the **Account ID** shown
there (also found under **My Profile → Account Home**).

### Step 4: Add both as GitHub secrets
Repo → **Settings → Secrets and variables → Actions → New repository
secret**, one each for:
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Both `daily-stories.yml` and `community-stories.yml` already read these —
no code changes needed on your end.

## Notes

- The Flux-1-schnell model always returns a 1024x1024 image (no
  width/height parameter) — `scene-image.js` resizes/crops it to whatever
  size the cover or scene slot needs, so this is transparent in practice.
- `CLOUDFLARE_IMAGE_MODEL` env var overrides the model id if Cloudflare
  ever renames or retires this one — see their
  [model catalog](https://developers.cloudflare.com/workers-ai/models/)
  for current text-to-image options.
- Cloudflare is only ever used as a *fallback* — pollinations.ai stays the
  primary provider, so this doesn't change anything about normal-day
  behavior when pollinations is healthy.
