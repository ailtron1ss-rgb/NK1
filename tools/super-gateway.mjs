import http from 'node:http';
import { request as httpRequest } from 'node:http';
import { resolveGatewayBindHost } from './super-gateway-config.mjs';

const PORT = Number(process.env.SUPER_GATEWAY_PORT || 8080);
const HOST = resolveGatewayBindHost();
const UI_PORT = Number(process.env.SUPER_UI_PORT || 8081);
const RUNTIME_PORT = Number(process.env.SUPER_RUNTIME_PORT || 3310);
const RESEARCH_PORT = Number(process.env.SUPER_RESEARCH_PORT || 8765);

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
  if (path.startsWith('/api/organism')) return forward(req, res, RUNTIME_PORT);
  if (path.startsWith('/api/research')) return forward(req, res, RESEARCH_PORT);
  return forward(req, res, UI_PORT);
}).listen(PORT, HOST, () => {
  console.log(`[super-gateway] http://${HOST}:${PORT}`);
});
