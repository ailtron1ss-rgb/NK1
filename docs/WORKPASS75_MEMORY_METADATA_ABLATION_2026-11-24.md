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

Workflow: [NK1 paired memory metadata ablation WorkPass75](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45447664888)

Observed on the WorkPass75 run's code snapshot:

| Metric | Metadata OFF | Metadata ON | Delta |
|---|---:|---:|---:|
| Recall@5 | 0.500 | 1.000 | +0.500 |
| Precision@1 | 0.500 | 0.600 | +0.100 |
| MRR@5 | 0.500 | 0.767 | +0.267 |
| nDCG@5 | 0.500 | 0.826 | +0.326 |
| Preview latency p50 | 3.52 ms | 3.99 ms | +0.47 ms |
| Preview latency p95 | 7.11 ms | 6.13 ms | -0.98 ms |

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
