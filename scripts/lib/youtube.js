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

function buildDescription(story) {
  const lines = [(story.description || '').trim(), ''];
  if (story.pageUrl) lines.push('▶️ Play the full story — free, fully narrated:', story.pageUrl, '');
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

module.exports = { postStoryToYouTube };
