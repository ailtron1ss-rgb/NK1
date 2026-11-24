# B372 — FINAL VERIFICATION

Дата: 2026-09-15
Релиз: 35.6.22

## Изменение
Reality-gated neural action learning + исправление host/device evidence boundary + release-script contract.

## Проверки

| Проверка | Результат |
|---|---|
| Typecheck | PASS |
| B372 causal reality gate | PASS |
| B371 active perception regression | PASS |
| B371 performance | PASS |
| Restart persistence | PASS |
| Core ownership | PASS |
| Architecture | PASS |

## B372 causal evidence

SHAM / host:
- rejectedUnverified = 16
- neural actionReadout delta = 0

ON / verified:
- accepted = 32
- update calls = 1152
- policy delta before/after = 0.65119347
- future policy L1 = 0.08993791
- verifiedUpdates = 32

Persistence:
- realityActionLearning deep-equal after restore = PASS

Reality boundary:
- host promotion = FALSE
- explicit device promotion = TRUE

Runtime host regression:
- no `device-resource-sample` was emitted for host fallback
- `host-resource-sample-derived` was emitted
- unverified embodied consequence was rejected by neural physical-learning gate

## Performance
B371 regression test after B372:
- 120 cycles
- p50 = 1.513 ms
- p95 = 4.349 ms
- p99 = 5.226 ms
- max = 7.875 ms

## Test-runner caveat
`test:smoke` reaches `CLEAN_ORGANISM_SMOKE=PASS`, but the process does not terminate cleanly under this environment. Поэтому этот тест не засчитывается как полностью закрытый release criterion; проблему lifecycle runner нужно вынести в отдельный fix, не подменяя её PASS.

## Scientific status

Functional consciousness: UNKNOWN.
Phenomenal consciousness: UNKNOWN.

Physical Android readiness is not promoted by this release. A local development environment cannot substitute for device evidence.
