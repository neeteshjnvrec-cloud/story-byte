/**
 * Curiosity-driven copy for the Instagram carousel — for each teaser slide,
 * a short spoiler-free line that walks the story's arc, plus (when Groq is
 * available) a one-line scene description so that slide can get its own
 * generated illustration instead of sitting on a flat gradient.
 *
 * Primary path: ask Groq to write it (it already reads the whole story, so
 * it can tease the middle/climax — and describe a matching scene — without
 * giving away the resolution).
 * Fallback (Groq unavailable/fails): pick evenly-spaced sentences straight
 * from the story text, with no per-slide scene image (the renderer falls
 * back to a themed gradient card for those). Never throws — a copy failure
 * must not block a story's own publish.
 */
let Groq;
try {
  Groq = require('groq-sdk');
} catch {
  Groq = null;
}

// Groq periodically retires models outright (this list previously defaulted
// to the now-404ing llama-3.3-70b-versatile) — a fallback chain, same
// pattern as build-stories.js, means one deprecation doesn't silently kill
// every carousel's AI copy until someone notices the warning in CI logs.
const MODELS = (process.env.GROQ_MODEL_CAROUSEL || 'groq/compound-mini,groq/compound,openai/gpt-oss-20b,openai/gpt-oss-120b')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** How many teaser slides a story earns, scaled to its length. */
function slideCountFor(text) {
  const words = String(text || '').split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.min(6, Math.round(words / 180)));
}

// '।'/'॥' (U+0964/U+0965, danda/double danda) end a sentence in Hindi —
// this pipeline's other supported language (see SLOTS in build-stories.js).
// Missing them here isn't cosmetic: with none matched, the whole story
// reads as one giant "sentence" and every slide count below collapses to
// 1, however many the story earned by length — confirmed in production on
// a Hindi story that fell back to this heuristic (its LLM copy call failed)
// and got a 2-slide carousel, and a video that inherited those same 2
// slides, instead of the ~4-5 both should have had.
const SENTENCE_END = '.!?।॥';
function sentences(text) {
  const re = new RegExp(`[^${SENTENCE_END}]+[${SENTENCE_END}]+(?=\\s|$)|[^${SENTENCE_END}]+$`, 'g');
  return (String(text || '').replace(/\s+/g, ' ').trim().match(re) || [])
    .map((s) => s.trim())
    .filter(Boolean);
}

function truncate(s, max) {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

/** Some reasoning-capable Groq models prepend prose (e.g. "**Reasoning**...")
 *  or wrap the object in a ```json fence even with response_format:
 *  json_object set. Try a plain parse first, then fall back to pulling out
 *  the first balanced {...} block instead of failing the whole slide. */
function extractJson(raw) {
  const text = String(raw || '').trim();
  try {
    return JSON.parse(text);
  } catch {
    /* fall through to brace scan */
  }
  const start = text.indexOf('{');
  if (start === -1) throw new Error('no JSON object found in model response');
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return JSON.parse(text.slice(start, i + 1));
    }
  }
  throw new Error('no balanced JSON object found in model response');
}

/** Evenly-spaced sentence groups across the whole story — a safe, no-LLM
 *  fallback that still reads as an arc rather than a random blob. No scene
 *  image (nothing here can safely describe one without the LLM). */
function heuristicSlides(text, count) {
  const sents = sentences(text);
  if (sents.length === 0) return [{ text: truncate(String(text || ''), 200), image: null }];
  // Splitting into more buckets than there are sentences forces two buckets
  // to draw the same start index (e.g. 3 sentences into 5 slides), which
  // produced two slides with identical text back to back. Capping the
  // bucket count to the sentence count guarantees every bucket gets at
  // least one sentence no other bucket has.
  const n = Math.max(1, Math.min(count, sents.length));
  const groups = Array.from({ length: n }, (_, i) => {
    const start = Math.floor((i * sents.length) / n);
    const end = i === n - 1 ? sents.length : Math.max(start + 1, Math.floor(((i + 1) * sents.length) / n));
    return truncate(sents.slice(start, Math.min(end, start + 2)).join(' '), 220);
  });
  return groups.map((text) => ({ text, image: null }));
}

