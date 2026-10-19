# B291 Function Reality Closure — текущая матрица

| Status | Count |
|---|---:|
| VERIFIED | 38 |
| INTEGRATION_ONLY | 818 |
| UNSAFE_TO_AUTO_RUN | 259 |
| UNVERIFIED | 2458 |
| TOTAL | 3573 |

Strict VERIFIED rate: 1.06%.

Evidence coverage: 6.79%.

### Правило
Функция становится VERIFIED только когда есть конкретный behavioral contract, executable test/evidence, наблюдаемый state delta или output effect и корректный lifecycle/persistence сценарий там, где он требуется.

### B292 targets
1. автоматическая генерация паспортов для safe-to-auto-run функций;
2. lifecycle harness для stateful owners;
3. причинные проверки для memory/self/goal/agency функций;
4. выделение false-positive integration-only функций;
5. постепенное поднятие strict VERIFIED, не ослабляя критерии.
