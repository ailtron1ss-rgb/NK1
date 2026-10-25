import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnManaged, terminateChildren } from './process-supervisor.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

function responder(label) {
  return http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`${label}:${req.url}`);
  });
}

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return address.port;
}

async function close(server) {
  if (!server.listening) return;
  const closed = new Promise((resolveClose) => server.close(resolveClose));
  server.closeAllConnections?.();
  await closed;
}

async function waitForManagedGatewayPort(child, timeoutMs = 4_000) {
  let output = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderr = (stderr + chunk).slice(-4_096);
  });

  return new Promise((resolvePort, rejectPort) => {
    let settled = false;
    const finish = (error, port) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.stdout.removeListener('data', onData);
      child.removeListener('exit', onExit);
      child.removeListener('error', onError);
      if (error) rejectPort(error);
      else resolvePort(port);
    };
    const onData = (chunk) => {
      output = (output + chunk).slice(-4_096);
      const marker = '[super-gateway] http://127.0.0.1:';
      const markerIndex = output.indexOf(marker);
      if (markerIndex >= 0) {
        const portText = output.slice(markerIndex + marker.length).match(/^\d+/)?.[0];
        if (portText) finish(null, Number(portText));
      }
      if (match) finish(null, Number(match[1]));
    };
    const onExit = (code, signal) => finish(
      new Error(`gateway exited before readiness: code=${code} signal=${signal ?? 'none'} stderr=${stderr}`),
    );
    const onError = (error) => finish(error);
    const timer = setTimeout(() => finish(
      new Error(`gateway readiness deadline elapsed; stdout=${output} stderr=${stderr}`),
    ), timeoutMs);

    child.stdout.on('data', onData);
    child.once('exit', onExit);
    child.once('error', onError);
    timer.unref?.();
  });
}

test('managed gateway routes live HTTP requests and shuts down under process supervision', async (t) => {
  const ui = responder('ui');
  const runtime = responder('runtime');
  const research = responder('research');
  let child;
  t.after(async () => {
    if (child) {
      await terminateChildren([child], { graceMs: 500, forceGraceMs: 500 });
    }
    await Promise.all([close(ui), close(runtime), close(research)]);
  });

  const [uiPort, runtimePort, researchPort] = await Promise.all([
    listen(ui),
    listen(runtime),
    listen(research),
  ]);

  child = spawnManaged(process.execPath, [resolve(ROOT, 'tools/super-gateway.mjs')], {
    cwd: ROOT,
    env: {
      ...process.env,
      SUPER_GATEWAY_PORT: '0',
      SUPER_UI_PORT: String(uiPort),
      SUPER_RUNTIME_PORT: String(runtimePort),
      SUPER_RESEARCH_PORT: String(researchPort),
      SUPER_GATEWAY_UPSTREAM_TIMEOUT_MS: '1000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const gatewayPort = await waitForManagedGatewayPort(child);
  const baseUrl = `http://127.0.0.1:${gatewayPort}`;
  const cases = [
    ['/health', 'ui:/health'],
    ['/api/organism/ping?source=e2e', 'runtime:/api/organism/ping?source=e2e'],
    ['/api/research/status', 'research:/api/research/status'],
    ['/api/organism-preview', 'ui:/api/organism-preview'],
    ['/api/researcher', 'ui:/api/researcher'],
  ];

  for (const [pathname, expected] of cases) {
    const response = await fetch(new URL(pathname, baseUrl), {
      signal: AbortSignal.timeout(2_000),
    });
    assert.equal(response.status, 200, `unexpected status for ${pathname}`);
    assert.equal(await response.text(), expected, `wrong upstream for ${pathname}`);
  }

  const [shutdown] = await terminateChildren([child], { graceMs: 500, forceGraceMs: 500 });
  assert.equal(shutdown.stopped, true, 'process supervisor must confirm gateway cleanup');
  assert.ok(child.exitCode !== null || child.signalCode !== null,
    'managed gateway must have exited before the test ends');

  await assert.rejects(
    fetch(new URL('/health', baseUrl), { signal: AbortSignal.timeout(500) }),
    /fetch failed/i,
    'gateway must no longer accept traffic after supervisor shutdown',
  );
});
