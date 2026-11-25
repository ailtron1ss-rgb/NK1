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

This is a conservative at-most-once boundary, not a claim of exactly-once delivery. The helper supplies a durable host bootstrap primitive, but a separate transport host must use it; the canonical `runtime/neuro-kurisu/src/server/server.mjs` does not currently expose a N.E.K.O. `MESSAGE_PUSH` route. Transport-to-host wiring and device/reconnect soak therefore remain deployment acceptance gates.
