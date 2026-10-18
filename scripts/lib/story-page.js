/**
 * Story page renderer — the HTML behind a shared StoryByte link.
 *
 * A shared story used to be a bare `.mp3` URL: the recipient got an audio file
 * download with no cover, no title, no author and no way back to the app. These
 * pages replace that with a real story page carrying OpenGraph tags, which is
 * what produces the rich preview card in WhatsApp / iMessage / Telegram.
 *
 * The pages are static and generated at publish time on purpose. Preview
 * crawlers don't execute JavaScript, so a client-rendered page can never produce
 * a card, and server-rendered meta would need Cloud Functions — unavailable on
 * the Spark tier. Both publish pipelines already stage files into `public/` and
 * then run `firebase deploy --only hosting`, so a page slots in at no extra cost.
 *
 * Used by build-stories.js (daily), generate-community-audio.js (community) and
 * build-story-pages.js (backfill).
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { WHATSAPP_CHANNEL_URL } = require('./social-extras');

const PROJECT = process.env.FIREBASE_PROJECT_ID || 'storybyte-76716';
const SITE = process.env.HOSTING_SITE || `https://${PROJECT}.web.app`;

// Where "Get the app" goes. The app is live on Play; there is no iOS listing yet,
// so both platforms land here.
const PLAY_STORE_URL = process.env.PLAY_STORE_URL
  || require('./app-link').appLink('storybyte_web', 'story_page', 'web');

// A profile picture is a base64 data URI on the user doc, so it inflates the page
// by its full length. Past this, fall back to the initial-letter circle rather
// than shipping a megabyte of image to every reader.
const MAX_AVATAR_CHARS = 200 * 1024;

// --- escaping ----------------------------------------------------------------

/**
 * Escape for both HTML text nodes and quoted attribute values.
 *
 * Community titles and story text are user-submitted and go straight into
 * `meta content="…"`, so this is load-bearing: an unescaped `"` would end the
 * attribute early and a `<` would open a tag.
 */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Normalise an asset URL for use in markup.
 *
 * Half the daily story IDs contain Devanagari (the slug generator allows it), so
 * `coverImage` and `audioUrl` arrive with raw non-ASCII in the path. WHATWG URL
 * percent-encodes it, which is what crawlers and `<audio src>` need.
 */
function safeUrl(u) {
  if (!u) return '';
  try { return new URL(String(u)).href; } catch (e) { return String(u); }
}

// --- slug --------------------------------------------------------------------

/**
 * Lowercase ASCII-only slug; empty when the input has no ASCII alphanumerics.
 *
 * NFD-normalising first folds accents onto their base letter, so the Spanish,
 * French, German, Italian and Portuguese titles the language picker allows still
 * produce readable slugs (`Corazón` → `corazon`, not `coraz-n`). Devanagari is a
 * separate script rather than accented Latin, so it drops out entirely — those
 * stories fall back to the genre stem in pageSlug().
 */
function asciiSlug(s) {
  let out = '';
  for (const ch of String(s || '').normalize('NFD')) {
    if (ch >= 'a' && ch <= 'z') out += ch;
    else if (ch >= 'A' && ch <= 'Z') out += ch.toLowerCase();
    else if (ch >= '0' && ch <= '9') out += ch;
    // Anything non-ASCII is dropped outright rather than turned into a
    // separator: that covers both the combining marks NFD just split off
    // (so `corazon`, not `corazo-n`) and whole non-Latin scripts.
    else if (ch.charCodeAt(0) > 127) continue;
    else out += '-';
  }
  return out.replace(/-+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40).replace(/-$/, '');
}

/**
 * Page slug for a story: readable stem + short digest of the story ID.
 *
 * The raw story ID can't be the path. `2026-08-16_hi_drama_परिवार-की-मोहब्बत`
 * percent-encodes to ~200 characters, which makes an unshareable link and a
 * fragile one for preview crawlers. The digest keeps it unique when the stem
 * collapses to nothing (an all-Devanagari title) or repeats (same genre, same day).
 */
function pageSlug(story) {
  const id = String(story.storyId || story.id || '');
  const digest = crypto.createHash('sha1').update(id, 'utf8').digest('hex').slice(0, 6);
  const stem = asciiSlug(story.title) || asciiSlug(story.genre) || 'story';
  return `${stem}-${digest}`;
}

