/**
 * Posts each day's katha to a Telegram channel, through a bot that is an
 * admin of the channel (Telegram Bot API, free).
 *
 * Setup (TELEGRAM-SETUP section in CHANNEL-IDENTITY.md):
 *   TELEGRAM_BOT_TOKEN — secret: the token @BotFather gives the bot
 *   TELEGRAM_CHANNEL   — variable: the channel's @username (or its -100… id)
 * Unset, every call here just skips. Never throws: a Telegram problem must
 * not cost the day's other posts.
 */
const fs = require('fs');
const path = require('path');
const { appLink } = require('./app-link');

// Bot API limits: 50 MB per uploaded file, 1024 characters per caption.
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_CAPTION = 1024;

const config = () => {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chat = (process.env.TELEGRAM_CHANNEL || '').trim();
  return token && chat ? { token, chat } : null;
};

async function call(token, method, form) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', body: form });
  const json = await res.json().catch(() => ({}));
  if (!json.ok) throw new Error(json.description || `HTTP ${res.status}`);
  return json.result;
}

const fileBlob = (file, type) => new Blob([fs.readFileSync(file)], { type });

/** Fits `lines` into a caption, shortening the first long line (the description) if needed. */
function caption(lines, longIndex) {
  const parts = lines.filter((l) => l != null);
  let text = parts.join('\n\n');
  if (text.length > MAX_CAPTION && longIndex != null && parts[longIndex]) {
    const over = text.length - MAX_CAPTION + 1;
    parts[longIndex] = `${parts[longIndex].slice(0, Math.max(0, parts[longIndex].length - over)).trimEnd()}…`;
    text = parts.join('\n\n');
  }
  return text.slice(0, MAX_CAPTION);
}

/**
 * The daily Short: the video itself when it fits Telegram's upload limit,
 * else its cover picture, with the katha's title, hook, tomorrow's teaser
 * and links to the story page and the app.
 */
async function postStoryToTelegram(story, { videoPath, coverPath } = {}) {
  const cfg = config();
  if (!cfg) return { posted: false, reason: 'not_configured' };
  try {
    const text = caption([
      String(story.title || '').replace(/#shorts/gi, '').trim(),
      (story.description || '').trim() || null,
      story.nextTeaser ? `🔔 ${story.nextTeaser}` : null,
      [story.pageUrl && `▶️ पूरी कथा पढ़ें और सुनें: ${story.pageUrl}`,
        `📱 सभी कथाएँ ऑडियो में, मुफ़्त — StoryByte ऐप: ${appLink('telegram', 'daily_short')}`].filter(Boolean).join('\n'),
      story.hashtags?.length ? story.hashtags.filter((t) => t !== '#shorts').slice(0, 5).join(' ') : null,
    ], 1);

    const form = new FormData();
    form.append('chat_id', cfg.chat);
    form.append('caption', text);
    let method;
    if (videoPath && fs.existsSync(videoPath) && fs.statSync(videoPath).size <= MAX_UPLOAD_BYTES) {
      method = 'sendVideo';
      form.append('video', fileBlob(videoPath, 'video/mp4'), path.basename(videoPath));
      form.append('supports_streaming', 'true');
    } else if (coverPath && fs.existsSync(coverPath)) {
      method = 'sendPhoto';
      form.append('photo', fileBlob(coverPath, 'image/jpeg'), path.basename(coverPath));
    } else {
      return { posted: false, reason: 'no_media' };
    }
    const msg = await call(cfg.token, method, form);
    console.log(`  ✈️  Telegram: posted (${method === 'sendVideo' ? 'video' : 'picture'})`);
    return { posted: true, messageId: msg.message_id };
  } catch (e) {
    console.warn(`  ⚠️  Telegram post failed: ${e.message}`);
    return { posted: false, reason: e.message };
  }
}

/**
 * A long video (weekly katha / episode): too big to upload, so its
 * thumbnail with the YouTube link.
 */
async function postEpisodeToTelegram({ title, description, youtubeUrl, thumbnailPath, campaign = 'long_video' }) {
  const cfg = config();
  if (!cfg) return { posted: false, reason: 'not_configured' };
  if (!youtubeUrl) return { posted: false, reason: 'no_link' };
  try {
    const text = caption([
      `📿 ${title}`,
      (description || '').trim() || null,
      [`▶️ पूरी कथा देखें: ${youtubeUrl}`,
        `📱 StoryByte ऐप: ${appLink('telegram', campaign)}`].join('\n'),
    ], 1);
    const form = new FormData();
    form.append('chat_id', cfg.chat);
    form.append('caption', text);
    let method = 'sendMessage';
    if (thumbnailPath && fs.existsSync(thumbnailPath)) {
      method = 'sendPhoto';
      form.append('photo', fileBlob(thumbnailPath, 'image/jpeg'), path.basename(thumbnailPath));
    } else {
      form.delete('caption');
      form.append('text', text);
    }
    const msg = await call(cfg.token, method, form);
    console.log('  ✈️  Telegram: posted the long video link');
    return { posted: true, messageId: msg.message_id };
  } catch (e) {
    console.warn(`  ⚠️  Telegram post failed: ${e.message}`);
    return { posted: false, reason: e.message };
  }
}

module.exports = { postStoryToTelegram, postEpisodeToTelegram, caption };
