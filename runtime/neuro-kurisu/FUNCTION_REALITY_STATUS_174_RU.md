# BIG PASS 174 — Реальный статус функций

Всего function-like деклараций: **2477**

| Статус | Количество |
|---|---:|
| VERIFIED | 18 |
| INTEGRATION_ONLY | 594 |
| UNSAFE_TO_AUTO_RUN | 214 |
| UNVERIFIED | 1651 |

Safe parameterized probe: **497/509 PASS**, failures=0.

> UNVERIFIED не превращается в PASS из-за наличия кода. UNSAFE_TO_AUTO_RUN также не считается рабочим доказанно без специальной сертификации.

Критический backlog (memory/self/world/learning): **940**.

UNVERIFIED без статических ссылок: **154**.
Из них в первые 400 входят наиболее критичные кандидаты.
