# 🖼️ Gemini Image Fallback — Setup Guide

## ✅ What's done

- `scripts/lib/gemini-image.js` generates images via the Gemini API's free
  tier.
- `scripts/lib/scene-image.js` tries pollinations.ai first (unchanged) and
  automatically falls back to Gemini if it fails, for **both** the story
  cover and the carousel/video scene art.
- **Silent no-op until you add one secret** — until then, a pollinations
  failure falls straight to the existing local fallbacks (a themed
  gradient cover, or plainer carousel/video art) exactly as it does today.

## Why this matters

pollinations.ai has had real multi-hour outages in production — confirmed
independently (direct requests with no auth involved returned `HTTP 500`
for over an hour). No amount of client-side retrying can work around an
actual outage on their end, and until now, that meant no bespoke cover art
at all until they recovered.

Gemini's free tier is far more generous (up to 500 image requests/day)
and needs no artificial request pacing the way pollinations' tiers do, so
it's a solid second option for exactly those windows.

## 🔧 Setup (~2 minutes, one-time)

### Step 1: Get a free API key
1. Go to **[aistudio.google.com](https://aistudio.google.com)**.
2. Sign in with any Google account (no new account needed, no payment
   info required for the free tier).
3. Click **Get API key → Create API key**.
4. Copy the key it gives you (starts with `AIza...`).

### Step 2: Add it as a GitHub secret
Repo → **Settings → Secrets and variables → Actions → New repository
secret**:
- Name: `GEMINI_API_KEY`
- Value: the key from Step 1

Both `daily-stories.yml` and `community-stories.yml` already read this —
no code changes needed on your end.

## Notes

- This key is separate from your Firebase service account, even though
  both live under Google — Gemini API keys are minted from AI Studio, not
  the Firebase/Google Cloud console.
- The exact free-tier image model Google exposes has changed names before
  (from "Nano Banana" onward) — `gemini-image.js` tries a short list of
  model ids (`GEMINI_IMAGE_MODEL` env var, comma-separated) rather than
  hardcoding one, the same fallback-chain pattern used for the Groq text
  models elsewhere in this pipeline. If every model in the list ever
  starts failing with a 404 ("model not found"), check
  [ai.google.dev](https://ai.google.dev/gemini-api/docs/image-generation)
  for the current model id and add it to that list (or set
  `GEMINI_IMAGE_MODEL` to override it directly).
- Gemini is only ever used as a *fallback* — pollinations.ai stays the
  primary provider, so this doesn't change anything about normal-day
  behavior or image style/cost when pollinations is healthy.
