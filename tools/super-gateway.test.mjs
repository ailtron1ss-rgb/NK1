import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const gatewayScript = path.join(root, 'tools', 'super-gateway.mjs');

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}

async function close(server) {
  if (!server.listening) return;
  await new Promise(resolve => server.close(resolve));
}

async function request(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* UI route is HTML/text */ }
  return { status: response.status, text, json };
}

async function freePort() {
  const server = createServer();
  const port = await listen(server);
  await close(server);
  return port;
}

test('gateway reports complete readiness and forwards UI, runtime and research traffic', async () => {
  let runtimeReady = true;
  const runtime = createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/api/health') {
      res.end(JSON.stringify({ ok: true, ready: runtimeReady, service: 'runtime' }));
      return;
    }
    res.end(JSON.stringify({ ok: true, service: 'runtime', path: req.url }));
  });
  const research = createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok: true, service: 'research', path: req.url }));
  });
  const ui = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><title>ui-home</title>');
  });

  let child;
  try {
    const [runtimePort, researchPort, uiPort, gatewayPort] = await Promise.all([
      listen(runtime), listen(research), listen(ui), freePort(),
    ]);
    child = spawn(process.execPath, [gatewayScript], {
      cwd: root,
      env: {
        ...process.env,
        SUPER_GATEWAY_HOST: '127.0.0.1',
        SUPER_GATEWAY_PORT: String(gatewayPort),
        SUPER_RUNTIME_PORT: String(runtimePort),
        SUPER_RESEARCH_PORT: String(researchPort),
        SUPER_UI_PORT: String(uiPort),
      },
      stdio: 'ignore',
    });
    const base = 'http://127.0.0.1:' + gatewayPort;
    let healthy = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        healthy = await request(base + '/health');
        if (healthy.status === 200) break;
      } catch { /* gateway process may still be binding */ }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal(healthy?.status, 200, 'all three upstreams should become healthy');
    assert.equal(healthy.json?.ok, true);
    assert.equal(healthy.json?.dependencies?.runtime?.ok, true);
    assert.equal(healthy.json?.dependencies?.research?.ok, true);
    assert.equal(healthy.json?.dependencies?.ui?.ok, true);

    runtimeReady = false;
    const unready = await request(base + '/health');
    assert.equal(unready.status, 503, 'HTTP 200 from a booting runtime must not mean the whole stack is ready');
    assert.equal(unready.json?.dependencies?.runtime?.ok, false);
    runtimeReady = true;

    const uiResponse = await request(base + '/');
    assert.equal(uiResponse.status, 200);
    assert.match(uiResponse.text, /ui-home/);
    const runtimeResponse = await request(base + '/api/organism/example?tick=7');
    assert.equal(runtimeResponse.status, 200);
    assert.equal(runtimeResponse.json?.path, '/api/organism/example?tick=7');
    const researchResponse = await request(base + '/api/research/status');
    assert.equal(researchResponse.status, 200);
    assert.equal(researchResponse.json?.service, 'research');
    assert.equal(researchResponse.json?.path, '/api/research/status');
  } finally {
    if (child && child.exitCode === null) {
      child.kill('SIGTERM');
      await Promise.race([
        once(child, 'exit'),
        new Promise(resolve => setTimeout(resolve, 1800)),
      ]);
    }
    await Promise.all([close(runtime), close(research), close(ui)]);
  }
});

console.log('Super gateway readiness and routing: PASS');
