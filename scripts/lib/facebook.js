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

module.exports = { postStoryToFacebook };
