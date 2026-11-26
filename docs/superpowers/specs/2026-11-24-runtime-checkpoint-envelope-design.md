# Runtime checkpoint envelope — design

## Intent

Make each durable OrganismCore checkpoint carry the runtime-owned state that must be restored with it. Today the Core file is atomically saved by FileStateStore, while World, OpenLoop, CognitiveSpine, RiskAwareRecovery and CognitiveHealth are saved in independent sidecar files. A process crash can therefore leave individually valid files from different logical checkpoints.

## Goals

- Capture one bounded snapshot of World, OpenLoop, CognitiveSpine, RiskAwareRecovery and CognitiveHealth at the exact time Core commits its durable file.
- Store the envelope inside the same persisted Core object, so its generation and Core snapshot share one atomic file replacement.
- Hash each owner snapshot with SHA-256 and validate the envelope before using it.
- Treat the existing sidecar files as repairable compatibility projections, not a competing authority when a verified envelope exists.
- On restart, restore all covered owners from one verified generation and repair their sidecar projections from that same generation.
- Preserve legacy behavior for Core files without an envelope: load the existing sidecars, then create the first coordinated envelope on the next durable Core checkpoint.

## Approaches considered

1. Independent commit manifest next to sidecars. This leaves the manifest and Core state as separate atomic files and still needs a recovery protocol for a crash between their commits.
2. New full runtime bundle file. This duplicates the multi-megabyte Core snapshot and creates a second source of truth.
3. Envelope embedded in the canonical Core snapshot (selected). The existing Core FileStateStore already provides atomic replacement, backup and hash verification. An injected snapshot contributor lets Core capture the external owner snapshots immediately before its own durable save, without importing Runtime implementations into Core.

## Boundaries and non-goals

- Covered owners: World, OpenLoopRadar, CognitiveSpineScheduler, RiskAwareRecoveryController and CognitiveHealth monitor state.
- Synaptic adapter replay anchors remain with the host-owned monotonic anti-rollback store; they must not be copied into this local checkpoint authority.
- Procedural skill lifecycle remains in its existing owner store for this pass.
- OperationalJournal and ContinuityLedger remain append-only evidence streams, not state snapshots.
- This does not introduce a multi-file transaction manager or force a multi-megabyte Core save on every cognitive tick. The envelope is included whenever the existing Core path performs a durable checkpoint.
- Release assets and canonical branch remain untouched until review and explicit integration.

## Failure behavior

- Valid envelope: restore all covered owners from that generation and rewrite sidecar projections from those snapshots.
- No envelope (legacy state): restore using existing sidecars and let the next durable Core checkpoint establish generation 1.
- Invalid envelope/hash: do not partially restore owners from it; emit a bounded recovery warning and use the legacy sidecar recovery path.
- Sidecar write failure after a successful Core commit: keep the Core envelope authoritative, log the repair failure, and retry projection repair on the next startup/flush.
