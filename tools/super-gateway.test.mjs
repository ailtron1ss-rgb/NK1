import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createGatewayServer, readUpstreamTimeout } from './super-gateway.mjs';

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return address.port;
}

async function close(server) {
  if (!server.listening) return;
  const closed = new Promise((resolve) => server.close(resolve));
  server.closeAllConnections?.();
  await closed;
}

function responder(label) {
  return http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end(`${label}:${req.url}`);
  });
}

async function withGateway(t, { timeoutMs = 1_000, runtimeHandler } = {}) {
  const ui = responder('ui');
  const runtime = runtimeHandler
    ? http.createServer(runtimeHandler)
    : responder('runtime');
  const research = responder('research');
  const ports = await Promise.all([listen(ui), listen(runtime), listen(research)]);
  const gateway = createGatewayServer({
    uiPort: ports[0],
    runtimePort: ports[1],
    researchPort: ports[2],
    upstreamTimeoutMs: timeoutMs,
  });
  const gatewayPort = await listen(gateway);
  t.after(async () => {
    await Promise.all([close(gateway), close(ui), close(runtime), close(research)]);
  });
  return { baseUrl: `http://127.0.0.1:${gatewayPort}`, ui, runtime, research, gateway };
}

test('gateway routes UI, organism, and research requests to their own upstreams', async (t) => {
  const { baseUrl } = await withGateway(t);
  const cases = [
    ['/home?mode=compact', 'ui:/home?mode=compact'],
    ['/api/organism/ui-snapshot?fresh=1', 'runtime:/api/organism/ui-snapshot?fresh=1'],
    ['/api/research/status', 'research:/api/research/status'],
  ];

  for (const [pathname, expected] of cases) {
    const response = await fetch(new URL(pathname, baseUrl), { signal: AbortSignal.timeout(3_000) });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), expected);
  }
});

test('gateway turns an inactive upstream into a bounded 504 response', async (t) => {
  const { baseUrl } = await withGateway(t, {
    timeoutMs: 1_000,
    runtimeHandler: (_req, _res) => {
      // Intentionally never reply: the gateway owns the deadline.
    },
  });

  const startedAt = Date.now();
  const response = await fetch(new URL('/api/organism/hang', baseUrl), {
    signal: AbortSignal.timeout(5_000),
  });
  const body = await response.text();

  assert.equal(response.status, 504);
  assert.equal(body, 'super-project upstream timed out');
  assert.ok(Date.now() - startedAt < 4_000, 'gateway timeout should be shorter than the client safety deadline');
});

test('gateway enforces total deadlines when an upstream keeps trickling data', async (t) => {
  const { baseUrl } = await withGateway(t, {
    timeoutMs: 1_000,
    runtimeHandler: (_req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.write('start');
      const timer = setInterval(() => res.write('tick'), 650);
      res.on('close', () => clearInterval(timer));
    },
  });

  const startedAt = Date.now();
  const response = await fetch(new URL('/api/organism/trickle', baseUrl), {
    signal: AbortSignal.timeout(5_000),
  });
  assert.equal(response.status, 200);
  await assert.rejects(response.text());
  assert.ok(Date.now() - startedAt < 4_000,
    'total request deadline must not reset whenever the upstream sends another chunk');
});

test('gateway timeout configuration has a safe default and rejects invalid values', () => {
  assert.equal(readUpstreamTimeout(undefined), 30_000);
  assert.equal(readUpstreamTimeout('15000'), 15_000);
  assert.throws(() => readUpstreamTimeout('999'), /must be an integer from 1000 to 120000/);
  assert.throws(() => readUpstreamTimeout('120001'), /must be an integer from 1000 to 120000/);
});
