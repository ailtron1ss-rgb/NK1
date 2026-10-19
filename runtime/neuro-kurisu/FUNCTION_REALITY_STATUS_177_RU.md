# BIG PASS 177 — Реальный статус функций

Всего function-like declarations в semantic inventory: **2489**.

| Статус | Количество |
|---|---:|
| VERIFIED | 24 |
| INTEGRATION_ONLY | 594 |
| UNSAFE_TO_AUTO_RUN | 224 |
| UNVERIFIED | 1647 |

Строгий VERIFIED rate: **0.96%**.

Безопасный parameterized probe: **497/509 PASS**, **0 FAIL**, **0 input synthesis needed**, **12 lifecycle-needed**.

Правило неизменно: declaration, наличие export, static reference или имя теста не дают VERIFIED без поведенческого доказательства. Для VERIFIED требуется direct + regression + persistence/replay evidence.
