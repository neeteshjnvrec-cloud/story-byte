/**
 * Shared image fetcher (Cloudflare Workers AI: FLUX.2, then flux-1-schnell,
 * across every configured account — lib/cloudflare-image.js) — used for the
 * story cover AND both the carousel slide renderer and the narrated-video
 * scene renderer, so the image-generation strategy (sizing, timeout,
 * fallback) is one implementation instead of three. (`seed` is still taken
 * for callers' sake; Cloudflare's models don't use one.) pollinations.ai
 * was the last resort until its pictures proved too poor to post.
 */
const sharp = require('sharp');
const { fetchCloudflareImage, fetchCloudflareHQImage } = require('./cloudflare-image');

function hashSeed(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return h;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetches one image: FLUX.2 at the frame's own aspect when `hq` is given,
 * else (or if that fails) flux-1-schnell, whose 1024x1024 square is resized
 * to fit — each trying every Cloudflare account with allocation left.
 * Both already retry their own transient failures with backoff; if the
 * whole chain still comes up empty (an outage, not a used-up allocation —
 * that moves to the next account), one more pass after a real wait. Throws
 * only if every pass fails.
 */
// Which model drew an image: 'hq' (FLUX.2 at the frame's own aspect) or
// 'standard' (flux-1-schnell's 1024x1024 square, cropped and scaled up).
// Set on the returned Buffer, so callers that crop further (a Short's
// close-ups) can tell an already scaled-up picture.
function tagged(buf, source) {
  buf.source = source;
  return buf;
}

// Battle kathas (Ram and Ravana, Durga and Mahishasura…) trip the models'
// safety filter ("output has been flagged"): one Sunday video lost 15 of
// its first 21 sharp pictures to it. The same moment, retold without the
// violence, nearly always draws — the narration still tells the story.
const VIOLENT_WORDS = /\b(slay(s|ing)?|slain|slew|kill(s|ed|ing)?|blood(y|ied)?|gore|corpses?|dead( bodies| body)?|severed|behead(s|ed|ing)?|decapitat\w*|stab(s|bed|bing)?|pierc(e|es|ed|ing)|wound(s|ed)?|dying|death|murder\w*|torture\w*|massacre\w*|carnage)\b/gi;

/** `prompt` with the violent words taken out and a peaceful framing added. */
function gentlerPrompt(prompt) {
  return `${prompt.replace(VIOLENT_WORDS, 'facing')}. Devotional and dignified: the moment just before or after, ` +
    'divine light and calm resolve, no blood, no wounds, no gore, no one hurt';
}

async function fetchStoryImage(prompt, seed, opts = {}) {
  const { width = 1080, height = 1350, chainRetries = 1, steps, hq } = opts;
  // A flagged picture is retried once with the gentler prompt, and the
  // standard model then gets the gentler one too.
  let ask = prompt;
  // `hq` ({ width, height, refs }) asks for the FLUX.2 model at its own
  // native size first — same aspect as the final frame, so the result is
  // only ever scaled up a little, never cropped. Any failure (including
  // the free daily allocation running out) drops to the usual chain.
  if (hq) {
    // A flag names the "prompt / input image combination": after the gentler
    // prompt, one last try without the reference images (a deity portrait or
    // the story's first picture), which a non-violent katha was still flagged
    // with.
    let opts = hq;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const buf = await fetchCloudflareHQImage(ask, opts);
        return tagged(await sharp(buf).resize(width, height, { fit: 'cover', kernel: 'lanczos3' }).jpeg({ quality: 95 }).toBuffer(), 'hq');
      } catch (e) {
        if (e.flagged && attempt === 0) {
          console.warn('    ⚠️  HQ picture flagged by the safety filter; retrying with a gentler prompt');
          ask = gentlerPrompt(prompt);
          continue;
        }
        if (e.flagged && attempt === 1 && opts.refs?.length) {
          console.warn('    ⚠️  Flagged again; retrying without the reference images');
          opts = { ...opts, refs: [] };
          continue;
        }
        console.warn(`    ⚠️  HQ image failed, using the standard model: ${e.message.slice(0, 160)}`);
        break;
      }
    }
  }
  let lastError;
  for (let pass = 0; pass <= chainRetries; pass++) {
    try {
      const buf = await fetchCloudflareImage(ask, { steps });
      return tagged(await sharp(buf).resize(width, height, { fit: 'cover', kernel: 'lanczos3' }).jpeg({ quality: 92 }).toBuffer(), 'standard');
    } catch (e) {
      lastError = e;
      if (e.flagged && ask === prompt) {
        ask = gentlerPrompt(prompt);
        continue;
      }
      // Every account used up for today: waiting won't bring it back.
      if (/used up today/.test(e.message)) break;
      if (pass < chainRetries) await sleep(10000 * (pass + 1));
    }
  }
  throw lastError;
}

/** Fetches one bespoke scene illustration. Never throws — callers fall back
 *  to a themed gradient card / equal-timing slide when this returns null. */
async function fetchSceneImage(prompt, seed, opts = {}) {
  try {
    return await fetchStoryImage(prompt, seed, opts);
  } catch (e) {
    console.warn(`    ⚠️  Scene image fetch failed ("${prompt.slice(0, 50)}…"): ${e.message}`);
    return null;
  }
}

/**
 * A stand-in for a missing picture: `buf` re-cropped to a different part of
 * itself (`k` picks which), at `width` x `height`, so it doesn't read as the
 * same frame twice.
 */
async function reframe(buf, k, width, height) {
  const img = sharp(buf);
  const meta = await img.metadata();
  const w = Math.round(meta.width * 0.78);
  const h = Math.round(meta.height * 0.78);
  const spots = [[0.5, 0.35], [0.3, 0.55], [0.7, 0.55], [0.5, 0.7]];
  const [fx, fy] = spots[k % spots.length];
  const left = Math.max(0, Math.min(meta.width - w, Math.round(meta.width * fx - w / 2)));
  const top = Math.max(0, Math.min(meta.height - h, Math.round(meta.height * fy - h / 2)));
  return img.extract({ left, top, width: w, height: h })
    .resize(width, height, { fit: 'cover', kernel: 'lanczos3' })
    .jpeg({ quality: 92 })
    .toBuffer();
}

/**
 * Fills the gaps in a video's pictures (`images`: Buffers, null where the
 * fetch failed) so no themed gradient card ends up in a video: each gap gets
 * one more try (`retry(i)`, resolving to a Buffer or null), then the nearest
 * picture that did come through, reframed. Only if not one picture came
 * through at all does `fallback()` (a themed card) fill the slots. Stand-ins
 * are tagged `.source = 'reused'`.
 */
async function fillMissingImages(images, { retry, fallback, width, height }) {
  const out = [...images];
  for (let i = 0; i < out.length; i++) {
    if (!out[i] && retry) out[i] = await retry(i);
  }
  const have = out.map((b, i) => (b ? i : -1)).filter((i) => i >= 0);
  for (let i = 0; i < out.length; i++) {
    if (out[i]) continue;
    if (!have.length) {
      out[i] = await fallback();
      continue;
    }
    const nearest = have.reduce((a, b) => (Math.abs(b - i) < Math.abs(a - i) ? b : a));
    const buf = await reframe(out[nearest], i, width, height);
    buf.source = 'reused';
    out[i] = buf;
  }
  return out;
}

module.exports = { fetchSceneImage, fetchStoryImage, fillMissingImages, hashSeed };
