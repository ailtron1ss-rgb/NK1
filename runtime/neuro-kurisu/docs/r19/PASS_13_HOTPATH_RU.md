# PASS 13 — R19 Hot Path Measurement

## Baseline → result

| Metric | До PASS 13 | После PASS 13 | Изменение |
|---|---:|---:|---:|
| R19 wall time | 33.23 s | 23.57 s | ~−29.0% |
| max RSS | 517,576 kB | 502,284 kB | ~−3.0% |
| first cycle | 105.99 ms | 68.45 ms | ~−35.4% |
| last cycle | 129.75 ms | 95.40 ms | ~−26.5% |
| structuredClone / first 64 cycles | ~73,295 | ~40,938 | ~−44.2% |

## Gate

`test:p2895:long-horizon`:

- cycles=256
- restartedTick=257
- pass=true

## Interpretation

Wall-time improvement is substantial. RSS improvement is real but smaller, so this pass did not prove full residency closure. The next work must focus on retained objects, allocator fragmentation, EventLog retention, graph upserts and remaining first-cycle snapshots.

R19 is now a true direct PASS; the aggregate `release:r19:core` command is not used as the sole verdict because its total orchestration window exceeded the current execution budget.
