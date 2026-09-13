/**
 * Instagram carousel preview — renders the slide design locally, offline, with
 * no Firebase/Instagram credentials needed. Use this to iterate on the look
 * of the carousel before wiring up real Instagram credentials.
 *
 * Usage:
 *   node preview-carousel.js
 *   node preview-carousel.js --genre=mystery --cover=/path/to/cover.jpg
 *
 * Writes slide-1.jpg..slide-N.jpg into ./.carousel-preview/.
 */
const path = require('path');
const fs = require('fs');
const { buildCarouselSlides } = require('./lib/carousel-slides');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

const SAMPLE_TEXT = `Mira had walked this shoreline every evening for a year, but tonight the tide pulled back
further than she'd ever seen, uncovering a ribbon of wet sand strewn with things the sea
usually kept.

Among the shells and driftwood sat a brass compass, its glass cracked but its needle still
spinning, restless, as if it hadn't decided which way was home. She picked it up and the
metal was warm — warmer than anything the cold water should have left behind.

By the time she reached her cottage, the needle had stopped. It pointed, steadily and without
wavering, back the way she'd come — toward the sea, toward whatever had let the compass go.

She stood at her door for a long moment, compass warm in her palm, and then, for the first
time in a year, she turned around and walked back toward the water.`;

const genre = args.genre || 'mystery';
const cover = args.cover || path.resolve(__dirname, '../assets/logo.png');
const outDir = path.resolve(__dirname, '../.carousel-preview');

async function main() {
  if (!fs.existsSync(cover)) {
    console.error(`❌ Cover image not found: ${cover}`);
    process.exit(1);
  }

  const urls = await buildCarouselSlides({
    storyId: 'preview',
    title: args.title || 'The Compass That Wouldn’t Settle',
    text: args.text || SAMPLE_TEXT,
    genre,
    coverPath: cover,
    outDir,
    siteUrl: 'file://.',
  });

  console.log(`✅ Rendered ${urls.length} slides to ${outDir}`);
  urls.forEach((u, i) => console.log(`   ${i + 1}. slide-${i + 1}.jpg`));
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
