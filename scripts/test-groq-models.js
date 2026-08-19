/**
 * Groq Model Test — checks which models are working & their limits
 *
 * Usage:
 *   GROQ_API_KEY=your_key node test-groq-models.js
 *   GROQ_MODELS=openai/gpt-oss-20b,groq/compound node test-groq-models.js
 */

const Groq = require('groq-sdk');

const API_KEY = process.env.GROQ_API_KEY;
if (!API_KEY) {
  console.error('❌ Set GROQ_API_KEY environment variable');
  process.exit(1);
}

// Default model list from earlier Groq API response
const MODELS = (process.env.GROQ_MODELS || [
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'groq/compound',
  'groq/compound-mini',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'llama-3.3-70b-versatile',
  'qwen/qwen3.6-27b',
].join(',')).split(',').map(s => s.trim());

const groq = new Groq({ apiKey: API_KEY });

const TEST_PROMPT = 'Write a one-sentence story about a cat.';

async function testModel(model) {
  try {
    const start = Date.now();
    const response = await groq.chat.completions.create({
      model,
      messages: [{ role: 'user', content: TEST_PROMPT }],
      max_tokens: 100,
      temperature: 0.7,
    });
    const ms = Date.now() - start;
    const text = response.choices?.[0]?.message?.content?.trim() || '(no text)';
    console.log(`✅ ${model}`);
    console.log(`   ${ms}ms | ${text}`);
    return { model, ok: true, ms, text };
  } catch (e) {
    const msg = e.message || String(e);
    console.log(`❌ ${model}`);
    console.log(`   ${msg.slice(0, 100)}`);
    return { model, ok: false, error: msg.slice(0, 100) };
  }
}

async function main() {
  console.log(`\n🧪 Testing ${MODELS.length} Groq models...\n`);
  const results = [];

  for (const model of MODELS) {
    const r = await testModel(model);
    results.push(r);
    // Small delay between requests to avoid rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  const ok = results.filter(r => r.ok);
  const fail = results.filter(r => !r.ok);

  console.log(`\n📊 Results: ${ok.length}/${results.length} working\n`);

  if (ok.length > 0) {
    console.log('✅ Working models:');
    for (const r of ok) {
      console.log(`   - ${r.model} (${r.ms}ms)`);
    }
  }

  if (fail.length > 0) {
    console.log('\n❌ Failed models:');
    for (const r of fail) {
      console.log(`   - ${r.model}: ${r.error}`);
    }
  }

  // Suggest best model
  if (ok.length > 0) {
    const best = ok.reduce((a, b) => a.ms < b.ms ? a : b);
    console.log(`\n🏆 Fastest: ${best.model} (${best.ms}ms)`);
  }
}

main().catch(console.error);
