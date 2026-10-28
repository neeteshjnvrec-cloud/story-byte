/**
 * The website's front door for search engines: a real home page listing
 * every story page, a sitemap, and robots.txt.
 *
 * Also video.html, one page that plays any long YouTube episode on our site
 * (/video?v=<id>, under a StoryByte loading screen), watch.html (the app's
 * player), and long-videos.json (the list both read, and the app's Long
 * stories row).
 *
 * Built from the story pages already in public/s/ (lib/story-page.js), so
 * whatever wrote those pages, this picks them up. Runs before every hosting
 * deploy (firebase.json → hosting.predeploy → scripts/build-site-index.js).
 *
 * Without these, Google had no way to find the story pages except through
 * links shared elsewhere: the site root was a bare "StoryByte content" stub
 * and there was no sitemap.
 */
const fs = require('fs');
const path = require('path');
const { esc, SITE } = require('./story-page');
const { appLink } = require('./app-link');
const { WHATSAPP_CHANNEL_URL, TELEGRAM_CHANNEL_URL } = require('./social-extras');

const unesc = (s) => String(s || '')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const meta = (html, prop) => {
  const m = html.match(new RegExp(`<meta (?:property|name)="${prop}" content="([^"]*)"`));
  return m ? unesc(m[1]) : '';
};

/** When a story was published, from its id (2026-10-12_hi_… or community_<ms>_…). */
function publishedAt(id) {
  const day = id.match(/^(\d{4}-\d{2}-\d{2})_/);
  if (day) return new Date(`${day[1]}T00:00:00Z`);
  const ms = id.match(/^community_(\d{12,14})_/);
  if (ms) return new Date(Number(ms[1]));
  return null;
}

/** Every story page in public/s/, newest first. */
function readPages(pubDir) {
  const dir = path.join(pubDir, 's');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.html')).map((file) => {
    const full = path.join(dir, file);
    const html = fs.readFileSync(full, 'utf8');
    const slug = file.replace(/\.html$/, '');
    const audio = meta(html, 'og:audio');
    const id = (audio.match(/\/audio\/([^/]+)\.mp3$/) || [])[1] || '';
    const lang = (html.match(/<html lang="([^"]+)"/) || [])[1] || 'en';
    return {
      slug,
      id,
      lang,
      title: meta(html, 'og:title') || slug,
      description: meta(html, 'og:description'),
      image: meta(html, 'og:image'),
      devotional: /_devotional_/.test(id) || slug.startsWith('devotional-'),
      date: publishedAt(id) || fs.statSync(full).mtime,
    };
  }).sort((a, b) => b.date - a.date);
}

const day = (d) => d.toISOString().slice(0, 10);

