/**
 * Gemini Model Test — Dynamically fetches models from API and tests each one
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
const TEST_PROMPT = 'Write a one-sentence story about a curious cat.';

// --- API helpers ---

function makeRequest(path, body, method = 'POST') {
  return new Promise((resolve, reject) => {
    const url = `https://${BASE_URL}${path}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': API_KEY,
      },
    };

    let data = null;
    if (body) {
      data = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = https.request(url, options, (res) => {
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
    if (data) req.write(data);
    req.end();
  });
}

// --- Fetch all available models from API ---

async function fetchModels() {
  console.log('📋 Fetching models from Google AI Studio API...\n');
  const path = `/${API_VERSION}/models?key=${API_KEY}`;
  const res = await makeRequest(path, null, 'GET');

  if (res.status !== 200) {
    console.error('❌ Failed to fetch models:', JSON.stringify(res.body, null, 2));
    process.exit(1);
  }

  const models = res.body.models || [];
  console.log(`✅ Found ${models.length} models\n`);

  // Parse and filter for text-generation models dynamically
  const modelList = models
    .filter(m => {
      const name = m.name || '';
      // Skip non-text models
      if (name.includes('embedding') || name.includes('aqa')) return false;
      if (name.includes('tts') || name.includes('audio') || name.includes('video') || name.includes('veo')) return false;
      if (name.includes('robotics') || name.includes('computer-use')) return false;
      // Only include models that support generateContent
      if (!m.supportedGenerationMethods?.includes('generateContent')) return false;
      return true;
    })
    .map(m => ({
      name: m.name.replace('models/', ''),
      version: m.version || '',
      displayName: m.displayName || m.name,
      inputTokenLimit: m.inputTokenLimit || 0,
      outputTokenLimit: m.outputTokenLimit || 0,
      temperature: m.temperature || 1,
      topP: m.topP || 0.95,
      topK: m.topK || 64,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return modelList;
}

// --- Test a single model ---

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
      const error = res.body?.error?.message || JSON.stringify(res.body)?.slice(0, 100) || 'Unknown error';
      return { name: modelName, version: '', ok: false, ms, error };
    }

    const text = res.body?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '(no text)';
    const stopReason = res.body?.candidates?.[0]?.finishReason || '';

    return {
      name: modelName,
      version: '',
      ok: true,
      ms,
      text,
      stopReason,
    };
  } catch (e) {
    const ms = Date.now() - start;
    return { name: modelName, version: '', ok: false, ms, error: e.message };
  }
}

// --- Main ---

async function main() {
  console.log(`🧪 Gemini Model Test - Dynamic API Fetch\n`);
  console.log(`API Key: ${API_KEY.slice(0, 12)}...${API_KEY.slice(-4)}\n`);
  console.log('='.repeat(70) + '\n');

  // Step 1: Fetch models dynamically from API
  let models = [];
  try {
    models = await fetchModels();
  } catch (e) {
    console.error('Failed to fetch models:', e.message);
    process.exit(1);
  }

  if (models.length === 0) {
    console.log('No text-generation models found.');
    process.exit(0);
  }

  // Step 2: Test each model
  console.log(`Testing ${models.length} models dynamically fetched from API...\n`);
  console.log('-'.repeat(70));

  const results = [];
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    process.stdout.write(`[${i + 1}/${models.length}] ${model.name} ... `);

    const r = await testModel(model.name);
    results.push({ ...model, ...r });

    if (r.ok) {
      console.log(`✅ ${r.ms}ms`);
    } else {
      console.log(`❌ ${r.ms}ms | ${r.error.slice(0, 50)}`);
    }

    // Small delay between requests to avoid rate limits
    if (i < models.length - 1) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  // Step 3: Summary
  console.log('\n' + '='.repeat(70));
  console.log('\n📊 RESULTS\n');

  const ok = results.filter(r => r.ok);
  const fail = results.filter(r => !r.ok);

  // Sort working models by speed
  ok.sort((a, b) => a.ms - b.ms);

  console.log(`✅ Working: ${ok.length}/${results.length}\n`);

  if (ok.length > 0) {
    console.log('🏆 Models ranked by speed:');
    console.log('-'.repeat(70));
    for (const r of ok) {
      const speed = r.ms < 500 ? '⚡' : r.ms < 1500 ? '🚀' : '📈';
      console.log(`${speed} ${r.ms.toString().padStart(4)}ms | ${r.name}`);
    }
  }

  if (fail.length > 0) {
    console.log(`\n❌ Failed: ${fail.length}\n`);
    const errors = {};
    for (const r of fail) {
      const err = r.error?.split(':')[0] || 'Unknown';
      if (!errors[err]) errors[err] = [];
      errors[err].push(r.name);
    }
    for (const [err, models] of Object.entries(errors)) {
      console.log(`  ${err}:`);
      for (const m of models.slice(0, 3)) {
        console.log(`    - ${m}`);
      }
      if (models.length > 3) {
        console.log(`    ... and ${models.length - 3} more`);
      }
    }
  }

  // Step 4: Recommendations
  console.log('\n' + '='.repeat(70));
  console.log('\n💡 RECOMMENDATIONS\n');

  if (ok.length > 0) {
    const fastest = ok[0];
    const bestMedium = ok[Math.floor(ok.length / 2)] || ok[0];
    const bestQuality = ok[ok.length - 1];

    console.log(`⚡ Fastest:          ${fastest.name} (${fastest.ms}ms)`);
    console.log(`🎯 Balanced:         ${bestMedium.name} (${bestMedium.ms}ms)`);
    console.log(`✨ Best Quality:     ${bestQuality.name} (${bestQuality.ms}ms)`);

    console.log('\n📚 For StoryByte (story generation):');
    if (fastest.ms < 1000) {
      console.log(`   → Use ${fastest.name} (fast + good quality)`);
    } else {
      console.log(`   → Use ${bestMedium.name} (balance of speed/quality)`);
    }
  } else {
    console.log('No working models found. Check your API key or quota.');
  }

  console.log('\n' + '='.repeat(70) + '\n');
}

main().catch(console.error);
