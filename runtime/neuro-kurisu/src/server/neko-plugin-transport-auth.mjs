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


/**
 * Execute the authenticated HTTP transport contract without depending on the
 * server router. A request may enter the durable ingress only after credentials
 * and envelope identities match, and the first transport remains read-only.
 */
export async function handleAuthenticatedNekoPluginPush({
  credentials,
  pluginIdHeader,
  tokenHeader,
  input,
  ingress,
} = {}) {
  if (!(credentials instanceof Map) || credentials.size === 0
      || !ingress || typeof ingress.handle !== 'function') {
    return { status: 503, body: { ok: false, error: 'neko-plugin-transport-not-configured' } };
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)
      || !input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) {
    return { status: 400, body: { ok: false, error: 'invalid-neko-plugin-envelope' } };
  }

  const transportAuth = authorizeNekoPluginTransport({
    credentials,
    pluginIdHeader,
    tokenHeader,
    identity: input.identity,
    payload: input.payload,
  });
  if (!transportAuth.allowed) {
    return { status: 401, body: { ok: false, error: 'neko-plugin-auth-denied' } };
  }

  // Until a durable presentation receipt and host presenter are wired, never
  // accept a request that expects a user-visible answer, chat or HUD side effect.
  if (input.payload.ai_behavior !== 'read'
      || (input.payload.visibility !== undefined
        && (!Array.isArray(input.payload.visibility) || input.payload.visibility.length !== 0))) {
    return { status: 409, body: { ok: false, error: 'neko-plugin-presentation-transport-not-configured' } };
  }

  let result;
  try {
    result = await ingress.handle(input);
  } catch {
    return { status: 503, body: { ok: false, error: 'neko-plugin-ingress-unavailable' } };
  }
  if (!result || typeof result !== 'object' || typeof result.accepted !== 'boolean') {
    return { status: 503, body: { ok: false, error: 'neko-plugin-ingress-invalid-result' } };
  }
  const status = result.accepted ? 200
    : result.errorCode === 'message-id-conflict' || result.errorCode === 'message-recovery-required' ? 409
    : result.errorCode === 'plugin-not-allowed' || result.errorCode === 'policy-denied' ? 403
    : result.errorCode === 'receipt-ledger-full'
      || result.errorCode === 'message-processing-failed'
      || result.errorCode === 'runtime-processing-failed'
      || result.errorCode === 'presentation-failed'
      || result.errorCode === 'receipt-store-not-initialized' ? 503
    : 400;
  return { status, body: { ok: result.accepted, ...result } };
}
