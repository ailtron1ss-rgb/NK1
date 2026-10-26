/**
 * Build upstream request headers while preserving the origin the user addressed.
 * Host is rewritten for the upstream socket; X-Forwarded-* keeps the public origin
 * available to auth popup/redirect handlers behind the local reverse proxy.
 */
export function buildGatewayUpstreamHeaders(sourceHeaders, targetHost, targetPort, protocol) {
  if (sourceHeaders === null || typeof sourceHeaders !== 'object' || Array.isArray(sourceHeaders)) {
    throw new TypeError('source request headers are required');
  }
  if (typeof targetHost !== 'string' || !targetHost.trim()) throw new TypeError('upstream host is required');
  if (!Number.isSafeInteger(targetPort) || targetPort < 1 || targetPort > 65535) {
    throw new TypeError('upstream port must be an integer from 1 to 65535');
  }
  const sourceProtocol = typeof sourceHeaders['x-forwarded-proto'] === 'string'
    ? sourceHeaders['x-forwarded-proto'].trim().toLowerCase()
    : '';
  if (protocol !== undefined && protocol !== 'http' && protocol !== 'https') {
    throw new TypeError('forwarded protocol must be http or https');
  }
  const forwardedProtocol = protocol ?? (sourceProtocol === 'https' ? 'https' : 'http');
  const publicHost = typeof sourceHeaders.host === 'string' ? sourceHeaders.host.trim() : '';
  const headers = {
    ...sourceHeaders,
    host: `${targetHost}:${targetPort}`,
    'x-forwarded-proto': forwardedProtocol,
  };
  if (publicHost) headers['x-forwarded-host'] = publicHost;
  else delete headers['x-forwarded-host'];
  return headers;
}
