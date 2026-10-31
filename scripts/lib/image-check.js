/**
 * Looks at a generated picture before it's used and redraws the bad ones.
 *
 * Image models get bodies wrong (an extra or missing arm, fused or six-finger
 * hands, a melted face) and drift from the deity people know (Hanuman drawn
 * with wings, Durga with two arms). A vision model checks each picture
 * against what it should show, including the traditional look from
 * lib/iconography.js — so Durga's eight arms or Brahma's four heads are
 * expected, not flagged.
 *
 * Checkers, first that answers: Groq (GROQ_VISION_MODEL, else the models in
 * GROQ_MODELS, with GROQ_API_KEY), then Gemini (GEMINI_VISION_MODEL, else
 * GEMINI_MODELS, with GEMINI_API_KEY). Each tries its models in order and
 * drops one the provider has retired: in October 2026 Groq removed Llama 4
 * Scout and Google closed gemini-2.5-flash to new keys, and with a single
 * hard-coded name each, every picture went unchecked. Once those are used
 * up, each provider's own model list is read (discover) for others to try:
 * by late October Groq had removed both Llama 4 models too.
 *
 * A model that keeps failing (overloaded, out of its daily quota) is set
 * aside after STRIKES failures in a row, so the run moves on to the next
 * model instead of waiting on it for every picture. With no checker
 * answering, pictures pass unchecked: a check must never stop a video.
 * IMAGE_CHECK=0 turns it off.
 */
const sharp = require('sharp');

const models = (env, fallback) => [...new Set([env, ...fallback].map((m) => String(m || '').trim()).filter(Boolean))];
const GROQ_MODELS = models(process.env.GROQ_VISION_MODEL, ['meta-llama/llama-4-maverick-17b-128e-instruct', 'meta-llama/llama-4-scout-17b-16e-instruct']);
// Google's 404 for gemini-2.5-flash names gemini-3.8-flash as its replacement.
const GEMINI_MODELS = models(process.env.GEMINI_VISION_MODEL, ['gemini-3.8-flash', 'gemini-2.5-flash']);
// Redraws per picture after a failed check; each is one more image request.
const MAX_REDRAWS = Math.max(0, Number(process.env.IMAGE_CHECK_REDRAWS ?? 2));
// A model that failed outright (retired, or a bad key) isn't asked again
// this run; a checker with none left is skipped.
const dead = new Set();
// Failures in a row per model; at STRIKES it's set aside for the run.
const STRIKES = 3;
const strikes = new Map();
const stats = { checked: 0, failed: 0, redrawn: 0, fixed: 0, unchecked: 0 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The stickman style is deliberately bare: stick figures, a few props, no
// iconography. Judged by the usual rules, a checker failed nearly every
// stickman picture for "simplified line art" or "only two of Surya's seven
// horses" and each scene was drawn three times for nothing.
const STICKMAN_RULES = [
  'This is the deliberately minimalist STICKMAN style: simple black stick figures, round heads, plain background, few props.',
  'Simple line art, missing details, missing traditional iconography, counts of animals or objects, and figures from the description that are left out are all FINE.',
  'Fail the picture only for clear defects:',
  '- a broken or unreadable picture (garbled shapes, a figure fused into another, a face or head growing from a body part)',
  '- a stick figure with clearly extra heads or limbs that the story does not call for',
  '- text, letters, watermarks or logos in the picture',
  '- blood, gore or nudity',
  'Reply with JSON only: {"ok": true|false, "score": 1-10 (overall quality), "problems": ["short description", ...]}',
];

function instructions({ subject, looks, style }) {
  if (style === 'stickman') {
    return ['You check AI-generated pictures for a devotional story channel before they are published.',
      subject && `The picture should roughly show: ${subject}`, ...STICKMAN_RULES].filter(Boolean).join('\n');
  }
  return [
    'You check AI-generated pictures for a devotional story channel before they are published.',
    subject && `The picture should show: ${subject}`,
    looks && `Traditional appearance the figures must have (extra arms or heads listed here are CORRECT): ${looks}`,
    'Fail the picture only for clear, visible defects:',
    '- anatomy: a person or deity with more or fewer arms, hands, legs or heads than they should have; hands with the wrong number of fingers, fused or melted; distorted or duplicated faces; limbs growing from the wrong place',
    '- the wrong deity look: missing the defining features above (e.g. Krishna not blue, Ganesha without an elephant head, Hanuman without a monkey face)',
    '- text, letters, watermarks or logos in the picture',
    '- blood, gore or nudity',
    'Small stylistic flaws, soft backgrounds and artistic choices are fine.',
    'Reply with JSON only: {"ok": true|false, "score": 1-10 (overall quality and correctness), "problems": ["short description", ...]}',
  ].filter(Boolean).join('\n');
}

function parse(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) throw new Error('no JSON in reply');
  const j = JSON.parse(m[0]);
  return { ok: j.ok !== false, score: Number(j.score) || (j.ok === false ? 3 : 7), problems: Array.isArray(j.problems) ? j.problems.map(String) : [] };
}

async function askGroq(b64, prompt, model) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, temperature: 0, max_tokens: 300, response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } },
      ] }],
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(`Groq ${res.status}: ${JSON.stringify(json.error || json).slice(0, 160)}`), { status: res.status });
  return parse(json.choices?.[0]?.message?.content);
}

async function askGemini(b64, prompt, model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: b64 } }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }),
  });
  const json = await res.json().catch(() => ({}));
  // `daily`: the free tier's per-day quota is spent (its quotaId says
  // PerDay), which won't come back this run, unlike a per-minute limit.
  if (!res.ok) {
    throw Object.assign(new Error(`Gemini ${res.status}: ${JSON.stringify(json.error || json).slice(0, 160)}`),
      { status: res.status, daily: res.status === 429 && /PerDay/i.test(JSON.stringify(json)) });
  }
  return parse(json.candidates?.[0]?.content?.parts?.map((p) => p.text).join(''));
}

