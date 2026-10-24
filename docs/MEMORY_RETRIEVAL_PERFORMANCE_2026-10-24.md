# NK1 Memory Retrieval Performance — 2026-10-24

## Status

The first paired performance run completed successfully in [GitHub Actions run 40126730431](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40126730431). It compared the same deterministic synthetic corpus and query sequence on one Ubuntu 24.04 hosted runner using Node.js v24.21.0.

- Baseline: `19f64b1ae985e579795b4ef054fd3fb58259a336` (pre-optimization parent).
- Candidate: `56a15ddc50b012fe7114461d13b0f06e1f81a910`.
- Candidate cache: up to 512 token sets plus 512 term-frequency maps.
- Retrieval parity: all recorded top-five IDs matched for every query at all three corpus sizes; both baseline and candidate reported consistent indexes.
- This is a synthetic microbenchmark, not a production workload, and this result is one runner execution rather than a multi-run confidence interval.

## Mixed query workload

Each size uses 100 measured mixed queries after 16 warm-up queries. p50/p95 are milliseconds; throughput is inverse mean latency.

| Memories | Baseline p50 / p95 | Candidate p50 / p95 | p50 change | p95 change | Throughput change |
|---:|---:|---:|---:|---:|---:|
| 256 | 4.461 / 8.729 ms | 2.728 / 7.195 ms | -38.86% | -17.57% | +44.97% |
| 800 | 5.917 / 9.991 ms | 4.503 / 8.778 ms | -23.90% | -12.14% | +28.84% |
| 1,600 | 7.027 / 10.592 ms | 5.481 / 9.769 ms | -22.00% | -7.77% | +20.35% |

## Repeated identical query

Each size uses 50 measured repetitions after 8 warm-up repetitions. This is a warm-cache case and should not be generalized to a varied production workload.

| Memories | Baseline p50 / p95 | Candidate p50 / p95 | p50 change | p95 change | Throughput change |
|---:|---:|---:|---:|---:|---:|
| 256 | 3.349 / 3.578 ms | 1.883 / 2.134 ms | -43.77% | -40.35% | +75.90% |
| 800 | 4.273 / 6.668 ms | 2.742 / 2.904 ms | -35.83% | -56.45% | +55.95% |
| 1,600 | 5.442 / 7.383 ms | 3.870 / 6.559 ms | -28.88% | -11.17% | +36.25% |

## Memory observations

The first run reported heap growth during the timed workload of approximately 933 KB baseline vs 940 KB candidate at 256 records, 395 KB vs 427 KB at 800, and 345 KB vs 376 KB at 1,600. This is *growth during the benchmark*, not absolute retained heap. The RSS deltas varied sharply between processes and are not suitable as a peak-memory comparison; the follow-up run adds absolute post-GC heap/RSS values to the comparison output.

The frequency cache is bounded at 512 entries and follows the token-cache eviction policy. The additional retained maps are a real trade-off, so latency and memory must be reviewed together.

## Interpretation and limits

1. The first paired run supports a performance benefit for the tested memory-retrieval path: p95 improved in every mixed and repeated workload tested, with identical top-five results.
2. The measured p95 benefit for mixed queries decreases at the 1,600-item corpus size (about 7.8% in this run), so cache misses still cost time as the corpus grows.
3. The result does not establish a global Neuro Kurisu speedup, production SLO, lower peak RAM, or better recall. It only measures this synthetic retrieval workload.
4. The independent retrieval benchmark remains non-promoted: `recallDelta=0` and the fixture correctly fails the sufficient-unanswerable-holdout gate. No retrieval-quality uplift is claimed.
5. Promotion still requires repeated runs on representative workloads, comparable absolute memory metrics, and regression checks against real labelled holdout queries.

## Reproduction

The benchmark and comparator are in:

- `runtime/neuro-kurisu/tests/memory-retrieval-performance-benchmark.mjs`
- `runtime/neuro-kurisu/tests/compare-memory-retrieval-performance.mjs`
- `.github/workflows/optimization-smoke.yml`

The workflow checks out the exact baseline commit and candidate on the same runner, runs the seven targeted regression checks, records p50/p95 and throughput for 256/800/1,600 memories, then compares top-five ranking parity.
