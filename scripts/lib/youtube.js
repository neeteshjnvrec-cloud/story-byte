/**
 * YouTube Data API v3 — publishes a story's narrated video to the connected
 * YouTube channel.
 *
 * Requires three secrets (see YOUTUBE-SETUP.md for how to obtain them):
 *   YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET — from the Google Cloud OAuth client
 *   YOUTUBE_REFRESH_TOKEN — minted locally via scripts/youtube-auth.js
 *
 * All three optional by design: until they're configured this is a silent
 * no-op, so the audio/community publish pipelines keep working exactly as
 * before. Any failure here is caught and logged — a broken YouTube upload
 * must never take down the actual story publish.
 *
 * Unlike Instagram/Facebook (which take a public HTTPS URL), the YouTube
 * upload reads the video straight off local disk — it doesn't need the
 * Firebase Hosting deploy to have happened first. It also gets the
 * full-length narrated video, not the ~90s clip Instagram Reels needs;
 * YouTube has no comparable duration ceiling.
 */
const fs = require('fs');
const { google } = require('googleapis');

function client() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.youtube({ version: 'v3', auth: oauth2Client });
}

const { appLink } = require('./app-link');
const APP_LINK = appLink('youtube', 'daily_short');
const { teaserLines, followLines } = require('./social-extras');

function buildDescription(story) {
  const lines = [(story.description || '').trim(), '', ...teaserLines(story)];
  if (story.pageUrl) lines.push('▶️ Play the full story — free, fully narrated:', story.pageUrl, '');
  lines.push(`📱 Get the app: ${APP_LINK}`, ...followLines(), '');
  lines.push(story.hashtags ? ['#shorts', ...story.hashtags].join(' ') : '#StoryByte #AudioStory');
  return lines.join('\n');
}

// YouTube rejects an upload whose tags add up to more than 500 characters
// (a multi-word tag counts its quotes too) — keep the first ones that fit.
function capTags(tags, limit = 450) {
  const out = [];
  let used = 0;
  for (const tag of [...new Set(tags.map((t) => String(t).replace(/[<>,]/g, '').trim()).filter(Boolean))]) {
    const cost = tag.length + (tag.includes(' ') ? 2 : 0) + 1;
    if (used + cost > limit) continue;
    out.push(tag);
    used += cost;
  }
  return out;
}

// A Short under a minute is classified as a Short by its length and aspect
// ratio; #shorts in the title is the conventional extra signal.
function shortTitle(story) {
  const title = String(story.title || 'A story on StoryByte');
  if (!story.isShort) return title.slice(0, 100);
  return `${title.slice(0, 100 - ' #shorts'.length)} #shorts`;
}

/**
 * Uploads `videoPath` (a local file) as a video on the connected channel.
 * No-ops when YouTube isn't configured.
 */
/** Sets `videoId`'s custom thumbnail; true when it worked. Custom thumbnails
 *  need a phone-verified channel, so a failure is only a warning. */
async function setThumbnail(youtube, videoId, thumbnailPath) {
  if (!thumbnailPath || !fs.existsSync(thumbnailPath)) return false;
  try {
    await youtube.thumbnails.set({ videoId, media: { mimeType: 'image/jpeg', body: fs.createReadStream(thumbnailPath) } });
    console.log('  ✅ YouTube thumbnail set');
    return true;
  } catch (e) {
    console.warn(`  ⚠️  YouTube thumbnail failed (custom thumbnails need a phone-verified channel): ${e.message}`);
    return false;
  }
}

/** `thumbnailPath`: the story's thumbnail — 9:16 for a Short (shown on the
 *  channel page, in search and the Shorts shelf; the Shorts feed itself
 *  plays the video), 16:9 for a long community story. */
async function postStoryToYouTube(story, videoPath, { thumbnailPath } = {}) {
  const youtube = client();

  if (!youtube) {
    console.log('  ℹ️  YouTube not configured — skipping (see YOUTUBE-SETUP.md).');
    return { posted: false, reason: 'not_configured' };
  }
  if (!videoPath || !fs.existsSync(videoPath)) {
    return { posted: false, reason: 'no_video' };
  }

  try {
    const res = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: shortTitle(story),
          description: buildDescription(story),
          tags: capTags([...(story.tagWords || []), 'storybyte', 'audio story', story.genre].filter(Boolean)),
          categoryId: '24', // Entertainment
        },
        status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
      },
      media: { body: fs.createReadStream(videoPath) },
    });

    console.log(`  ✅ YouTube video published (video id ${res.data.id})`);
    const thumbnailSet = await setThumbnail(youtube, res.data.id, thumbnailPath);
    return { posted: true, videoId: res.data.id, thumbnailSet };
  } catch (e) {
    console.warn(`  ⚠️  YouTube upload failed for "${story.title}": ${e.message}`);
    return { posted: false, reason: e.message };
  }
}

// YouTube rejects `<` and `>` anywhere in a title or description.
const ytSafe = (s) => String(s || '').replace(/[<>]/g, '');

/**
 * With YOUTUBE_CHANNEL_ID set (the Life of Jesus workflow), why the token
 * can't be used — it belongs to another channel, or the check failed — else
 * null. Stops a token minted on the wrong channel from posting there.
 */
async function wrongChannel(youtube) {
  const expected = String(process.env.YOUTUBE_CHANNEL_ID || '').trim();
  if (!expected) return null;
  try {
    const res = await youtube.channels.list({ part: ['snippet'], mine: true });
    const mine = (res.data.items || [])[0];
    if (mine?.id === expected) return null;
    const reason = `the YouTube token is for ${mine ? `"${mine.snippet?.title}" (${mine.id})` : 'no channel'}, not ${expected}`;
    console.warn(`  ⚠️  Not uploading: ${reason} — re-mint it on the right channel (YOUTUBE-SETUP.md)`);
    return reason;
  } catch (e) {
    console.warn(`  ⚠️  Not uploading: couldn't check the token's channel: ${e.message}`);
    return `channel check failed: ${e.message}`;
  }
}

