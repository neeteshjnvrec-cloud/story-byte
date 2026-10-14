/**
 * Facebook Page posting — publishes the same carousel slides used for
 * Instagram as a multi-photo post on the connected Facebook Page.
 *
 * Requires FB_PAGE_ID and FB_PAGE_ACCESS_TOKEN (a Page Access Token — not
 * the Instagram/user token from lib/instagram.js; see INSTAGRAM-SETUP.md
 * for how to get one). No-op until both are set, and any failure here is
 * caught and logged — same pattern as lib/instagram.js, so a broken
 * Facebook post never blocks a story's own publish.
 */
const GRAPH = `https://graph.facebook.com/${process.env.IG_GRAPH_VERSION || 'v21.0'}`;

async function fbCall(method, path, params) {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  let res;
  if (method === 'GET') {
    const qs = new URLSearchParams({ ...params, access_token: token });
    res = await fetch(`${GRAPH}${path}?${qs}`);
  } else {
    res = await fetch(`${GRAPH}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...params, access_token: token }),
    });
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Facebook API ${method} ${path} failed (HTTP ${res.status})`);
  }
  return json;
}

const { appLink } = require('./app-link');
const APP_LINK = appLink('facebook', 'daily_short');
const { teaserLines, followLines } = require('./social-extras');

// Facebook Page posts support a real clickable link (unlike Instagram
// captions), so lead with that instead of a "link in bio" workaround.
function buildMessage(story) {
  const hook = (story.description || story.title || '').trim();
  const lines = [story.title || 'A story on StoryByte', '', hook, '', ...teaserLines(story)];
  if (story.pageUrl) {
    lines.push(`▶️ Listen free — full story, fully narrated: ${story.pageUrl}`);
  } else {
    lines.push('▶️ Listen free — full story, fully narrated, on StoryByte.');
  }
  lines.push('', `📱 Get the app: ${APP_LINK}`, ...followLines());
  const tag = (story.genre || 'story').replace(/[^a-zA-Z0-9]/g, '');
  const hashtags = story.hashtags ? [...story.hashtags] : ['#StoryByte', '#AudioStories', `#${tag}`];
  if (story.occasionHashtag && !hashtags.includes(story.occasionHashtag)) hashtags.push(story.occasionHashtag);
  lines.push('', hashtags.join(' '));
  return lines.join('\n');
}

/**
 * Publishes `slideUrls` (the same public HTTPS carousel images used for
 * Instagram) as a single multi-photo Facebook Page post. No-ops when
 * Facebook isn't configured.
 */