/** Drops any slide whose text exactly repeats the previous slide's — a
 *  safety net regardless of which path produced the slides (the LLM itself
 *  occasionally repeats a line too). */
function dedupeConsecutive(slides) {
  return slides.filter((s, i) => i === 0 || s.text.trim() !== slides[i - 1].text.trim());
}

async function llmCopy({ title, text, genre, description }, count) {
  if (!Groq || !process.env.GROQ_API_KEY) return null;
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const sys =
      'You write Instagram carousel copy that promotes an audio story app. Given a full story, ' +
      'reply with JSON only: {"hook": string, "slides": [{"text": string, "image": string}]}. ' +
      '"hook" and every slide "text" must be written in the SAME LANGUAGE as the story text below — ' +
      'never translate it to English. ' +
      '"hook" is one punchy, curiosity-driven line (max 100 characters) that makes someone want to know ' +
      "what happens — a question, a tease, or a striking detail. Never a summary. " +
      `"slides" must have exactly ${count} entries, in order, walking the story's beginning, middle and ` +
      'turning points, vivid and specific to THIS story, building suspense — and must NEVER reveal how the ' +
      'story ends. Each entry: "text" is 10-22 words of teaser copy (plain text, no markdown, no quotation ' +
      'marks); "image" is, regardless of the story\'s language, always a 6-14 word ENGLISH visual description ' +
      'of that exact moment/scene for an illustrator — concrete subject, setting and mood, specific to what ' +
      'actually happens in THIS story (name a well-known deity/mythological/historical figure the story is ' +
      "about if there is one, e.g. Krishna, Ganesha, Rama — but never invent a name for an ordinary fictional " +
      'character), no text or words rendered in the image, no summary of plot.';
    const user = `Title: ${title}\nGenre: ${genre}\nDescription: ${description || ''}\n\nStory:\n${String(text || '').slice(0, 6000)}`;

    let completion = null;
    let lastError = null;
    for (const model of MODELS) {
      try {
        completion = await groq.chat.completions.create({
          model,
          temperature: 0.9,
          max_tokens: 900,
          top_p: 0.95,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: user },
          ],
        });
        break;
      } catch (e) {
        lastError = e;
      }
    }
    if (!completion) throw lastError || new Error('all carousel-copy models failed');

    const d = extractJson(completion.choices[0].message.content);
    const slides = Array.isArray(d.slides)
      ? d.slides
          .map((s) =>
            typeof s === 'string'
              ? { text: s.trim(), image: null }
              : { text: String(s?.text || '').trim(), image: s?.image ? String(s.image).trim() : null }
          )
          .filter((s) => s.text)
      : [];
    if (slides.length === 0) return null;

    return {
      hook: truncate(String(d.hook || description || title || '').trim(), 110),
      slides: slides.slice(0, count),
    };
  } catch (e) {
    console.warn(`  ⚠️  Carousel hook generation failed, falling back to excerpts: ${e.message}`);
    return null;
  }
}

/** Returns { hook, slides }: slides.length between 3 and 6 (fewer if the
 *  story doesn't have enough distinct content for that many — see
 *  dedupeConsecutive), each `{ text, image }` where `image` is a scene
 *  prompt or null. */
async function buildCarouselCopy(story) {
  const count = slideCountFor(story.text);
  const llm = await llmCopy(story, count);
  if (llm) return { ...llm, slides: dedupeConsecutive(llm.slides) };
  return {
    hook: truncate((story.description || story.title || '').trim(), 110),
    slides: dedupeConsecutive(heuristicSlides(story.text, count)),
  };
}

module.exports = { buildCarouselCopy, slideCountFor, extractJson };
