import { handleAuthenticatedNekoPluginPush } from './neko-plugin-transport-auth.mjs';

const PUSH_PATH = '/api/neko/messages/push';
const DEFAULT_MAX_BODY_BYTES = 64 * 1024;
const MAX_CONFIGURABLE_BODY_BYTES = 1024 * 1024;

function response(status, body, headers = {}) {
  return { status, body, headers };
}

async function readJsonBody(req, maxBodyBytes) {
  const declared = req.headers?.['content-length'];
  if (declared !== undefined) {
    if (typeof declared !== 'string' || !/^(0|[1-9][0-9]*)$/.test(declared)) {
      return { ok: false, status: 400, error: 'invalid-content-length' };
    }
    const declaredBytes = Number(declared);
    if (!Number.isSafeInteger(declaredBytes)) {
      return { ok: false, status: 400, error: 'invalid-content-length' };
    }
    if (declaredBytes > maxBodyBytes) {
      // Drain without retaining data so the keep-alive connection remains well-formed.
      req.resume?.();
      return { ok: false, status: 413, error: 'request-too-large' };
    }
  }

  const chunks = [];
  let received = 0;
  let oversized = false;
  try {
    for await (const chunk of req) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      received += bytes.byteLength;
      if (received > maxBodyBytes) {
        oversized = true;
        chunks.length = 0;
        continue;
      }
      if (!oversized) chunks.push(bytes);
    }
  } catch {
    return { ok: false, status: 400, error: 'request-body-read-failed' };
  }

  if (oversized) return { ok: false, status: 413, error: 'request-too-large' };
  let source;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
  } catch {
    return { ok: false, status: 400, error: 'request-body-not-utf8' };
  }
  if (!source.trim()) return { ok: false, status: 400, error: 'invalid-neko-plugin-envelope' };

  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    return { ok: false, status: 400, error: 'invalid-json' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, status: 400, error: 'invalid-neko-plugin-envelope' };
  }
  return { ok: true, value: parsed };
}

/**
 * Real Node HTTP boundary for N.E.K.O. push_message.v2.
 *
 * API authorization and rate limiting remain the responsibility of the outer
 * NK1 server router. This adapter owns method/path, readiness, media type,
 * bounded UTF-8/JSON decoding and the authenticated ingress hand-off.
 */
export async function handleNekoPluginPushHttpRequest(req, {
  credentials,
  ingress,
  ready = true,
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
} = {}) {
  if (!Number.isSafeInteger(maxBodyBytes)
      || maxBodyBytes < 1024
      || maxBodyBytes > MAX_CONFIGURABLE_BODY_BYTES) {
    throw new Error('neko-plugin-http-body-limit-invalid');
  }

  let url;
  try {
    url = new URL(req?.url || '/', 'http://localhost');
  } catch {
    return response(400, { ok: false, error: 'invalid-request-url' });
  }
  if (url.pathname !== PUSH_PATH) {
    return response(404, { ok: false, error: 'neko-plugin-route-not-found' });
  }
  if (req?.method !== 'POST') {
    return response(405, { ok: false, error: 'method-not-allowed' }, { allow: 'POST' });
  }
  if (ready !== true) {
    return response(503, { ok: false, error: 'organism-runtime-not-ready' });
  }

  const contentType = String(req.headers?.['content-type'] || '')
    .split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    return response(415, { ok: false, error: 'application-json-required' });
  }

  const decoded = await readJsonBody(req, maxBodyBytes);
  if (!decoded.ok) return response(decoded.status, { ok: false, error: decoded.error });

  try {
    const result = await handleAuthenticatedNekoPluginPush({
      credentials,
      pluginIdHeader: req.headers?.['x-neko-plugin-id'],
      tokenHeader: req.headers?.['x-neko-plugin-token'],
      input: decoded.value,
      ingress,
    });
    return response(result.status, result.body);
  } catch {
    // Never expose transport tokens, payloads or internal exception details.
    return response(503, { ok: false, error: 'neko-plugin-ingress-unavailable' });
  }
}

export const NEKO_PLUGIN_PUSH_HTTP_LIMITS = Object.freeze({
  defaultMaxBodyBytes: DEFAULT_MAX_BODY_BYTES,
  maxConfigurableBodyBytes: MAX_CONFIGURABLE_BODY_BYTES,
});
