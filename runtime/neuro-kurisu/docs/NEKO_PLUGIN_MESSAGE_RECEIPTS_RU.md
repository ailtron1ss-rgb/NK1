# N.E.K.O. message receipts in NK1

## Why this adapter exists

N.E.K.O. message envelopes must pass through `PluginMessageIngress` before they reach the canonical NK1 runtime. A process-local replay cache is not sufficient: a restart can erase it and allow a transport retry to repeat cognition or chat/HUD presentation.

The receipt store is a host-owned checkpoint at the existing ingress boundary. It is not a second memory system or plugin executor.

## Production host bootstrap

Use the file-backed bootstrap helper rather than constructing the adapter with an optional in-memory cache:

```ts
const ingress = await createFileBackedPluginMessageIngress({
  receiptFilePath: path.join(STATE, 'neko-plugin-receipts.json'),
  allowedPlugins: configuredPluginIds,
  authorize: hostPermissionPolicy,
  runtime: organismRuntime,
  present: hostPresenter,
});

// Only now may the transport begin accepting MESSAGE_PUSH envelopes.
const result = await ingress.handle({ identity, payload });
```

The helper creates the canonical `FileStateStore`, awaits `initialize()`, and returns only after the receipt checkpoint has been restored. A missing, corrupt or incompatible checkpoint rejects host startup; it is never silently replaced by an empty replay cache. In `NODE_ENV=production`, constructing `PluginMessageIngress` without a durable receipt store fails closed.

The helper requires an absolute host-owned state path. The transport must still bind the request identity to its authenticated plugin connection and call `handle()` only after the transport has completed that authentication.

## Commit sequence

1. Validate the inert envelope and transport identity.
2. Re-check the host-owned permission policy, including on replay.
3. Persist a `pending` receipt with plugin ID, message ID and SHA-256 fingerprint.
4. Only after that write succeeds, run cognition and optional presentation.
5. Replace the pending row with a bounded `completed` receipt and its sanitized result.

Raw message text, prompt content, metadata and binary payload are never written to the receipt snapshot.

## Restart and recovery

- A matching `completed` receipt returns its result with `replayed: true`; cognition and presentation are not repeated.
- Reusing an identity with a different fingerprint returns `message-id-conflict`.
- A restored `pending` receipt returns `message-recovery-required`. NK1 does not guess whether the previous process completed the side effect, and never re-runs it automatically.
- An uncertain save acknowledgement keeps a pending tombstone and fails closed. The host must reconcile the real outcome before authorizing a retry.
- A malformed or unsupported snapshot aborts initialization; it is not silently replaced by an empty cache.
- Earlier version-1 snapshots are accepted as completed receipts and migrate to version 2 on the next successful write.

This is a conservative at-most-once boundary, not a claim of exactly-once delivery. The canonical `runtime/neuro-kurisu/src/server/server.mjs` now exposes the N.E.K.O. `MESSAGE_PUSH` route through the dedicated bounded HTTP adapter described below. Transport-to-host wiring is covered by a real socket-level regression; device/reconnect soak and production secret provisioning remain deployment acceptance gates.


## Authenticated NK1 HTTP transport

The canonical server now exposes `POST /api/neko/messages/push` when per-plugin credentials are configured. Set the server-only `NEKO_PLUGIN_CREDENTIALS_JSON` environment variable to a JSON object that maps each enabled plugin ID to its own random secret of at least 32 printable ASCII characters:

```json
{"notes":"replace-with-a-long-random-secret-of-at-least-32-characters"}
```

The request must carry both the existing NK1 API authorization (for remote API access) and these plugin-specific headers:

- `X-Neko-Plugin-Id`: the configured plugin ID
- `X-Neko-Plugin-Token`: that plugin's secret

The server binds the header ID to both `identity.pluginId` and `payload.plugin_id` before calling the ingress. It then applies the existing allowlist, evidence-only runtime policy, durable pending/completed receipt protocol and replay protection. Receipt state is stored at `STATE/neko-plugin-message-receipts.json`; startup awaits its restore barrier before `runtimeReady` becomes true. A malformed or unreadable receipt file fails startup closed.

This first HTTP transport is deliberately limited to `ai_behavior: "read"` with `visibility: []` (or no visibility field). It performs quiet cognitive ingestion without generating a user-visible answer. Requests that ask for `respond`, chat or HUD presentation are rejected with `neko-plugin-presentation-transport-not-configured`; they are not silently accepted or marked as displayed. A durable UI presenter and delivery acknowledgement contract are the next integration gate. With no `NEKO_PLUGIN_CREDENTIALS_JSON`, the route stays disabled and returns `neko-plugin-transport-not-configured`.


## Bounded Node HTTP adapter and socket-level regression

`neko-plugin-http-route.mjs` is the single HTTP boundary used by the canonical server and by the transport integration test. The outer NK1 router still performs the existing API-token/loopback authorization and rate-limit checks before this adapter runs.

The adapter enforces:

- only `POST /api/neko/messages/push`; other methods return 405 with `Allow: POST`, and other paths return 404;
- runtime readiness before parsing or admitting a message;
- `application/json` media type, valid UTF-8 and a JSON object envelope;
- 64 KiB default request-body limit, with a hard 1 MiB ceiling for explicit host configuration;
- content-length validation and bounded buffering even for chunked requests;
- per-plugin token authentication and binding of the header ID to both envelope identity fields;
- read-only/evidence-only transport until a separately durable presenter is configured;
- stable 409 conflict/recovery behavior and 503 for transient runtime/receipt failures.

`tests/neko-plugin-http-route.mjs` starts an actual local `node:http` server and sends real HTTP requests through the adapter into a file-backed `PluginMessageIngress`. It covers successful admission, retry replay, process-restart restore, identity conflict, invalid credentials, forged plugin ID, denied chat/HUD/respond capabilities, invalid JSON/UTF-8/media type, body overflow, not-ready state, method/path handling, disabled credentials and a failed ingress. The runtime call counter proves that rejected and replayed requests do not repeat cognition.

The test does not claim a full external plugin deployment, TLS termination, Android networking, or multi-replica coordination. Those remain separate operational gates.
