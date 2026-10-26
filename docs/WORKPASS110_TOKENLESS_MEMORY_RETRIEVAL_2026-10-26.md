# NK1 WorkPass110 — tokenless memory retrieval guard

Date: 2026-10-26  
Branch: `feature/visual-embodiment`

## Defect

`MemoryOS2.retrieve()` used an empty token set for queries like an empty string, punctuation-only input, or a single letter, then continued into the recent-memory fallback. On an empty query, JavaScript's `String.includes('')` is true for every content string, so unrelated memories could receive an exact-match signal despite there being no searchable query evidence.

## Fix

- Return an empty result when `tokensFor(query)` yields a set of size zero.
- Set retrieval candidate/BM25/fuzzy diagnostics to zero for that call, preserving the current temporal mode, timestamp, and intent metadata.
- Do not run recent-memory fallback or score any corpus row against an empty query.
- Added regression coverage for `''`, whitespace/punctuation/emoji, and one-character `'a'`; each must return no rows and zero candidates. The test also checks that row access timestamps, retrieval counts, and temperatures do not change.
- Added a focused GitHub Actions workflow for memory retrieval behavior so these tests do not depend on the unrelated Live2D workflow's path filter. Removed a superseded schema-v3 benchmark assertion (current report schema is v6) from this focused gate; the current WorkPass83 truth test and paired-seed experiment remain active.

## Commits

- Retrieval guard: `748a01dd0db3a33089dc3f1aae72a3625a743f29`
- Set-size typing correction: `fca50e743d5af5eda87a7a0224e88716e07eb4aa`
- Regression test: `7dcc76e438520ace8e2aa60f8e76993536a2f64a`
- Focused retrieval workflow (tested revision): `c429bca441158bc68951a40dfacdf7903ec92014`

## Validation

[Memory retrieval validation run 40308173225](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40308173225) **passed** on exact tested workflow head `c429bca441158bc68951a40dfacdf7903ec92014`.

- Tokenless query / candidate coverage regression passed.
- Current recall suppression of superseded records passed; archival history remains inspectable.
- Benchmark truth gate passed, including provenance, holdout leakage, abstention and promotion safeguards.
- Retrieval experiment passed determinism checks on seeds 13, 29 and 53; the synthetic candidate was **not promoted**.
- Semantic embedding retrieval passed with lexical fallback when the local model is unavailable.
- The retrieval path through live cognition passed; foreground work stayed bounded and fallback remained available.

## Separate unresolved blocker

The repository-wide runtime TypeScript check is currently not green because it reports multiple errors in unrelated existing modules (for example, `EmbodiedActionExecutor.ts`, `OrganismCore.ts`, `CognitiveEventFabric.ts`, and learning modules). The first workflow attempt exposed one error in this change (`Set.length`), which was corrected to `Set.size`. The focused workflow intentionally runs the actual retrieval tests without claiming that the entire runtime typecheck is clean. The broad typecheck debt remains an independent repair task.
