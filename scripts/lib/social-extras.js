/**
 * Lines every social post's description shares: tomorrow's katha teaser
 * (lib/teaser.js), the WhatsApp Channel and the Telegram channel. For this
 * audience, the channels are the "email list": a direct line to viewers that
 * no feed algorithm controls. The WHATSAPP_CHANNEL_URL and
 * TELEGRAM_CHANNEL_URL repository variables override the links.
 */
const WHATSAPP_CHANNEL_URL = String(process.env.WHATSAPP_CHANNEL_URL || '').trim()
  || 'https://whatsapp.com/channel/0029VbEOIuxAojZ0Wgg11J2l';
const TELEGRAM_CHANNEL_URL = String(process.env.TELEGRAM_CHANNEL_URL || '').trim()
  || 'https://t.me/storybytes';

function teaserLines(story) {
  return story.nextTeaser ? [`🔔 ${story.nextTeaser}`, ''] : [];
}

function followLines() {
  return [
    `💬 रोज़ नई कथा WhatsApp पर: ${WHATSAPP_CHANNEL_URL}`,
    `✈️ Telegram पर: ${TELEGRAM_CHANNEL_URL}`,
  ];
}

module.exports = { teaserLines, followLines, WHATSAPP_CHANNEL_URL, TELEGRAM_CHANNEL_URL };
