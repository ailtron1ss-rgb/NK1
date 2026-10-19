# B307 Release Notes
Дата: 13.09.2026

B307 — Verified Policy Closure.

Главное изменение: существующий AdaptivePolicyEngine получил отдельную verified/independent outcome branch.

Новые поля action/context row:
- verifiedValue
- verifiedUpdates

Новые методы:
- observeVerifiedOutcome(...)
- verifiedClosure(...)

Старые сохранения backward-compatible: rows без новых полей нормализуются из старого value.

Проверено:
- B307 unit + core integration + restart
- B306 regression
- B305 regression
- B298 regression
- full static gates

B307 не создаёт второй policy engine.