/** Public URL of a story's page. Kept next to pageSlug so the two can't drift. */
function pageUrlFor(story, site = SITE) {
  return `${site.replace(/\/$/, '')}/s/${pageSlug(story)}`;
}

// --- formatting --------------------------------------------------------------

// Same dual-format convention as the creation-time picker: the language's own
// name first (so the speaker recognises it) + the English name in parens (so
// everyone else can read it). Only English is bare — it would gloss itself.
const LANGUAGE_NAMES = {
  en: 'English', hi: 'हिन्दी (Hindi)', es: 'Español (Spanish)', fr: 'Français (French)',
  de: 'Deutsch (German)', it: 'Italiano (Italian)', pt: 'Português (Portuguese)',
  bn: 'বাংলা (Bengali)', mr: 'मराठी (Marathi)', te: 'తెలుగు (Telugu)', ta: 'தமிழ் (Tamil)',
  gu: 'ગુજરાતી (Gujarati)', ur: 'اردو (Urdu)', kn: 'ಕನ್ನಡ (Kannada)', or: 'ଓଡ଼ିଆ (Odia)', ml: 'മലയാളം (Malayalam)',
};

function fmtDuration(sec) {
  const s = Number(sec) || 0;
  if (s <= 0) return '';
  const min = Math.round(s / 60);
  if (min < 60) return `${Math.max(1, min)} min`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

/** One line, no runaway length — og:description is truncated by every crawler. */
function ogDescription(story) {
  const raw = (story.description || story.text || '').replace(/\s+/g, ' ').trim();
  if (raw.length <= 200) return raw;
  return `${raw.slice(0, 197).trimEnd()}…`;
}

/** Story text → escaped <p> blocks. Blank lines first, single newlines as fallback. */
function paragraphs(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  let blocks = raw.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length < 2) blocks = raw.split(/\n+/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((b) => `      <p>${esc(b)}</p>`).join('\n');
}

// --- author ------------------------------------------------------------------

/**
 * Normalise the two author shapes into one.
 *
 * Community stories carry `authorName` + `authorProfilePic` (a base64 data URI);
 * daily stories carry `author: 'StoryByte AI'` and no picture.
 */
function authorOf(story) {
  const name = String(story.authorName || story.author || 'StoryByte').trim() || 'StoryByte';
  const pic = String(story.authorProfilePic || '').trim();
  const usable = pic && pic.length <= MAX_AVATAR_CHARS && /^(data:image\/|https?:)/.test(pic);
  return { name, pic: usable ? pic : '', initial: name[0].toUpperCase() };
}

// --- render ------------------------------------------------------------------

/**
 * Full HTML for one story page.
 *
 * @param {object} story  Firestore story doc (plus `id`/`storyId`).
 * @param {object} [opts] `{ site, playStoreUrl }`
 */
function renderStoryPage(story, opts = {}) {
  const site = (opts.site || SITE).replace(/\/$/, '');
  const playUrl = opts.playStoreUrl || PLAY_STORE_URL;
  const id = String(story.storyId || story.id || '');

  const title = String(story.title || 'A StoryByte story').trim();
  const desc = ogDescription(story);
  const url = pageUrlFor(story, site);
  const cover = safeUrl(story.coverImage || `${site}/covers/${id}.jpg`);
  const audio = safeUrl(story.audioUrl || `${site}/audio/${id}.mp3`);
  const author = authorOf(story);
  const lang = String(story.language || 'en').toLowerCase();
  const isHindi = lang === 'hi';

  const chips = [
    story.genre ? { label: String(story.genre), cls: 'chip chip-genre' } : null,
    LANGUAGE_NAMES[lang] ? { label: LANGUAGE_NAMES[lang], cls: 'chip' } : null,
    fmtDuration(story.duration) ? { label: fmtDuration(story.duration), cls: 'chip' } : null,
  ].filter(Boolean);

  const avatar = author.pic
    ? `<img class="avatar" src="${esc(author.pic)}" alt="" width="44" height="44">`
    : `<div class="avatar avatar-fallback">${esc(author.initial)}</div>`;

  return `<!DOCTYPE html>
<html lang="${esc(lang)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} · StoryByte</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${esc(url)}">
  <link rel="icon" href="${esc(site)}/covers/${esc(id)}.jpg">

  <!-- OpenGraph: this is what renders the preview card when the link is pasted
       into WhatsApp, iMessage or Telegram. og:type stays "website" — it previews
       predictably everywhere, where music.song does not. -->
  <meta property="og:site_name" content="StoryByte">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:image" content="${esc(cover)}">
  <meta property="og:image:width" content="768">
  <meta property="og:image:height" content="768">
  <meta property="og:image:alt" content="Cover art for ${esc(title)}">
  <meta property="og:audio" content="${esc(audio)}">
  <meta property="og:audio:type" content="audio/mpeg">
  <meta property="og:locale" content="${isHindi ? 'hi_IN' : 'en_US'}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="${esc(cover)}">

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #F6EFE4;
      color: #2A2118;
      line-height: 1.7;
      padding: 0 20px;
    }
    .container { max-width: 680px; margin: 0 auto; padding: 28px 0 72px; }
    .brand {
      display: flex; align-items: center; gap: 10px; margin-bottom: 28px;
    }
    .brand-icon {
      width: 36px; height: 36px; border-radius: 11px;
      background: linear-gradient(135deg, #B5613A, #E0913A);
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 19px; font-weight: 700;
    }
    .brand-home { display: flex; align-items: center; gap: 10px; text-decoration: none; }
    .brand-text { font-size: 19px; font-weight: 700; color: #2A2118; }
    .brand-cta {
      margin-left: auto; font-size: 14px; font-weight: 600;
      color: #B5613A; text-decoration: none;
    }
    .cover {
      width: 100%; aspect-ratio: 1 / 1; max-height: 420px;
      object-fit: cover; border-radius: 20px;
      border: 1px solid #EADFCC; background: #FCF7EF; display: block;
    }
    h1 { font-size: 27px; font-weight: 700; line-height: 1.25; margin: 22px 0 0; }
    .byline { display: flex; align-items: center; gap: 11px; margin-top: 16px; }
    .avatar {
      width: 44px; height: 44px; border-radius: 50%;
      object-fit: cover; flex-shrink: 0; border: 1px solid #EADFCC;
    }
    .avatar-fallback {
      background: linear-gradient(135deg, #B5613A, #E0913A);
      color: #fff; font-size: 18px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; border: 0;
    }
    .byline-name { font-size: 15px; font-weight: 600; }
    .byline-role { font-size: 13px; color: #A99C89; line-height: 1.3; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
    .chip {
      font-size: 13px; font-weight: 600; color: #B5613A;
      background: rgba(181, 97, 58, 0.1);
      padding: 5px 12px; border-radius: 999px;
    }
    /* Genre arrives lowercase from the generator. Only it gets capitalised —
       applying this to every chip rendered the duration as "12 Min". */
    .chip-genre { text-transform: capitalize; }
    .player {
      background: #FCF7EF; border: 1px solid #EADFCC; border-radius: 16px;
      padding: 16px; margin-top: 22px;
    }
    .player-label {
      font-size: 11px; font-weight: 700; letter-spacing: 1.2px;
      color: #A99C89; text-transform: uppercase; margin-bottom: 10px;
    }
    audio { width: 100%; display: block; }
    .lead { font-size: 17px; color: #4A3D2F; margin-top: 24px; }
    .transcript { margin-top: 34px; }
    .transcript-label {
      font-size: 11px; font-weight: 700; letter-spacing: 1.2px;
      color: #A99C89; text-transform: uppercase; margin-bottom: 14px;
    }
    .transcript-body {
      background: #FCF7EF; border: 1px solid #EADFCC;
      border-radius: 16px; padding: 22px;
    }
    .transcript-body p { font-size: 16px; color: #4A3D2F; margin-bottom: 15px; }
    .transcript-body p:last-child { margin-bottom: 0; }
    .get-app {
      margin-top: 40px; padding: 28px 24px; text-align: center;
      background: #FCF7EF; border: 1px solid #EADFCC; border-radius: 20px;
    }
    .get-app h2 { font-size: 20px; font-weight: 700; margin-bottom: 6px; }
    .get-app p { font-size: 14px; color: #4A3D2F; margin-bottom: 20px; }
    .get-app .wa { margin: 18px 0 8px; font-weight: 700; }
    .get-app .wa a { color: #128C7E; }
    .btn {
      display: inline-block; padding: 15px 30px; border-radius: 999px;
      background: linear-gradient(135deg, #B5613A, #E0913A);
      color: #fff; font-size: 16px; font-weight: 700; text-decoration: none;
    }
    .footer {
      text-align: center; font-size: 13px; color: #A99C89;
      margin-top: 44px; padding-top: 22px; border-top: 1px solid #EADFCC;
    }
    .footer a { color: #A99C89; text-decoration: underline; }
    @media (max-width: 480px) {
      h1 { font-size: 23px; }
      .container { padding-top: 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">
      <!-- The wordmark goes to the home page (every story, lib/site-index.js);
           "Get the app" goes straight to the store. -->
      <a class="brand-home" href="${esc(site)}/"><span class="brand-icon">S</span>
      <span class="brand-text">StoryByte</span></a>
      <a class="brand-cta" href="${esc(playUrl)}">${isHindi ? 'ऐप डाउनलोड करें' : 'Get the app'}</a>
    </div>

    <img class="cover" src="${esc(cover)}" alt="Cover art for ${esc(title)}" width="768" height="768">

    <h1>${esc(title)}</h1>

    <div class="byline">
      ${avatar}
      <div>
        <div class="byline-name">${esc(author.name)}</div>
        <div class="byline-role">Narrated on StoryByte</div>
      </div>
    </div>

    ${chips.length ? `<div class="chips">${chips.map((c) => `<span class="${c.cls}">${esc(c.label)}</span>`).join('')}</div>` : ''}

    <div class="player">
      <div class="player-label">${isHindi ? 'सुनें' : 'Listen'}</div>
      <audio controls preload="metadata" src="${esc(audio)}">
        Your browser can't play audio. <a href="${esc(audio)}">Download the recording</a>.
      </audio>
    </div>

    ${story.description ? `<p class="lead">${esc(story.description)}</p>` : ''}

    ${story.text ? `<div class="transcript">
      <div class="transcript-label">${isHindi ? 'कथा' : 'Story'}</div>
      <div class="transcript-body">
${paragraphs(story.text)}
      </div>
    </div>` : ''}

    ${isHindi ? `<div class="get-app">
      <h2>हर सुबह एक नई पावन कथा</h2>
      <p>StoryByte ऐप में सभी कथाएँ ऑडियो में, मुफ़्त — जहाँ छोड़ा वहीं से सुनें, ऑफ़लाइन भी।</p>
      <a class="btn" href="${esc(playUrl)}">StoryByte ऐप डाउनलोड करें</a>
      <p class="wa"><a href="${esc(WHATSAPP_CHANNEL_URL)}">💬 रोज़ की कथा WhatsApp पर पाएँ</a></p>
      <p><a href="${esc(site)}/">और कथाएँ पढ़ें और सुनें →</a></p>
    </div>` : `<div class="get-app">
      <h2>Listen to more on StoryByte</h2>
      <p>Thousands of narrated stories — new ones every day. Free to listen, offline too.</p>
      <a class="btn" href="${esc(playUrl)}">Get the StoryByte app</a>
      <p><a href="${esc(site)}/">More stories →</a></p>
    </div>`}

    <div class="footer">
      <p>© 2025 StoryByte · <a href="${esc(site)}/privacy.html">Privacy</a></p>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Write a story's page into `{pubDir}/s/` and return where it will live.
 * Callers must write the page BEFORE deploying hosting, and only record
 * `pageUrl` on the story doc once the deploy succeeded.
 */
function writeStoryPage(pubDir, story, opts = {}) {
  const dir = path.join(pubDir, 's');
  fs.mkdirSync(dir, { recursive: true });
  const slug = pageSlug(story);
  const file = path.join(dir, `${slug}.html`);
  fs.writeFileSync(file, renderStoryPage(story, opts), 'utf8');
  return { slug, file, pageUrl: pageUrlFor(story, opts.site || SITE) };
}

module.exports = {
  PLAY_STORE_URL,
  SITE,
  esc,
  asciiSlug,
  pageSlug,
  pageUrlFor,
  renderStoryPage,
  writeStoryPage,
};
