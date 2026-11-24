# Neuro-Kurisu SUPER — FINAL4 release status

Date: 2026-10-08

Canonical runtime: Neuro-Kurisu 35.40.0 / schema 223

## Integrated source branches

WILL, Lumina, Hexis, Letta and Conscio 4.8.2 are preserved as provenance and adapted behind existing canonical owners. No second brain, memory, identity or policy owner was introduced.

## Verified gates

- Runtime typecheck: PASS
- Conscio adaptation: PASS
- Conscio UI wiring: 18/18 PASS
- Conscio server smoke: PASS
- Letta governance: PASS
- WILL integration: 9/9 PASS
- WILL surfaces: 3/3 PASS
- Lumina: 3/3 PASS
- Hexis adaptation: PASS
- Server input hardening: PASS
- Server security smoke: PASS
- Organism smoke: PASS
- Restart persistence: PASS
- Memory dedupe: PASS
- Concurrency: PASS (standalone deterministic run)
- Server smoke: PASS (request timeouts enabled in smoke harness)
- Full project audit: PASS, 0 errors, 0 warnings
- UI wiring audit: PASS, no missing routes / no unused tracked methods
- Architecture/core ownership: PASS, 0 cycles, 5 direct constructors
- Forensics/hygiene/syntax/integrity/contract/release-source: PASS
- Function-reality critical path: PASS
- Parameterized probes: 1186 passed, 0 failed
- Archive manifest: regenerated and verified

## Conscio hardening included

- Safe FTS5 MATCH query construction.
- Provenance classification before legacy matching.
- Evidence required for supported claim receipts.
- Skill immutability after review.
- Peer ACK idempotency and optional message idempotency key.
- Full bidirectional Conscio UI controls (source state, skill reject/promote, peer revoke/ACK, calibration, claim recording).

## Source preservation

Safe raw archives for WILL/Lumina/Letta are retained under `legacy/input-archives/raw-source-archives/`. Conscio raw source is under `legacy/input-archives/external-sources/`. Hexis is retained as sanitized extracted provenance because its original archive contains credential-bearing files.

## Checklist snapshot

DONE-equivalent (DONE + PASS): 232
PARTIAL: 115
TODO: 41
Total: 388
Weighted completion (PARTIAL=0.5): 74.61%

## Environment limits

Full clean-room UI dependency install/Vite/browser E2E and unrestricted long-duration soak still require an environment with the full dependency registry/cache and without sandbox execution limits. Historical semantic coverage remains intentionally incomplete; unverified historical functions are not auto-promoted.
