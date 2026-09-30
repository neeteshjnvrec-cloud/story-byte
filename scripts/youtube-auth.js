#!/usr/bin/env node
/**
 * Mints a YouTube upload refresh token. Run this on your own machine — it
 * needs a real browser and your login for the channel's Google account,
 * neither of which CI has.
 *
 * While the OAuth consent screen is in Testing mode (see
 * YOUTUBE-SETUP.md), the refresh token this prints expires after ~7 days.
 * Re-run this script and update the GitHub secret whenever uploads start
 * failing with an auth error — that's the tradeoff for skipping Google's
 * verification review for now.
 *
 * Usage:
 *   YOUTUBE_CLIENT_ID=... YOUTUBE_CLIENT_SECRET=... node youtube-auth.js
 */
const http = require('http');
const { google } = require('googleapis');

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET first — see YOUTUBE-SETUP.md.');
  process.exit(1);
}

// Must exactly match an "Authorized redirect URI" on the OAuth client in
// Google Cloud Console (Web application client type — see
// YOUTUBE-SETUP.md), trailing slash included. "Desktop app" clients are
// supposed to auto-allow any localhost port without registering it, but
// that isn't reliably honored by the current Cloud Console — an exact,
// explicitly registered URI on a Web application client sidesteps that.
const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}/`;

async function main() {
  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  console.log(`\nUsing redirect URI: ${REDIRECT_URI}`);
  console.log('This must be registered EXACTLY (including the trailing slash) as an');
  console.log('Authorized redirect URI on the OAuth client — see YOUTUBE-SETUP.md if');
  console.log('you get "redirect_uri_mismatch".\n');
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    // Forces Google to hand back a refresh_token even on a re-auth for an
    // account that already granted consent once before (otherwise a
    // repeat consent can silently omit it).
    prompt: 'consent',
    // youtube.force-ssl lets the pipeline post the first comment on each
    // Short (lib/youtube.js commentOnYouTube); upload alone can't.
    scope: ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.force-ssl'],
  });

  console.log("\nOpen this URL in a browser signed into the YouTube channel's Google account:\n");
  console.log(authUrl);
  console.log('\nWaiting for you to approve access...\n');

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, REDIRECT_URI);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      res.end(error ? 'Authorization failed — you can close this tab.' : 'Authorized — you can close this tab and return to the terminal.');
      server.close();
      if (error) reject(new Error(error));
      else resolve(code);
    });
    server.listen(PORT);
  });

  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error('No refresh_token in the response — try again (the consent screen sometimes omits it on a repeat authorization).');
  }

  console.log('\n✅ Refresh token — save this as the YOUTUBE_REFRESH_TOKEN GitHub secret:\n');
  console.log(tokens.refresh_token);
  console.log('\nWhile the OAuth app is in Testing mode this expires in ~7 days; rerun this script to mint a new one when uploads start failing.\n');
}

main().catch((e) => {
  console.error('Auth failed:', e.message);
  process.exit(1);
});
