/**
 * A second "camera angle" for each scene picture of a vertical Short: the
 * scene is shown as the full picture, then cuts to a close-up crop of part
 * of it (with its own camera move, lib/video.js), so the view changes every
 * few seconds without generating more AI images. The crop is made here,
 * before captions are drawn onto the frames (lib/caption-frames.js), so the
 * close-up never crops the captions.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// The close-up keeps 76% of the width and height (about a 1.3x zoom), on
// one of these points in turn. They stay near the centre and the upper part
// of the frame: a Short's picture puts its main figure in the middle, and a
// close-up shifted far to one side cut that figure in half in a test.
const KEEP = 0.76;
const FOCUS = [{ fx: 0.5, fy: 0.3 }, { fx: 0.44, fy: 0.36 }, { fx: 0.56, fy: 0.36 }];

async function closeUpOf(file, out, focus) {
  const img = sharp(file);
  const { width, height } = await img.metadata();
  const w = Math.round(width * KEEP);
  const h = Math.round(height * KEEP);
  const left = Math.max(0, Math.min(width - w, Math.round(width * focus.fx - w / 2)));
  const top = Math.max(0, Math.min(height - h, Math.round(height * focus.fy - h / 2)));
  await img.extract({ left, top, width: w, height: h })
    .resize(width, height, { kernel: 'lanczos3' })
    .sharpen({ sigma: 0.6 })
    .jpeg({ quality: 92 })
    .toFile(out);
}

/**
 * Splits every scene at least `minSec` long into a wide shot (55% of its
 * time) and a close-up (the rest). Scenes are { file, duration }. Never
 * throws: if a crop fails, that scene just stays one shot.
 */
async function withCloseUps(scenes, { outDir, minSec = 6 } = {}) {
  const out = [];
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (!(scene.duration >= minSec)) {
      out.push(scene);
      continue;
    }
    try {
      const file = path.join(outDir || path.dirname(scene.file), `${path.basename(scene.file, path.extname(scene.file))}-close.jpg`);
      await closeUpOf(scene.file, file, FOCUS[i % FOCUS.length]);
      const wide = scene.duration * 0.55;
      out.push({ ...scene, duration: wide }, { ...scene, file, duration: scene.duration - wide, closeUp: true });
    } catch (e) {
      console.warn(`  ⚠️  Close-up for scene ${i + 1} failed, keeping one shot: ${e.message}`);
      out.push(scene);
    }
  }
  return out;
}

/** Scene pictures for a vertical Short: a new one about every 8 seconds. */
function shortSceneCount(videoSec) {
  return Math.max(10, Math.min(22, Math.round(videoSec / 8)));
}

module.exports = { withCloseUps, shortSceneCount, closeUpOf };
