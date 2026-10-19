# BIG PASS 172 — Реальный статус функций

Всего function-like деклараций: **2471**

| Статус | Количество |
|---|---:|
| VERIFIED | 18 |
| INTEGRATION_ONLY | 578 |
| UNSAFE_TO_AUTO_RUN | 214 |
| UNVERIFIED | 1661 |

Safe parameterized probe: **478/509 PASS**, failures=0.

> UNVERIFIED не превращается в PASS из-за наличия кода. UNSAFE_TO_AUTO_RUN также не считается рабочим доказанно без специальной сертификации.

Критический backlog (memory/self/world/learning): **945**.

UNVERIFIED без статических ссылок: **153**.
Из них в первые 400 входят наиболее критичные кандидаты.
