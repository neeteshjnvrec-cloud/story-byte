const Groq = require('groq-sdk');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { fetchSceneImage, hashSeed } = require('./lib/scene-image');
const { renderLandscapeVideo, WIDTH, HEIGHT } = require('./lib/video-landscape');
const { callGroqJson, extractJson } = require('./lib/carousel-copy');
const { parseSrt } = require('./lib/subtitles');
const { toCaptionChunks, buildAss, captionFont } = require('./lib/landscape-captions');
const { renderFallbackCover } = require('./lib/fallback-cover');
const { GENRE_THEME, theme } = require('./lib/genre-theme');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

const title = process.env.EPISODE_TITLE || 'Alien Is My Girlfriend';
const episode = String(process.env.EPISODE_NUMBER || '1');
const language = process.env.EPISODE_LANGUAGE || 'en';
const genre = process.env.EPISODE_GENRE || 'science fiction romance';

const voice = language === 'hi'
  ? 'hi-IN-SwaraNeural'
  : 'en-US-AriaNeural';

// ~15 minutes of narration: edge-tts runs ~140-160 words/minute depending on
// voice and language (a real Hindi render measured 142 wpm).
const TARGET_WORDS = 2200;
// One model call asked for the whole 2,000-2,500 words came back with 1,292
// in a real run (a 9-minute "15-minute" episode) — long-form output is
// exactly what these models cut short. Planning an outline first and then
// writing it in parts keeps each call to a length they reliably deliver.
const PARTS = 3;
const WORDS_PER_PART = Math.round(TARGET_WORDS / PARTS);

function parseModels(value) {
  // Keep only models known to be available in the current test.
  const fallback = [
    'openai/gpt-oss-20b',
    'openai/gpt-oss-120b',
  ];

  if (!value || !String(value).trim()) {
    return fallback;
  }

  const raw = String(value).trim();

  // Supports JSON arrays:
  // ["openai/gpt-oss-20b", "openai/gpt-oss-120b"]
  try {
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      const models = parsed
        .map((model) => String(model).trim())
        .filter(Boolean);

      if (models.length > 0) {
        return models;
      }
    }
  } catch {
    // Continue with tolerant parsing.
  }

  // Supports:
  // ['model-a', 'model-b']
  // ["model-a", "model-b"]
  // model-a,model-b
  const models = raw
    .replace(/^\s*\[\s*/, '')
    .replace(/\s*\]\s*$/, '')
    .split(',')
    .map((model) => model.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);

  return models.length > 0 ? models : fallback;
}

const models = parseModels(process.env.GROQ_MODEL);

console.log(`Using Groq models: ${models.join(', ')}`);

// The genre input is free text ("science fiction romance"); pick the first
// known theme it names so scene mood and fallback cards still match it.
const themeKey = Object.keys(GENRE_THEME).find((key) => key !== 'default' && genre.toLowerCase().includes(key)) || 'default';
const mood = theme(themeKey).mood;

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'series';
}

