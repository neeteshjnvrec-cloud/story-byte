/**
 * Lines every social post's description shares: tomorrow's katha teaser
 * (lib/teaser.js) and the WhatsApp Channel. For this audience, the Channel
 * is the "email list": a direct line to viewers that no feed algorithm
 * controls. The WHATSAPP_CHANNEL_URL repository variable overrides the link.
 */
const WHATSAPP_CHANNEL_URL = String(process.env.WHATSAPP_CHANNEL_URL || '').trim()
  || 'https://whatsapp.com/channel/0029VbEOIuxAojZ0Wgg11J2l';

function teaserLines(story) {
  return story.nextTeaser ? [`🔔 ${story.nextTeaser}`, ''] : [];
}

function followLines() {
  return [`💬 रोज़ नई कथा WhatsApp पर: ${WHATSAPP_CHANNEL_URL}`];
}

module.exports = { teaserLines, followLines, WHATSAPP_CHANNEL_URL };
