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

const APP_LINK = 'https://play.google.com/store/apps/details?id=com.storybyte.app';

function buildDescription(story) {
  const lines = [(story.description || '').trim(), ''];
  if (story.pageUrl) lines.push('▶️ Play the full story — free, fully narrated:', story.pageUrl, '');
  lines.push(`📱 Get the app: ${APP_LINK}`, '');
  lines.push('#StoryByte #AudioStory');
  return lines.join('\n');
}

/**
 * Uploads `videoPath` (a local file) as a video on the connected channel.
 * No-ops when YouTube isn't configured.
 */
async function postStoryToYouTube(story, videoPath) {
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
          title: (story.title || 'A story on StoryByte').slice(0, 100),
          description: buildDescription(story),
          tags: ['storybyte', 'audio story', story.genre].filter(Boolean),
          categoryId: '24', // Entertainment
        },
        status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
      },
      media: { body: fs.createReadStream(videoPath) },
    });

    console.log(`  ✅ YouTube video published (video id ${res.data.id})`);
    return { posted: true, videoId: res.data.id };
  } catch (e) {
    console.warn(`  ⚠️  YouTube upload failed for "${story.title}": ${e.message}`);
    return { posted: false, reason: e.message };
  }
}

// YouTube rejects `<` and `>` anywhere in a title or description.
const ytSafe = (s) => String(s || '').replace(/[<>]/g, '');

/**
 * Uploads a long-form landscape episode, then sets its custom thumbnail.
 * Separate from postStoryToYouTube (the daily Reels' upload) so the two
 * pipelines never change each other's behaviour.
 *
 * The thumbnail step can fail on its own — YouTube only allows custom
 * thumbnails on phone-verified channels — so the video is still reported as
 * published and `thumbnailSet` says whether the thumbnail made it.
 */
async function uploadEpisodeToYouTube({ videoPath, thumbnailPath, title, description, tags = [], language, privacy = 'public' }) {
  const youtube = client();
  if (!youtube) {
    console.log('  ℹ️  YouTube not configured — skipping (see YOUTUBE-SETUP.md).');
    return { posted: false, reason: 'not_configured' };
  }
  if (!videoPath || !fs.existsSync(videoPath)) return { posted: false, reason: 'no_video' };

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
        status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
      },
      media: { body: fs.createReadStream(videoPath) },
    });
    videoId = res.data.id;
    console.log(`  ✅ YouTube episode published: https://youtu.be/${videoId}`);
  } catch (e) {
    console.warn(`  ⚠️  YouTube episode upload failed: ${e.message}`);
    return { posted: false, reason: e.message };
  }

  let thumbnailSet = false;
  if (thumbnailPath && fs.existsSync(thumbnailPath)) {
    try {
      await youtube.thumbnails.set({ videoId, media: { mimeType: 'image/jpeg', body: fs.createReadStream(thumbnailPath) } });
      thumbnailSet = true;
      console.log('  ✅ YouTube thumbnail set');
    } catch (e) {
      console.warn(`  ⚠️  YouTube thumbnail failed (custom thumbnails need a phone-verified channel): ${e.message}`);
    }
  }
  return { posted: true, videoId, url: `https://youtu.be/${videoId}`, thumbnailSet };
}

module.exports = { postStoryToYouTube, uploadEpisodeToYouTube };
