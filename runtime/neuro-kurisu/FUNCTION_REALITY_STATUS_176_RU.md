# BIG PASS 176 — Реальный статус функций

Всего function-like деклараций: **2485**

| Статус | Количество |
|---|---:|
| VERIFIED | 24 |
| INTEGRATION_ONLY | 594 |
| UNSAFE_TO_AUTO_RUN | 214 |
| UNVERIFIED | 1653 |

Safe parameterized probe: **497/509 PASS**, failures=0.

> UNVERIFIED не превращается в PASS из-за наличия кода. UNSAFE_TO_AUTO_RUN также не считается рабочим доказанно без специальной сертификации.

Критический backlog (memory/self/world/learning): **942**.

UNVERIFIED без статических ссылок: **156**.
Из них в первые 400 входят наиболее критичные кандидаты.
