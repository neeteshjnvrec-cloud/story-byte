/**
 * Re-cuts one story's Short as raw material for a hand-finished version —
 * the "add your own touch to a winner" step. Nothing is posted: the
 * outputs go to remakes/<story id>/ (uploaded as a run artifact by the
 * Remake Short workflow) for you to edit and upload yourself.
 *
 * The remake is deliberately not a copy of the original: new scene art
 * (new seeds), a different look (grade, caption style, camera moves, music
 * key) and fresh narration — of the complete katha, like the daily video.
 *
 * Outputs:
 *   short.mp4             finished video with captions + music
 *   short-clean.mp4       same video with no captions, for your own text
 *   voice.mp3             narration alone;  mix.mp3  narration + music
 *   scene-*.jpg           the scene art;  captions.srt
 *   post.txt              title, description, hashtags, comment question
 *
 * Env: REMAKE_STORY_ID (a Firestore story id; default: the best-performing
 * daily Short in reports/social/latest.json), REMAKE_VARIANT (any text —
 * change it for a different remake of the same story), plus the pipeline's
 * usual GROQ_API_KEY, FIREBASE_SERVICE_ACCOUNT, CLOUDFLARE_*, SARVAM_*.
 */
const admin = require('firebase-admin');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { synth } = require('./lib/narrate');
const { synthSarvam } = require('./lib/sarvam-tts');
const { parseSrt, toCaptionLines } = require('./lib/subtitles');
const { buildVideoScenes } = require('./lib/video-scenes');
const { bakeInCaptions } = require('./lib/caption-frames');
const { buildStoryVideo } = require('./lib/video');
const { mixDevotionalMusic } = require('./lib/devotional-music');
const { styleOfDay, fitShort } = require('./lib/short-style');
const { withCloseUps, shortSceneCount } = require('./lib/close-ups');
const { DEITIES, GENERAL_HASHTAGS } = require('./lib/devotional-calendar');

const ROOT = path.resolve(__dirname, '..');
const APP_LINK = 'https://play.google.com/store/apps/details?id=com.storybyte.app';
const VARIANT = process.env.REMAKE_VARIANT || new Date().toISOString().slice(0, 10);

function db() {
  const sa = path.join(os.tmpdir(), 'sb-remake-sa.json');
  fs.writeFileSync(sa, process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  admin.initializeApp({ credential: admin.credential.cert(require(sa)) });
  return admin.firestore();
}

/** Story id of the most-viewed daily Short in the latest analytics snapshot. */
function bestFromReport() {
  const file = path.join(ROOT, 'reports', 'social', 'latest.json');
  if (!fs.existsSync(file)) return null;
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  const stories = (report.app?.stories || []).filter((s) => s.socialTitle);
  const ranked = [...(report.youtube?.shorts || []), ...(report.youtube?.videos || [])]
    .map((v) => ({ v, story: stories.find((s) => String(v.title || '').startsWith(s.socialTitle)) }))
    .filter((x) => x.story)
    .sort((a, b) => (b.v.views || 0) - (a.v.views || 0));
  if (!ranked.length) return null;
  console.log(`Best daily Short: "${ranked[0].v.title}" (${ranked[0].v.views} views)`);
  return ranked[0].story.id;
}

async function main() {
  const firestore = db();
  const id = process.env.REMAKE_STORY_ID || bestFromReport();
  if (!id) throw new Error('No REMAKE_STORY_ID given and no daily Short found in reports/social/latest.json');
  const snap = await firestore.collection('stories').doc(id).get();
  if (!snap.exists) throw new Error(`Story ${id} not found`);
  const story = snap.data();
  const deity = Object.values(DEITIES).find((d) => d.key === story.deity) || null;
  const outDir = path.join(ROOT, 'remakes', id.replace(/[^\wऀ-ॿ-]+/g, '-'));
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`Remaking "${story.title}" (variant ${VARIANT})`);

  // Fresh narration of the whole katha — a remake, like the daily video,
  // tells the complete story.
  const voice = path.join(outDir, 'voice.mp3');
  const subs = path.join(outDir, 'captions.srt');
  const text = story.text;
  const narrated = (await synthSarvam(text, { out: voice, subsOut: subs, language: story.language || 'hi' })) ||
    synth(text, { voice: process.env.DEVOTIONAL_VOICE || 'hi-IN-MadhurNeural', rate: process.env.DEVOTIONAL_RATE || '-5%' }, voice, subs);
  let cues = narrated.subtitlesPath ? parseSrt(fs.readFileSync(subs, 'utf8')) : [];
  if (!cues.length) throw new Error('Narration produced no caption timings');
  const dur = parseFloat(require('child_process').execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', voice]).toString()) || cues[cues.length - 1].end;
  const { tempo, tailSec } = fitShort(dur);
  if (tempo !== 1) cues = cues.map((c) => ({ ...c, start: c.start / tempo, end: c.end / tempo }));
  const videoDur = dur / tempo;
  const total = videoDur + tailSec;

  const look = styleOfDay(`${id}:remake:${VARIANT}`);
  const scenes = await buildVideoScenes({
    storyId: `${id}-remake-${VARIANT}`, title: story.title, text, genre: 'devotional',
    description: story.description, cues, audioDurSec: videoDur, outDir,
    sceneCount: shortSceneCount(videoDur),
    context: `${story.title} ${story.description || ''}`,
  });
  if (!scenes) throw new Error('Scene generation failed');
  scenes.forEach((s, i) => {
    const file = path.join(outDir, `scene-${String(i + 1).padStart(2, '0')}.jpg`);
    fs.renameSync(s.file, file);
    s.file = file;
  });
  scenes[scenes.length - 1].duration += tailSec;

  const mix = mixDevotionalMusic(voice, path.join(outDir, 'mix.mp3'), { variant: look.seed, tempo, tailSec });
  if (!mix) throw new Error('Could not mix the narration');

  const frameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-remake-frames-'));
  // Each picture as a wide shot, then a close-up of part of it.
  const shots = await withCloseUps(scenes, { outDir: frameDir });
  const captioned = await bakeInCaptions(shots, toCaptionLines(cues), frameDir, total, { format: 'short', look });
  buildStoryVideo({ scenes: captioned, audioPath: mix, outPath: path.join(outDir, 'short.mp4'), format: 'short', look });
  buildStoryVideo({ scenes: shots, audioPath: mix, outPath: path.join(outDir, 'short-clean.mp4'), format: 'short', look });
  fs.rmSync(frameDir, { recursive: true, force: true });

  const hashtags = [...new Set(['#shorts', ...(deity?.hashtags || []), ...GENERAL_HASHTAGS])];
  fs.writeFileSync(path.join(outDir, 'post.txt'), [
    `Title: ${story.socialTitle || story.title}`,
    '',
    'Description:',
    story.description || '',
    '',
    `▶️ Full katha, free: ${story.pageUrl || APP_LINK}`,
    `📱 Get the app: ${APP_LINK}`,
    '',
    hashtags.join(' '),
    '',
    `First comment: 🙏 ${deity?.hindi || 'भगवान'} की कौन सी कथा आप अगली बार सुनना चाहेंगे? कमेंट में लिखिए 🙏`,
    '',
    `Look: ${look.grade.name} grade, ${look.captionColour} captions`,
  ].join('\n'));

  console.log(`Remake ready in ${path.relative(ROOT, outDir)}/ (${total.toFixed(1)}s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
