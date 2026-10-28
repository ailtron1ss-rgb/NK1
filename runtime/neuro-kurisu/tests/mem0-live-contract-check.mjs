import { Mem0PlatformAdapter } from '../src/organism/integration/mem0/Mem0PlatformAdapter.ts';

// No network call is permitted unless the operator explicitly opts in.
if (process.env.NK_MEM0_LIVE_CONTRACT_CHECK !== '1') {
  console.log('MEM0_LIVE_CONTRACT_CHECK=SKIPPED (explicit opt-in absent; no network request made)');
  process.exit(0);
}

if (process.env.NK_MEM0_ENABLED !== '1') {
  throw new Error('Live check requires NK_MEM0_ENABLED=1');
}

const apiKey = String(process.env.MEM0_API_KEY ?? '').trim();
const userId = String(process.env.NK_MEM0_USER_ID ?? '').trim();
if (!apiKey) throw new Error('Live check requires MEM0_API_KEY in the environment');
if (!/^nk1-live-contract-[a-z0-9][a-z0-9._:-]{0,108}$/.test(userId)) {
  throw new Error('Live check requires a dedicated test-only NK_MEM0_USER_ID beginning nk1-live-contract-');
}

const adapter = new Mem0PlatformAdapter({
  enabled: true,
  apiKey,
  userId,
  baseUrl: process.env.NK_MEM0_BASE_URL,
  // Force this canary to be read-only regardless of other environment settings.
  allowWrites: false,
  timeoutMs: process.env.NK_MEM0_TIMEOUT_MS ? Number(process.env.NK_MEM0_TIMEOUT_MS) : undefined,
  maxResponseBytes: process.env.NK_MEM0_MAX_RESPONSE_BYTES ? Number(process.env.NK_MEM0_MAX_RESPONSE_BYTES) : undefined,
});
const before = adapter.diagnostics();
if (!before.available || before.writesEnabled || !before.userScopeConfigured) {
  throw new Error('Live check refused: provider or isolated user scope is not configured for read-only use');
}

// Synthetic query only. The result may contain existing memories in this dedicated
// scope, so do not log their contents, IDs, metadata, or scores.
const result = await adapter.search('NK1 non-sensitive live API contract probe', 3);
if (result.status !== 'ok') {
  throw new Error('Mem0 read-only contract check failed: ' + String(result.errorCode ?? result.status));
}
if (result.diagnostics.scopeRejected > 0) {
  throw new Error('Mem0 returned records without matching owner provenance; those records were quarantined');
}
if (result.memories.some(memory =>
  memory.source !== 'mem0-platform' ||
  memory.epistemicStatus !== 'external-unverified' ||
  memory.instructionTreatment !== 'data-not-instructions' ||
  memory.requiresVerification !== true
)) {
  throw new Error('Mem0 result failed NK1 provenance and trust-boundary checks');
}
const after = adapter.diagnostics();
if (after.writesEnabled || after.requests < 1) {
  throw new Error('Live check invariant failed: expected at least one read request and no write capability');
}
console.log('MEM0_LIVE_CONTRACT_CHECK=PASS ' + JSON.stringify({
  mode: 'read-only',
  provider: after.provider,
  baseHost: after.baseHost,
  status: result.status,
  resultCount: result.memories.length,
  scopeRejected: result.diagnostics.scopeRejected,
  requestCount: after.requests,
  writesEnabled: after.writesEnabled,
  mutationsPerformed: false,
}));
