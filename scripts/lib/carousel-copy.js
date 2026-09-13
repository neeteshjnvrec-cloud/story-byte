/**
 * Curiosity-driven copy for the Instagram carousel — a short "hook" tagline
 * for the cover slide, and a handful of teaser lines that walk the story's
 * arc without spoiling the ending, for the quote-card slides.
 *
 * Primary path: ask Groq to write it (it already reads the whole story, so
 * it can tease the middle/climax without giving away the resolution).
 * Fallback (Groq unavailable/fails): pick evenly-spaced sentences straight
 * from the story text. Never throws — a copy failure must not block a
 * story's own publish.
 */
let Groq;
try {
  Groq = require('groq-sdk');
} catch {
  Groq = null;
}

const MODEL = process.env.GROQ_MODEL_CAROUSEL || 'llama-3.3-70b-versatile';

/** How many teaser slides a story earns, scaled to its length. */
function slideCountFor(text) {
  const words = String(text || '').split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.min(6, Math.round(words / 180)));
}

function sentences(text) {
  return (String(text || '').replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) || [])
    .map((s) => s.trim())
    .filter(Boolean);
}

function truncate(s, max) {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

/** Evenly-spaced sentence groups across the whole story — a safe, no-LLM
 *  fallback that still reads as an arc rather than a random blob. */
function heuristicSlides(text, count) {
  const sents = sentences(text);
  if (sents.length === 0) return [truncate(String(text || ''), 200)];
  const out = [];
  for (let i = 0; i < count; i++) {
    const start = Math.floor((i * sents.length) / count);
    const end = Math.max(start + 1, Math.floor(((i + 1) * sents.length) / count));
    out.push(truncate(sents.slice(start, Math.min(end, start + 2)).join(' '), 220));
  }
  return out;
}

async function llmCopy({ title, text, genre, description }, count) {
  if (!Groq || !process.env.GROQ_API_KEY) return null;
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const sys =
      'You write Instagram carousel copy that promotes an audio story app. Given a full story, ' +
      'reply with JSON only: {"hook": string, "slides": string[]}. ' +
      '"hook" is one punchy, curiosity-driven line (max 100 characters) that makes someone want to know ' +
      "what happens — a question, a tease, or a striking detail. Never a summary. " +
      `"slides" must have exactly ${count} entries, each 10-22 words, walking the story's beginning, ` +
      'middle and turning points in order, vivid and specific to THIS story, building suspense — and must ' +
      'NEVER reveal how the story ends. Plain text only, no markdown, no quotation marks around the values.';
    const user = `Title: ${title}\nGenre: ${genre}\nDescription: ${description || ''}\n\nStory:\n${String(text || '').slice(0, 6000)}`;

    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.9,
      max_tokens: 700,
      top_p: 0.95,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
    });

    const d = JSON.parse(completion.choices[0].message.content.trim());
    const slides = Array.isArray(d.slides) ? d.slides.map((s) => String(s).trim()).filter(Boolean) : [];
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

/** Returns { hook, slides }, `slides.length` between 3 and 6. */
async function buildCarouselCopy(story) {
  const count = slideCountFor(story.text);
  const llm = await llmCopy(story, count);
  if (llm) return llm;
  return {
    hook: truncate((story.description || story.title || '').trim(), 110),
    slides: heuristicSlides(story.text, count),
  };
}

module.exports = { buildCarouselCopy, slideCountFor };
