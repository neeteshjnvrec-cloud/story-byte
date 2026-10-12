/**
 * Long-form (~15 min) 1920x1080 serialized episodes — a separate pipeline
 * from the daily vertical Reels (build-stories.js); nothing here is shared
 * with or triggered by the daily cron jobs.
 *
 * Per episode: plan (outline + chapters) -> write in parts -> narrate ->
 * scenes planned from the narration -> render with burned-in captions ->
 * thumbnail -> optionally publish to YouTube + Facebook (EPISODE_PUBLISH).
 *
 * Episodes live in public/episodes/<series>/season-<S>/episode-<E>/.
 *
 * Continuity lives in public/episodes/<series>/series.json — the series
 * bible: every recurring character's fixed name (and native-script
 * spelling) and look, the setting, and each episode's summary. Every
 * episode is planned and illustrated from it, so names and faces don't
 * drift from one episode to the next.
 *
 * Katha mode (EPISODE_KATHA set, run weekly by weekly-katha.js): instead of
 * a serialized episode, one complete, faithful retelling of a traditional
 * katha under the Hindi title people search for ("शिव जी की कथा: …") —
 * long-form videos are what YouTube search ranks and what builds watch
 * hours, which Shorts mostly don't. Standalone: no bible, no cliffhanger.
 */
const Groq = require('groq-sdk');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { fetchSceneImage, fetchStoryImage, hashSeed } = require('./lib/scene-image');
const { renderLandscapeVideo, WIDTH, HEIGHT } = require('./lib/video-landscape');
const { callGroqJson, extractJson } = require('./lib/carousel-copy');
const { parseSrt } = require('./lib/subtitles');
const { toCaptionChunks, captionFont } = require('./lib/landscape-captions');
const { renderFallbackCover } = require('./lib/fallback-cover');
const { GENRE_THEME, theme } = require('./lib/genre-theme');
const { artStyleFor, styleKey } = require('./lib/short-style');
const { iconographyFor } = require('./lib/iconography');
const { renderEpisodeThumbnail, THUMB_WIDTH, THUMB_HEIGHT } = require('./lib/episode-thumbnail');
const { uploadEpisodeToYouTube } = require('./lib/youtube');
const { uploadEpisodeToFacebook } = require('./lib/facebook');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

const title = process.env.EPISODE_TITLE || 'Alien Is My Girlfriend';
const episode = String(process.env.EPISODE_NUMBER || '1');
const season = String(process.env.EPISODE_SEASON || '1');
const language = process.env.EPISODE_LANGUAGE || 'en';
const genre = process.env.EPISODE_GENRE || 'science fiction romance';
const publish = process.env.EPISODE_PUBLISH === 'true';

// Katha mode (see the header). EPISODE_DEITY is the deity's Hindi name,
// EPISODE_SEARCHES what people search for it on YouTube (one per line),
// EPISODE_HASHTAGS the deity's hashtags.
const KATHA = String(process.env.EPISODE_KATHA || '').trim();
const KATHA_DEITY = String(process.env.EPISODE_DEITY || '').trim();
const KATHA_SEARCHES = String(process.env.EPISODE_SEARCHES || '').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 8);
const KATHA_HASHTAGS = String(process.env.EPISODE_HASHTAGS || '').split(/\s+/).filter((t) => t.startsWith('#'));

const APP_LINK = 'https://play.google.com/store/apps/details?id=com.storybyte.app';

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
// Flux-schnell's maximum — sharper, more detailed art than the default 4.
// Used only when the FLUX.2 render below fails (e.g. the free daily
// allocation runs out).
const IMAGE_STEPS = 8;
// FLUX.2 [klein] at 16:9: 1344x768 is 6 of its 512px tiles (~160 of the
// free 10,000 neurons a day per image; ~30 scenes an episode).
const HQ_LANDSCAPE = { width: 1344, height: 768 };

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
const { mood, accent } = theme(themeKey);

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'series';
}

const seriesDirectory = path.join(PUBLIC, 'episodes', slug(title));

// Episodes order by season, then episode — S2E1 comes after S1E12.
const orderKey = (s, e) => Number(s || 1) * 1000 + Number(e);
const currentKey = orderKey(season, episode);
const isEarlier = (x) => orderKey(x.season, x.episode) < currentKey;
const byOrder = (a, b) => orderKey(a.season, a.episode) - orderKey(b.season, b.episode);
const seasonEpisode = `Season ${season} Episode ${episode}`;
const biblePath = path.join(seriesDirectory, 'series.json');

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

