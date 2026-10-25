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
    ['/api/organism', 'runtime:/api/organism'],
    ['/api/organism?root=1', 'runtime:/api/organism?root=1'],
    ['/api/organism/ui-snapshot?fresh=1', 'runtime:/api/organism/ui-snapshot?fresh=1'],
    ['/api/research', 'research:/api/research'],
    ['/api/research/status', 'research:/api/research/status'],
    // Similar string prefixes are not members of the API namespaces.
    ['/api/organism-preview', 'ui:/api/organism-preview'],
    ['/api/researcher', 'ui:/api/researcher'],
  ];

  for (const [pathname, expected] of cases) {
    const response = await fetch(new URL(pathname, baseUrl), { signal: AbortSignal.timeout(3_000) });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), expected);
  }
});

test('gateway preserves POST method, content headers, and request body', async (t) => {
  const { baseUrl } = await withGateway(t, {
    runtimeHandler: (req, res) => {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          method: req.method,
          contentType: req.headers['content-type'],
          body,
        }));
      });
    },
  });
  const payload = JSON.stringify({ goal: 'preserve request semantics', nested: { count: 2 } });
  const response = await fetch(new URL('/api/organism/command?source=test', baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-nk1-test': 'forwarded' },
    body: payload,
    signal: AbortSignal.timeout(3_000),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    method: 'POST',
    contentType: 'application/json',
    body: payload,
  });
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

test('gateway aborts upstream work when the downstream client disconnects', async (t) => {
  let markStarted;
  let markClosed;
  const upstreamStarted = new Promise((resolve) => { markStarted = resolve; });
  const upstreamClosed = new Promise((resolve) => { markClosed = resolve; });
  const { baseUrl } = await withGateway(t, {
    timeoutMs: 5_000,
    runtimeHandler: (_req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.write('stream-started');
      res.once('close', markClosed);
      markStarted();
    },
  });

  const client = http.get(new URL('/api/organism/client-disconnect', baseUrl));
  client.on('response', (response) => {
    response.once('data', () => response.destroy());
  });
  client.on('error', (error) => {
    if (error.code !== 'ECONNRESET') t.diagnostic(String(error));
  });
  t.after(() => client.destroy());

  await upstreamStarted;
  await Promise.race([
    upstreamClosed,
    new Promise((_, reject) => setTimeout(() => reject(new Error('gateway did not abort upstream after client disconnect')), 2_000)),
  ]);
});
