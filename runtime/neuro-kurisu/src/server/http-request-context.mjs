import { randomUUID } from 'node:crypto';

const TRUTHY = /^(1|true|yes|on)$/i;

export function parseToggle(value, fallback = false) {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  return TRUTHY.test(raw);
}

export function parseOriginAllowlist(raw) {
  const origins = String(raw ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  return new Set(origins);
}

/** Returns the request origin when it is explicitly allowed, otherwise an empty string. */
export function resolveCorsOrigin(origin, allowlist) {
  const value = String(origin ?? '').trim();
  if (!value || !allowlist || allowlist.size === 0) return '';
  return allowlist.has(value) ? value : '';
}

export function firstForwardedAddress(headerValue) {
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof raw !== 'string') return '';
  const first = raw.split(',')[0]?.trim() ?? '';
  return first.slice(0, 64);
}

/**
 * Client address used for rate limiting. Forwarded headers are trusted only when the
 * deployment explicitly opts in, otherwise every proxied client would share one bucket.
 */
export function parseAddressAllowlist(raw) {
  return new Set(String(raw ?? '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean));
}

/** Forwarded client identity is used only when the socket peer is explicitly allowlisted. */
export function resolveClientAddress(req, { trustProxy = false, trustedProxyAddresses = new Set() } = {}) {
  const socketAddress = String(req?.socket?.remoteAddress ?? '').trim();
  const trusted = trustProxy && trustedProxyAddresses instanceof Set
    && trustedProxyAddresses.has(socketAddress.toLowerCase());
  if (!trusted) return socketAddress || 'unknown';
  const forwarded = firstForwardedAddress(req?.headers?.['x-forwarded-for']);
  return forwarded || socketAddress || 'unknown';
}

export function isProxiedRequest(req) {
  const forwardedFor = firstForwardedAddress(req?.headers?.['x-forwarded-for']);
  const forwarded = String(req?.headers?.forwarded ?? '').trim();
  return Boolean(forwardedFor || forwarded);
}

export function createRequestContext(req, { trustProxy = false, trustedProxyAddresses = new Set(), requestIdFactory = randomUUID } = {}) {
  const method = String(req?.method ?? 'GET').toUpperCase();
  const rawUrl = String(req?.url ?? '/');
  return {
    requestId: requestIdFactory(),
    method,
    pathname: rawUrl.split('?')[0] || '/',
    clientAddress: resolveClientAddress(req, { trustProxy, trustedProxyAddresses }),
    proxied: isProxiedRequest(req),
    startedAt: Date.now(),
  };
}

/** One JSON line per request. The query string is deliberately excluded: it may carry tokens. */
export function formatAccessLog(entry) {
  const line = {
    ts: new Date(entry?.startedAt ?? Date.now()).toISOString(),
    requestId: String(entry?.requestId ?? ''),
    method: String(entry?.method ?? 'GET'),
    path: String(entry?.pathname ?? '/'),
    status: Number(entry?.status ?? 0),
    durationMs: Math.max(0, Number(entry?.durationMs ?? 0)),
    client: String(entry?.clientAddress ?? 'unknown'),
    proxied: Boolean(entry?.proxied),
  };
  if (entry?.errorCode) line.errorCode = String(entry.errorCode).slice(0, 80);
  return JSON.stringify(line);
}
