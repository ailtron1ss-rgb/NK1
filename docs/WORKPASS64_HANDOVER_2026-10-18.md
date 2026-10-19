# WorkPass64 handover — Neuro Kurisu (2026-10-18)

## Canonical state

- Source baseline: `Neuro_Kurisu_WORKPASS63_2026-10-18.zip`.
- Current package/runtime line: root `35.0.0-super-workpass64`; runtime `35.84.0`; persisted schema `225`.
- Root release status: `implementation-workpass; release gates remain open`.
- No parallel runtime, gateway, writable memory owner, or new decision planner was introduced.

## Critical change

The previous action-ledger archive model treated all completed receipts as equally safe to spill. That is not true: a completed `executed-unverified` or `executed-contradicted` result may still need provider reconciliation. This pass now refuses to evict those entries from the hot ledger just to make room; under all-unresolved capacity pressure, the next keyed mutation fails closed before executor entry.

For backwards compatibility, older archived unresolved receipts remain recoverable. The append-only JSONL archive can append an identity-preserving revision only when the old receipt is unresolved and the new receipt is explicitly reconciled for the same request/tool/execution identity. Each line remains checksum-protected; archive load replays and validates revision transitions and points reads at the newest valid line.

The redacted recovery count/snapshot now merges archive and hot rows. That matters for deployments with old archive rows: a previously unresolved action must not disappear from the visible recovery queue merely because it was spilled by an older runtime.

## What passed

- Runtime TypeScript typecheck.
- WorkPass64: ledger saturation, fail-closed admission, archived unresolved queue visibility, authorized receipt reconciliation, append-only archive revision, identity-conflict rejection, archive reload and idempotent replay.
- Legacy archive spill/replay suite: 4 subtests.
- WorkPass63: keyed-action uncertainty/skill firewall and filesystem side-effect lost-ACK/restart recovery, executed independently.
- WorkPass62: two child-process SIGKILL windows and reconciliation, executed independently. Both child-process harnesses now enforce bounded timeouts and process-group cleanup so a stuck child is reported as a test failure rather than hanging the full release run.
- WorkPass61: authoritative receipt revision regression.

## Proof boundaries

The provider in the archive regression is a controlled fixture, not a real network/device provider. The filesystem E2E from WorkPass63 is genuine local filesystem state but not a remote provider ACK-gap proof. The canonical `npm run install:all` was retried during this pass; `npm ci` failed while fetching `ajv@^8.12.0` with DNS `EAI_AGAIN` and hit the command timeout. `app/node_modules` remains absent. Production Vite build and actual desktop/mobile browser/Live2D journeys remain unverified.

Memory retrieval uplift remains `recallDelta=0`; the vector candidate stays unpromoted. Real cause-to-learning credit over provider receipts/independent observations, live initiative, audio-clock Live2D lipsync, target GPU model profile, source/model/dataset license review, clean-room rollback and 24–72h soak remain open.

## Next critical path

1. Run the provider ACK-gap/reconnect/postcondition matrix against one configured safe reversible real target.
2. Run clean install/typecheck/production build and actual browser approval/reload/replay journeys when the npm registry and browser environment are available.
3. Complete causal-learning and independent memory holdout gates; do not promote embeddings while the uplift is zero.

Runtime archive manifest is regenerated and verified for 4,256 entries. The packaged snapshot retains all 9,292 WorkPass63 paths, adds seven files, changes 18 existing files and deletes none. The adjacent SHA-256 sidecar is the authoritative package hash; its value is not embedded inside the ZIP to avoid a self-referential digest.

See `WORKPASS64_CODE_CHANGES_2026-10-18.md`, `PROJECT_CURRENT_STATUS_2026-10-18_WORKPASS64.md`, `PROJECT_PROGRESS_SCORECARD_2026-10-18_WORKPASS64.json`, and `ROADMAP_GAPS_TO_TARGET_WORKPASS64.md`.
