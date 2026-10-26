export function resolveGatewayBindHost(value = process.env.SUPER_GATEWAY_HOST) {
  if (value === undefined || value === null || String(value).trim() === '') return '127.0.0.1';
  const host = String(value).trim();
  if (host === '127.0.0.1' || host === '0.0.0.0') return host;
  throw new Error('SUPER_GATEWAY_HOST must be 127.0.0.1 for local use or 0.0.0.0 for an explicitly published container');
}
