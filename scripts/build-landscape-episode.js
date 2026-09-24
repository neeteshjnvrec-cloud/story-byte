const Groq = require('groq-sdk');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { fetchSceneImage, hashSeed } = require('./lib/scene-image');
const { renderLandscapeVideo } = require('./lib/video-landscape');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const title = process.env.EPISODE_TITLE || 'Alien Is My Girlfriend';
const episode = String(process.env.EPISODE_NUMBER || '1');
const language = process.env.EPISODE_LANGUAGE || 'en';
const genre = process.env.EPISODE_GENRE || 'science fiction romance';
const voice = language === 'hi' ? 'hi-IN-SwaraNeural' : 'en-US-AriaNeural';
const models = (process.env.GROQ_MODEL || 'groq/compound-mini,groq/compound,openai/gpt-oss-20b').split(',').map(s => s.trim()).filter(Boolean);

const slug = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'series';
const shell = (command, args) => execFileSync(command, args, { stdio: 'pipe' }).toString().trim();
const duration = file => Number(shell('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])) || 0;

async function generateText() {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set');
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const messages = [{ role: 'system', content: `You write serialized audio fiction. Return JSON only with title, description, and text. Write episode ${episode} of a continuing ${genre} series called "${title}" in ${language === 'hi' ? 'Hindi Devanagari' : 'English'}. Make it complete with a hook, escalating middle, satisfying cliffhanger. Target 1,800-2,100 spoken words, no markdown, sound-effect labels, or chapter headings.` }, { role: 'user', content: `Write episode ${episode} now.` }];
  for (const model of models) {
    try {
      const response = await groq.chat.completions.create({ model, temperature: 0.85, max_tokens: 7000, top_p: 0.95, response_format: { type: 'json_object' }, messages });
      const data = JSON.parse(response.choices[0].message.content.trim());
      if (data.title && data.text && data.text.split(/\s+/).length >= 1200) return data;
    } catch (error) { console.warn(`Model ${model} failed: ${error.message}`); }
  }
  throw new Error('All configured story models failed');
}

function synthesize(text, output, subtitles) {
  const input = path.join(os.tmpdir(), `storybyte-${Date.now()}.txt`);
  fs.writeFileSync(input, text, 'utf8');
  const args = ['--voice', voice, '--file', input, '--write-media', output, '--write-subtitles', subtitles];
  try { shell('edge-tts', args); } catch { shell('python3', ['-m', 'edge_tts', ...args]); } finally { fs.rmSync(input, { force: true }); }
}

function parseSrt(file, total) {
  const cues = fs.readFileSync(file, 'utf8').split(/\r?\n\r?\n/).map(block => {
    const m = block.match(/(\d\d):(\d\d):(\d\d),(\d{3})\s+-->\s+(\d\d):(\d\d):(\d\d),(\d{3})/);
    if (!m) return null;
    const toSeconds = (h, min, s, ms) => +h * 3600 + +min * 60 + +s + +ms / 1000;
    return { start: toSeconds(m[1], m[2], m[3], m[4]), end: toSeconds(m[5], m[6], m[7], m[8]) };
  }).filter(Boolean);
  return cues.length ? cues : [{ start: 0, end: total }];
}

async function main() {
  const outDir = path.join(PUBLIC, 'episodes', slug(title), `episode-${episode}`);
  fs.mkdirSync(outDir, { recursive: true });
  const content = await generateText();
  fs.writeFileSync(path.join(outDir, 'story.json'), JSON.stringify({ title, episode, genre, language, ...content }, null, 2));
  const audioPath = path.join(outDir, 'audio.mp3');
  const subtitlesPath = path.join(outDir, 'captions.srt');
  synthesize(content.text, audioPath, subtitlesPath);
  const audioDuration = duration(audioPath);
  const sceneCount = Math.max(12, Math.min(24, Math.round(audioDuration / 45)));
  const cues = parseSrt(subtitlesPath, audioDuration);
  const scenes = [];
  for (let i = 0; i < sceneCount; i++) {
    const prompt = `Landscape cinematic scene ${i + 1} of ${sceneCount} from episode ${episode} of ${title}: ${content.description || genre}, science-fiction romance, consistent characters, detailed environment, no text, no words.`;
    const image = await fetchSceneImage(prompt, hashSeed(`${title}-${episode}-${i}`));
    const file = path.join(outDir, `scene-${String(i + 1).padStart(2, '0')}.jpg`);
    fs.writeFileSync(file, image);
    const start = i === 0 ? 0 : cues[Math.min(cues.length - 1, Math.floor(i / sceneCount * cues.length))].start;
    const end = i === sceneCount - 1 ? audioDuration : cues[Math.min(cues.length - 1, Math.floor((i + 1) / sceneCount * cues.length))].start;
    scenes.push({ file, duration: Math.max(2, end - start) });
  }
  renderLandscapeVideo({ scenes, audioPath, outPath: path.join(outDir, 'episode.mp4') });
  fs.writeFileSync(path.join(outDir, 'README.txt'), `Landscape episode ${episode}\nDuration: ${Math.round(audioDuration)} seconds\nResolution: 1920x1080\nFPS: 30\n`);
  console.log(`Rendered ${title} episode ${episode}: ${Math.round(audioDuration)}s`);
}

main().catch(error => { console.error(error); process.exit(1); });
