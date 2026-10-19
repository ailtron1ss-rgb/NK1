# WorkPass41 — causal cycle verification and memory net-value admission

**Date:** 2026-10-14  
**Base:** WorkPass40 · **Runtime:** 35.63.0 · **State schema:** 225  
**Implementation progress:** 92/100 · **Weighted release roadmap:** 78.0% (not release approval)

## Changes implemented

1. Added `CognitiveEventFabric.verifyOperationalCycle`. It resolves each of the six canonical stage IDs, verifies exact stage labels and shared tick, and checks the required parent edges: prediction→observation, action→prediction/observation, outcome→action, learning→outcome, self-update→learning. Both `OrganismRuntime` and `OrganismCore.feedback` now feed the unified cycle contract with this cycle-local result. Historical dangling refs caused by ring-buffer eviction can no longer poison a valid current cycle. Invalid current lineage remains fail-closed.
2. Hardened `CognitiveEventFabric.restore`. It preserves valid historical IDs but rejects duplicate IDs and unknown stages, normalizes timestamps/ticks/confidence/source/payload, and prevents malformed persisted rows from replacing a valid causal node.
3. Fixed `MemoryRetentionEconomy` admission. Previously the `score01`/action classification largely ignored harm, redundancy, provenance and net utility unless budget pressure was already high. The base score is now the net utility (`score - harm penalty + provenance evidence`); budget pressure blends this with value-per-byte as an additional constraint. This resolves the observed failing `big-pass-164` assertion for low-value/high-redundancy content.
4. Updated root release audit to explicitly include both WorkPass41 regression suites, big-pass 162/164, adaptive memory retention tests, memory-substrate equivalence, runtime typecheck, app script/browser contracts, retrieval benchmark, server import, UI/API linkage and asset audits.
5. Aligned root/runtime release versions and provenance to WorkPass41 / Neuro-Kurisu 35.63.0 / schema 225. No persisted schema fields were added, so state schema remains 225.

## Targeted evidence

- cycle-local lineage plus restore sanitization: 10 assertions pass;
- memory retention net-value: 5 assertions pass;
- `big-pass-162-unified-cognitive-economy`: PASS;
- `big-pass-164-large-cognitive-pass`: PASS after the retention fix;
- `p2894-memory-anti-collapse`: PASS;
- `p2888-adaptive-memory-economy`: PASS;
- memory substrate indexed-vs-brute-force equivalence: PASS;
- runtime TypeScript typecheck: PASS.

## Limits/open release gates

Production Vite build cannot be claimed until locked app dependencies are installed; the current offline environment lacks Vite (`spawn vite ENOENT`) and npm registry DNS previously failed. Full interactive browser/Live2D E2E, real llama.cpp inference on target hardware, real provider/device receipts and reconnect/replay, independent labelled temporal retrieval holdout, fault-injected clean-room rollback, manual nested-source licence sign-off and long soak remain open. Current synthetic retrieval improvement is zero; the candidate remains not-promoted.