function shell(command, args) {
  return execFileSync(command, args, {
    stdio: 'pipe',
  }).toString().trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function countWords(text) {
  return String(text || '').split(/\s+/).filter(Boolean).length;
}

function getDuration(file) {
  try {
    return Number(
      shell('ffprobe', [
        '-v',
        'quiet',
        '-show_entries',
        'format=duration',
        '-of',
        'csv=p=0',
        file,
      ])
    ) || 0;
  } catch {
    return 0;
  }
}

/** Plain-text completion across the model fallback chain. */
async function callGroqText(groq, { system, user, maxTokens }) {
  const errors = [];
  for (const model of models) {
    try {
      const response = await groq.chat.completions.create({
        model,
        temperature: 0.85,
        max_tokens: maxTokens,
        top_p: 0.95,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });
      const text = response.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('empty response');
      return text;
    } catch (error) {
      errors.push(`${model}: ${error?.message || error}`);
    }
  }
  throw new Error(`all models failed: ${errors.join(' | ')}`);
}

/** Retries a whole generation step with backoff — free-tier Groq rate limits
 *  (per-minute token caps) are the usual reason a step fails outright, and
 *  those clear by waiting rather than by trying the same second again. */
async function withRetries(label, attempt) {
  const waits = [20000, 45000];
  for (let i = 0; ; i += 1) {
    try {
      return await attempt();
    } catch (error) {
      if (i >= waits.length) throw error;
      console.warn(`${label} failed (${error.message}); retrying in ${waits[i] / 1000}s`);
      await sleep(waits[i]);
    }
  }
}

function languageName() {
  return language === 'hi' ? 'Hindi using Devanagari script' : 'English';
}

async function planEpisode(groq) {
  const system =
    `You plan episodes of serialized audio fiction. Plan episode ${episode} of a continuing ${genre} series ` +
    `called "${title}". Reply with JSON only: {"title": string, "description": string, "parts": [string, ...]}. ` +
    `"title" and "description" (one sentence) are written in ${languageName()}. ` +
    `"parts" has exactly ${PARTS} entries in English, in order, each a 3-5 sentence summary of what happens in ` +
    `that part: part 1 opens with a strong hook, the middle escalates with new obstacles and emotional turns, ` +
    `and the last part reaches a climax that ends on a cliffhanger for the next episode. Name the main ` +
    `characters and keep them consistent across all parts.`;
  const content = await callGroqJson(groq, models, {
    sys: system,
    user: `Plan episode ${episode} now.`,
    temperature: 0.85,
    maxTokens: 4000,
    topP: 0.95,
  });
  const plan = extractJson(content);
  const parts = Array.isArray(plan.parts) ? plan.parts.map((p) => String(p || '').trim()).filter(Boolean) : [];
  if (!plan.title || parts.length < PARTS) throw new Error('episode plan is missing a title or parts');
  return {
    title: String(plan.title).trim(),
    description: String(plan.description || '').trim(),
    parts: parts.slice(0, PARTS),
  };
}

// Models sometimes label a continuation ("Part 2:", "भाग 2") despite being
// asked not to — that would be read aloud by the narrator.
function stripPartHeading(text) {
  return text.replace(/^\s*(\*+)?\s*(part|भाग)\s*\d+[^\n]*\n+/i, '').trim();
}

async function writePart(groq, plan, index, storySoFar) {
  const isLast = index === PARTS - 1;
  const outline = plan.parts.map((summary, i) => `Part ${i + 1}: ${summary}`).join('\n');
  const system =
    `You write serialized audio fiction for narration. Series: "${title}", episode ${episode}, genre: ${genre}. ` +
    `Episode title: "${plan.title}". Full episode outline:\n${outline}\n\n` +
    `Write ONLY part ${index + 1} of ${PARTS}, in ${languageName()}, about ${WORDS_PER_PART} words ` +
    `(never fewer than ${Math.round(WORDS_PER_PART * 0.8)}). Detailed scenes, natural dialogue, emotional depth. ` +
    (index === 0 ? 'Open with a strong hook. ' : 'Continue seamlessly from exactly where the story so far stops. ') +
    (isLast
      ? 'This is the final part: build to the climax and end on a cliffhanger for the next episode. '
      : 'Do not wrap up or end the episode — the story continues in the next part. ') +
    'Output only the story text in complete paragraphs: no title, no part labels, no markdown, no sound-effect labels.';
  const user = storySoFar
    ? `The story so far ends with:\n\n${storySoFar.slice(-2500)}\n\nWrite part ${index + 1} now.`
    : 'Write part 1 now.';

  const text = stripPartHeading(await callGroqText(groq, { system, user, maxTokens: 8000 }));
  const words = countWords(text);
  if (words < WORDS_PER_PART * 0.4) throw new Error(`part ${index + 1} too short: ${words} words`);
  return text;
}

async function generateText() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set');
  }

  const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

  const plan = await withRetries('Episode plan', () => planEpisode(groq));
  console.log(`Planned "${plan.title}" in ${PARTS} parts`);

  const parts = [];
  for (let index = 0; index < PARTS; index += 1) {
    const text = await withRetries(`Part ${index + 1}`, () => writePart(groq, plan, index, parts.join('\n\n')));
    console.log(`Part ${index + 1}/${PARTS}: ${countWords(text)} words`);
    parts.push(text);
  }

  const text = parts.join('\n\n');
  const wordCount = countWords(text);
  console.log(`Generated ${wordCount} words`);
  if (wordCount < TARGET_WORDS * 0.8) {
    console.warn(`Warning: story has only ${wordCount} words; the episode may run shorter than 15 minutes.`);
  }

  return { title: plan.title, description: plan.description, outline: plan.parts, text, wordCount };
}