/** Groq's models that can see pictures, by name (its list doesn't say). */
async function listGroq() {
  const res = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` } });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data || []).map((m) => m.id).filter((id) => /vision|vl\b|-vl-|llama-4|scout|maverick|gemma-3/i.test(id));
}

/** Gemini's Flash models that take a prompt, newest first (lite ones have
 *  their own daily quota). */
async function listGemini() {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY } });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.models || [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((n) => /flash/.test(n) && !/image|tts|audio|live|embed|thinking/.test(n))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
}

const CHECKERS = [
  { name: 'groq', ready: () => !!process.env.GROQ_API_KEY, ask: askGroq, models: GROQ_MODELS, list: listGroq },
  { name: 'gemini', ready: () => !!process.env.GEMINI_API_KEY, ask: askGemini, models: GEMINI_MODELS, list: listGemini },
];

/** Once a checker's named models are all set aside, adds the others its
 *  provider lists (once per run). */
async function discover(c) {
  if (c.listed) return;
  c.listed = true;
  try {
    const more = (await c.list()).filter((m) => !c.models.includes(m));
    if (more.length) console.log(`    🔎 Picture check: also trying ${c.name} ${more.join(', ')}`);
    c.models.push(...more);
  } catch (e) {
    console.warn(`    ⚠️  Picture check: couldn't list ${c.name}'s models: ${e.message}`);
  }
}

/**
 * Checks one picture. Returns { ok, score, problems, checker } or null when
 * no checker could answer (treat as a pass).
 */
async function checkImage(buf, context = {}) {
  if (process.env.IMAGE_CHECK === '0' || !buf) return null;
  const b64 = (await sharp(buf).resize(768, 768, { fit: 'inside' }).jpeg({ quality: 85 }).toBuffer()).toString('base64');
  const prompt = instructions(context);
  for (const c of CHECKERS) {
    if (!c.ready()) continue;
    if (c.models.every((m) => dead.has(m))) await discover(c);
    // Indexed: discover() can add models while this loop runs.
    for (let i = 0; i < c.models.length; i++) {
      const model = c.models[i];
      if (dead.has(model)) continue;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const verdict = await c.ask(b64, prompt, model);
          strikes.delete(model);
          return { ...verdict, checker: `${c.name} ${model}` };
        } catch (e) {
          // Rate limited: one wait, then try again; out of today's quota: next model.
          if (e.status === 429 && attempt === 0 && !e.daily) { await sleep(8000); continue; }
          // A retired model or a wrong key won't fix itself this run.
          if ([400, 401, 403, 404].includes(e.status) || e.daily) {
            console.warn(`    ⚠️  Picture check: ${c.name} ${model} unavailable (${e.message.slice(0, 160)}); not asking it again this run`);
            dead.add(model);
          } else {
            // Overloaded, out of quota, a timeout: the next model, and after
            // STRIKES in a row this one is set aside.
            const n = (strikes.get(model) || 0) + 1;
            strikes.set(model, n);
            console.warn(`    ⚠️  Picture check: ${c.name} ${model} failed (${e.message.slice(0, 120)})` +
              (n >= STRIKES ? `; ${n} in a row, not asking it again this run` : ''));
            if (n >= STRIKES) dead.add(model);
          }
          if (c.models.slice(i + 1).every((m) => dead.has(m))) await discover(c);
          break;
        }
      }
    }
  }
  return null;
}

// Positive wording (naming a defect tends to draw it): added to a redraw's
// prompt.
const CAREFUL = 'Anatomically correct: every figure has exactly the right number of arms, hands, legs and heads ' +
  'for their traditional form, natural hands with five fingers, clear well-formed faces, no text in the picture';

/**
 * `draw(extraPrompt)` → Buffer|null draws one picture (extraPrompt is '' the
 * first time, then corrective wording). Checks each result and redraws up to
 * MAX_REDRAWS times, returning the first that passes, else the best scored.
 */
async function drawChecked(draw, context = {}, label = 'picture') {
  let best = null;
  let bestScore = -1;
  for (let attempt = 0; attempt <= MAX_REDRAWS; attempt++) {
    const extra = attempt === 0 ? '' : `${CAREFUL}${best?.problems?.length ? `. Fix: ${best.problems.join('; ')}` : ''}`;
    const buf = await draw(extra);
    if (!buf) return best?.buf || null;
    const verdict = await checkImage(buf, context);
    if (!verdict) { stats.unchecked++; return buf; }
    stats.checked++;
    if (verdict.ok) {
      if (attempt > 0) { stats.fixed++; console.log(`    ✅ ${label}: redraw ${attempt} passed the check`); }
      return buf;
    }
    stats.failed++;
    console.warn(`    🔁 ${label}: failed the check (${verdict.problems.join('; ').slice(0, 160) || 'no detail'})`);
    if (verdict.score > bestScore) { best = { buf, problems: verdict.problems }; bestScore = verdict.score; }
    if (attempt < MAX_REDRAWS) stats.redrawn++;
  }
  console.warn(`    ⚠️  ${label}: no redraw passed; using the best of ${MAX_REDRAWS + 1}`);
  return best.buf;
}

/** One log line for the run's summary. */
function checkSummary() {
  if (!stats.checked && !stats.unchecked) return '';
  return `🔎 Picture check: ${stats.checked} checked, ${stats.failed} failed, ${stats.redrawn} redrawn, ${stats.fixed} fixed by a redraw` +
    (stats.unchecked ? `, ${stats.unchecked} unchecked (no checker answered)` : '');
}

module.exports = { checkImage, drawChecked, checkSummary };
