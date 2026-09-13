#!/usr/bin/env node
/**
 * Test OpenRouter-style models and build working/performance list (Node.js).
 * WARNING: Rotate exposed API key before running. Use env var only.
 * Usage: OPENROUTER_API_KEY=sk-or-... node test_models.js
 */

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) {
  console.error("Error: OPENROUTER_API_KEY not set. Rotate exposed key first.");
  process.exit(1);
}

const URL = "https://openrouter.ai/api/v1/chat/completions";

const MODELS = [
  // Meta Muse
  "meta/muse-spark-1.2-contributor",
  "meta/muse-spark-1.2-contributor-1m",
  "meta/muse-spark-1.2",
  "meta/muse-spark-1.2-1m",
  "meta/muse-spark-1.1",
  "meta/muse-spark-1.1-1m",
  "meta/muse-glimmer-30b",
  // Ox
  "ox/ox-alpha",
  "ox/ox-alpha-1m",
  // Tencent
  "tencent/hy-mt2-1.8b",
  "tencent/hy-mt2-30b-azb",
  "tencent/hy-mt2-7b",
  // Dots Studio
  "dots-studio/dots3-note-preview:free",
  // Sakana
  "sakana/sakana-namazu",
  "sakana/fugu-ultra",
  "sakana/fugu-ultra-1m",
  // Thinking Machines (Inkling)
  "anthropic/thinkingmachines/inkling-small:free",
  "anthropic/thinkingmachines/inkling-small",
  "anthropic/thinkingmachines/inkling-small-1m",
  "anthropic/thinkingmachines/inkling:free",
  "anthropic/thinkingmachines/inkling",
  "anthropic/thinkingmachines/inkling-1m",
  "anthropic/thinkingmachines/inkling-batch",
  "anthropic/thinkingmachines/inkling-batch-1m",
  "anthropic/poolside/laguna-s-2.1:free",
  "anthropic/poolside/laguna-s-2.1",
  "anthropic/poolside/laguna-s-2.11m",
  "anthropic/poolside/laguna-xs-2.1",
  "anthropic/poolside/laguna-xs-2.1:free",
  // Claude / Anthropic
  "anthropic/claude-opus-5-fast",
  "anthropic/claude-opus-5-fast-1m",
  "anthropic/claude-opus-5-batch",
  "anthropic/claude-opus-5-batch-1m",
  "anthropic/claude-opus-5",
  "anthropic/claude-opus-5-1m",
  "anthropic/claude-sonnet-5",
  "anthropic/claude-sonnet-5-1m",
  "anthropic/claude-opus-4.8-fast",
  "anthropic/claude-opus-4.8-fast-1m",
  "anthropic/claude-opus-4.8",
  "anthropic/claude-opus-4.8-1m",
  "anthropic/claude-opus-4.7-fast",
  "anthropic/claude-opus-4.1",
  "anthropic/claude-opus-4",
  "anthropic/claude-sonnet-4",
  "anthropic/claude-sonnet-4-1m",
  "anthropic/claude-3-haiku",
  "anthropic/claude-fable-latest",
  "anthropic/claude-fable-latest-1m",
  "anthropic/claude-fable-5",
  "anthropic/claude-fable-5-1m",
  // Nex AGI
  "nex-agi/nex-n2-mini",
  "nex-agi/nex-n2-pro",
  // Cohere
  "cohere/north-mini-code:free",
  "cohere/command-a",
  // OpenRouter
  "openrouter/fusion",
  "openrouter/fusion-1m",
  // Auto Router
  "auto-router/auto-router-beta",
  "auto-router/auto-router-beta-1m",
  // AionLabs
  "aionlabs/aion-3.0-mini",
  "aionlabs/aion-3.0",
  // Relace
  "relace/relace-apply-3",
  // Morph
  "morph/morph-v3-large",
  "morph/morph-v3-fast",
  // TheDrummer
  "thedrummer/cydonia-24b-v4.1",
  "thedrummer/skyfall-36b-v2",
  "thedrummer/unslopnemo-12b",
  "thedrummer/unslopnemo-12b-1m",
  "thedrummer/rocinante-12b",
  // Perplexity
  "perplexity/sonar-reasoning-pro",
  "perplexity/sonar-pro",
  "perplexity/sonar-deep-research",
  "perplexity/sonar",
  // Sao10K
  "sao10k/llama-3.3-euryale-70b",
  "sao10k/llama-3.1-euryale-70b-v2.2",
  "sao10k/llama-3-8b-lunaris",
  // Others
  "magnum/v4-72b",
  "wizardlm-2/8x22b",
  "mancer/weaver-alpha",
  "remm-slerp-13b",
  "reka/flash-3",
];

async function testModel(modelId) {
  const payload = {
    model: modelId,
    messages: [{ role: "user", content: "Say 'hello' only." }],
  };
  const start = Date.now();
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const latency = (Date.now() - start) / 1000;
    const ok = res.status === 200;
    let content = "";
    if (ok) {
      const data = await res.json();
      content = data?.choices?.[0]?.message?.content || "";
    }
    return { ok, latency, content: content.slice(0, 60), status: res.status };
  } catch (e) {
    return { ok: false, latency: (Date.now() - start) / 1000, content: e.message, status: 0 };
  }
}

(async () => {
  const results = [];
  for (const m of MODELS) {
    const r = await testModel(m);
    const status = r.ok ? "WORKING" : "FAIL";
    results.push({ model: m, status, latency: r.latency.toFixed(2) + "s", resp: r.content, code: r.status });
    console.log(`${status.padEnd(7)} | ${m.padEnd(55)} | ${r.latency.toFixed(2)}s | code=${r.status} | ${JSON.stringify(r.content)}`);
  }
  console.log("\n=== SUMMARY ===");
  results.forEach((r) => {
    console.log(`${r.status.padEnd(7)} | ${r.model} | latency=${r.latency} | resp=${JSON.stringify(r.resp)} | http=${r.code}`);
  });
})();