function renderSitemap(pages, site = SITE, videos = []) {
  const home = site.replace(/\/$/, '');
  const urls = [
    `  <url><loc>${home}/</loc>${pages[0] ? `<lastmod>${day(pages[0].date)}</lastmod>` : ''}</url>`,
    ...pages.map((p) => `  <url><loc>${esc(`${home}/s/${p.slug}`)}</loc><lastmod>${day(p.date)}</lastmod></url>`),
    ...videos.map((v) => `  <url><loc>${esc(`${home}/video?v=${v.id}`)}</loc>${v.publishedAt ? `<lastmod>${String(v.publishedAt).slice(0, 10)}</lastmod>` : ''}</url>`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

function renderRobots(site = SITE) {
  return [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${site.replace(/\/$/, '')}/sitemap.xml`,
    '',
  ].join('\n');
}

const card = (p, site) => `
      <a class="card" href="${esc(`${site}/s/${p.slug}`)}">
        ${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy" width="768" height="768">` : ''}
        <span class="card-body">
          <span class="card-title">${esc(p.title)}</span>
          ${p.description ? `<span class="card-desc">${esc(p.description)}</span>` : ''}
        </span>
      </a>`;

// Shared look of the generated pages (home and video pages).
const BASE_CSS = `
    :root { --bg: #fff8ef; --card: #ffffff; --ink: #2b1d12; --muted: #6f5a48; --accent: #d9480f; --line: #f0e0cc; }
    @media (prefers-color-scheme: dark) { :root { --bg: #1a130d; --card: #251b13; --ink: #f6eadb; --muted: #c4ad96; --accent: #ff8a4c; --line: #3a2a1c; } }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.6 system-ui, -apple-system, "Noto Sans Devanagari", sans-serif; }
    a { color: inherit; }
    .wrap { max-width: 960px; margin: 0 auto; padding: 0 16px 48px; }
    header { display: flex; align-items: center; justify-content: space-between; padding: 16px 0; }
    .logo { font-weight: 800; font-size: 20px; text-decoration: none; }
    .logo span { color: var(--accent); }
    .btn { display: inline-block; background: var(--accent); color: #fff; text-decoration: none; font-weight: 700; padding: 12px 20px; border-radius: 999px; }
    .btn-small { padding: 8px 14px; font-size: 14px; }
    .btn-wa { background: #25D366; margin-top: 10px; }
    .btn-tg { background: #229ED9; margin-top: 10px; }
    .hero { padding: 32px 0 24px; }
    .hero h1 { font-size: clamp(28px, 6vw, 44px); line-height: 1.25; margin: 0 0 12px; }
    .hero p { color: var(--muted); font-size: 18px; margin: 0 0 20px; max-width: 640px; }
    h2 { font-size: 22px; margin: 36px 0 14px; }
    .feature { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; background: var(--card); border: 1px solid var(--line); border-radius: 18px; overflow: hidden; text-decoration: none; }
    .feature img { width: 100%; height: auto; aspect-ratio: 1; object-fit: cover; display: block; }
    .feature .card-body { padding: 0 18px 18px; }
    @media (min-width: 640px) { .feature { grid-template-columns: 280px minmax(0, 1fr); } .feature .card-body { padding: 18px 18px 18px 0; } }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr)); gap: 14px; }
    .card { display: flex; flex-direction: column; background: var(--card); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; text-decoration: none; }
    .card img { width: 100%; height: auto; aspect-ratio: 1; object-fit: cover; display: block; }
    .card-body { display: flex; flex-direction: column; gap: 6px; padding: 12px; }
    .card-title { font-weight: 700; line-height: 1.35; }
    .card-desc { color: var(--muted); font-size: 14px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .feature .card-title { font-size: 22px; }
    .feature .card-desc { font-size: 16px; -webkit-line-clamp: 5; }
    .videos { display: flex; gap: 14px; overflow-x: auto; padding-bottom: 8px; scroll-snap-type: x mandatory; }
    .video { flex: 0 0 min(80%, 300px); scroll-snap-align: start; }
    @media (min-width: 760px) {
      .videos { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); overflow: visible; }
    }
    .video .thumb { position: relative; }
    .video img { width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: cover; display: block; background: #000; }
    .yt { position: absolute; left: 8px; bottom: 8px; background: #e62117; color: #fff; font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 6px; }
    .len { position: absolute; right: 8px; bottom: 8px; background: rgba(0,0,0,.75); color: #fff; font-size: 12px; padding: 1px 6px; border-radius: 4px; }
    .section-note { color: var(--muted); margin: -8px 0 14px; }
    .get-app { margin-top: 40px; padding: 24px; background: var(--card); border: 1px solid var(--line); border-radius: 18px; text-align: center; }
    footer { margin-top: 32px; color: var(--muted); font-size: 14px; text-align: center; }
`;

function renderHome(pages, site = SITE, previousVerification = '', videos = []) {
  site = site.replace(/\/$/, '');
  const play = appLink('storybyte_web', 'home', 'web');
  const kathas = pages.filter((p) => p.devotional && p.lang === 'hi');
  // Everything else (older English and community stories); the sitemap has them all.
  const others = pages.filter((p) => !kathas.includes(p)).slice(0, 48);
  const [today, ...rest] = kathas;
  // Google Search Console's ownership check: the GOOGLE_SITE_VERIFICATION
  // variable (daily workflow), or whatever the last home page carried, so a
  // deploy from another workflow doesn't drop it and fail Google's re-checks.
  const verification = (process.env.GOOGLE_SITE_VERIFICATION || '').trim() || previousVerification;
  const title = 'StoryByte — रोज़ एक पावन कथा, ऑडियो में मुफ़्त';
  const description = 'हनुमान जी, शिव जी, श्री कृष्ण, गणेश जी, माँ दुर्गा और विष्णु भगवान की पौराणिक कथाएँ हिंदी में सुनें। हर सुबह एक नई पूरी कथा — StoryByte ऐप पर मुफ़्त, ऑफ़लाइन भी।';
  const app = {
    '@context': 'https://schema.org',
    '@type': 'MobileApplication',
    name: 'StoryByte',
    operatingSystem: 'ANDROID',
    applicationCategory: 'BooksApplication',
    description,
    inLanguage: 'hi',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
    url: site,
    downloadUrl: play,
  };

  return `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(site)}/">
  ${verification ? `<meta name="google-site-verification" content="${esc(verification)}">` : ''}
  <meta property="og:site_name" content="StoryByte">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(site)}/">
  ${today?.image ? `<meta property="og:image" content="${esc(today.image)}">` : ''}
  <meta property="og:locale" content="hi_IN">
  <script type="application/ld+json">${JSON.stringify(app).replace(/</g, '\\u003c')}</script>
  <style>
${BASE_CSS}  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <a class="logo" href="${esc(site)}/">Story<span>Byte</span></a>
      <a class="btn btn-small" href="${esc(play)}">ऐप डाउनलोड करें</a>
    </header>

    <section class="hero">
      <h1>🙏 रोज़ सुबह एक पावन कथा — पूरी, सच्ची, सुंदर।</h1>
      <p>हनुमान जी, शिव जी, श्री कृष्ण, गणेश जी, माँ दुर्गा और विष्णु भगवान की कथाएँ हिंदी में सुनें। हर दिन उस दिन के देवता की एक नई पूरी कथा — मुफ़्त, ऑफ़लाइन भी।</p>
      <a class="btn" href="${esc(play)}">📱 StoryByte ऐप — Google Play पर मुफ़्त</a>
      <a class="btn btn-wa" href="${esc(WHATSAPP_CHANNEL_URL)}">💬 रोज़ की कथा WhatsApp पर</a>
      <a class="btn btn-tg" href="${esc(TELEGRAM_CHANNEL_URL)}">✈️ Telegram पर जुड़ें</a>
    </section>
${today ? `
    <h2>आज की कथा</h2>
    <a class="feature" href="${esc(`${site}/s/${today.slug}`)}">
      ${today.image ? `<img src="${esc(today.image)}" alt="" width="768" height="768">` : ''}
      <span class="card-body">
        <span class="card-title">${esc(today.title)}</span>
        ${today.description ? `<span class="card-desc">${esc(today.description)}</span>` : ''}
        <span class="btn btn-small" style="align-self:flex-start">▶ अभी सुनें</span>
      </span>
    </a>` : ''}
${videos.length ? `
    <h2>पूरी कथाएँ — वीडियो</h2>
    <p class="section-note">लंबी कथाएँ और धारावाहिक, पूरे विस्तार से।</p>
    <div class="videos">${videos.slice(0, 20).map((v) => videoCard(v, site)).join('')}
    </div>` : ''}
${rest.length ? `
    <h2>सभी कथाएँ</h2>
    <div class="grid">${rest.map((p) => card(p, site)).join('')}
    </div>` : ''}
${others.length ? `
    <h2>और कहानियाँ</h2>
    <div class="grid">${others.map((p) => card(p, site)).join('')}
    </div>` : ''}

    <section class="get-app">
      <h2 style="margin-top:0">हर सुबह नई कथा, सीधे आपके फ़ोन पर</h2>
      <p>StoryByte ऐप में सभी कथाएँ ऑडियो में — जहाँ छोड़ा वहीं से सुनें, डाउनलोड करके ऑफ़लाइन सुनें।</p>
      <a class="btn" href="${esc(play)}">StoryByte ऐप डाउनलोड करें</a>
    </section>

    <footer>© StoryByte · <a href="${esc(site)}/privacy.html">Privacy</a></footer>
  </div>
</body>
</html>
`;
}

const srtEnd = (file) => {
  try {
    const times = fs.readFileSync(file, 'utf8').match(/--> (\d+):(\d+):(\d+)[,.](\d+)/g) || [];
    const m = times.length && times[times.length - 1].match(/(\d+):(\d+):(\d+)/);
    return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
  } catch {
    return 0;
  }
};

/**
 * Every long episode published on YouTube, newest first, from each
 * episode's story.json: links and text only. The app's "Long stories" row
 * reads this as long-videos.json (src/components/story/LongVideosRow.js).
 */
function readLongVideos(pubDir) {
  const root = path.join(pubDir, 'episodes');
  if (!fs.existsSync(root)) return [];
  const out = [];
  for (const series of fs.readdirSync(root)) {
    const seriesDir = path.join(root, series);
    if (!fs.statSync(seriesDir).isDirectory()) continue;
    for (const season of fs.readdirSync(seriesDir).filter((d) => d.startsWith('season-'))) {
      const seasonDir = path.join(seriesDir, season);
      if (!fs.statSync(seasonDir).isDirectory()) continue;
      for (const ep of fs.readdirSync(seasonDir).filter((d) => d.startsWith('episode-'))) {
        const dir = path.join(seasonDir, ep);
        let story;
        try {
          story = JSON.parse(fs.readFileSync(path.join(dir, 'story.json'), 'utf8'));
        } catch {
          continue;
        }
        // A series on its own YouTube channel (scripts/epics/, storybyte: false).
        if (story.inApp === false) continue;
        const yt = story.published?.youtube;
        const id = (String(yt?.url || '').match(/youtu\.be\/([\w-]{11})/) || [])[1] || yt?.videoId;
        if (!yt?.posted || !id) continue;
        out.push({
          id,
          youtubeUrl: `https://youtu.be/${id}`,
          thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
          thumbnailHd: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
          title: String(story.metadata?.title || story.generatedTitle || '').replace(/\s+/g, ' ').trim(),
          seriesTitle: String(story.seriesTitle || '').trim(),
          season: String(story.season ?? ''),
          episode: String(story.episode ?? ''),
          description: story.description || '',
          language: story.language || '',
          durationSec: srtEnd(path.join(dir, 'captions.srt')),
          publishedAt: story.renderedAt || null,
        });
      }
    }
  }
  return out.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
}

// --- video player ------------------------------------------------------------
//
// YouTube's embedded player (IFrame API). Until YouTube says the player is
// ready, the video's own thumbnail shows with a small spinner, instead of a
// black box. Used by the video page (video.html) and by watch.html, the page
// the app's story details screen loads.

const PLAYER_CSS = `
    .player { position: relative; width: 100%; aspect-ratio: 16 / 9; background: #000; border-radius: 16px; overflow: hidden; }
    .player iframe, .player #yt-player { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    .loader { position: absolute; inset: 0; z-index: 2; display: grid; place-items: center;
      background: #000 center / cover no-repeat; transition: opacity .35s ease; }
    .loader::before { content: ""; position: absolute; inset: 0; background: rgba(0, 0, 0, .18); }
    .spin { position: relative; width: 44px; height: 44px; border-radius: 50%;
      border: 4px solid rgba(255, 255, 255, .35); border-top-color: #fff; animation: spin .9s linear infinite; }
    .player.ready .loader { opacity: 0; pointer-events: none; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spin { animation-duration: 3s; } }
`;

const LOADER_MARKUP = '<div class="loader"><i class="spin"></i></div>';

// startPlayer(box): shows a thumbnail in the loader (data-poster if given,
// else the sharp maxresdefault when YouTube made one, else hqdefault, which
// always exists),
// builds the YouTube player inside `box` (.player with data-id,
// data-autoplay) and fades the loader out once the player is ready, or after
// 10 s whatever happens, so a slow network never leaves it covering the video.
const PLAYER_SCRIPT = `
    function startPlayer(box) {
      var id = box.dataset.id, loader = box.querySelector('.loader');
      var thumb = function (name) { return 'https://i.ytimg.com/vi/' + id + '/' + name + '.jpg'; };
      if (box.dataset.poster) {
        // Our own art (a Short's story cover): YouTube's Short thumbnails are letterboxed.
        loader.style.backgroundImage = "url('" + box.dataset.poster + "')";
      } else {
        loader.style.backgroundImage = "url('" + thumb('hqdefault') + "')";
        var hd = new Image();
        // A missing maxresdefault comes back as a 120px placeholder.
        hd.onload = function () { if (hd.naturalWidth > 120) loader.style.backgroundImage = "url('" + hd.src + "')"; };
        hd.src = thumb('maxresdefault');
      }
      var done = function () { box.classList.add('ready'); };
      setTimeout(done, 10000);
      // Inside the app (react-native-webview), tell it what the viewer
      // watches: { type: play | progress | pause | ended, currentTime,
      // duration }, so it can count the play and keep their place.
      var tick = null;
      var post = function (player, type) {
        if (!window.ReactNativeWebView) return;
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: type, currentTime: player.getCurrentTime() || 0, duration: player.getDuration() || 0
          }));
        } catch (err) {}
      };
      // YouTube mutes a video that starts without a tap. The app's WebView
      // allows sound without one (mediaPlaybackRequiresUserAction={false}),
      // so in the app the sound comes back on as it starts — once, so a
      // viewer who mutes it later stays muted. A browser would pause a video
      // unmuted without a tap, so the website leaves it alone.
      var inApp = !!window.ReactNativeWebView, unmuted = false;
      var unmute = function (player) {
        if (!inApp || unmuted) return;
        unmuted = true;
        try { if (player.isMuted()) player.unMute(); player.setVolume(100); } catch (err) {}
      };
      var report = function (player, state) {
        if (state === 1) {
          unmute(player);
          post(player, 'play');
          clearInterval(tick);
          tick = setInterval(function () { post(player, 'progress'); }, 15000);
        } else if (state === 2 || state === 0) {
          clearInterval(tick);
          post(player, state === 0 ? 'ended' : 'pause');
        }
      };
      var make = function () {
        // window.sbPlayer: the app pauses and resumes it (FloatingVideoPlayer.js).
        window.sbPlayer = new YT.Player('yt-player', {
          videoId: id, host: 'https://www.youtube.com',
          playerVars: { autoplay: box.dataset.autoplay === '1' ? 1 : 0, playsinline: 1, rel: 0, origin: location.origin },
          events: {
            onReady: function (e) {
              if (box.dataset.autoplay === '1') { if (inApp) { e.target.unMute(); e.target.setVolume(100); } e.target.playVideo(); }
              setTimeout(done, 200);
            },
            onError: done,
            onStateChange: function (e) { report(e.target, e.data); }
          }
        });
      };
      if (window.YT && YT.Player) return make();
      window.onYouTubeIframeAPIReady = make;
      var s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = done;
      document.head.appendChild(s);
    }
`;

const minutesHi = (sec) => (sec > 0 ? `${Math.round(sec / 60)} मिनट` : '');

/** One video's card on the home page, linking to the video page. */
const videoCard = (v, site) => `
      <a class="card video" href="${esc(`${site}/video?v=${v.id}`)}">
        <span class="thumb">
          <img src="${esc(v.thumbnail)}" alt="" loading="lazy" width="320" height="180">
          <span class="yt">▶ देखें</span>
          ${v.durationSec > 0 ? `<span class="len">${minutesHi(v.durationSec)}</span>` : ''}
        </span>
        <span class="card-body">
          <span class="card-title">${esc(v.title)}</span>
          ${v.description ? `<span class="card-desc">${esc(v.description)}</span>` : ''}
        </span>
      </a>`;

/**
 * video.html: one page for every long video, /video?v=<id>. It starts the
 * player from the address straight away, then fills in the title, details
 * and more episodes from long-videos.json, so new episodes need nothing
 * extra.
 */
function renderVideoWrapper(site = SITE) {
  site = site.replace(/\/$/, '');
  const play = appLink('storybyte_web', 'video_page', 'web');
  return `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <title>पूरी कथा · StoryByte</title>
  <meta name="description" content="StoryByte की पूरी कथाएँ — लंबी कथाएँ और धारावाहिक, वीडियो में।">
  <meta property="og:site_name" content="StoryByte">
  <meta property="og:title" content="पूरी कथाएँ · StoryByte">
  <meta property="og:description" content="लंबी कथाएँ और धारावाहिक, पूरे विस्तार से — StoryByte पर।">
  <meta property="og:locale" content="hi_IN">
  <link rel="preconnect" href="https://www.youtube.com">
  <link rel="preconnect" href="https://i.ytimg.com">
  <style>
${BASE_CSS}${PLAYER_CSS}
    .video-head { margin: 18px 0 6px; }
    .video-head h1 { font-size: clamp(22px, 4.5vw, 30px); line-height: 1.3; margin: 0 0 8px; min-height: 1.3em; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 12px; }
    .chip { background: var(--card); border: 1px solid var(--line); border-radius: 999px; padding: 3px 12px; font-size: 14px; color: var(--muted); }
    .desc { color: var(--muted); font-size: 17px; margin: 0 0 16px; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .btn-ghost { background: transparent; color: var(--ink); border: 1px solid var(--line); }
    [hidden] { display: none !important; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <a class="logo" href="${esc(site)}/">Story<span>Byte</span></a>
      <a class="btn btn-small" href="${esc(play)}">ऐप डाउनलोड करें</a>
    </header>

    <div class="player" data-autoplay="0">
      ${LOADER_MARKUP}
      <div id="yt-player"></div>
    </div>

    <section class="video-head">
      <h1 id="title"></h1>
      <div class="chips" id="chips" hidden></div>
      <p class="desc" id="desc" hidden></p>
      <div class="actions">
        <a class="btn" href="${esc(play)}">📱 ऐसी सारी कथाएँ — StoryByte ऐप</a>
        <a class="btn btn-ghost btn-small" id="on-youtube" href="https://www.youtube.com/@LatestStories4u" rel="noopener">YouTube पर देखें</a>
      </div>
    </section>

    <section id="more-section" hidden>
      <h2 id="more-title">और पूरी कथाएँ</h2>
      <div class="videos" id="more"></div>
    </section>

    <section class="get-app">
      <h2 style="margin-top:0">हर सुबह नई कथा, सीधे आपके फ़ोन पर</h2>
      <p>StoryByte ऐप में रोज़ की कथाएँ ऑडियो में और पूरी कथाएँ वीडियो में — मुफ़्त।</p>
      <a class="btn" href="${esc(play)}">StoryByte ऐप डाउनलोड करें</a>
    </section>

    <footer>© StoryByte · <a href="${esc(site)}/">सभी कथाएँ</a> · <a href="${esc(site)}/privacy.html">Privacy</a></footer>
  </div>
  <script>${PLAYER_SCRIPT}
    var id = (new URLSearchParams(location.search).get('v') || '').replace(/[^\\w-]/g, '').slice(0, 11);
    var box = document.querySelector('.player');
    var $ = function (sel) { return document.getElementById(sel); };
    var el = function (tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
    var minutes = function (sec) { return sec > 0 ? Math.round(sec / 60) + ' मिनट' : ''; };

    if (id.length === 11) {
      box.dataset.id = id;
      $('on-youtube').href = 'https://youtu.be/' + id;
      startPlayer(box);
    }

    // A card for "more episodes", built as elements (never HTML from data).
    function card(v) {
      var a = el('a', 'card video'); a.href = '/video?v=' + encodeURIComponent(v.id);
      var thumb = el('span', 'thumb');
      var img = el('img'); img.src = v.thumbnail; img.alt = ''; img.loading = 'lazy'; img.width = 320; img.height = 180;
      thumb.appendChild(img); thumb.appendChild(el('span', 'yt', '▶ देखें'));
      if (v.durationSec > 0) thumb.appendChild(el('span', 'len', minutes(v.durationSec)));
      var body = el('span', 'card-body');
      body.appendChild(el('span', 'card-title', v.title));
      if (v.description) body.appendChild(el('span', 'card-desc', v.description));
      a.appendChild(thumb); a.appendChild(body);
      return a;
    }

    fetch('/long-videos.json').then(function (r) { return r.json(); }).then(function (data) {
      var all = (data && data.videos) || [];
      var v = all.filter(function (x) { return x.id === id; })[0];
      if (!v) {
        $('title').textContent = id ? 'यह वीडियो नहीं मिला' : 'पूरी कथाएँ';
        if (!id && all[0]) { location.replace('/video?v=' + encodeURIComponent(all[0].id)); return; }
      } else {
        document.title = v.title + ' · StoryByte';
        $('title').textContent = v.title;
        var part = /^\\d+$/.test(v.episode) ? 'भाग ' + v.episode : v.episode;
        var chips = [v.seriesTitle, part, minutes(v.durationSec)].filter(Boolean);
        chips.forEach(function (c) { $('chips').appendChild(el('span', 'chip', c)); });
        $('chips').hidden = !chips.length;
        if (v.description) { $('desc').textContent = v.description; $('desc').hidden = false; }
      }
      var same = all.filter(function (x) { return x.id !== id && v && x.seriesTitle === v.seriesTitle; });
      var more = same.concat(all.filter(function (x) { return x.id !== id && same.indexOf(x) < 0; })).slice(0, 9);
      more.forEach(function (x) { $('more').appendChild(card(x)); });
      $('more-title').textContent = same.length ? 'अगली कथाएँ' : 'और पूरी कथाएँ';
      $('more-section').hidden = !more.length;
    }).catch(function () {});
  </script>
</body>
</html>
`;
}

/**
 * watch.html: just the player, full screen, for the app's story details
 * screen (src/components/story/YouTubePlayer.js loads /watch?v=<id>).
 * Autoplays, since the listener tapped the video to get here, unless
 * &autoplay=0; &poster= sets the thumbnail shown until the player is ready.
 */
function renderWatchPage() {
  return `<!doctype html>
<html lang="hi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- YouTube's embedded player needs to know which site embeds it. -->
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta name="robots" content="noindex">
  <title>StoryByte player</title>
  <link rel="preconnect" href="https://www.youtube.com">
  <link rel="preconnect" href="https://i.ytimg.com">
  <style>
    html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
${PLAYER_CSS}
    .player { position: fixed; inset: 0; aspect-ratio: auto; border-radius: 0; }
  </style>
</head>
<body>
  <div class="player" data-autoplay="1">
    ${LOADER_MARKUP}
    <div id="yt-player"></div>
  </div>
  <script>${PLAYER_SCRIPT}
    var params = new URLSearchParams(location.search);
    var id = (params.get('v') || '').replace(/[^\\w-]/g, '').slice(0, 11);
    var box = document.querySelector('.player');
    // ?autoplay=0 waits for a tap (a Short on a story's page); ?poster= is the
    // thumbnail to show meanwhile, only from our own site.
    var poster = params.get('poster') || '';
    if (poster.indexOf(location.origin + '/') === 0) box.dataset.poster = poster.replace(/'/g, '%27');
    if (params.get('autoplay') === '0') box.dataset.autoplay = '0';
    if (id.length === 11) {
      box.dataset.id = id;
      startPlayer(box);
    }
  </script>
</body>
</html>
`;
}

/** Writes index.html, sitemap.xml, robots.txt and long-videos.json into `pubDir`. */
function writeSiteIndex(pubDir, site = SITE) {
  const pages = readPages(pubDir);
  const home = path.join(pubDir, 'index.html');
  const previous = fs.existsSync(home) ? meta(fs.readFileSync(home, 'utf8'), 'google-site-verification') : '';
  const videos = readLongVideos(pubDir);
  fs.writeFileSync(home, renderHome(pages, site, previous, videos));
  fs.writeFileSync(path.join(pubDir, 'sitemap.xml'), renderSitemap(pages, site, videos));
  // One page for every long video (/video?v=<id>) and the app's player page.
  fs.writeFileSync(path.join(pubDir, 'video.html'), renderVideoWrapper(site));
  fs.writeFileSync(path.join(pubDir, 'watch.html'), renderWatchPage());
  // Per-video pages from before the single video page.
  fs.rmSync(path.join(pubDir, 'v'), { recursive: true, force: true });
  fs.writeFileSync(path.join(pubDir, 'robots.txt'), renderRobots(site));
  fs.writeFileSync(path.join(pubDir, 'long-videos.json'), `${JSON.stringify({ updatedAt: new Date().toISOString(), videos }, null, 1)}\n`);
  return { pages: pages.length, videos: videos.length };
}

module.exports = { readPages, readLongVideos, publishedAt, renderHome, renderSitemap, renderRobots, renderVideoWrapper, renderWatchPage, writeSiteIndex };
