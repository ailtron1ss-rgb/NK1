import http from 'node:http';
import { request as httpRequest } from 'node:http';

const PORT = Number(process.env.SUPER_GATEWAY_PORT || 8080);
const HOST = process.env.SUPER_GATEWAY_HOST || '127.0.0.1';
const UI_PORT = Number(process.env.SUPER_UI_PORT || 8081);
const RUNTIME_PORT = Number(process.env.SUPER_RUNTIME_PORT || 3310);
const RESEARCH_PORT = Number(process.env.SUPER_RESEARCH_PORT || 8765);

function probe(port, path, validateJson) {
  return new Promise(resolve => {
    const request = httpRequest({ hostname:'127.0.0.1', port, path, method:'GET' }, response => {
      let body = '';
      response.on('data', chunk => {
        if (body.length < 16384) body += chunk.toString('utf8').slice(0, 16384 - body.length);
      });
      response.on('end', () => {
        const status = response.statusCode ?? 0;
        let ok = status >= 200 && status < 300;
        if (ok && validateJson) {
          try { ok = validateJson(JSON.parse(body)); } catch { ok = false; }
        }
        resolve({ ok, status });
      });
    });
    request.setTimeout(1500, () => request.destroy(new Error('health-probe-timeout')));
    request.on('error', () => resolve({ ok:false, status:0 }));
    request.end();
  });
}

async function gatewayHealth() {
  const [runtime, research, ui] = await Promise.all([
    probe(RUNTIME_PORT, '/api/health', value => value?.ok === true && value?.ready === true),
    probe(RESEARCH_PORT, '/health', value => value?.ok === true),
    probe(UI_PORT, '/', null),
  ]);
  const ok = runtime.ok && research.ok && ui.ok;
  return {
    status: ok ? 200 : 503,
    body: JSON.stringify({ ok, service:'super-gateway', dependencies:{ runtime, research, ui } }),
  };
}

const forward = (req, res, targetPort, targetHost = '127.0.0.1') => {
  const upstream = httpRequest({
    hostname: targetHost,
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `${targetHost}:${targetPort}` },
  }, (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
    upstreamRes.pipe(res);
  });
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('super-project upstream unavailable');
  });
  req.pipe(upstream);
};

http.createServer((req, res) => {
  const path = String(req.url || '/');
  const pathname = path.split('?', 1)[0];
  if (pathname === '/health' || pathname === '/healthz') {
    void gatewayHealth().then(result => {
      res.writeHead(result.status, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' });
      res.end(result.body);
    }).catch(() => {
      res.writeHead(503, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' });
      res.end(JSON.stringify({ ok:false, service:'super-gateway', error:'health-probe-failed' }));
    });
    return;
  }
  if (pathname.startsWith('/api/organism')) return forward(req, res, RUNTIME_PORT);
  if (pathname.startsWith('/api/research')) return forward(req, res, RESEARCH_PORT);
  return forward(req, res, UI_PORT);
}).listen(PORT, HOST, () => {
  console.log(`[super-gateway] http://${HOST}:${PORT}`);
});
