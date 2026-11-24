# V144 Next Frontier Plan

## Execution + Language Scaling
1. Add trainable sequence path for language bridge without recreating state per token.
2. Reuse chunk plans across trunk and FwPKM bridge.
3. Benchmark step vs chunk vs full sequence.
4. Train FwPKM bridge on real text with the same next-byte objective.
5. Compare baseline / canonical memory / FwPKM on matched 1K/4K/16K windows.
6. Add revision-interference-replay task at byte level.
7. Add external corpus adapter without bundling datasets.
8. Measure language quality delta, memory recall, state bytes, latency.
9. Promote only with multi-seed positive evidence and no regression.
10. Otherwise retain as candidate or delete.
