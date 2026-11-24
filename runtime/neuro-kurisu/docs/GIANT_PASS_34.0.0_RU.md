# Neuro-Kurisu 34.0.0 — Giant Pass

## What was actually changed
1. Current release bookkeeping was rebuilt from one source: `VERSION.json`.
2. Stale active P-phase/release documents were moved to `docs/history/`.
3. `ARCHITECTURE_MANIFEST.json` is regenerated from current tree state; the old 29.0.0/73 manifest drift is eliminated.
4. Duplicate native-perception API routes were removed (86 unique routes, 0 duplicates).
5. A bounded `status-lite` endpoint was added so a phone UI does not need the full deep diagnostic snapshot.
6. `/health` was added as a real lightweight health endpoint.
7. Remote API binding now has explicit token authentication; localhost research mode remains usable without a token.
8. A real non-loopback server security smoke test was added.
9. Source-truth and API-route audits are now repeatable release gates.
10. Current evidence/roadmap/progress were reduced to one active source of truth.

## Findings that remain open
- `OrganismCore` is still the main architectural bottleneck.
- `StateMigrations.ts` is still a migration hotspot.
- Multiple P-derived memory/self/development engines remain compatibility complexity.
- Long-horizon scaling remains a warning: 220 cycles passed functionally, but first-to-last latency grew ~2.63x in the latest regression.
- Native Android lifecycle/recovery is not yet a real implementation.
- Semantic perception is feature-level/local without an externally validated multimodal semantic backend.
- L1/L2/L3 evidence is not demonstrated.
- Phenomenal consciousness/qualia are UNPROVEN.

## Stage decision
Stage 1 is not declared 100% complete: canonical construction/source-of-truth hardening is strong, but full single-writer semantic mutation and migration/event-rebuild work remain.
Stage 2 has begun only at the contract/security boundary; native Android is still next.