function synthesize(text, output, subtitles) {
  const input = path.join(
    os.tmpdir(),
    `storybyte-landscape-${Date.now()}.txt`
  );

  fs.writeFileSync(input, text, 'utf8');

  const args = [
    '--voice',
    voice,
    '--file',
    input,
    '--write-media',
    output,
    '--write-subtitles',
    subtitles,
  ];

  try {
    try {
      shell('edge-tts', args);
    } catch {
      shell('python3', ['-m', 'edge_tts', ...args]);
    }
  } finally {
    fs.rmSync(input, { force: true });
  }

  if (!fs.existsSync(output) || fs.statSync(output).size === 0) {
    throw new Error('Audio generation failed');
  }

  if (!fs.existsSync(subtitles) || fs.statSync(subtitles).size === 0) {
    throw new Error('Subtitle generation failed');
  }
}

/**
 * Splits the narration's own sentence cues into `count` consecutive scene
 * segments — the same boundaries the video uses to time each scene — so a
 * scene's art is planned from exactly the words spoken while it's on screen.
 */
function segmentCues(cues, count, totalDuration) {
  return Array.from({ length: count }, (_, i) => {
    const from = Math.floor((i * cues.length) / count);
    const to = Math.max(from + 1, Math.floor(((i + 1) * cues.length) / count));
    const start = i === 0 ? 0 : cues[from].start;
    const end = i === count - 1 ? totalDuration : cues[Math.min(to, cues.length - 1)].start;
    const text = cues.slice(from, to).map((c) => c.text).join(' ').trim();
    return { start, end, text };
  });
}

/**
 * Every scene used to share one prompt built from the one-line description,
 * so a real render got 12 near-identical generic shots for a story that
 * moves through a lab, a crystal hall and a spaceship. This asks for one
 * description per narration segment, plus a fixed character look-book that
 * goes into every prompt so the same people look the same scene to scene.
 */
async function planScenes(groq, content, segments) {
  const system =
    `You are the visual director for an illustrated ${genre} series. Given numbered narration segments ` +
    `(in order), reply with JSON only: {"characters": string, "scenes": [string, ...]}. ` +
    `"characters" is one English sentence fixing the look of each recurring character by name (age, face, hair, ` +
    `clothing) so every illustration draws them the same way. "scenes" has exactly ${segments.length} English ` +
    'entries, one per segment in the same order, each a 12-25 word visual description of what is happening in ' +
    'that segment — who is there, what they are doing, where, and the mood. Never describe text, signs or words.';
  const user =
    `Series: ${title}\nEpisode: ${content.title}\nDescription: ${content.description}\n\n` +
    segments.map((s, i) => `${i + 1}. ${s.text.slice(0, 280)}`).join('\n');
  const reply = await callGroqJson(groq, models, { sys: system, user, temperature: 0.7, maxTokens: 6000, topP: 0.95 });
  const plan = extractJson(reply);
  const scenes = Array.isArray(plan.scenes) ? plan.scenes.map((s) => String(s || '').trim()) : [];
  if (scenes.filter(Boolean).length < segments.length) throw new Error(`got ${scenes.length}/${segments.length} scenes`);
  return { characters: String(plan.characters || '').trim(), scenes: scenes.slice(0, segments.length) };
}

function scenePrompt(description, characters) {
  const clean = (s) => String(s || '').trim().replace(/[.\s]+$/, '');
  return (
    `${clean(description)}. ${characters ? `Characters: ${clean(characters)}. ` : ''}` +
    `${mood}, cinematic widescreen 16:9 illustration, consistent character design, detailed environment, ` +
    'no text, no captions, no letters, no logos, no words.'
  );
}

