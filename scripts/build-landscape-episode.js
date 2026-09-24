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

const voice = language === 'hi'
  ? 'hi-IN-SwaraNeural'
  : 'en-US-AriaNeural';

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

async function generateText() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set');
  }

  const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

  const languageName = language === 'hi'
    ? 'Hindi using Devanagari script'
    : 'English';

  const systemPrompt =
    `You write serialized audio fiction. Return JSON only with exactly these fields: ` +
    `title, description, and text. ` +
    `Write episode ${episode} of a continuing ${genre} series called "${title}" ` +
    `in ${languageName}. ` +
    `This is a long-form episode for approximately 15 minutes of narration. ` +
    `Write between 2,000 and 2,500 spoken words. ` +
    `Do not summarize or shorten the story. ` +
    `Include a strong opening hook, detailed scenes, natural dialogue, emotional development, ` +
    `an escalating middle, and a satisfying cliffhanger ending. ` +
    `Use complete paragraphs. Do not use markdown, sound-effect labels, or chapter headings.`;

  const messages = [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content:
        `Write episode ${episode} now. ` +
        `The final text must be a complete long-form episode, not an outline or summary.`,
    },
  ];

  const errors = [];

  for (const model of models) {
    try {
      console.log(`Trying Groq model: ${model}`);

      const response = await groq.chat.completions.create({
        model,
        temperature: 0.85,
        max_tokens: 10000,
        top_p: 0.95,
        response_format: {
          type: 'json_object',
        },
        messages,
      });

      const rawContent = response.choices?.[0]?.message?.content;

      if (!rawContent) {
        throw new Error('Model returned an empty response');
      }

      const data = JSON.parse(rawContent.trim());

      const wordCount = String(data.text || '')
        .split(/\s+/)
        .filter(Boolean)
        .length;

      if (!data.title || !data.text) {
        throw new Error('Response did not contain title and text');
      }

      // Reject only clearly unusable responses. Some models may produce
      // less than the ideal target even with a large token budget.
      if (wordCount < 800) {
        throw new Error(`Story is too short: ${wordCount} words`);
      }

      if (wordCount < 1800) {
        console.warn(
          `Warning: story has only ${wordCount} words; ` +
          'the final episode may be shorter than 15 minutes.'
        );
      }

      console.log(`Model succeeded: ${model}`);
      console.log(`Generated ${wordCount} words`);

      return {
        title: String(data.title).trim(),
        description: String(data.description || '').trim(),
        text: String(data.text).trim(),
        wordCount,
      };
    } catch (error) {
      const message = error?.message || String(error);
      errors.push(`${model}: ${message}`);
      console.warn(`Model ${model} failed: ${message}`);
    }
  }

  throw new Error(
    `All configured story models failed:\n${errors.join('\n')}`
  );
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

function parseSrt(file, totalDuration) {
  const raw = fs.readFileSync(file, 'utf8');

  const cues = raw
    .split(/\r?\n\r?\n/)
    .map((block) => {
      const match = block.match(
        /(\d\d):(\d\d):(\d\d),(\d{3})\s+-->\s+(\d\d):(\d\d):(\d\d),(\d{3})/
      );

      if (!match) {
        return null;
      }

      const toSeconds = (hours, minutes, seconds, milliseconds) =>
        Number(hours) * 3600 +
        Number(minutes) * 60 +
        Number(seconds) +
        Number(milliseconds) / 1000;

      return {
        start: toSeconds(
          match[1],
          match[2],
          match[3],
          match[4]
        ),
        end: toSeconds(
          match[5],
          match[6],
          match[7],
          match[8]
        ),
      };
    })
    .filter(Boolean);

  return cues.length > 0
    ? cues
    : [{ start: 0, end: totalDuration }];
}

function sceneTime(cues, fraction, totalDuration) {
  if (fraction <= 0) {
    return 0;
  }

  if (fraction >= 1) {
    return totalDuration;
  }

  const index = Math.min(
    cues.length - 1,
    Math.floor(fraction * cues.length)
  );

  return cues[index].start;
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
        wordCount: content.wordCount,
        text: content.text,
      },
      null,
      2
    )
  );

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

  const cues = parseSrt(subtitlesPath, audioDuration);

  // Approximately one visual scene every 45 seconds.
  // A 15-minute episode creates approximately 20 scenes.
  const sceneCount = Math.max(
    12,
    Math.min(24, Math.round(audioDuration / 45))
  );

  console.log(`Generating ${sceneCount} landscape scenes...`);

  const scenes = [];

  for (let index = 0; index < sceneCount; index += 1) {
    const sceneNumber = index + 1;

    const prompt =
      `Landscape cinematic scene ${sceneNumber} of ${sceneCount} ` +
      `from episode ${episode} of "${title}". ` +
      `${content.description || genre}. ` +
      `Science-fiction romance atmosphere, consistent recurring characters, ` +
      `cinematic lighting, detailed environment, widescreen composition, ` +
      `no text, no captions, no logos, no words.`;

    console.log(
      `Generating scene ${sceneNumber}/${sceneCount}...`
    );

    const image = await fetchSceneImage(
      prompt,
      hashSeed(`${title}-${episode}-${sceneNumber}`)
    );

    if (!image) {
      throw new Error(
        `Image generation failed for scene ${sceneNumber}`
      );
    }

    const imagePath = path.join(
      outputDirectory,
      `scene-${String(sceneNumber).padStart(2, '0')}.jpg`
    );

    fs.writeFileSync(imagePath, image);

    const start = sceneTime(
      cues,
      index / sceneCount,
      audioDuration
    );

    const end = sceneTime(
      cues,
      (index + 1) / sceneCount,
      audioDuration
    );

    scenes.push({
      file: imagePath,
      duration: Math.max(2, end - start),
    });
  }

  const videoPath = path.join(
    outputDirectory,
    'episode.mp4'
  );

  console.log('Rendering 1920x1080 landscape video...');

  const rendered = renderLandscapeVideo({
    scenes,
    audioPath,
    outPath: videoPath,
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
      `Scenes: ${sceneCount}`,
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
