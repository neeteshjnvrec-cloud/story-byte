/**
 * Instagram Graph API — publishes a story's carousel slides to the connected
 * Instagram Business/Creator account.
 *
 * Requires two secrets (see INSTAGRAM-SETUP.md for how to obtain them):
 *   IG_BUSINESS_ACCOUNT_ID — the Instagram professional account's numeric id
 *   IG_ACCESS_TOKEN        — a long-lived Page access token with
 *                             instagram_basic + instagram_content_publish
 *
 * Both are optional by design: until they're configured this is a silent
 * no-op, so the audio/community publish pipelines keep working exactly as
 * before. Any failure here is caught and logged — a broken Instagram post
 * must never take down the actual story publish.
 */
const GRAPH = `https://graph.facebook.com/${process.env.IG_GRAPH_VERSION || 'v21.0'}`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function igCall(method, path, params) {
  const token = process.env.IG_ACCESS_TOKEN;
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
    throw new Error(json.error?.message || `IG API ${method} ${path} failed (HTTP ${res.status})`);
  }
  return json;
}

/** Carousel image containers process asynchronously — poll before publishing. */
async function waitUntilFinished(containerId, { timeoutMs = 90000, intervalMs = 3000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { status_code } = await igCall('GET', `/${containerId}`, { fields: 'status_code' });
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR') throw new Error(`container ${containerId} failed processing`);
    await sleep(intervalMs);
  }
  throw new Error(`container ${containerId} timed out before publishing`);
}

function firstSentence(text) {
  const m = String(text || '').match(/^.{0,220}?[.!?](\s|$)/);
  return (m ? m[0] : String(text || '').slice(0, 200)).trim();
}

function buildCaption(story) {
  const teaser = (story.description || firstSentence(story.text) || '').trim();
  const tag = (story.genre || 'story').replace(/[^a-zA-Z0-9]/g, '');
  const lines = [
    story.title || 'A story on StoryByte',
    '',
    teaser,
    '',
    '🎧 Full story + free audio narration on StoryByte — link in bio.',
  ];
  if (story.pageUrl) lines.push(story.pageUrl);
  lines.push('', `#StoryByte #AudioStories #${tag} #ShortStory #StoryTime`);
  return lines.join('\n');
}

/**
 * Publishes `slideUrls` (public HTTPS image URLs, already deployed) as an
 * Instagram carousel post. No-ops when Instagram isn't configured.
 */
async function postStoryCarousel(story, slideUrls) {
  const igUserId = process.env.IG_BUSINESS_ACCOUNT_ID;
  const token = process.env.IG_ACCESS_TOKEN;

  if (!igUserId || !token) {
    console.log('  ℹ️  Instagram not configured — skipping (see INSTAGRAM-SETUP.md).');
    return { posted: false, reason: 'not_configured' };
  }
  if (!slideUrls || slideUrls.length < 2) {
    console.warn('  ⚠️  Instagram carousel needs at least 2 slides — skipping.');
    return { posted: false, reason: 'not_enough_slides' };
  }

  try {
    const childIds = [];
    for (const image_url of slideUrls.slice(0, 10)) {
      const child = await igCall('POST', `/${igUserId}/media`, {
        image_url,
        is_carousel_item: 'true',
      });
      childIds.push(child.id);
    }

    const container = await igCall('POST', `/${igUserId}/media`, {
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      caption: buildCaption(story),
    });

    await waitUntilFinished(container.id);

    const published = await igCall('POST', `/${igUserId}/media_publish`, {
      creation_id: container.id,
    });

    console.log(`  ✅ Instagram carousel published (media id ${published.id})`);
    return { posted: true, mediaId: published.id };
  } catch (e) {
    console.warn(`  ⚠️  Instagram post failed for "${story.title}": ${e.message}`);
    return { posted: false, reason: e.message };
  }
}

module.exports = { postStoryCarousel, buildCaption };
