/**
 * The app's Play Store link, tagged with where the viewer came from.
 *
 * Play passes the `referrer` parameter through to the install, and Play
 * Console shows UTM-tagged installs under Statistics → Store listing
 * acquisition (it needs utm_source and utm_campaign). That's how to tell
 * whether YouTube, Facebook, Instagram or the story pages bring installs.
 */
const PLAY_STORE_BASE = 'https://play.google.com/store/apps/details?id=com.storybyte.app';

/**
 * @param {string} source    where the link is posted: youtube, facebook, instagram, web
 * @param {string} campaign  what carries it: short, long_video, story_page …
 * @param {string} [medium]
 */
function appLink(source, campaign, medium = 'social') {
  const referrer = `utm_source=${source}&utm_medium=${medium}&utm_campaign=${campaign}`;
  return `${PLAY_STORE_BASE}&referrer=${encodeURIComponent(referrer)}`;
}

module.exports = { appLink, PLAY_STORE_BASE };