async function groqJson(groq, system, user, maxTokens) {
  return extractJson(await callGroqJson(groq, models, { sys: system, user, temperature: 0.8, maxTokens, topP: 0.95 }));
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

// ---------------------------------------------------------------------------
// Series bible
// ---------------------------------------------------------------------------

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** story.json of every earlier episode already rendered for this series, in
 *  season/episode order. A bare episode-N folder (from before seasons
 *  existed) counts as season 1. */
function previousEpisodes() {
  if (!fs.existsSync(seriesDirectory)) return [];
  const dirs = [];
  for (const name of fs.readdirSync(seriesDirectory)) {
    const full = path.join(seriesDirectory, name);
    if (/^season-\d+$/.test(name)) dirs.push(...fs.readdirSync(full).map((e) => path.join(full, e)));
    else if (/^episode-/.test(name)) dirs.push(full);
  }
  return dirs
    .map((dir) => readJson(path.join(dir, 'story.json')))
    .filter(Boolean)
    .map((s) => ({ ...s, season: String(s.season || '1') }))
    .filter(isEarlier)
    .sort(byOrder);
}

function cleanCharacters(list) {
  return (Array.isArray(list) ? list : [])
    .map((c) => ({
      name: String(c?.name || '').trim(),
      nativeName: String(c?.nativeName || c?.name || '').trim(),
      role: String(c?.role || '').trim(),
      look: String(c?.look || '').trim(),
    }))
    .filter((c) => c.name && c.look);
}

/**
 * A series whose earlier episodes predate the bible (or whose bible was
 * lost) gets one reconstructed from the latest earlier episode's actual
 * text, so episode N keeps episode N-1's names instead of inventing new ones.
 */
async function bootstrapBible(groq, previous) {
  const latest = previous[previous.length - 1];
  const reply = await groqJson(
    groq,
    'You are the continuity editor of a serialized fiction series. From the episode text, reply with JSON only: ' +
      '{"characters": [{"name": string, "nativeName": string, "role": string, "look": string}], "setting": string}. ' +
      '"name" is the character\'s name in English letters; "nativeName" is exactly how the text spells it; "look" is an ' +
      'English description of a fixed, drawable appearance (age, face, hair, clothing) consistent with the text; ' +
      '"setting" is one English sentence. Include every recurring named character.',
    String(latest.text || '').slice(0, 9000),
    4000
  );
  return {
    seriesTitle: title,
    genre,
    language,
    characters: cleanCharacters(reply.characters),
    setting: String(reply.setting || '').trim(),
    episodes: previous.map((s) => ({ season: s.season, episode: String(s.episode), title: s.generatedTitle, description: s.description, summary: (s.outline || []).join(' ') || s.description })),
  };
}

async function loadBible(groq) {
  // Each katha stands alone — no characters or "story so far" carried over.
  if (KATHA) return null;
  const existing = readJson(biblePath);
  if (existing?.characters?.length) return existing;
  const previous = previousEpisodes();
  if (!previous.length) return null;
  const latest = previous[previous.length - 1];
  console.log(`No series bible yet — reconstructing it from season ${latest.season} episode ${latest.episode}`);
  const bible = await withRetries('Series bible', () => bootstrapBible(groq, previous));
  return bible.characters.length ? bible : null;
}

function characterBlock(bible) {
  return bible.characters
    .map((c) => `- ${c.name}${c.nativeName && c.nativeName !== c.name ? ` (written "${c.nativeName}")` : ''}: ${c.role}. Looks: ${c.look}`)
    .join('\n');
}

function storySoFarBlock(bible) {
  const eps = (bible?.episodes || []).filter(isEarlier).sort(byOrder).slice(-4);
  return eps.length ? `Story so far:\n${eps.map((e) => `Season ${e.season || 1} Episode ${e.episode}: ${e.summary}`).join('\n')}` : '';
}

// ---------------------------------------------------------------------------
// Story
// ---------------------------------------------------------------------------

function kathaPlanPrompt() {
  const searches = KATHA_SEARCHES.length
    ? ` People in India are searching YouTube for: ${KATHA_SEARCHES.map((q) => `"${q}"`).join(', ')} — if one of these exact ` +
      'phrases truly describes this katha, use it in the title.'
    : '';
  return 'You plan a long narrated devotional video: a faithful retelling of the traditional katha ' +
    `"${KATHA}" of ${KATHA_DEITY || 'the deity'}, as told in the Puranas / Ramayana / Mahabharata — no invented ` +
    'characters, no modern settings. Reply with JSON only: {"title": string, "description": string, "chapters": [string, ...], ' +
    '"parts": [string, ...], "characters": [{"name": string, "nativeName": string, "role": string, "look": string}], "setting": string}. ' +
    `"title" is the YouTube title in ${languageName()}, at most 70 characters, starting with the deity's name and the ` +
    'word कथा the way people search, then what happens — e.g. "शिव जी की कथा: नीलकंठ — जब महादेव ने पिया हलाहल विष".' +
    `${searches} "description" is 1-2 enticing sentences and "chapters" exactly ${PARTS} short chapter titles, both in ` +
    `${languageName()}. "parts" has exactly ${PARTS} English entries, in order, each a 3-5 sentence summary: part 1 opens ` +
    'with a strong hook, the middle tells the heart of the katha with its emotional turns, the last reaches the ' +
    'resolution and closes with the katha\'s lesson and a blessing — one complete story, never a cliffhanger. ' +
    '"characters" are the 2-6 figures who appear: "name" in English letters, "nativeName" exactly as the story text ' +
    'will spell it, "look" a fixed drawable English description — for gods and epic figures, their exact traditional ' +
    'iconography (e.g. Hanuman: monkey face, red-orange skin, golden crown, mace, no wings). "setting" one English sentence. ' +
    'Refer to characters by name in the parts.';
}

async function planEpisode(groq, bible) {
  const continuity = bible
    ? `Series bible — recurring characters. Use these EXACT names with EXACT spellings; never rename anyone:\n` +
      `${characterBlock(bible)}\nSetting: ${bible.setting}\n${storySoFarBlock(bible)}\n\n`
    : '';
  const castFields = bible
    ? '"newCharacters": [{"name": string, "nativeName": string, "role": string, "look": string}]'
    : '"characters": [{"name": string, "nativeName": string, "role": string, "look": string}], "setting": string';
  const system =
    `You plan episodes of serialized audio fiction. ${continuity}` +
    `Plan episode ${episode} of season ${season} of the continuing ${genre} series "${title}". Reply with JSON only: ` +
    `{"title": string, "description": string, "chapters": [string, ...], "parts": [string, ...], ${castFields}}. ` +
    `"title" is this episode's own title (not the series name), "description" one enticing sentence, and ` +
    `"chapters" exactly ${PARTS} short chapter titles — all three in ${languageName()}. ` +
    `"parts" has exactly ${PARTS} English entries, in order, each a 3-5 sentence summary of that part: part 1 opens ` +
    'with a strong hook, the middle escalates with new obstacles and emotional turns, the last reaches a climax ending ' +
    'on a cliffhanger for the next episode. ' +
    (bible
      ? '"newCharacters" lists only characters introduced in this episode (usually none). '
      : '"characters" defines the 2-5 recurring characters: "name" in English letters, "nativeName" exactly as the story ' +
        'text will spell it, "look" a fixed drawable English description (age, face, hair, clothing); "setting" one English sentence. ') +
    'Refer to characters by name in the parts.';
  const plan = KATHA
    ? await groqJson(groq, kathaPlanPrompt(), `Plan the video of this katha now: ${KATHA}`, 5000)
    : await groqJson(groq, system, `Plan season ${season} episode ${episode} now.`, 5000);
  const parts = Array.isArray(plan.parts) ? plan.parts.map((p) => String(p || '').trim()).filter(Boolean) : [];
  if (!plan.title || parts.length < PARTS) throw new Error('episode plan is missing a title or parts');
  const chapters = Array.isArray(plan.chapters) ? plan.chapters.map((c) => String(c || '').trim()).filter(Boolean) : [];
  return {
    title: String(plan.title).trim(),
    description: String(plan.description || '').trim(),
    chapters: chapters.length >= PARTS ? chapters.slice(0, PARTS) : parts.map((_, i) => `Part ${i + 1}`),
    parts: parts.slice(0, PARTS),
    characters: cleanCharacters(bible ? plan.newCharacters : plan.characters),
    setting: String(plan.setting || '').trim(),
  };
}

// Models sometimes label a continuation ("Part 2:", "भाग 2") despite being
// asked not to — that would be read aloud by the narrator.
function stripPartHeading(text) {
  return text.replace(/^\s*(\*+)?\s*(part|भाग)\s*\d+[^\n]*\n+/i, '').trim();
}

// Normalised for "is this paragraph a repeat" checks only.
function squash(text) {
  return String(text).replace(/\s+/g, ' ').trim();
}

// Models asked to continue a story sometimes restate its last paragraphs
// before carrying on — narrated twice, and counted against the length.
function dropRepeatedStart(text, storySoFar) {
  if (!storySoFar) return text;
  const seen = squash(storySoFar);
  const paragraphs = text.split(/\n\s*\n/);
  let i = 0;
  while (i < paragraphs.length - 1 && squash(paragraphs[i]).length > 40 && seen.includes(squash(paragraphs[i]).slice(0, 160))) i += 1;
  return paragraphs.slice(i).join('\n\n');
}

/**
 * Cuts `text` down to about `maxWords` on paragraph boundaries. A middle
 * part keeps its opening (the next part continues from wherever it now
 * stops); the final part keeps its opening and its ending — the climax and
 * cliffhanger — and loses paragraphs from the middle instead.
 */
function trimToWords(text, maxWords, { keepEnding = false } = {}) {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const count = (list) => countWords(list.join(' '));
  if (count(paragraphs) <= maxWords || paragraphs.length < 2) return text;
  const tail = [];
  if (keepEnding) {
    while (paragraphs.length > 2 && count(tail) < maxWords * 0.35) tail.unshift(paragraphs.pop());
  }
  const head = [];
  for (const p of paragraphs) {
    if (head.length && count([...head, p, ...tail]) > maxWords) break;
    head.push(p);
  }
  return [...head, ...tail].join('\n\n');
}

async function writePart(groq, plan, bible, index, storySoFar, budget) {
  const isLast = index === PARTS - 1;
  const outline = plan.parts.map((summary, i) => `Part ${i + 1}: ${summary}`).join('\n');
  const intro = KATHA
    ? 'You retell traditional Hindu kathas for narration — faithful to the Puranas / Ramayana / Mahabharata, told ' +
      `vividly with devotion, emotion and dialogue. Katha: "${KATHA}". `
    : `You write serialized audio fiction for narration. Series: "${title}", season ${season}, episode ${episode}, genre: ${genre}. `;
  const ending = KATHA
    ? 'This is the final part: tell the resolution fully, then close with the katha\'s lesson and one line of blessing. ' +
      'The story must be complete — never a cliffhanger. '
    : 'This is the final part: build to the climax and end on a cliffhanger for the next episode. ';
  const system =
    intro +
    `Episode title: "${plan.title}".\nCharacters — use exactly these names, spelled exactly like this:\n${characterBlock(bible)}\n` +
    `${storySoFarBlock(bible)}\nFull outline of this episode:\n${outline}\n\n` +
    `Write ONLY part ${index + 1} of ${PARTS}, in ${languageName()}, about ${budget} words ` +
    `(at least ${Math.round(budget * 0.8)}, never more than ${Math.round(budget * 1.15)} — the episode must fit 15 minutes of narration). ` +
    'Detailed scenes, natural dialogue, emotional depth. ' +
    (index === 0
      ? 'Open with a strong hook. '
      : 'Continue seamlessly from exactly where the story so far stops — never repeat or summarise text that was already written. ') +
    (isLast
      ? ending
      : 'Do not wrap up or end the episode — the story continues in the next part. ') +
    'Output only the story text in complete paragraphs: no title, no part labels, no markdown, no sound-effect labels.';
  const user = storySoFar
    ? `The story so far ends with:\n\n${storySoFar.slice(-2500)}\n\nWrite part ${index + 1} now.`
    : 'Write part 1 now.';

  const text = dropRepeatedStart(stripPartHeading(await callGroqText(groq, { system, user, maxTokens: 8000 })), storySoFar);
  const words = countWords(text);
  if (words < budget * 0.4) throw new Error(`part ${index + 1} too short: ${words} words`);
  // A real Hindi run came back with 1,003 / 1,425 / 1,937 words against a
  // 733-word ask — a 31-minute "15-minute" episode that also took 80+
  // minutes to render. Length instructions alone don't hold these models.
  const limit = Math.round(budget * 1.15);
  if (words > limit) {
    console.warn(`Part ${index + 1}: ${words} words is over the ${budget}-word budget — trimming to ~${limit}`);
    return trimToWords(text, limit, { keepEnding: isLast });
  }
  return text;
}

async function generateStory(groq) {
  let bible = await loadBible(groq);
  const plan = await withRetries('Episode plan', () => planEpisode(groq, bible));

  if (!bible) {
    if (!plan.characters.length) throw new Error('episode plan defined no characters for the new series');
    bible = { seriesTitle: title, genre, language, characters: plan.characters, setting: plan.setting, episodes: [] };
  } else {
    const known = new Set(bible.characters.map((c) => c.name.toLowerCase()));
    bible.characters.push(...plan.characters.filter((c) => !known.has(c.name.toLowerCase())));
  }
  console.log(`Planned "${plan.title}" in ${PARTS} parts — cast: ${bible.characters.map((c) => c.name).join(', ')}`);

  const parts = [];
  for (let index = 0; index < PARTS; index += 1) {
    // Each part's budget is what's left of the episode's, so one long or
    // short part is balanced out by the ones after it.
    const written = countWords(parts.join(' '));
    const budget = Math.round(Math.max(WORDS_PER_PART * 0.6, Math.min(WORDS_PER_PART * 1.2, (TARGET_WORDS - written) / (PARTS - index))));
    const text = await withRetries(`Part ${index + 1}`, () => writePart(groq, plan, bible, index, parts.join('\n\n'), budget));
    console.log(`Part ${index + 1}/${PARTS}: ${countWords(text)} words`);
    parts.push(text);
  }

  const wordCount = countWords(parts.join(' '));
  console.log(`Generated ${wordCount} words`);
  if (wordCount < TARGET_WORDS * 0.8) {
    console.warn(`Warning: story has only ${wordCount} words; the episode may run shorter than 15 minutes.`);
  }

  return { plan, bible, parts, text: parts.join('\n\n'), wordCount };
}

// ---------------------------------------------------------------------------
// Narration
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

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
 * One English visual description per narration segment. Every scene used
 * to share a single prompt, so a real render got 12 near-identical generic
 * shots for a story that moves through a lab, a crystal hall and a
 * spaceship.
 */
async function planScenes(groq, plan, bible, segments) {
  const system =
    `You are the visual director for an illustrated ${genre} series. Characters:\n${characterBlock(bible)}\n\n` +
    `Given numbered narration segments (in order), reply with JSON only: {"scenes": [string, ...]} with exactly ` +
    `${segments.length} English entries, one per segment in the same order, each a 12-25 word visual description ` +
    'of what is happening in that segment — who is there (by their English name), what they are doing, where, and ' +
    'the mood. Never describe text, signs or words.';
  const user =
    `Series: ${title}\nEpisode: ${plan.title}\nSetting: ${bible.setting}\n\n` +
    segments.map((s, i) => `${i + 1}. ${s.text.slice(0, 280)}`).join('\n');
  const reply = await groqJson(groq, system, user, 6000);
  const scenes = Array.isArray(reply.scenes) ? reply.scenes.map((s) => String(s || '').trim()) : [];
  if (scenes.filter(Boolean).length < segments.length) throw new Error(`got ${scenes.length}/${segments.length} scenes`);
  return scenes.slice(0, segments.length);
}

const clean = (s) => String(s || '').trim().replace(/[.\s]+$/, '');

/** The fixed look of every bible character this description mentions. */
function looksFor(description, bible) {
  const text = description.toLowerCase();
  const own = bible.characters
    .filter((c) => text.includes(c.name.toLowerCase()) || (c.nativeName && description.includes(c.nativeName)));
  // Deities and epic figures the bible doesn't define get their traditional
  // iconography (lib/iconography.js) — a Mahabharata or Hanuman Chalisa
  // series otherwise draws Krishna or Hanuman however the model imagines.
  const ownNames = own.map((c) => c.name.toLowerCase());
  const traditional = iconographyFor(description, { context: `${title} ${genre}` })
    .filter((f) => !ownNames.some((n) => f.look.toLowerCase().includes(n)));
  return [...own.map((c) => `${c.name}: ${clean(c.look)}`), ...traditional.map((f) => f.look)].join('; ');
}

// The series' art style (see resolveStyle). 'illustration' is the look
// every series had before styles existed; the others are the shared
// devotional styles (lib/short-style.js), framed for 16:9.
let seriesStyle = 'illustration';

function styleText() {
  return seriesStyle === 'illustration'
    ? 'cinematic widescreen 16:9 illustration, no text, no captions, no letters, no logos, no words'
    : artStyleFor(seriesStyle, { orientation: 'wide' });
}

/**
 * Explicit EPISODE_STYLE (workflow input) > the style saved in the series
 * bible > DEVOTIONAL_STYLE for a brand-new series (cartoon3d by default).
 * A series that predates styles keeps 'illustration', so its look doesn't
 * change mid-season unless asked to.
 */
function resolveStyle(bible) {
  const requested = String(process.env.EPISODE_STYLE || '').trim().toLowerCase();
  if (requested === 'illustration' || styleKey(requested)) return requested;
  if (bible.style) return bible.style;
  const isNew = !(bible.episodes || []).length;
  return isNew ? (styleKey(process.env.DEVOTIONAL_STYLE) || 'cartoon3d') : 'illustration';
}

function scenePrompt(description, bible) {
  const looks = looksFor(description, bible);
  return (
    `${clean(description)}. ${looks ? `${looks}. ` : ''}` +
    `${mood}, consistent character design, detailed environment, ${styleText()}.`
  );
}

// ---------------------------------------------------------------------------
// Publishing metadata
// ---------------------------------------------------------------------------

function timestamp(seconds) {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/**
 * Start time of each part in the narration, found by walking the sentence
 * cues until their running word count passes the words of the parts before.
 * YouTube only turns a list into chapters when it starts at 0:00, has 3+
 * entries and each is 10s+ long — otherwise it's just text, so skip it.
 */
function chapterMarks(cues, parts, chapters) {
  const marks = [{ time: 0, label: chapters[0] }];
  let boundary = 0;
  let running = 0;
  let cueIndex = 0;
  for (let i = 1; i < parts.length; i += 1) {
    boundary += countWords(parts[i - 1]);
    while (cueIndex < cues.length && running + countWords(cues[cueIndex].text) <= boundary) {
      running += countWords(cues[cueIndex].text);
      cueIndex += 1;
    }
    if (cueIndex >= cues.length) break;
    marks.push({ time: cues[cueIndex].start, label: chapters[i] });
  }
  const valid = marks.length >= 3 && marks.every((m, i) => i === 0 || m.time - marks[i - 1].time >= 10);
  return valid ? marks : [];
}

function hashtag(value) {
  return `#${String(value).replace(/[^\p{L}\p{N}]+/gu, '')}`;
}

const WHATSAPP = String(process.env.WHATSAPP_CHANNEL_URL || '').trim();

function kathaMetadata({ plan, cues, parts }) {
  const chapters = chapterMarks(cues, parts, plan.chapters);
  // Only the plain "<deity> की कथा(एँ)" searches become tags: the rest of
  // the raw suggestions name other storytellers, dhams or formats, which
  // would be misleading metadata.
  const plain = KATHA_SEARCHES.filter((q) => /(की|के)\s+(कथा|कथाएं|कथाएँ|कहानी|कहानियां)$/.test(q));
  const tags = [...plain, KATHA_DEITY && `${KATHA_DEITY} की कथा`, KATHA_DEITY, 'katha', 'कथा', 'bhakti',
    'pauranik katha', 'hindi kahani', 'StoryByte'].filter(Boolean);
  const cappedTags = [];
  for (const tag of [...new Set(tags)]) {
    if ([...cappedTags, tag].join(',').length > 450) break;
    cappedTags.push(tag);
  }
  const description = [
    plan.description,
    '',
    ...(chapters.length ? ['⏱️ अध्याय', ...chapters.map((m) => `${timestamp(m.time)} ${m.label}`), ''] : []),
    '🙏 रोज़ एक नई कथा — हमारे Shorts देखें और चैनल सब्सक्राइब करें',
    `📱 StoryByte ऐप पर सभी कथाएँ मुफ़्त: ${APP_LINK}`,
    ...(WHATSAPP ? [`💬 रोज़ नई कथा WhatsApp पर: ${WHATSAPP}`] : []),
    '',
    [...new Set([...KATHA_HASHTAGS, '#katha', '#bhakti', '#sanatandharma', '#hindistory', '#StoryByte'])].join(' '),
  ].join('\n');
  return { title: plan.title.slice(0, 100), description, tags: cappedTags, chapters };
}

function buildMetadata({ plan, bible, cues, parts }) {
  if (KATHA) return kathaMetadata({ plan, cues, parts });
  const full = `${title} | ${seasonEpisode}: ${plan.title}`;
  const videoTitle = full.length <= 100 ? full : `${title} | S${season} E${episode}: ${plan.title}`.slice(0, 100);

  const previous = (bible.episodes || []).filter(isEarlier).sort(byOrder).slice(-1)[0];
  const chapters = chapterMarks(cues, parts, plan.chapters);
  const tags = [
    title, `${title} season ${season}`, `${title} s${season}e${episode}`, genre, 'audio story', 'StoryByte', 'web series', 'story',
    language === 'hi' ? 'hindi story' : 'english story', ...bible.characters.slice(0, 4).map((c) => c.name),
  ];
  const cappedTags = [];
  for (const tag of tags) {
    if ([...cappedTags, tag].join(',').length > 450) break;
    cappedTags.push(tag);
  }

  const description = [
    plan.description,
    '',
    `📺 ${title} — Season ${season}, Episode ${episode}`,
    ...(previous?.description ? ['', `⏪ Previously: ${previous.description}`] : []),
    ...(chapters.length ? ['', '⏱️ Chapters', ...chapters.map((m) => `${timestamp(m.time)} ${m.label}`)] : []),
    '',
    '🎧 More stories, free and fully narrated, on StoryByte',
    `📱 Get the app: ${APP_LINK}`,
    '',
    [hashtag(title), `#Season${season}`, `#S${season}E${episode}`, '#AudioStory', '#StoryByte', language === 'hi' ? '#HindiStory' : '#Story'].join(' '),
  ].join('\n');

  return { title: videoTitle, description, tags: cappedTags, chapters };
}

async function thumbnailArt(plan, bible, fallbackImage) {
  const leads = bible.characters.slice(0, 2).map((c) => `${c.name}: ${clean(c.look)}`).join('; ');
  const prompt =
    `Dramatic cinematic key art for the ${genre} series "${title}": ${clean(plan.parts[0]).slice(0, 220)}. ` +
    `${leads}. Characters on the right half of the frame, darker empty space on the left, intense emotional ` +
    `expressions, ${mood}, movie poster lighting, ${styleText()}.`;
  try {
    return await fetchStoryImage(prompt, hashSeed(`${title}-s${season}-${episode}-thumbnail`), {
      width: THUMB_WIDTH, height: THUMB_HEIGHT, steps: IMAGE_STEPS, hq: HQ_LANDSCAPE,
    });
  } catch (error) {
    console.warn(`Thumbnail art failed, using a scene image instead: ${error.message}`);
    return fs.readFileSync(fallbackImage);
  }
}

function saveBible(bible, plan) {
  const entry = { season, episode, title: plan.title, description: plan.description, summary: plan.parts.join(' ') };
  const same = (e) => String(e.season || '1') === season && String(e.episode) === episode;
  bible.episodes = [...(bible.episodes || []).filter((e) => !same(e)), entry].sort(byOrder);
  fs.mkdirSync(seriesDirectory, { recursive: true });
  fs.writeFileSync(biblePath, JSON.stringify(bible, null, 2));
}

// ---------------------------------------------------------------------------

async function main() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set');
  }
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const outputDirectory = path.join(seriesDirectory, `season-${season}`, `episode-${episode}`);
  fs.mkdirSync(outputDirectory, { recursive: true });

  console.log(`Generating "${title}" ${seasonEpisode}`);
  console.log(`Language: ${language}`);
  console.log(`Genre: ${genre}`);
  console.log(`Publish: ${publish ? 'yes (public on YouTube and Facebook)' : 'no'}`);

  const { plan, bible, parts, text, wordCount } = await generateStory(groq);
  seriesStyle = resolveStyle(bible);
  bible.style = seriesStyle;
  console.log(`Art style: ${seriesStyle}`);

  const audioPath = path.join(outputDirectory, 'audio.mp3');
  const subtitlesPath = path.join(outputDirectory, 'captions.srt');

  console.log('Generating narration...');
  synthesize(text, audioPath, subtitlesPath);

  const audioDuration = getDuration(audioPath);
  if (!audioDuration) {
    throw new Error('Could not determine generated audio duration');
  }
  console.log(`Audio duration: ${Math.round(audioDuration)} seconds`);
  if (audioDuration < 780) {
    console.warn(`Audio is shorter than the expected 13-minute minimum: ${Math.round(audioDuration)} seconds`);
  }
  if (audioDuration > 960) {
    console.warn(`Audio is longer than the expected 16-minute maximum: ${Math.round(audioDuration)} seconds`);
  }

  const parsed = parseSrt(fs.readFileSync(subtitlesPath, 'utf8'));
  const cues = parsed.length ? parsed : [{ start: 0, end: audioDuration, text: '' }];

  // About one scene every 30 seconds — ~30 for a 15-minute episode.
  const sceneCount = Math.max(12, Math.min(32, Math.round(audioDuration / 30)));
  const segments = segmentCues(cues, sceneCount, audioDuration);

  let sceneDescriptions = null;
  try {
    sceneDescriptions = await withRetries('Scene plan', () => planScenes(groq, plan, bible, segments));
    console.log(`Scene plan ready (${sceneDescriptions.length} scenes)`);
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
    // first part's English summary for those.
    const description = sceneDescriptions?.[index] ||
      (language === 'en' ? segment.text.slice(0, 240) : clean(plan.parts[Math.floor((index * PARTS) / sceneCount)]).slice(0, 240));
    scenePrompts.push(description);

    console.log(`Generating scene ${sceneNumber}/${sceneCount}...`);
    let image = await fetchSceneImage(
      scenePrompt(description, bible),
      hashSeed(`${title}-s${season}-${episode}-${sceneNumber}`),
      // Native 16:9 from FLUX.2 (lib/cloudflare-image.js), scaled 1.43x to
      // 1920x1080 — not a 1024 square cropped to a 576px strip and blown up.
      { width: WIDTH, height: HEIGHT, steps: IMAGE_STEPS, hq: HQ_LANDSCAPE }
    );
    if (!image) {
      // One failed image used to abort the whole ~15-minute episode.
      console.warn(`Scene ${sceneNumber}: image generation failed, using a themed fallback card`);
      image = await renderFallbackCover(themeKey, { width: WIDTH, height: HEIGHT });
    }
    const imagePath = path.join(outputDirectory, `scene-${String(sceneNumber).padStart(2, '0')}.jpg`);
    fs.writeFileSync(imagePath, image);
    scenes.push({ file: imagePath, duration: Math.max(2, segment.end - segment.start) });
  }

  const videoPath = path.join(outputDirectory, 'episode.mp4');
  console.log('Rendering 1920x1080 landscape video with captions...');
  const captionLines = toCaptionChunks(parsed);
  const rendered = await renderLandscapeVideo({
    scenes,
    audioPath,
    outPath: videoPath,
    captions: captionLines,
    font: captionFont(language),
  });
  if (!rendered || !fs.existsSync(videoPath)) {
    throw new Error('Landscape video rendering failed');
  }

  console.log('Rendering thumbnail...');
  const thumbnailPath = path.join(outputDirectory, 'thumbnail.jpg');
  const art = await thumbnailArt(plan, bible, scenes[Math.floor(scenes.length / 2)].file);
  fs.writeFileSync(thumbnailPath, await renderEpisodeThumbnail(KATHA
    ? { art, seriesTitle: KATHA_DEITY ? `${KATHA_DEITY} की कथा` : title, episodeTitle: plan.title.replace(/^[^:]*:\s*/, ''), accent, badge: 'पूरी कथा' }
    : { art, seriesTitle: title, season, episode, episodeTitle: plan.title, accent }));

  const metadata = buildMetadata({ plan, bible, cues: parsed, parts });
  saveBible(bible, plan);

  const published = {};
  if (publish) {
    console.log('Publishing...');
    published.youtube = await uploadEpisodeToYouTube({
      videoPath, thumbnailPath, title: metadata.title, description: metadata.description,
      tags: metadata.tags, language, privacy: 'public',
    });
    published.facebook = await uploadEpisodeToFacebook({
      videoPath, thumbnailPath, title: metadata.title, description: metadata.description,
    });
  }

  fs.writeFileSync(
    path.join(outputDirectory, 'story.json'),
    JSON.stringify(
      {
        seriesTitle: title,
        season,
        episode,
        // Read by scripts/prune-old-videos.js to age out episode.mp4.
        renderedAt: new Date().toISOString(),
        genre,
        language,
        generatedTitle: plan.title,
        description: plan.description,
        chapters: plan.chapters,
        outline: plan.parts,
        wordCount,
        cast: bible.characters.map((c) => c.name),
        scenes: scenePrompts,
        metadata,
        published,
        text,
      },
      null,
      2
    )
  );

  fs.writeFileSync(
    path.join(outputDirectory, 'README.txt'),
    [
      `Series: ${title}`,
      `Season: ${season}`,
      `Episode: ${episode} — ${plan.title}`,
      `Language: ${language}`,
      `Genre: ${genre}`,
      `Words: ${wordCount}`,
      `Duration: ${Math.round(audioDuration)} seconds`,
      'Resolution: 1920x1080',
      'Frame rate: 30 FPS',
      `Scenes: ${sceneCount} (${sceneDescriptions ? 'planned from narration' : 'narration excerpts'})`,
      `Captions: ${captionLines.length} lines, burned in`,
      `Chapters: ${metadata.chapters.length ? metadata.chapters.map((m) => `${timestamp(m.time)} ${m.label}`).join(' | ') : 'none'}`,
      `YouTube: ${published.youtube?.url || (publish ? `failed — ${published.youtube?.reason}` : 'not published')}`,
      `Facebook: ${published.facebook?.url || (publish ? `failed — ${published.facebook?.reason}` : 'not published')}`,
      '',
      `Title: ${metadata.title}`,
      '',
      metadata.description,
    ].join('\n')
  );

  console.log('');
  console.log('Landscape episode completed successfully.');
  console.log(`Output directory: ${outputDirectory}`);
  console.log(`Video: ${videoPath}`);

  // Rendering succeeded but a requested upload didn't — fail the job so it's
  // noticed, now that the rendered episode and bible are already saved.
  if (publish && (!published.youtube?.posted || !published.facebook?.posted)) {
    throw new Error('Episode rendered, but publishing failed — see the warnings above');
  }
}

main().catch((error) => {
  console.error('');
  console.error('Landscape episode generation failed:');
  console.error(error?.stack || error);
  process.exit(1);
});
