/**
 * Gemini Model Test — checks which Google AI Studio models are working
 *
 * Usage:
 *   GEMINI_API_KEY=your_key node test-gemini-models.js
 */

const https = require('https');

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('❌ Set GEMINI_API_KEY environment variable');
  process.exit(1);
}

const BASE_URL = 'generativelanguage.googleapis.com';
const API_VERSION = 'v1beta';

// Models to test (from the list you shared)
const MODELS_TO_TEST = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-pro-latest',
  'gemini-2.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash-lite-preview',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemma-4-26b-a4b-it',
  'gemma-4-31b-it',
];

const TEST_PROMPT = 'Write a one-sentence story about a cat.';

// --- API helpers ---

function makeRequest(path, body) {
  return new Promise((resolve, reject) => {
    const url = `https://${BASE_URL}${path}`;
    const data = JSON.stringify(body);

    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': API_KEY,
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let rawData = '';
      res.setEncoding('utf8');
      res.on('data', chunk => rawData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(rawData) });
        } catch (e) {
          resolve({ status: res.statusCode, body: rawData });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.write(data);
    req.end();
  });
}

async function listModels() {
  console.log('📋 Fetching available models...\n');
  const path = `/${API_VERSION}/models?key=${API_KEY}`;
  const res = await makeRequest(path, null);

  if (res.status !== 200) {
    console.error('❌ Failed to list models:', res.body);
    process.exit(1);
  }

  const models = res.body.models || [];
  console.log(`✅ Found ${models.length} models\n`);

  // Filter for text generation models
  const textModels = models.filter(m =>
    m.name.includes('gemini') || m.name.includes('gemma')
  ).map(m => ({
    name: m.name.replace('models/', ''),
    displayName: m.displayName,
    inputTokenLimit: m.inputTokenLimit,
    outputTokenLimit: m.outputTokenLimit,
  }));

  return textModels;
}

async function testModel(modelName) {
  const start = Date.now();
  const path = `/${API_VERSION}/models/${modelName}:generateContent?key=${API_KEY}`;

  try {
    const res = await makeRequest(path, {
      contents: [{
        parts: [{ text: TEST_PROMPT }],
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 200,
      },
    });

    const ms = Date.now() - start;

    if (res.status !== 200) {
      const errorMsg = res.body?.error?.message || JSON.stringify(res.body).slice(0, 100);
      console.log(`❌ ${modelName.padEnd(35)} ${ms}ms | ${errorMsg}`);
      return { model: modelName, ok: false, ms, error: errorMsg };
    }

    const text = res.body?.candidates?.[0]?.content?.parts?.[0]?.text || '(no text)';
    console.log(`✅ ${modelName.padEnd(35)} ${ms}ms | ${text.slice(0, 80)}`);
    return { model: modelName, ok: true, ms, text: text.trim() };
  } catch (e) {
    const ms = Date.now() - start;
    console.log(`❌ ${modelName.padEnd(35)} ${ms}ms | ${e.message.slice(0, 80)}`);
    return { model: modelName, ok: false, ms, error: e.message };
  }
}

async function main() {
  console.log(`\n🧪 Testing Gemini models...\n`);
  console.log(`API Key: ${API_KEY.slice(0, 10)}...${API_KEY.slice(-4)}\n`);

  // Step 1: Fetch available models from API
  let availableModels = [];
  try {
    availableModels = await listModels();
  } catch (e) {
    console.error('Failed to fetch models:', e.message);
    console.log('Using hardcoded model list instead...\n');
  }

  // Step 2: Test models (use API list if available, otherwise hardcoded)
  const models = availableModels.length > 0
    ? availableModels.map(m => m.name)
    : MODELS_TO_TEST;

  console.log(`Testing ${models.length} models...\n`);
  const results = [];

  for (const model of models) {
    // Skip image/audio only models
    if (model.includes('image') || model.includes('tts') || model.includes('audio') ||
        model.includes('video') || model.includes('veo') || model.includes('embedding') ||
        model.includes('aqa') || model.includes('robotics') || model.includes('computer-use')) {
      continue;
    }

    const r = await testModel(model);
    results.push(r);
    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 300));
  }

  // Step 3: Summary
  const ok = results.filter(r => r.ok);
  const fail = results.filter(r => !r.ok);

  console.log(`\n📊 Results: ${ok.length}/${results.length} working\n`);

  if (ok.length > 0) {
    console.log('✅ Working models:');
    ok.sort((a, b) => a.ms - b.ms);
    for (const r of ok) {
      console.log(`   ${r.ms.toString().padStart(4)}ms | ${r.model}`);
    }
  }

  if (fail.length > 0) {
    console.log(`\n❌ Failed models (${fail.length}):`);
    for (const r of fail.slice(0, 5)) {
      console.log(`   ${r.model}: ${r.error.slice(0, 60)}`);
    }
    if (fail.length > 5) {
      console.log(`   ... and ${fail.length - 5} more`);
    }
  }

  // Suggest best model
  if (ok.length > 0) {
    const best = ok.reduce((a, b) => a.ms < b.ms ? a : b);
    const fastest = ok[0];
    console.log(`\n🏆 Fastest: ${fastest.model} (${fastest.ms}ms)`);
    console.log(`💡 Recommended: ${best.model} (balanced speed/quality)`);
  }
}

main().catch(console.error);
