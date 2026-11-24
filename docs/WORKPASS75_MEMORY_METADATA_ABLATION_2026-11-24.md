# WorkPass75 — paired bilingual memory metadata ablation

Date: 2026-11-24

Branch: `aspect/autonomy-verified-agency-outcome-loop-20261124-r2`

Pull request: [#1168](https://github.com/ailtron1ss-rgb/NK1/pull/1168)

## Question

Does the optional `MemoryOS2.metadataRecallEnabled` candidate-retrieval channel recover memories when key query terms are present in curated metadata (tags) but not in memory content, without breaking ordinary content-only recall?

This isolates one retrieval channel. It is **not** a whole-organism memory-on/off experiment.

## Protocol

- Frozen synthetic corpus: 16 labelled queries (8 English, 8 Russian), with one target and two lower-evidence decoys per query (48 rows).
- Paired arms use the same corpus, query, ranker, top-k, temporal coordinate, and row-order seed. Only `metadataRecallEnabled` changes.
- Five deterministic row-order permutations: 80 paired query comparisons per arm.
- Four metadata-dependent and four lexical-control queries per language.
- Metrics: Recall@5, Precision@1, MRR@5, nDCG@5, p50/p95 preview latency, and metadata-channel-only recoveries.
- The benchmark uses the existing read-only `previewRetrieveWithRankedChannels` API; it does not mutate canonical memory state.

The deterministic permutations test row-order stability. They are not five independent stochastic training seeds, and the constructed query labels are not blind human annotations.

## Exact CI result

Exact current-HEAD validation: [WorkPass75-76, run 45450829975](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45450829975), on PR HEAD 25bcb68a301c289b665e26ba5c86d00dfc292532.

Observed on the exact current-HEAD run:

| Metric | Metadata OFF | Metadata ON | Delta |
|---|---:|---:|---:|
| Recall@5 | 0.500 | 1.000 | +0.500 |
| Precision@1 | 0.500 | 0.600 | +0.100 |
| MRR@5 | 0.500 | 0.767 | +0.267 |
| nDCG@5 | 0.500 | 0.826 | +0.326 |
| Preview latency p50 | 4.57 ms | 4.93 ms | +0.35 ms |
| Preview latency p95 | 8.62 ms | 8.30 ms | -0.32 ms |

Language breakdown:
- English: Recall@5 0.50 → 1.00; Precision@1 0.50 → 0.50; MRR@5 0.50 → 0.70.
- Russian: Recall@5 0.50 → 1.00; Precision@1 0.50 → 0.70; MRR@5 0.50 → 0.833.

Control checks:
- Metadata-dependent gold memories recovered by metadata channel: 40/40 paired runs.
- Lexical controls recalled with metadata OFF: 40/40.
- Lexical controls recalled with metadata ON: 40/40.
- Existing retrieval candidate-coverage, numeric RU/EN query, WorkPass74 decision receipt, and memory-to-world causal regressions all passed in the same workflow.

## Interpretation and guardrails

The optional channel behaves as designed on this synthetic diagnostic: it increases recall for the constructed metadata-dependent cases while preserving the lexical control set. The observed median latency cost in this runner was approximately 0.47 ms; the p95 result is a single CI environment measurement, not a device performance guarantee.

This does **not** establish:
- independent retrieval uplift on a licensed, blinded, held-out RU/EN corpus;
- better recall of actual user memories or better downstream decisions;
- full-organism memory-on/off causal impact;
- 10k or 100k searchable-memory capacity;
- Android/device latency or long-duration memory stability.

Therefore `metadataRecallEnabled` remains opt-in. Promotion requires a separately governed holdout, frozen labels, leakage-resistant query/document splits, at least five genuinely independent paired runs, and p50/p95/p99 measurements on supported device profiles. The benchmark must not be used as evidence of consciousness or metaphysical free will.

## Files

- `runtime/neuro-kurisu/tests/memory-metadata-ablation-workpass75.mjs`
- `.github/workflows/nk1-memory-metadata-ablation-workpass75.yml`

Status: IMPLEMENTED / CONNECTED / TESTED on the WorkPass75 run snapshot; not independently proven, device verified, or released.

## WorkPass76 — hot-memory capacity profile boundary

Workflow: [NK1 memory retrieval ablation and capacity boundary WorkPass75-76, run 45449589858](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45449589858)

Implementation:
- MemoryOS2 now accepts an optional per-instance itemCap.
- The default remains **1,600**; accepted configuration is clamped to **128–10,000**.
- The restore scan ceiling remains **100,000 input rows**.
- Restore, encode-time capacity admission, maintenance, capacity diagnostics, and isolated preview clones use the same configured cap.
- This is a hot-memory capacity profile, not a cold durable tier or an increase to every NK1 subsystem.

Exact-run measurements:

| Profile / metric | Result |
|---|---:|
| Default cap | 1,600 |
| Default 10k-row restore retained | 1,600 |
| Default restore truncation | 8,400 |
| Default restore time | 327.66 ms |
| Default isolated preview | 222.74 ms |
| Explicit 10k profile accepted | 10,000 |
| Explicit 10k profile truncated | 0 |
| Explicit 10k restore time | 2,382.97 ms |
| Direct 10k retrieval p50 | 14.38 ms |
| Direct 10k retrieval p95 | 30.60 ms |
| Isolated 10k preview | 2,296.43 ms |
| 10k index integrity | PASS |

The direct retrieval latency is measured separately from the preview latency. The preview clones and restores a snapshot, rebuilding indexes; it is not a representative single-query latency measurement. All timings are from a GitHub-hosted Linux runner, not Android hardware.

The 10k profile survived restore, returned the high-retention target in 16 direct retrieval samples and the isolated preview, and passed index integrity. Maintenance then reduced the instance from 10,000 to the requested 9,000 rows (1,000 removals), while keeping index integrity true. The constructor clamp checks reported default 1,600, minimum 128, and maximum 10,000. The canonical runtime configuration regression passed for the default, explicit 10k value, upper/lower clamps, and invalid fallback. The mobile/default cap remains 1,600. A 10k configuration must not be promoted to a general runtime default until Android/device memory, latency, battery, and long-duration soak tests pass.

This result establishes a configurable in-process hot-memory test profile only. It does **not** establish:
- durable 10k/100k storage across process/device restarts outside the snapshot path tested here;
- a cold archive tier, paging, compaction, or streaming persistence;
- acceptable memory pressure on Android/mobile devices;
- 100k live searchable rows;
- production retrieval quality on an independent holdout.

Runtime connection:
- The canonical owner is MemorySubsystemRuntime.memoryOS; it now reads the host-only environment variable NEURO_MEMORY_ITEM_CAP when constructing that same MemoryOS2 instance.
- Absent, blank, or invalid values fall back to 1,600.
- The MemoryOS2 constructor clamps explicit values to 128–10,000.
- No second memory store is created and no persisted snapshot schema is changed.

WorkPass76 tests:
- runtime/neuro-kurisu/tests/memory-capacity-boundary-workpass76.mjs
- runtime/neuro-kurisu/tests/memory-runtime-capacity-config-workpass76.mjs

The runtime configuration test covers the default, explicit 10k profile, upper/lower clamps, and invalid-value fallback.

Status: IMPLEMENTED / CONNECTED / CI TESTED at 10k synthetic rows. Not Android/device verified, not cold-tier complete, not independently quality validated, and not released.