/**
 * Uploads a long-form landscape episode, then sets its custom thumbnail.
 * Separate from postStoryToYouTube (the daily Reels' upload) so the two
 * pipelines never change each other's behaviour.
 *
 * The thumbnail step can fail on its own — YouTube only allows custom
 * thumbnails on phone-verified channels — so the video is still reported as
 * published and `thumbnailSet` says whether the thumbnail made it.
 *
 * `publishAt` (an ISO time at least a few minutes ahead) uploads the video
 * private and lets YouTube make it public then, so a series goes up at the
 * same time each day however long the render took.
 */
async function uploadEpisodeToYouTube({ videoPath, thumbnailPath, title, description, tags = [], language, privacy = 'public', publishAt }) {
  const youtube = client();
  if (!youtube) {
    console.log('  ℹ️  YouTube not configured — skipping (see YOUTUBE-SETUP.md).');
    return { posted: false, reason: 'not_configured' };
  }
  if (!videoPath || !fs.existsSync(videoPath)) return { posted: false, reason: 'no_video' };
  const wrong = await wrongChannel(youtube);
  if (wrong) return { posted: false, reason: wrong };

  // Too close (or past) and YouTube rejects the time: publish right away.
  const scheduled = publishAt && new Date(publishAt).getTime() - Date.now() > 5 * 60e3;
  let videoId;
  try {
    const res = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: ytSafe(title).slice(0, 100),
          description: ytSafe(description).slice(0, 5000),
          tags,
          categoryId: '24', // Entertainment
          defaultLanguage: language,
          defaultAudioLanguage: language,
        },
        status: scheduled
          ? { privacyStatus: 'private', publishAt, selfDeclaredMadeForKids: false }
          : { privacyStatus: privacy, selfDeclaredMadeForKids: false },
      },
      media: { body: fs.createReadStream(videoPath) },
    });
    videoId = res.data.id;
    console.log(scheduled
      ? `  ✅ YouTube episode uploaded, public at ${publishAt}: https://youtu.be/${videoId}`
      : `  ✅ YouTube episode published: https://youtu.be/${videoId}`);
  } catch (e) {
    console.warn(`  ⚠️  YouTube episode upload failed: ${e.message}`);
    return { posted: false, reason: e.message };
  }

  const thumbnailSet = await setThumbnail(youtube, videoId, thumbnailPath);
  return { posted: true, videoId, url: `https://youtu.be/${videoId}`, thumbnailSet, ...(scheduled && { publishAt }) };
}

/**
 * Adds `videoId` to the playlist `playlistId`, or to a new public playlist
 * titled `title` when there's no id yet. Returns the playlist id (to keep for
 * the next episode), or null. Needs the youtube.force-ssl scope, like
 * commentOnYouTube; never fails the upload.
 */
async function addToYouTubePlaylist(videoId, { playlistId, title, description = '' }) {
  const youtube = client();
  if (!youtube || !videoId) return null;
  try {
    let id = playlistId;
    if (!id) {
      const res = await youtube.playlists.insert({
        part: ['snippet', 'status'],
        requestBody: { snippet: { title: ytSafe(title).slice(0, 150), description: ytSafe(description).slice(0, 5000) }, status: { privacyStatus: 'public' } },
      });
      id = res.data.id;
      console.log(`  📃 YouTube playlist created: https://www.youtube.com/playlist?list=${id}`);
    }
    await youtube.playlistItems.insert({ part: ['snippet'], requestBody: { snippet: { playlistId: id, resourceId: { kind: 'youtube#video', videoId } } } });
    console.log('  📃 Added to the YouTube playlist');
    return id;
  } catch (e) {
    const scope = /insufficient|permission|scope/i.test(e.message) ? ' — re-mint YOUTUBE_REFRESH_TOKEN with the youtube.force-ssl scope (YOUTUBE-SETUP.md)' : '';
    console.warn(`  ⚠️  YouTube playlist failed: ${e.message}${scope}`);
    return playlistId || null;
  }
}

/**
 * Posts `text` as the first comment on `videoId`, to start the replies that
 * Shorts ranking weighs heavily. Needs the youtube.force-ssl scope — a
 * refresh token minted with youtube.upload only gets a 403, logged with the
 * fix (re-run scripts/youtube-auth.js, see YOUTUBE-SETUP.md). The API can't
 * pin comments; pin it by hand in YouTube Studio if wanted.
 */
async function commentOnYouTube(videoId, text) {
  const youtube = client();
  if (!youtube || !videoId || !text) return { posted: false };
  try {
    const res = await youtube.commentThreads.insert({
      part: ['snippet'],
      requestBody: { snippet: { videoId, topLevelComment: { snippet: { textOriginal: text } } } },
    });
    console.log('  💬 YouTube first comment posted');
    return { posted: true, commentId: res.data.id };
  } catch (e) {
    const scope = /insufficient|permission|scope/i.test(e.message) ? ' — re-mint YOUTUBE_REFRESH_TOKEN with the youtube.force-ssl scope (YOUTUBE-SETUP.md)' : '';
    console.warn(`  ⚠️  YouTube comment failed: ${e.message}${scope}`);
    return { posted: false, reason: e.message };
  }
}

module.exports = { postStoryToYouTube, uploadEpisodeToYouTube, commentOnYouTube, addToYouTubePlaylist };
