/**
 * Read-only performance snapshot of everything StoryByte has posted, so the
 * daily mix can be chosen from real numbers instead of guesses. Writes
 * reports/social/latest.json (every post with its metrics) and
 * reports/social/summary.md (per-platform totals and top/bottom posts).
 *
 * Sources, each optional — a missing secret or permission just leaves that
 * section empty with the reason recorded:
 *   Instagram  IG_BUSINESS_ACCOUNT_ID + IG_ACCESS_TOKEN — media list with
 *              likes/comments; reach/views/saves/shares too if the token has
 *              instagram_manage_insights (INSTAGRAM-SETUP.md doesn't ask for
 *              it, so expect those to be absent).
 *   Facebook   FB_PAGE_ID + FB_PAGE_ACCESS_TOKEN — posts and videos with
 *              reactions/comments/shares (pages_read_engagement).
 *   YouTube    public channel pages + RSS feed for views and likes.
 *   Retention  YOUTUBE_CLIENT_ID / _SECRET / _REFRESH_TOKEN, minted with the
 *              yt-analytics.readonly scope (scripts/youtube-auth.js) — per
 *              video, how many viewers are still there at 3 seconds and at
 *              the halfway mark: whether the hook works.
 *   App        FIREBASE_SERVICE_ACCOUNT — per-story plays, likes, ratings,
 *              shares from Firestore, with genre/language/occasion.
 *
 * Usage: node scripts/analyze-social.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'reports', 'social');
const GRAPH = `https://graph.facebook.com/${process.env.IG_GRAPH_VERSION || 'v21.0'}`;
const YT_HANDLE = process.env.YOUTUBE_CHANNEL_HANDLE || '@LatestStories4u';
const MAX_ITEMS = 500;

async function graph(pathname, params, token) {
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${GRAPH}${pathname}?${qs}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(json.error?.message || `HTTP ${res.status}`);
  return json;
}

async function graphList(pathname, params, token) {
  const items = [];
  let page = await graph(pathname, { limit: '100', ...params }, token);
  for (;;) {
    items.push(...(page.data || []));
    const next = page.paging?.next;
    if (!next || items.length >= MAX_ITEMS) break;
    const res = await fetch(next);
    page = await res.json();
    if (page.error) throw new Error(page.error.message);
  }
  return items;
}

// ---------------------------------------------------------------------------

async function instagram() {
  const id = process.env.IG_BUSINESS_ACCOUNT_ID;
  const token = process.env.IG_ACCESS_TOKEN;
  if (!id || !token) return { skipped: 'IG_BUSINESS_ACCOUNT_ID / IG_ACCESS_TOKEN not set' };
  const account = await graph(`/${id}`, { fields: 'username,followers_count,follows_count,media_count' }, token);
  const media = await graphList(`/${id}/media`, {
    fields: 'id,caption,media_type,media_product_type,timestamp,like_count,comments_count,permalink',
  }, token);

  let insightsError = null;
  for (const m of media) {
    if (insightsError) break;
    // Reels report views; carousels/photos report reach. Ask for the common
    // set first, then views separately, so one unsupported metric doesn't
    // lose the rest.
    for (const metric of ['reach,saved,shares,total_interactions', 'views']) {
      try {
        const res = await graph(`/${m.id}/insights`, { metric }, token);
        for (const row of res.data || []) m[row.name] = row.values?.[0]?.value ?? row.total_value?.value;
      } catch (e) {
        if (/permission|#10\b|#200\b|OAuth/i.test(e.message)) { insightsError = e.message; break; }
      }
    }
  }
  return { account, media, insightsError };
}

async function facebook() {
  const id = process.env.FB_PAGE_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!id || !token) return { skipped: 'FB_PAGE_ID / FB_PAGE_ACCESS_TOKEN not set' };
  const out = {};
  try {
    out.page = await graph(`/${id}`, { fields: 'name,followers_count,fan_count' }, token);
  } catch (e) { out.pageError = e.message; }
  try {
    out.posts = await graphList(`/${id}/posts`, {
      fields: 'id,message,created_time,permalink_url,status_type,shares,' +
        'reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)',
    }, token);
    for (const p of out.posts) {
      p.reactions = p.reactions?.summary?.total_count ?? null;
      p.comments = p.comments?.summary?.total_count ?? null;
      p.shares = p.shares?.count ?? 0;
    }
  } catch (e) { out.postsError = e.message; }
  try {
    out.videos = await graphList(`/${id}/videos`, { fields: 'id,title,description,created_time,length,permalink_url' }, token);
    let insightsError = null;
    for (const v of out.videos) {
      if (insightsError) break;
      try {
        const res = await graph(`/${v.id}/video_insights`, { metric: 'total_video_views,total_video_avg_time_watched' }, token);
        for (const row of res.data || []) v[row.name] = row.values?.[0]?.value;
      } catch (e) { insightsError = e.message; }
    }
    out.videoInsightsError = insightsError;
  } catch (e) { out.videosError = e.message; }
  return out;
}

// ---------------------------------------------------------------------------

function parseCount(text) {
  const m = String(text || '').replace(/,/g, '').match(/([\d.]+)\s*([KM]?)/i);
  if (!m) return null;
  return Math.round(Number(m[1]) * ({ K: 1e3, M: 1e6 }[m[2].toUpperCase()] || 1));
}

// The page assigns it as `var ytInitialData = {...};` or
// `window["ytInitialData"] = {...};` depending on the response variant.
function initialData(html) {
  const start = html.search(/ytInitialData"?\]?\s*=\s*\{/);
  if (start < 0) return null;
  const open = html.indexOf('{', start);
  const end = html.indexOf('};</script>', open);
  return end > open ? JSON.parse(html.slice(open, end + 1)) : null;
}

function collect(node, key, out = []) {
  if (Array.isArray(node)) node.forEach((n) => collect(n, key, out));
  else if (node && typeof node === 'object') {
    if (node[key]) out.push(node[key]);
    Object.values(node).forEach((n) => collect(n, key, out));
  }
  return out;
}

async function youtube() {
  const get = async (url) => {
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res.text();
  };
  const base = `https://www.youtube.com/${YT_HANDLE}`;
  const videosHtml = await get(`${base}/videos`);
  const channelId = videosHtml.match(/channel_id=([\w-]{24})/)?.[1] || null;

  const videos = collect(initialData(videosHtml), 'lockupViewModel').map((l) => {
    const s = JSON.stringify(l);
    return {
      id: l.contentId,
      format: 'video',
      title: s.match(/"title":\{"content":"(.*?)"/)?.[1] || null,
      views: parseCount(s.match(/"accessibilityLabel":"([\d,.KM]+) views?"/)?.[1]),
      age: s.match(/"accessibilityLabel":"([^"]*ago)"/)?.[1] || null,
      length: s.match(/"text":"(\d+:\d\d(?::\d\d)?)"/)?.[1] || null,
    };
  });

  let shorts = [];
  try {
    shorts = collect(initialData(await get(`${base}/shorts`)), 'shortsLockupViewModel').map((l) => {
      const s = JSON.stringify(l);
      return {
        id: s.match(/"videoId":"([\w-]{11})"/)?.[1] || null,
        format: 'short',
        title: s.match(/"primaryText":\{"content":"(.*?)"/)?.[1] || null,
        views: parseCount(s.match(/"secondaryText":\{"content":"(.*?)"/)?.[1]),
      };
    });
  } catch (e) { /* no shorts tab */ }

  // The RSS feed has exact views, likes and publish dates for the latest 15.
  if (channelId) {
    const xml = await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`).catch(() => '');
    const byId = new Map([...videos, ...shorts].map((v) => [v.id, v]));
    for (const entry of xml.split('<entry>').slice(1)) {
      const id = entry.match(/<yt:videoId>([\w-]{11})</)?.[1];
      const v = byId.get(id);
      if (!v) continue;
      v.published = entry.match(/<published>([^<]+)</)?.[1] || null;
      v.views = Number(entry.match(/views="(\d+)"/)?.[1] ?? v.views);
      v.likes = Number(entry.match(/starRating count="(\d+)"/)?.[1] ?? 0);
    }
  }
  return { handle: YT_HANDLE, channelId, videos, shorts };
}

// ---------------------------------------------------------------------------

// How many of the most-viewed recent videos get a retention curve (one
// Analytics request each).
const RETENTION_VIDEOS = 30;
const RETENTION_DAYS = 90;

function isoSeconds(iso) {
  const m = String(iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return m ? (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0) : 0;
}

// The share of viewers still watching at `ratio` of the way through, read
// off the retention curve ([[elapsedRatio, audienceWatchRatio], ...]).
// audienceWatchRatio goes above 1 when a looping Short is rewatched.
function keptAt(curve, ratio) {
  if (!curve.length) return null;
  const point = curve.reduce((best, p) => (Math.abs(p[0] - ratio) < Math.abs(best[0] - ratio) ? p : best));
  return Math.round(point[1] * 100);
}

async function retention() {
  const { YOUTUBE_CLIENT_ID: id, YOUTUBE_CLIENT_SECRET: secret, YOUTUBE_REFRESH_TOKEN: token } = process.env;
  if (!id || !secret || !token) return { skipped: 'YOUTUBE_CLIENT_ID / _SECRET / _REFRESH_TOKEN not set' };
  const { google } = require('googleapis');
  const auth = new google.auth.OAuth2(id, secret);
  auth.setCredentials({ refresh_token: token });
  const analytics = google.youtubeAnalytics({ version: 'v2', auth });
  const data = google.youtube({ version: 'v3', auth });
  const day = (d) => d.toISOString().slice(0, 10);
  const range = { ids: 'channel==MINE', startDate: day(new Date(Date.now() - RETENTION_DAYS * 864e5)), endDate: day(new Date()) };
  let top;
  try {
    top = await analytics.reports.query({
      ...range, dimensions: 'video', metrics: 'views,averageViewDuration,averageViewPercentage',
      sort: '-views', maxResults: RETENTION_VIDEOS,
    });
  } catch (e) {
    if (/insufficient|scope|permission|403/i.test(e.message)) {
      return { skipped: 'the YouTube token has no Analytics access — re-mint YOUTUBE_REFRESH_TOKEN with scripts/youtube-auth.js' };
    }
    throw e;
  }
  const rows = top.data.rows || [];
  if (!rows.length) return { videos: [] };
  const details = await data.videos.list({ part: 'snippet,contentDetails', id: rows.map((r) => r[0]).join(','), maxResults: 50 });
  const byId = new Map((details.data.items || []).map((v) => [v.id, v]));
  const videos = [];
  for (const [videoId, views, avgDuration, avgPercent] of rows) {
    const v = byId.get(videoId);
    const length = isoSeconds(v?.contentDetails?.duration);
    let curve = [];
    try {
      const res = await analytics.reports.query({
        ...range, dimensions: 'elapsedVideoTimeRatio', metrics: 'audienceWatchRatio', filters: `video==${videoId}`,
      });
      curve = res.data.rows || [];
    } catch (e) { /* too few views for a curve */ }
    videos.push({
      id: videoId, title: v?.snippet?.title || null, published: v?.snippet?.publishedAt || null,
      format: length && length <= 180 ? 'short' : 'video', length, views,
      avgViewSec: avgDuration, avgViewPercent: Math.round(avgPercent),
      keptAt3s: length ? keptAt(curve, Math.min(1, 3 / length)) : null,
      keptAtHalf: keptAt(curve, 0.5),
    });
  }
  return { range, videos };
}

// ---------------------------------------------------------------------------

async function app() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return { skipped: 'FIREBASE_SERVICE_ACCOUNT not set' };
  const admin = require('firebase-admin');
  const sa = path.join(os.tmpdir(), 'sb-analytics-sa.json');
  fs.writeFileSync(sa, process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(require(sa)) });
  const snap = await admin.firestore().collection('stories').get();
  const stories = snap.docs.map((d) => {
    const s = d.data();
    return {
      id: d.id, title: s.title, socialTitle: s.socialTitle || null, deity: s.deity || null,
      genre: s.genre, language: s.language, occasion: s.occasion || null,
      isDaily: Boolean(s.isDaily), isCommunityStory: Boolean(s.isCommunityStory), status: s.status,
      generatedDate: s.generatedDate || null, duration: s.duration || null,
      plays: s.plays || 0, likes: s.likesCount || 0, shares: s.sharesCount || 0,
      rating: s.rating || 0, ratingCount: s.ratingCount || 0, hookText: s.hookText || null,
    };
  });
  fs.rmSync(sa, { force: true });
  return { stories };
}

// ---------------------------------------------------------------------------

async function section(name, fn) {
  try {
    const result = await fn();
    console.log(`${name}: ok`);
    return result;
  } catch (e) {
    console.warn(`${name}: failed — ${e.message}`);
    return { error: e.message };
  }
}

function sum(list, key) {
  return list.reduce((t, x) => t + (Number(x[key]) || 0), 0);
}

function table(rows, cols) {
  const line = (cells) => `| ${cells.join(' | ')} |`;
  return [line(cols.map((c) => c[0])), line(cols.map(() => '---')),
    ...rows.map((r) => line(cols.map(([, f]) => String(f(r) ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').slice(0, 70))))].join('\n');
}

function summary(report) {
  const out = [`# Social performance snapshot — ${report.generatedAt.slice(0, 10)}`, ''];
  const yt = report.youtube;
  if (yt?.videos) {
    const all = [...yt.videos, ...yt.shorts];
    out.push('## YouTube', `${yt.videos.length} videos (${sum(yt.videos, 'views')} views), ${yt.shorts.length} Shorts (${sum(yt.shorts, 'views')} views)`, '');
    out.push(table([...all].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 15),
      [['Views', (r) => r.views], ['Format', (r) => r.format], ['Title', (r) => r.title]]), '');
  }
  // Daily devotional Shorts, matched to their stories by the social title
  // they were posted under — the story id is what the Remake Short
  // workflow takes to re-cut a winner.
  const titled = (report.app?.stories || []).filter((st) => st.socialTitle);
  if (yt?.shorts && titled.length) {
    const rows = [...yt.shorts, ...yt.videos]
      .map((v) => ({ v, st: titled.find((st) => String(v.title || '').startsWith(st.socialTitle)) }))
      .filter((x) => x.st)
      .sort((a, b) => (b.v.views || 0) - (a.v.views || 0));
    if (rows.length) {
      out.push('## Daily Shorts ranked', 'Re-cut a winner: Actions → Remake Short, with its story id.', '');
      out.push(table(rows.slice(0, 15), [['Views', (r) => r.v.views], ['Likes', (r) => r.v.likes], ['Deity', (r) => r.st.deity],
        ['Plays in app', (r) => r.st.plays], ['Story id', (r) => r.st.id], ['Title', (r) => r.v.title]]), '');
    }
  }
  const rt = report.retention;
  if (rt?.videos?.length) {
    const hooked = new Set((report.app?.stories || []).filter((st) => st.hookText && st.socialTitle).map((st) => st.socialTitle));
    const hasHook = (v) => [...hooked].some((t) => String(v.title || '').startsWith(t));
    // YouTube counts replays, so a looping Short reads above 100%: shown
    // as 100%+ and capped in averages, where it would swamp the rest.
    const pct = (n) => (n == null ? '' : n > 100 ? '100%+' : `${n}%`);
    const avg = (list, key) => {
      const known = list.filter((v) => v[key] != null);
      return known.length ? `${Math.round(known.reduce((t, v) => t + Math.min(100, v[key]), 0) / known.length)}%` : '—';
    };
    out.push('## YouTube retention — where viewers leave',
      `Last ${RETENTION_DAYS} days, most-viewed first. "At 3s" is the share still watching after 3 seconds: the hook. ` +
      '100%+ means viewers replayed it. "New hook" marks Shorts made with the on-screen hook and the checked opening.', '');
    const groups = [
      ['Katha Shorts (1-3 min)', rt.videos.filter((v) => v.format === 'short' && v.length >= 60)],
      ['Short clips (under 1 min)', rt.videos.filter((v) => v.format === 'short' && v.length < 60)],
      ['Long videos', rt.videos.filter((v) => v.format === 'video')],
    ];
    for (const [label, list] of groups) {
      if (!list.length) continue;
      const withHook = list.filter(hasHook);
      out.push(`- **${label}:** ${avg(list, 'keptAt3s')} still watching at 3s, ${avg(list, 'keptAtHalf')} at half, ${avg(list, 'avgViewPercent')} watched on average` +
        (withHook.length ? ` · with the new hook (${withHook.length}): ${avg(withHook, 'keptAt3s')} at 3s, ${avg(withHook, 'avgViewPercent')} watched` : ''));
    }
    out.push('');
    out.push(table(rt.videos, [['Views', (r) => r.views], ['At 3s', (r) => pct(r.keptAt3s)],
      ['At half', (r) => pct(r.keptAtHalf)], ['Watched', (r) => pct(r.avgViewPercent)],
      ['Length', (r) => `${r.length}s`], ['New hook', (r) => (hasHook(r) ? '✓' : '')], ['Title', (r) => r.title]]), '');
  }
  const ig = report.instagram;
  if (ig?.media) {
    out.push('## Instagram', `@${ig.account.username}: ${ig.account.followers_count} followers, ${ig.media.length} posts` +
      (ig.insightsError ? ` (no reach/views: ${ig.insightsError})` : ''), '');
    out.push(table([...ig.media].sort((a, b) => (b.like_count + b.comments_count) - (a.like_count + a.comments_count)).slice(0, 15),
      [['Likes', (r) => r.like_count], ['Comments', (r) => r.comments_count], ['Views', (r) => r.views], ['Type', (r) => r.media_product_type],
        ['Date', (r) => r.timestamp?.slice(0, 10)], ['Caption', (r) => r.caption]]), '');
  }
  const fb = report.facebook;
  if (fb?.posts) {
    out.push('## Facebook', `${fb.page?.name || 'Page'}: ${fb.page?.followers_count ?? '?'} followers, ${fb.posts.length} posts`, '');
    out.push(table([...fb.posts].sort((a, b) => (b.reactions + b.comments + b.shares) - (a.reactions + a.comments + a.shares)).slice(0, 15),
      [['Reactions', (r) => r.reactions], ['Comments', (r) => r.comments], ['Shares', (r) => r.shares],
        ['Date', (r) => r.created_time?.slice(0, 10)], ['Message', (r) => r.message]]), '');
  }
  const stories = report.app?.stories;
  if (stories) {
    out.push('## App (Firestore)', `${stories.length} stories, ${sum(stories, 'plays')} plays`, '');
    const groups = {};
    for (const s of stories) {
      const k = `${s.isCommunityStory ? 'community' : 'daily'} / ${s.genre} / ${s.language}`;
      (groups[k] ||= []).push(s);
    }
    out.push(table(Object.entries(groups).map(([k, list]) => ({ k, n: list.length, plays: sum(list, 'plays'), likes: sum(list, 'likes') }))
      .sort((a, b) => b.plays / b.n - a.plays / a.n),
    [['Group', (r) => r.k], ['Stories', (r) => r.n], ['Plays', (r) => r.plays], ['Plays/story', (r) => (r.plays / r.n).toFixed(1)], ['Likes', (r) => r.likes]]), '');
  }
  for (const [name, s] of Object.entries({ youtube: yt, retention: rt, instagram: ig, facebook: fb, app: report.app })) {
    if (s?.error || s?.skipped) out.push(`- ${name}: ${s.error || s.skipped}`);
  }
  return out.join('\n') + '\n';
}

async function main() {
  const report = {
    generatedAt: new Date().toISOString(),
    youtube: await section('YouTube', youtube),
    retention: await section('YouTube retention', retention),
    instagram: await section('Instagram', instagram),
    facebook: await section('Facebook', facebook),
    app: await section('App', app),
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'latest.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUT, 'summary.md'), summary(report));
  console.log(`Wrote ${path.relative(ROOT, OUT)}/latest.json and summary.md`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