async function main() {
  const outputDirectory = path.join(
    PUBLIC,
    'episodes',
    slug(title),
    `episode-${episode}`
  );

  fs.mkdirSync(outputDirectory, {
    recursive: true,
  });

  console.log(`Generating "${title}" episode ${episode}`);
  console.log(`Language: ${language}`);
  console.log(`Genre: ${genre}`);

  const content = await generateText();

  const audioPath = path.join(outputDirectory, 'audio.mp3');
  const subtitlesPath = path.join(outputDirectory, 'captions.srt');

  console.log('Generating narration...');
  synthesize(content.text, audioPath, subtitlesPath);

  const audioDuration = getDuration(audioPath);

  if (!audioDuration) {
    throw new Error('Could not determine generated audio duration');
  }

  console.log(`Audio duration: ${Math.round(audioDuration)} seconds`);

  if (audioDuration < 780) {
    console.warn(
      `Audio is shorter than the expected 13-minute minimum: ` +
      `${Math.round(audioDuration)} seconds`
    );
  }

  if (audioDuration > 960) {
    console.warn(
      `Audio is longer than the expected 16-minute maximum: ` +
      `${Math.round(audioDuration)} seconds`
    );
  }

  const parsed = parseSrt(fs.readFileSync(subtitlesPath, 'utf8'));
  const cues = parsed.length ? parsed : [{ start: 0, end: audioDuration, text: '' }];

  // Approximately one visual scene every 45 seconds.
  // A 15-minute episode creates approximately 20 scenes.
  const sceneCount = Math.max(
    12,
    Math.min(24, Math.round(audioDuration / 45))
  );
  const segments = segmentCues(cues, sceneCount, audioDuration);

  let scenePlan = null;
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    scenePlan = await withRetries('Scene plan', () => planScenes(groq, content, segments));
    console.log(`Scene plan ready (${scenePlan.scenes.length} scenes)`);
  } catch (error) {
    console.warn(`Scene planning failed, using narration excerpts instead: ${error.message}`);
  }

  console.log(`Generating ${sceneCount} landscape scenes...`);

  const scenes = [];
  const scenePrompts = [];

  for (let index = 0; index < sceneCount; index += 1) {
    const sceneNumber = index + 1;
    const segment = segments[index];

    // Without a plan, an English excerpt is still a usable image prompt; a
    // Hindi one isn't (image models are English-first), so fall back to the
    // episode description for those.
    const description = scenePlan?.scenes[index] ||
      (language === 'en' ? segment.text.slice(0, 240) : `${genre} story scene: ${content.description}`);
    const prompt = scenePrompt(description, scenePlan?.characters);
    scenePrompts.push(description);

    console.log(
      `Generating scene ${sceneNumber}/${sceneCount}...`
    );

    let image = await fetchSceneImage(
      prompt,
      hashSeed(`${title}-${episode}-${sceneNumber}`),
      { width: WIDTH, height: HEIGHT }
    );

    if (!image) {
      // One failed image used to abort the whole ~15-minute episode.
      console.warn(`Scene ${sceneNumber}: image generation failed, using a themed fallback card`);
      image = await renderFallbackCover(themeKey, { width: WIDTH, height: HEIGHT });
    }

    const imagePath = path.join(
      outputDirectory,
      `scene-${String(sceneNumber).padStart(2, '0')}.jpg`
    );

    fs.writeFileSync(imagePath, image);

    scenes.push({
      file: imagePath,
      duration: Math.max(2, segment.end - segment.start),
    });
  }

  fs.writeFileSync(
    path.join(outputDirectory, 'story.json'),
    JSON.stringify(
      {
        seriesTitle: title,
        episode,
        genre,
        language,
        generatedTitle: content.title,
        description: content.description,
        outline: content.outline,
        wordCount: content.wordCount,
        characters: scenePlan?.characters || null,
        scenes: scenePrompts,
        text: content.text,
      },
      null,
      2
    )
  );

  const videoPath = path.join(
    outputDirectory,
    'episode.mp4'
  );

  console.log('Rendering 1920x1080 landscape video with captions...');

  const captionLines = toCaptionChunks(parsed);
  const rendered = renderLandscapeVideo({
    scenes,
    audioPath,
    outPath: videoPath,
    assContent: captionLines.length ? buildAss(captionLines, { font: captionFont(language) }) : null,
  });

  if (!rendered || !fs.existsSync(videoPath)) {
    throw new Error('Landscape video rendering failed');
  }

  fs.writeFileSync(
    path.join(outputDirectory, 'README.txt'),
    [
      `Series: ${title}`,
      `Episode: ${episode}`,
      `Language: ${language}`,
      `Genre: ${genre}`,
      `Words: ${content.wordCount}`,
      `Duration: ${Math.round(audioDuration)} seconds`,
      'Resolution: 1920x1080',
      'Frame rate: 30 FPS',
      `Frames: ${Math.round(audioDuration * 30)}`,
      `Scenes: ${sceneCount} (${scenePlan ? 'planned from narration' : 'narration excerpts'})`,
      `Captions: ${captionLines.length} lines, burned in`,
      '',
      'Generated by the isolated landscape test workflow.',
    ].join('\n')
  );

  console.log('');
  console.log('Landscape episode completed successfully.');
  console.log(`Output directory: ${outputDirectory}`);
  console.log(`Video: ${videoPath}`);
}

main().catch((error) => {
  console.error('');
  console.error('Landscape episode generation failed:');
  console.error(error?.stack || error);
  process.exit(1);
});
