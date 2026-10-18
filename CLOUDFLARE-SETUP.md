# 🖼️ Cloudflare Workers AI images — Setup Guide

Every picture the pipeline draws (story covers, Short and long-video scenes, Instagram slides) comes from Cloudflare Workers AI's free tier:

- **FLUX.2 [klein]** (`@cf/black-forest-labs/flux-2-klein-4b`) for video scenes, drawn at the video's own shape: the sharp pictures.
- **flux-1-schnell** (`@cf/black-forest-labs/flux-1-schnell`) when FLUX.2 fails: a 1024×1024 square resized to fit, softer.

pollinations.ai was removed: its pictures were too poor to post.

## The daily budget, and why more accounts help

Each free Cloudflare account gets **10,000 "neurons" a day**, reset at 00:00 UTC, shared by both models and every workflow that day:

| What | Roughly |
|---|---|
| One FLUX.2 Short picture (864×1536) | ~160 neurons |
| Daily Short (up to 22 pictures) | ~3,500 |
| Festival-eve Short | ~3,500 |
| Sunday long katha (~45 pictures, 1344×768) | ~7,400 |
| One flux-1-schnell picture | under 10 |

A Sunday, or the day before a festival, can need more than one account's 10,000. With several accounts, when one runs out the next carries on (`scripts/lib/cloudflare-image.js`). If a picture still fails, the video reuses a reframed neighbouring picture rather than a blank gradient card.

## 🔧 Setup (~3 minutes per account)

### 1. Create a free Cloudflare account
[dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up): email and password, no card.

### 2. Get an API token
Dashboard → **Workers AI** → **Use REST API** → **Create a Workers AI API Token** (or My Profile → API Tokens → Create Token → the "Workers AI" template). Copy the token.

### 3. Get the Account ID
On the same Workers AI REST API page (also under My Profile → Account Home).

### 4. Add them as GitHub secrets
Repo → **Settings → Secrets and variables → Actions → New repository secret**:

- **First account:** `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`.
- **Every extra account:** one secret named `CLOUDFLARE_ACCOUNTS`, one account per line as `accountId:apiToken`:

  ```
  1a2b3c4d5e6f...:AbCdEfGh123...
  9z8y7x6w5v4u...:ZyXwVu987...
  ```

  To add an account later, edit the secret and add a line.

Every image workflow (Daily Stories, Community Stories, Weekly Long Katha, Remake Short, Deity Portraits, Test Landscape Episode) already reads all three.

## Notes

- A run's log shows how each video's pictures came out, e.g. `🖼️ Video pictures: 20 hq, 2 reused`. `hq` is FLUX.2, `standard` is flux-1-schnell, `reused` is a reframed neighbouring picture. When an account runs out it logs `Cloudflare account 1/3: free daily allocation used up, trying the next account`.
- `CLOUDFLARE_IMAGE_MODEL` and `CLOUDFLARE_HQ_MODEL` override the model ids if Cloudflare renames or retires them ([model catalog](https://developers.cloudflare.com/workers-ai/models/)).
