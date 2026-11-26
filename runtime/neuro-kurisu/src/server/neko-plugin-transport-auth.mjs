import { timingSafeEqual } from 'node:crypto';

const SAFE_PLUGIN_ID = /^[a-z0-9][a-z0-9._-]{0,79}$/i;
const MIN_TOKEN_LENGTH = 32;
const MAX_TOKEN_LENGTH = 512;

/**
 * Parse the server-only per-plugin credential map.
 * The JSON shape is { "plugin-id": "long-random-secret", ... }.
 * An empty setting disables the plugin transport; malformed non-empty settings
 * are startup errors so the server never silently falls back to unauthenticated ingress.
 */
export function parseNekoPluginCredentials(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return new Map();
  let parsed;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    throw new Error('neko-plugin-credentials-json-invalid');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
      || Object.getPrototypeOf(parsed) !== Object.prototype) {
    throw new Error('neko-plugin-credentials-map-invalid');
  }
  const entries = Object.entries(parsed);
  if (entries.length > 128) throw new Error('neko-plugin-credentials-capacity-exceeded');
  const credentials = new Map();
  for (const [pluginId, token] of entries) {
    if (!SAFE_PLUGIN_ID.test(pluginId)
        || typeof token !== 'string'
        || token.length < MIN_TOKEN_LENGTH
        || token.length > MAX_TOKEN_LENGTH
        || /[^\x21-\x7e]/.test(token)) {
      throw new Error('neko-plugin-credential-entry-invalid');
    }
    credentials.set(pluginId, token);
  }
  return credentials;
}

/**
 * Bind the transport-authenticated plugin header to both message identity layers.
 * The secret is compared in constant time after a length check. The caller must
 * still pass the envelope through PluginMessageIngress for schema, policy, replay,
 * persistence and evidence-only cognition checks.
 */
export function authorizeNekoPluginTransport({
  credentials,
  pluginIdHeader,
  tokenHeader,
  identity,
  payload,
} = {}) {
  if (!(credentials instanceof Map)
      || typeof pluginIdHeader !== 'string'
      || !SAFE_PLUGIN_ID.test(pluginIdHeader)
      || typeof tokenHeader !== 'string'
      || !identity || typeof identity !== 'object' || Array.isArray(identity)
      || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { allowed: false };
  }

  if (identity.pluginId !== pluginIdHeader || payload.plugin_id !== pluginIdHeader) {
    return { allowed: false };
  }
  const expected = credentials.get(pluginIdHeader);
  if (typeof expected !== 'string') return { allowed: false };

  const expectedBytes = Buffer.from(expected, 'utf8');
  const presentedBytes = Buffer.from(tokenHeader, 'utf8');
  if (expectedBytes.length !== presentedBytes.length || expectedBytes.length < MIN_TOKEN_LENGTH) {
    return { allowed: false };
  }
  return timingSafeEqual(expectedBytes, presentedBytes)
    ? { allowed: true, pluginId: pluginIdHeader }
    : { allowed: false };
}
