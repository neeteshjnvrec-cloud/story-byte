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

const APP_LINK = 'https://play.google.com/store/apps/details?id=com.storybyte.app';

// Facebook Page posts support a real clickable link (unlike Instagram
// captions), so lead with that instead of a "link in bio" workaround.
function buildMessage(story) {
  const hook = (story.description || story.title || '').trim();
  const lines = [story.title || 'A story on StoryByte', '', hook, ''];
  if (story.pageUrl) {
    lines.push(`▶️ Listen free — full story, fully narrated: ${story.pageUrl}`);
  } else {
    lines.push('▶️ Listen free — full story, fully narrated, on StoryByte.');
  }
  lines.push('', `📱 Get the app: ${APP_LINK}`);
  const tag = (story.genre || 'story').replace(/[^a-zA-Z0-9]/g, '');
  const hashtags = ['#StoryByte', '#AudioStories', `#${tag}`];
  if (story.occasionHashtag) hashtags.push(story.occasionHashtag);
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

/**
 * Uploads a long-form landscape episode straight from disk (multipart
 * `source`, not `file_url`) — episodes aren't deployed to Firebase Hosting,
 * so there's no public URL for Facebook to fetch. `thumb` sets the video's
 * cover image in the same request. Graph API accepts files up to 1GB this
 * way; a 15-minute episode is ~150MB.
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

  try {
    const form = new FormData();
    form.append('access_token', token);
    form.append('title', String(title || '').slice(0, 255));
    form.append('description', String(description || ''));
    form.append('published', 'true');
    form.append('source', await fs.openAsBlob(videoPath, { type: 'video/mp4' }), path.basename(videoPath));
    if (thumbnailPath && fs.existsSync(thumbnailPath)) {
      form.append('thumb', await fs.openAsBlob(thumbnailPath, { type: 'image/jpeg' }), path.basename(thumbnailPath));
    }
    const res = await fetch(`https://graph-video.facebook.com/${process.env.IG_GRAPH_VERSION || 'v21.0'}/${pageId}/videos`, {
      method: 'POST',
      body: form,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(json.error?.message || `HTTP ${res.status}`);
    const url = `https://www.facebook.com/${pageId}/videos/${json.id}`;
    console.log(`  ✅ Facebook episode published: ${url}`);
    return { posted: true, videoId: json.id, url };
  } catch (e) {
    console.warn(`  ⚠️  Facebook episode upload failed: ${e.message}`);
    return { posted: false, reason: e.message };
  }
}

module.exports = { postStoryToFacebook, postStoryVideo, uploadEpisodeToFacebook };
