# NK1 Memory Retrieval Performance — 2026-10-24

## Status

Two paired performance runs completed successfully on the same Ubuntu 24.04 GitHub-hosted runner class with Node.js v24.21.0:

- [Run 1 — 40126730431](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40126730431), candidate commit `56a15ddc50b012fe7114461d13b0f06e1f81a910`.
- [Run 2 — 40126825696](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40126825696), candidate commit `42b496bcc290a03f2222b73c99a8e4daecc46fda`.
- Baseline for both: `19f64b1ae985e579795b4ef054fd3fb58259a336` (parent immediately before the optimization edits).
- Retrieval parity: all recorded top-five IDs matched for every query at all three corpus sizes; both baseline and candidate reported consistent indexes.
- Candidate cache: up to 512 token sets plus 512 term-frequency maps.

The benchmark uses a deterministic synthetic bilingual corpus, not production traces. Each run measures 100 mixed queries after 16 warm-ups and 50 repetitions of a single query after 8 warm-ups, for each corpus size. The two runs vary visibly in absolute latency due to runner noise; the percentage improvements below are shown as a range across both runs, not a statistical confidence interval.

## Mixed query workload

p50/p95 are milliseconds. Throughput is inverse mean latency.

| Memories | Run 1 baseline → candidate p50 / p95 | Run 2 baseline → candidate p50 / p95 | p95 improvement across runs | Throughput improvement |
|---:|---:|---:|---:|---:|
| 256 | 4.461 / 8.729 → 2.728 / 7.195 ms | 5.658 / 11.690 → 3.721 / 9.926 ms | 15.09–17.57% | +36.17–44.97% |
| 800 | 5.917 / 9.991 → 4.503 / 8.778 ms | 6.956 / 13.770 → 5.795 / 13.392 ms | 2.75–12.14% | +20.91–28.84% |
| 1,600 | 7.027 / 10.592 → 5.481 / 9.769 ms | 8.741 / 14.440 → 7.299 / 13.407 ms | 7.15–7.77% | +15.92–20.35% |

## Repeated identical query

This is a warm-cache case and should not be generalized to a varied production workload.

| Memories | Run 1 baseline → candidate p50 / p95 | Run 2 baseline → candidate p50 / p95 | p95 improvement across runs | Throughput improvement |
|---:|---:|---:|---:|---:|
| 256 | 3.349 / 3.578 → 1.883 / 2.134 ms | 4.258 / 5.905 → 2.449 / 3.969 ms | 32.79–40.35% | +70.44–75.90% |
| 800 | 4.273 / 6.668 → 2.742 / 2.904 ms | 5.175 / 7.480 → 3.565 / 3.950 ms | 47.20–56.45% | +43.52–55.95% |
| 1,600 | 5.442 / 7.383 → 3.870 / 6.559 ms | 6.711 / 11.646 → 5.042 / 7.696 ms | 11.17–33.92% | +36.25–38.07% |

## Memory observations

Run 2 reports absolute post-GC heap usage after each workload:

| Memories | Baseline heap after | Candidate heap after | Candidate delta | Candidate change |
|---:|---:|---:|---:|---:|
| 256 | 12.35 MB | 12.70 MB | +351,728 bytes | +2.85% |
| 800 | 15.83 MB | 16.44 MB | +602,656 bytes | +3.81% |
| 1,600 | 19.87 MB | 20.59 MB | +715,512 bytes | +3.60% |

The post-GC RSS difference in run 2 was -2.57% at 256 records, +1.26% at 800, and +4.19% at 1,600. Process RSS is noisy and is not a peak-memory measurement. The absolute heap result is more useful here: the candidate retains roughly 0.35–0.72 MB more after the tested workload, alongside the measured latency reduction.

## Interpretation and limits

1. In both runs, p50 and p95 improved for all three corpus sizes and both query patterns. The mixed-query p95 improvement was smaller at the largest corpus and varied on the 800-memory corpus, so larger real-world workloads still need profiling.
2. All recorded top-five IDs remained identical across baseline and candidate; this change did not alter the tested ranking results.
3. These results measure this retrieval code path only. They do not establish a global Neuro Kurisu speedup, production SLO, lower peak RAM, or better retrieval recall.
4. The independent retrieval-quality benchmark still reports `recallDelta=0` and remains `not-promoted` because the synthetic fixture does not contain enough unanswerable holdout evidence. No retrieval-quality uplift is claimed.
5. The extra retained heap is a known cost of the bounded term-frequency cache. Any broader rollout still requires representative user traces, more repeated runs, and independent labelled holdout evaluation.

## Reproduction

- Benchmark: `runtime/neuro-kurisu/tests/memory-retrieval-performance-benchmark.mjs`
- Comparator: `runtime/neuro-kurisu/tests/compare-memory-retrieval-performance.mjs`
- Workflow: `.github/workflows/optimization-smoke.yml`

The workflow checks out the exact baseline commit and candidate on the same runner, runs the targeted regression suite, then measures and compares 256 / 800 / 1,600-memory corpora.