async function postStoryToFacebook(story, slideUrls) {
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;

  if (!pageId || !token) {
    console.log('  ℹ️  Facebook not configured — skipping (see INSTAGRAM-SETUP.md).');
    return { posted: false, reason: 'not_configured' };
  }
  if (!slideUrls || slideUrls.length === 0) {
    return { posted: false, reason: 'no_slides' };
  }

  try {
    const photoIds = [];
    for (const url of slideUrls.slice(0, 10)) {
      // published:false stages the photo without posting it standalone —
      // it only appears once attached to the /feed post below.
      const photo = await fbCall('POST', `/${pageId}/photos`, { url, published: 'false' });
      photoIds.push(photo.id);
    }

    const attachedMedia = {};
    photoIds.forEach((id, i) => {
      attachedMedia[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
    });

    const post = await fbCall('POST', `/${pageId}/feed`, {
      message: buildMessage(story),
      ...attachedMedia,
    });

    console.log(`  ✅ Facebook post published (post id ${post.id})`);
    return { posted: true, postId: post.id };
  } catch (e) {
    console.warn(`  ⚠️  Facebook post failed for "${story.title}": ${e.message}`);
    return { posted: false, reason: e.message };
  }
}

/**
 * Publishes `videoUrl` (a public HTTPS mp4 — see lib/video.js) as a native
 * Facebook Page video post with the story's real narration audio. No-ops
 * when Facebook isn't configured.
 */
async function postStoryVideo(story, videoUrl) {
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;

  if (!pageId || !token) {
    console.log('  ℹ️  Facebook not configured — skipping video (see INSTAGRAM-SETUP.md).');
    return { posted: false, reason: 'not_configured' };
  }
  if (!videoUrl) {
    return { posted: false, reason: 'no_video' };
  }

  try {
    const result = await fbCall('POST', `/${pageId}/videos`, {
      file_url: videoUrl,
      description: buildMessage(story),
    });
    console.log(`  ✅ Facebook video published (video id ${result.id})`);
    return { posted: true, videoId: result.id };
  } catch (e) {
    console.warn(`  ⚠️  Facebook video failed for "${story.title}": ${e.message}`);
    return { posted: false, reason: e.message };
  }
}

const VIDEO_GRAPH = `https://graph-video.facebook.com/${process.env.IG_GRAPH_VERSION || 'v21.0'}`;

async function fbVideoPhase(pageId, form) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${VIDEO_GRAPH}/${pageId}/videos`, { method: 'POST', body: form });
    const json = await res.json().catch(() => ({}));
    if (res.ok && !json.error) return json;
    const message = json.error?.message || `HTTP ${res.status}`;
    // A chunk that hits a transient 5xx/timeout is retried in place; the
    // session stays open on Facebook's side.
    if (attempt < 3 && (res.status >= 500 || json.error?.is_transient)) {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
      continue;
    }
    throw new Error(message);
  }
}

/**
 * Uploads a long-form landscape episode straight from disk — episodes
 * aren't deployed to Firebase Hosting, so there's no public URL for
 * Facebook to fetch. Uses Graph's resumable upload (start / transfer
 * chunks / finish): a single-request `source` upload of a 30-minute 1080p
 * episode was rejected with HTTP 413 in a real run. `thumb` sets the
 * video's cover image on the finish call.
 */
async function uploadEpisodeToFacebook({ videoPath, thumbnailPath, title, description }) {
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) {
    console.log('  ℹ️  Facebook not configured — skipping (see INSTAGRAM-SETUP.md).');
    return { posted: false, reason: 'not_configured' };
  }
  const fs = require('fs');
  const path = require('path');
  if (!videoPath || !fs.existsSync(videoPath)) return { posted: false, reason: 'no_video' };

  const fields = (entries) => {
    const form = new FormData();
    form.append('access_token', token);
    for (const [k, v] of Object.entries(entries)) form.append(k, v);
    return form;
  };

  try {
    const fileSize = fs.statSync(videoPath).size;
    const session = await fbVideoPhase(pageId, fields({ upload_phase: 'start', file_size: String(fileSize) }));
    let start = Number(session.start_offset);
    let end = Number(session.end_offset);
    const fd = fs.openSync(videoPath, 'r');
    try {
      while (start < end) {
        const chunk = Buffer.alloc(end - start);
        fs.readSync(fd, chunk, 0, chunk.length, start);
        const form = fields({ upload_phase: 'transfer', upload_session_id: session.upload_session_id, start_offset: String(start) });
        form.append('video_file_chunk', new Blob([chunk]), 'chunk');
        const next = await fbVideoPhase(pageId, form);
        start = Number(next.start_offset);
        end = Number(next.end_offset);
      }
    } finally {
      fs.closeSync(fd);
    }

    const finish = async (withThumb) => {
      const form = fields({
        upload_phase: 'finish',
        upload_session_id: session.upload_session_id,
        title: String(title || '').slice(0, 255),
        description: String(description || ''),
        published: 'true',
      });
      if (withThumb) form.append('thumb', await fs.openAsBlob(thumbnailPath, { type: 'image/jpeg' }), path.basename(thumbnailPath));
      return fbVideoPhase(pageId, form);
    };
    const hasThumb = Boolean(thumbnailPath && fs.existsSync(thumbnailPath));
    try {
      await finish(hasThumb);
    } catch (e) {
      // The upload itself is done; don't lose the whole post over the cover.
      if (!hasThumb) throw e;
      console.warn(`  ⚠️  Facebook rejected the thumbnail (${e.message}) — publishing without it`);
      await finish(false);
    }

    const url = `https://www.facebook.com/${pageId}/videos/${session.video_id}`;
    console.log(`  ✅ Facebook episode published: ${url}`);
    return { posted: true, videoId: session.video_id, url };
  } catch (e) {
    console.warn(`  ⚠️  Facebook episode upload failed: ${e.message}`);
    return { posted: false, reason: e.message };
  }
}

/** Comments `text` on a Page post or video as the Page. Needs the
 *  pages_manage_engagement permission on FB_PAGE_ACCESS_TOKEN; without it
 *  the error is logged and nothing else is affected. */
async function commentOnFacebook(objectId, text) {
  if (!process.env.FB_PAGE_ACCESS_TOKEN || !objectId || !text) return { posted: false };
  try {
    const res = await fbCall('POST', `/${objectId}/comments`, { message: text });
    console.log('  💬 Facebook first comment posted');
    return { posted: true, commentId: res.id };
  } catch (e) {
    console.warn(`  ⚠️  Facebook comment failed (needs pages_manage_engagement): ${e.message}`);
    return { posted: false, reason: e.message };
  }
}

module.exports = { postStoryToFacebook, postStoryVideo, uploadEpisodeToFacebook, commentOnFacebook };
