/**
 * The website's front door for search engines: a real home page listing
 * every story page, a sitemap, and robots.txt.
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

function renderSitemap(pages, site = SITE) {
  const home = site.replace(/\/$/, '');
  const urls = [
    `  <url><loc>${home}/</loc>${pages[0] ? `<lastmod>${day(pages[0].date)}</lastmod>` : ''}</url>`,
    ...pages.map((p) => `  <url><loc>${esc(`${home}/s/${p.slug}`)}</loc><lastmod>${day(p.date)}</lastmod></url>`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

function renderRobots(site = SITE) {
  return [
    'User-agent: *',
    // Paid episodes' audio (lib/publish-episode-to-app.js).
    'Disallow: /premium/',
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

function renderHome(pages, site = SITE, previousVerification = '') {
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
    .get-app { margin-top: 40px; padding: 24px; background: var(--card); border: 1px solid var(--line); border-radius: 18px; text-align: center; }
    footer { margin-top: 32px; color: var(--muted); font-size: 14px; text-align: center; }
  </style>
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

/** Writes index.html, sitemap.xml and robots.txt into `pubDir`. */
function writeSiteIndex(pubDir, site = SITE) {
  const pages = readPages(pubDir);
  const home = path.join(pubDir, 'index.html');
  const previous = fs.existsSync(home) ? meta(fs.readFileSync(home, 'utf8'), 'google-site-verification') : '';
  fs.writeFileSync(home, renderHome(pages, site, previous));
  fs.writeFileSync(path.join(pubDir, 'sitemap.xml'), renderSitemap(pages, site));
  fs.writeFileSync(path.join(pubDir, 'robots.txt'), renderRobots(site));
  return { pages: pages.length };
}

module.exports = { readPages, publishedAt, renderHome, renderSitemap, renderRobots, writeSiteIndex };
