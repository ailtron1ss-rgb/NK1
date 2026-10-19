# P2691 — Adaptive Memory Policy

P2691 builds on P2690 Memory Signal Fusion and adds a bounded adaptive controller. The controller selects among semantic, hybrid, causal, temporal and balanced retrieval policies, observes delayed reward, and updates only bounded policy weights. It cannot modify code, memory contents or runtime architecture.

## Why
P2690 proved that multi-signal fusion can outperform semantic-only on a small controlled holdout. P2691 tests the next hypothesis: rather than hard-coding one fusion policy, the organism should be able to select a retrieval policy from observed outcomes.

## Implementation
- `src/organism/developmental/AdaptiveMemoryPolicy.ts`
- persisted optional policy state in `MemoryOS2`
- cold-start exploration: every policy receives at least two trials
- bounded reward update and cooldown
- policy-specific ranking bias
- restore/snapshot diagnostics
- no external dependency; mobile-safe

## GitHub-derived ideas reviewed
- Mem0: semantic + keyword + entity + temporal retrieval as independent signals.
- A-MEM: dynamic linking/evolution of memory structures.
- Neo4j Agent Memory: explicit reasoning-to-entity `TOUCHED` provenance, buffered writes and evaluation harness.

We reuse the architectural ideas, not the external runtimes/databases.

## Test
`P2691_ADAPTIVE_MEMORY_POLICY=PASS`
40 retrievals / 320 returned memories. Cold-start exploration: 2 trials for semantic, hybrid, causal and temporal; balanced received 32 exploitation trials. State restoration preserved the selected policy and trial counters.

This is an implementation/controlled test, not evidence of general superiority over other memory systems.
