# OmeStro #22 — Substrate Independence

## Purpose

Keep NeuroCore's durable cognitive state independent of the language model, provider, runtime process, GPU or device that happens to execute inference. NK1 continues to own memory, goals, world state, procedural skills and continuity; an LLM is a replaceable compute substrate.

This implementation is a first operational slice of the idea. It does not claim behavioural identity between models or automatic migration without evidence.

## Canonical state and portable package

The transfer contract is `nk1.portable-cognitive-state`, schema version 1:

- `PersistedOrganism` — canonical organism state, including self, memory, goals and recorded backend continuity.
- `PersistedWorld` — the persisted world snapshot and transition history.
- `SkillLibraryState` — procedural skills and their bounded lifecycle metadata.

The envelope records the source backend identity/profile digest, capture time, schema contract, SHA-256 digest and encoded byte count. Canonical key ordering makes the digest deterministic. Payload parsing is bounded by size, depth and node count. Accessors/getters, proxies, cyclic references, sparse arrays, unsafe keys and unsupported class instances are rejected. Explicit portable tags preserve Date, Map, Set, Buffer, ArrayBuffer, DataView and typed-array values.

The digest detects accidental corruption and payload alteration when compared to the original envelope. It is **not** encryption, sender authentication or a signature. Before moving a package between devices, the host must encrypt it and authenticate the transfer using its own transport/key-management policy. Do not place API keys, credentials, secrets or model weights in the package.

## Backend identity and compatibility

Backend profiles are supplied by trusted host configuration, not by an LLM response. A profile identifies the route, provider, model/revision, runtime, privacy class, supported capabilities, embedding space and context window.

A transfer is refused when a required capability is missing, the source profile cannot be verified, the embedding space differs (reindex required), or a remote/external backend has not received explicit consent. The deterministic text fallback is deliberately not treated as a model substrate and cannot permanently take over model routing.

The server recognises configured `llama.cpp`, `kobold`, `gemini` and deterministic fallback routes. A registered substrate preference is considered only when the provider is configured/available; the existing local-language policy and provider fallback remain in place.

## Calibration and promotion

Importing state does not promote a target model. Promotion requires independent holdout trials bound to the exact transfer digest:

- At least 5 distinct trials across at least 3 task families.
- Unique trial ID, task ID, evaluator receipt ID and independence key.
- Host-verified Ed25519 evaluator receipt for each trial.
- Minimum task success 0.80, memory recall 0.90, goal fidelity 0.90, constraint fidelity 0.95, identity continuity 0.85 and tool-contract fidelity 0.98.
- p95 target/source latency ratio no greater than 2.0 by default.

The signed claims include the exact transfer digest, source and target backend IDs, task family/ID, evidence independence identifiers, metrics and latency measurements. Use `substrateCalibrationSigningPayload(trial)` to obtain the canonical UTF-8 string before adding `evaluatorSignatureBase64`. Sign it with an Ed25519 private key held by the independent evaluator outside NK1. The private key must not be stored in the repository or on the model provider.

The NK1 server accepts a host-owned public-key registry through:

```sh
NEURO_SUBSTRATE_CALIBRATION_PUBLIC_KEYS_JSON='{"independent-evaluator-v1":"-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"}'
```

The JSON object maps a stable key ID to an Ed25519 PEM public key. The server rejects malformed entries or non-Ed25519 keys at startup. With no configured keys, the calibration verifier is absent and evaluation/promotion fail closed.

A successful evaluation is not itself a provider switch. The caller must explicitly invoke `promoteSubstrateBackend(targetBackendId, evaluationId)`. The runtime stores the signed receipts with the evaluation; after restart, the receipts and metrics are recomputed and reverified before promotion remains trusted. If the active backend had been promoted but its receipts cannot be revalidated, runtime startup rolls back to the recorded prior backend. An approval is consumed by promotion/rollback; a second attempt requires a fresh evaluation.

## Runtime API

- `createPortableSubstrateTransferPackage()` — flush canonical state and export a verified envelope. Runtime must be initialized.
- `importPortableSubstrateTransferPackage(transfer, targetBackendId, options)` — validate and import before runtime initialization. Writes a durable backup and a prepared/committed journal.
- `evaluateSubstrateMigration({ transfer, targetBackendId, trials, allowExternalBackend? })` — uses the configured host receipt verifier.
- `promoteSubstrateBackend(targetBackendId, evaluationId)` — explicit, evidence-gated promotion.
- `rollbackSubstrateBackend()` — return to the previous substrate after a promotion.

If startup finds an import journal left in `prepared`, it restores the pre-import organism/world/skill snapshots and the substrate sidecar before continuing. If the backup is absent or unreadable, startup stops instead of silently accepting a partial import.

## Scope and remaining work

This slice does not yet provide a user-facing migration UI, encrypted cross-device transport, a production holdout task runner, hardware-specific GPU/accelerator adaptation, embedding reindex execution, or production soak results. The host must produce independent calibration receipts from paired source/target executions; synthetic unit-test receipts do not establish real-world migration quality.

The automated gates are registered in `test:substrate-independence` and the NK1 Unified organism workflow. Their current exact-head outcome must be checked before merge. No main-branch or Release ZIP change is included in this Draft PR.
