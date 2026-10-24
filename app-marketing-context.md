# StoryByte — app marketing context

Read by the ASO and marketing skills (`aso-audit`, `android-aso`, `keyword-research` …). Snapshot taken 2026-10-24 from the live Play Store page, `reports/social/summary.md` (2026-10-19) and the codebase. Update it when the listing, numbers or goals change.

## App Overview
- **App Name:** StoryByte: Har Mood Ki Kahani
- **App ID (Apple):** none (not on iOS)
- **App ID (Google Play):** `com.storybyte.app`
- **Category:** Productivity (live). Should be **Books & Reference** (planned in `docs/play-store/LISTING.md`, not yet changed). Also listed under Family.
- **Platform:** Android only
- **Price Model:** Free, no ads, no subscription. Coins come from daily check-ins and invites; nothing is sold.
- **Launch Date:** about April 2026
- **Current Version:** 2.1.0 (live listing updated 15 Oct 2026)

## Value Proposition
- **Problem:** Hindi-speaking listeners want stories and devotional kathas to listen to (commute, bedtime, puja time), but the big audio apps lock most episodes behind coins or subscriptions.
- **Target Audience:**
  - *Devotional:* Hindi-speaking families in India, 30–65, often women, who listen to kathas in the morning, on festival days and on the deity's weekday (Tuesday Hanuman, Saturday Shani …). They find content on YouTube Shorts, Facebook and WhatsApp, and aren't used to installing apps.
  - *Stories:* Hindi and English listeners, 18–35, who want romance, drama, mystery and sleep stories. In-app data says this group listens most.
- **Unique Differentiator:**
  - Completely free: no coin paywall per episode (unlike Pocket FM and Kuku FM).
  - A new katha every morning, matched to the weekday's deity and to the festival calendar. Festival kathas are posted the evening before.
  - Read along: every story has its full text.
  - Anyone can write one line and get a full narrated story in 16 Indian languages.
- **Elevator Pitch:** Free Hindi audio stories and a new devotional katha every morning, with no coins or subscription.

## Competitors
| App | Strengths | Weaknesses |
|-----|-----------|------------|
| Pocket FM | Huge library of cliffhanger audio series, strong ads, high ratings volume | Episodes locked behind coins; long serials, not short stories; no devotional focus |
| Kuku FM | Hindi audiobooks, stories and spiritual content, big brand | Subscription needed for most content |
| Sri Mandir and other bhakti apps | Strong devotional brand, aarti, puja, temple services | Focused on rituals and offerings, not narrated stories |
| YouTube bhakti channels | Where the devotional audience already is; free | Not an app, so nothing to install; that's the reason viewers don't come to StoryByte |

Competitor package names are unverified; check them in `competitor-analysis` before using them.

## Current ASO State
- **Title:** StoryByte: Har Mood Ki Kahani (29/30)
- **Short description (live):** "Listen. Escape. Repeat. High-quality audio stories to recharge your imagination." This is the old one, and it has no Hindi, "kahani" or "katha" keywords. The prepared replacement in `docs/play-store/LISTING.md` ("Hindi audio stories & kathas — romance, mystery, bedtime and devotional") hasn't been applied.
- **Full description:** the `LISTING.md` version is live. It's feature-led and in English.
- **Rating:** none yet (no ratings shown)
- **Downloads:** 10+
- **Primary Keywords (intended):** hindi kahani, audio story, kahaniyan, katha, bhakti stories, bedtime stories, sleep stories, romance stories
- **Graphics:** 8 phone screenshots, 7- and 10-inch tablet sets, feature graphic (in `docs/play-store/`)

## Performance (as of 2026-10-19)
- **YouTube:** 48 Shorts with 37,884 views in total. The top 3 are "nature creates a deity" Shorts (10k, 8.4k, 7.6k). Bhajan-audio Shorts get about 1.2k each. Daily katha Shorts get 8–323 views (most under 50). 30 long videos have 371 views in total.
- **Facebook:** page "Littlekrishna.ai", 4,208 followers, low reactions (12–73 per post)
- **Instagram:** @cute_krishna.ai, 13 followers
- **Telegram:** t.me/storybytes (new 2026-10-24); **WhatsApp Channel:** live
- **App (Firestore):** 175 stories, 1,081 plays. Plays per story: romance and drama in Hindi 14–27, sleep and mystery about 10, **devotional 1.4**.
- **Takeaway:** the content that gets views (visual-wow devotional Shorts) and the content app users play (Hindi drama and romance) are different, and social accounts don't carry the StoryByte name.

## Goals
Proposed, not yet confirmed by the owner:
1. Installs: from 10+ to 1,000+ by 31 Jan 2027
2. Ratings: 25+ ratings at 4.5★ or above by 31 Dec 2026
3. Retention: listeners coming back weekly (the daily katha and the morning push as the habit)

## Resources
- **Budget:** ₹0 (free promotion only)
- **Team:** solo developer
- **Tools:** Play Console, Firebase (Spark), GitHub Actions content pipeline that auto-posts daily to YouTube, Facebook, Instagram and Telegram; `scripts/analyze-social.js` snapshot
- **Constraints:** no paid ads; content is AI-generated (Groq text, edge-tts voice, Cloudflare images), and YouTube is strict on mass-produced AI content; Android only

## Markets
- **Primary:** India (Hindi belt: UP, Bihar, MP, Rajasthan, Delhi, Haryana)
- **Secondary:** Indian diaspora
- **Languages:** Hindi (main), English; story creation in 16 Indian languages
