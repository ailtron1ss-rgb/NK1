# Release Notes B326 — Recovery Causal Influence

B326 связывает recovery continuity с canonical action arbitration.

Изменения:
- новый `AdaptivePolicyEngine.recoveryBias()`;
- recovery-aware policy signal добавлен в `OrganismCore`;
- добавлен `recoveryPolicyDiagnostics()`;
- добавлен release test `tests/big-pass-326-recovery-causal-influence.mjs`;
- добавлен npm script `test:big-pass-326-recovery-causal-influence`.

Verification:
- B324 PASS
- B325 PASS
- B326 PASS

Ключевой результат: после восстановления `explore` получает отрицательное recovery-влияние, `verify/rest/reflect` положительное; после 12 циклов интеграции величина эффекта уменьшается.
