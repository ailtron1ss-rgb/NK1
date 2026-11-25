# N.E.K.O. message receipts in NK1

## Why this adapter exists

N.E.K.O. envelopes pass through \`PluginMessageIngress\` before they reach the canonical NK1 runtime. The ingress previously kept a bounded in-memory replay cache only. A restart erased that cache, allowing a transport retry to repeat cognition or chat/HUD presentation.

The receipt store adds a host-owned checkpoint at the existing ingress boundary. It is not a second memory system or plugin executor.

## Host setup

The transport host should construct a dedicated \`FileStateStore\` beside its other host-owned state and restore it before accepting messages:

\`\`\`ts
const receiptStore = new FileStateStore<PluginMessageIngressSnapshot>(
  stateFile + '.neko-plugin-receipts.json',
);

const ingress = new PluginMessageIngress({
  allowedPlugins: configuredPluginIds,
  authorize: hostPermissionPolicy,
  runtime: organismRuntime,
  present: hostPresenter,
  receiptStore,
});

await ingress.initialize();
// Open the N.E.K.O. transport only after initialization succeeds.
\`\`\`

The store is a structural \`load\` / \`save\` interface, so hosts may provide another atomic durable store. \`FileStateStore\` serializes concurrent writes and atomically replaces its state file.

## Commit sequence

1. Validate the inert envelope and transport identity.
2. Re-check the host-owned permission policy, including on replay.
3. Persist a \`pending\` receipt with plugin ID, message ID and SHA-256 fingerprint.
4. Only after that write succeeds, run cognition and optional presentation.
5. Replace the pending row with a bounded \`completed\` receipt and its sanitized result.

Raw message text, prompt content, metadata and binary payload are never written to the receipt snapshot.

## Restart and recovery

- A matching \`completed\` receipt returns its result with \`replayed: true\`; cognition and presentation are not repeated.
- Reusing an identity with a different fingerprint returns \`message-id-conflict\`.
- A restored \`pending\` receipt returns \`message-recovery-required\`. NK1 does not guess whether the previous process completed the side effect, and never re-runs it automatically.
- An uncertain save acknowledgement keeps a pending tombstone and fails closed. The host must reconcile the real outcome before authorizing a retry.
- A malformed or unsupported snapshot aborts initialization; it is not silently replaced by an empty cache.
- Earlier version-1 snapshots are accepted as completed receipts and migrate to version 2 on the next successful write.

This is a conservative at-most-once boundary, not a claim of exactly-once delivery. The final transport-to-host wiring and device/reconnect soak remain deployment checks.
