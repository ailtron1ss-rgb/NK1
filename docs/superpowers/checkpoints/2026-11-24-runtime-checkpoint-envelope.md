# NK1 Execution Checkpoint — Runtime Checkpoint Envelope

**Recorded:** 2026-11-24  
**Status:** implementation complete; awaiting review / post-commit failure-injection / mobile soak  
**Repository:** `ailtron1ss-rgb/NK1`

## Identity

- Canonical branch: `workpass70-source`
- Canonical base SHA: `87c9ed9034e09ca9fb83fd676ac52bb46434c4fe`
- Aspect branch: `aspect/p0-runtime-checkpoint-envelope-20261124`
- Verified head SHA: `91093837f72863633313b957e68e6780db2ab387`
- Pull request: [#1170](https://github.com/ailtron1ss-rgb/NK1/pull/1170)
- PR state: Open, Draft, mergeable; not merged.

## What changed

The canonical Core persisted object now stores a version-1 runtime checkpoint envelope generated at the Core durable-save boundary. The envelope contains bounded, raw-deflate/base64 owner snapshots plus SHA-256 payload hashes for:

1. WorldEnvironment
2. OpenLoopRadar
3. CognitiveSpineScheduler
4. RiskAwareRecoveryController
5. CognitiveHealth monitor (or explicit null when not configured)

Core owns envelope generation and the monotonic generation number. Runtime supplies owner snapshots via a structural contributor; after the atomic Core save, the commit observer writes existing sidecar files as projections.

Startup validates exact envelope and owner keys, owner hashes, declared raw/compressed sizes, aggregate budgets and owner shapes before decompression. It validates Core tick alignment and preflights owner restorers before applying any owner. A valid envelope wins over stale or mixed sidecars and repairs them. Missing/invalid envelopes retain the legacy sidecar restore path and emit bounded warnings.

Explicit OpenLoop mutations now force the canonical Core checkpoint before returning. World, Spine, RiskRecovery and CognitiveHealth updates mark the existing Core checkpoint governor dirty rather than racing their sidecar files independently.

## Verification

Latest head: **73/73 GitHub Actions workflows passed**; **30/30 commit check-runs passed**; no failed, cancelled or active jobs.

Focused checks:
- `NK1 Cognitive Core Consolidation`: PASS
- `NK1 Module Dependency Audit`: PASS
- `NK1 Unified organism runtime`: PASS
- `NeuroCore core regression validation`: PASS
- `NK1 integrated software baseline`: PASS
- `NK1 Cognitive Health Runtime Supervision`: PASS
- `NK1 clean prototype startup smoke`: PASS

The real-runtime checkpoint regression exercises generation advancement across restart, tampered owner hash rejection, aggregate size guard, exact-key validation, mixed-sidecar repair and legacy no-envelope restore.

## Preserved boundaries

- `workpass70-source` remains unchanged at the base SHA above.
- Latest Release remains `NeuroKurisu0.1`, tag `Neuro`; its ZIP asset was not modified.
- No changes were made to Release assets or `main`.
- Synaptic replay-anchor trust remains in the external monotonic authority.
- Procedural skill lifecycle remains in its own store.
- OperationalJournal and ContinuityLedger remain append-only streams.

## Next verified action

Request an independent review of PR #1170, then add explicit sidecar-write failure injection and run a real-device mobile soak measuring checkpoint payload size, p50/p95 latency, peak heap and cold-restart recovery. Keep Draft until those review and runtime measurements are complete.
