import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_UPSTREAM_TIMEOUT_MS = 30_000;
const MAX_UPSTREAM_TIMEOUT_MS = 120_000;
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function stripHopByHopHeaders(headers = {}) {
  const connectionNamedHeaders = new Set(
    String(headers.connection ?? '')
      .split(',')
      .map((header) => header.trim().toLowerCase())
      .filter(Boolean),
  );
  const result = {};
  for (const [name, value] of Object.entries(headers)) {
    const normalized = name.toLowerCase();
    if (normalized === 'host' || HOP_BY_HOP_HEADERS.has(normalized) || connectionNamedHeaders.has(normalized)) continue;
    result[name] = value;
  }
  return result;
}

export function readUpstreamTimeout(raw = process.env.SUPER_GATEWAY_UPSTREAM_TIMEOUT_MS) {
  const value = raw === undefined || raw === '' ? DEFAULT_UPSTREAM_TIMEOUT_MS : Number(raw);
  if (!Number.isSafeInteger(value) || value < 1_000 || value > MAX_UPSTREAM_TIMEOUT_MS) {
    throw new Error(`SUPER_GATEWAY_UPSTREAM_TIMEOUT_MS must be an integer from 1000 to ${MAX_UPSTREAM_TIMEOUT_MS}`);
  }
  return value;
}

export function createGatewayServer({
  uiPort,
  runtimePort,
  researchPort,
  targetHost = '127.0.0.1',
  upstreamTimeoutMs = DEFAULT_UPSTREAM_TIMEOUT_MS,
} = {}) {
  if (![uiPort, runtimePort, researchPort].every((port) => Number.isInteger(port) && port >= 1 && port <= 65535)) {
    throw new Error('UI, runtime, and research ports must be integers in the range 1..65535');
  }
  if (!Number.isInteger(upstreamTimeoutMs) || upstreamTimeoutMs < 1_000 || upstreamTimeoutMs > MAX_UPSTREAM_TIMEOUT_MS) {
    throw new Error(`upstreamTimeoutMs must be an integer from 1000 to ${MAX_UPSTREAM_TIMEOUT_MS}`);
  }

  const forward = (req, res, targetPort) => {
    const upstream = http.request({
      hostname: targetHost,
      port: targetPort,
      path: req.url || '/',
      method: req.method,
      headers: stripHopByHopHeaders(req.headers),
    }, (upstreamRes) => {
      if (res.destroyed) {
        upstreamRes.destroy();
        return;
      }
      res.writeHead(upstreamRes.statusCode ?? 502, stripHopByHopHeaders(upstreamRes.headers));
      upstreamRes.on('error', () => {
        if (!res.destroyed) res.destroy();
      });
      upstreamRes.pipe(res);
    });

    upstream.setTimeout(upstreamTimeoutMs, () => {
      const error = new Error(`Upstream request timed out after ${upstreamTimeoutMs}ms`);
      error.code = 'ETIMEDOUT';
      upstream.destroy(error);
    });

    upstream.on('error', (error) => {
      if (res.destroyed || res.writableEnded) return;
      if (res.headersSent) {
        res.destroy(error);
        return;
      }
      const timedOut = error?.code === 'ETIMEDOUT';
      const status = timedOut ? 504 : 502;
      const body = timedOut ? 'super-project upstream timed out' : 'super-project upstream unavailable';
      res.writeHead(status, {
        'content-type': 'text/plain; charset=utf-8',
        'content-length': Buffer.byteLength(body),
        'cache-control': 'no-store',
      });
      res.end(body);
    });

    const abortUpstream = () => upstream.destroy();
    const abortOnClientClose = () => {
      if (!res.writableEnded) upstream.destroy();
    };
    req.once('aborted', abortUpstream);
    res.once('close', abortOnClientClose);
    upstream.once('close', () => {
      req.removeListener('aborted', abortUpstream);
      res.removeListener('close', abortOnClientClose);
    });

    req.pipe(upstream);
  };

  return http.createServer((req, res) => {
    const pathname = String(req.url || '/');
    if (pathname.startsWith('/api/organism')) return forward(req, res, runtimePort);
    if (pathname.startsWith('/api/research')) return forward(req, res, researchPort);
    return forward(req, res, uiPort);
  });
}

export function startGateway(env = process.env) {
  const port = Number(env.SUPER_GATEWAY_PORT || 8080);
  const uiPort = Number(env.SUPER_UI_PORT || 8081);
  const runtimePort = Number(env.SUPER_RUNTIME_PORT || 3310);
  const researchPort = Number(env.SUPER_RESEARCH_PORT || 8765);
  const upstreamTimeoutMs = readUpstreamTimeout(env.SUPER_GATEWAY_UPSTREAM_TIMEOUT_MS);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('SUPER_GATEWAY_PORT must be an integer in the range 0..65535');
  }

  const server = createGatewayServer({ uiPort, runtimePort, researchPort, upstreamTimeoutMs });
  server.listen(port, '127.0.0.1', () => {
    const address = server.address();
    const boundPort = typeof address === 'object' && address ? address.port : port;
    console.log(`[super-gateway] http://127.0.0.1:${boundPort} upstreamTimeoutMs=${upstreamTimeoutMs}`);
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    startGateway();
  } catch (error) {
    console.error(`[super-gateway] configuration error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
