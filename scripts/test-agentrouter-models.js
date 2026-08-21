/**
 * AgentRouter Model Test - tests the AgentRouter API gateway
 *
 * Based on the documentation at: https://agentrouter.org/docs/claude-code.html
 *
 * Usage:
 *   AGENTROUTER_API_KEY=your_key node test-agentrouter-models.js
 *   AGENTROUTER_BASE_URL=https://agentrouter.org node test-agentrouter-models.js
 */

const https = require('https');
const http = require('http');

const BASE_URL = process.env.AGENTROUTER_BASE_URL || 'https://agentrouter.org';
const API_KEY = process.env.AGENTROUTER_API_KEY;

const TEST_PROMPT = 'Write a one-sentence story about a curious cat.';

// --- API helpers ---

function makeRequest(path, body, method = 'POST') {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (API_KEY) {
      options.headers['Authorization'] = 'Bearer ' + API_KEY;
    }
    
    let data = null;
    if (body) {
      data = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }
    
    const req = lib.request(options, (res) => {
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

// --- Test status endpoint ---

async function testStatus() {
  console.log('\n[1/3] Testing AgentRouter API Status...');
  console.log('Base URL: ' + BASE_URL);
  console.log('API Key: ' + (API_KEY ? API_KEY.slice(0, 12) + '...' + API_KEY.slice(-4) : '(not set)') + '\n');
  
  try {
    const res = await makeRequest('/api/status', null, 'GET');
    console.log('Status endpoint: HTTP ' + res.status);
    
    if (res.status === 200 && res.body && res.body.data) {
      const data = res.body.data;
      console.log('System: ' + (data.system_name || 'Agent Router'));
      console.log('Version: ' + (data.version || 'unknown'));
      console.log('Price: ' + data.price + '/unit');
      console.log('USD Exchange: ' + data.usd_exchange_rate + '\n');
    }
  } catch (e) {
    console.log('Status endpoint failed: ' + e.message + '\n');
  }
}

// --- Test v1/models endpoint ---

async function testModels() {
  console.log('[2/3] Testing v1/models endpoint...');
  
  try {
    const res = await makeRequest('/v1/models', null, 'GET');
    console.log('HTTP Status: ' + res.status);
    
    if (res.status === 200 && res.body && res.body.data && res.body.data.data) {
      const models = res.body.data.data;
      console.log('Found ' + models.length + ' models\n');
      
      for (const model of models.slice(0, 20)) {
        console.log('  - ' + model.id);
      }
      if (models.length > 20) {
        console.log('  ... and ' + (models.length - 20) + ' more');
      }
    } else if (res.body && res.body.message) {
      console.log('  ' + res.body.message + '\n');
    } else {
      console.log('Response: ' + JSON.stringify(res.body).slice(0, 300) + '\n');
    }
  } catch (e) {
    console.log('Failed: ' + e.message + '\n');
  }
}

// --- Test v1/chat/completions endpoint ---

async function testChatCompletion(model) {
  const startTime = Date.now();
  
  try {
    const res = await makeRequest('/v1/chat/completions', {
      model: model,
      messages: [{ role: 'user', content: TEST_PROMPT }],
      max_tokens: 100,
      temperature: 0.7,
    });
    
    const ms = Date.now() - startTime;
    
    if (res.status === 200 && res.body && res.body.choices && res.body.choices[0] && res.body.choices[0].message) {
      const text = res.body.choices[0].message.content ? res.body.choices[0].message.content.trim() : '(no text)';
      console.log('  OK: ' + model);
      console.log('       ' + ms + 'ms | ' + text + '\n');
      return { model: model, ok: true, ms: ms, text: text };
    } else if (res.body && res.body.error && res.body.error.message) {
      console.log('  FAIL: ' + model);
      console.log('        ' + res.body.error.message + '\n');
      return { model: model, ok: false, ms: ms, error: res.body.error.message };
    } else if (res.body && res.body.message) {
      console.log('  FAIL: ' + model);
      console.log('        ' + res.body.message + '\n');
      return { model: model, ok: false, ms: ms, error: res.body.message };
    } else {
      console.log('  UNEXPECTED: ' + model + ' (' + ms + 'ms)');
      console.log('      ' + JSON.stringify(res.body).slice(0, 200) + '\n');
      return { model: model, ok: false, ms: ms, error: 'Unexpected response' };
    }
  } catch (e) {
    const ms = Date.now() - startTime;
    console.log('  FAIL: ' + model);
    console.log('        ' + ms + 'ms | ' + e.message + '\n');
    return { model: model, ok: false, ms: ms, error: e.message };
  }
}

// --- Main ---

async function main() {
  console.log('='.repeat(70));
  console.log('  AgentRouter Model Test');
  console.log('='.repeat(70));
  
  // Test 1: Status endpoint
  await testStatus();
  
  // Test 2: Models endpoint
  await testModels();
  
  // Test 3: Test some common model IDs if API key is available
  if (API_KEY) {
    console.log('[3/3] Testing common model IDs...');
    console.log('-'.repeat(70));
    
    const COMMON_MODELS = [
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'llama-3.1-405b',
      'llama-3.1-70b',
      'llama-3.1-8b',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'glm-4',
    ];
    
    const results = [];
    for (const model of COMMON_MODELS) {
      const r = await testChatCompletion(model);
      results.push(r);
      await new Promise(r => setTimeout(r, 300));
    }
    
    const ok = results.filter(r => r.ok);
    const fail = results.filter(r => !r.ok);
    
    console.log('='.repeat(70));
    console.log('\nRESULTS');
    console.log('='.repeat(70));
    console.log('Working: ' + ok.length + '/' + results.length);
    
    if (ok.length > 0) {
      console.log('\nWorking models (sorted by speed):');
      ok.sort((a, b) => a.ms - b.ms);
      for (const r of ok) {
        const speed = r.ms < 500 ? 'FAST' : r.ms < 1500 ? 'MED' : 'SLOW';
        console.log('  [' + speed + '] ' + r.ms + 'ms | ' + r.model);
      }
    }
    
    if (fail.length > 0) {
      console.log('\nFailed: ' + fail.length);
      for (const r of fail.slice(0, 5)) {
        console.log('  - ' + r.model + ': ' + (r.error || 'unknown').slice(0, 50));
      }
      if (fail.length > 5) {
        console.log('  ... and ' + (fail.length - 5) + ' more');
      }
    }
    
    console.log('\n' + '='.repeat(70));
  } else {
    console.log('\nSet AGENTROUTER_API_KEY to test model inference');
    console.log('Get your API key from: https://agentrouter.org/\n');
  }
}

main().catch(console.error);
