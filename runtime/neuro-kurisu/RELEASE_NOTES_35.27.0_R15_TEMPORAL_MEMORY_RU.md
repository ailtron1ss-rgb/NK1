# Neuro-Kurisu 35.27.0 — R15 Temporal Memory

R15 extends the canonical MemoryOS2 authority without introducing a second durable memory store.

## Реализовано

- Bi-temporal-style validity fields: `validFromAt`, `validUntilAt`, `observedAt`.
- Content revision lineage: `supersedesId`, `supersededById`, `revisionGroupId`, `revisionSequence`.
- Point-in-time retrieval modes: `current`, `at`, `all`.
- `reviseContent()` with explicit revision lineage and historical preservation.
- Symmetric contradiction links and temporal links based on validity/semantic overlap.
- Исправлено удаление: stale `itemIndex`/token/DF/link references больше не остаются после forget/pressure maintenance.
- Index integrity diagnostics for item, exact/content indexes and BM25 document-frequency accounting.
- Read-only temporal retrieval path exposed through the existing Core/server memory inspector boundary.
- Independent R15 behavioral holdout for revision-aware retrieval and identifier retrieval.

## Проверки

- Typecheck PASS.
- R13/R14 memory regressions PASS.
- R15 temporal/behavioral test PASS: Recall@3 = 1.0, revision chain depth = 2.
- R15 index audit PASS: stale indexes = 0, DF mismatches = 0.
- Core architecture PASS: direct constructors = 5, cycles = 0.
- P2854 hierarchical/core PASS.
- P2855 contextual/integration/ablation PASS.
- Mobile 256-MB benchmark PASS: repeated runs show p50 400–492 ms and p95 676–773 ms, max heap 129–132 MB and max RSS 294–306 MB; benchmark is noisy, so no single-run regression is treated as a definitive trend.

## Ограничения

R15 does not claim subjective consciousness. The new temporal layer improves continuity and factual state tracking; it is not proof of consciousness. An actual MCP transport is not vendored in this release to avoid adding a large external runtime dependency to the phone target; the Core/server boundary is ready for a separate MCP adapter.
