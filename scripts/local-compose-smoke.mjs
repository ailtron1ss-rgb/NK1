import assert from 'node:assert/strict';

const appBase = process.env.NK1_SMOKE_APP_URL ?? 'http://127.0.0.1:8080';
const runtimeBase = process.env.NK1_SMOKE_RUNTIME_URL ?? 'http://127.0.0.1:3310';
const deadline = Date.now() + Number(process.env.NK1_SMOKE_TIMEOUT_MS ?? 180_000);
const waitMs = 1_500;
let last = { app: 'not attempted', runtime: 'not attempted', proxy: 'not attempted' };

async function readJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(3_000) });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { response, body, text: text.slice(0, 300) };
}

while (Date.now() < deadline) {
  try {
    const appResponse = await fetch(appBase, { signal: AbortSignal.timeout(3_000) });
    if (!appResponse.ok) throw new Error(`app HTTP ${appResponse.status}`);

    const runtime = await readJson(`${runtimeBase}/health`);
    if (!runtime.response.ok || !runtime.body || runtime.body.ok === false || runtime.body.ready === false) {
      throw new Error(`runtime is not ready: HTTP ${runtime.response.status} ${runtime.text}`);
    }

    const proxy = await readJson(`${appBase}/api/health`);
    if (!proxy.response.ok || !proxy.body || proxy.body.ok === false || proxy.body.ready === false) {
      throw new Error(`app-to-runtime proxy failed: HTTP ${proxy.response.status} ${proxy.text}`);
    }

    console.log('NK1_LOCAL_COMPOSE_SMOKE=PASS', JSON.stringify({
      app: appBase,
      runtime: runtimeBase,
      proxyService: proxy.body.service,
      runtimeReady: proxy.body.ready,
      tick: proxy.body.tick,
    }));
    process.exit(0);
  } catch (error) {
    last = { ...last, error: error instanceof Error ? error.message : String(error) };
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }
}

console.error('NK1_LOCAL_COMPOSE_SMOKE=FAIL', JSON.stringify(last));
process.exitCode = 1;
