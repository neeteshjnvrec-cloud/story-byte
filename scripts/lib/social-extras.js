/**
 * Lines every social post's description shares: tomorrow's katha teaser
 * (lib/teaser.js) and, once the WHATSAPP_CHANNEL_URL repository variable
 * is set, the WhatsApp Channel. For this audience, the Channel is the
 * "email list": a direct line to viewers that no feed algorithm controls.
 */
function teaserLines(story) {
  return story.nextTeaser ? [`🔔 ${story.nextTeaser}`, ''] : [];
}

function followLines() {
  const url = String(process.env.WHATSAPP_CHANNEL_URL || '').trim();
  return url ? [`💬 रोज़ नई कथा WhatsApp पर: ${url}`] : [];
}

module.exports = { teaserLines, followLines };
