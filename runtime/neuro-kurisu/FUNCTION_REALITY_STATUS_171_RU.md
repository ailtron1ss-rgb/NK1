# BIG PASS 171 — Реальный статус функций

Всего function-like деклараций: **2467**

| Статус | Количество |
|---|---:|
| VERIFIED | 18 |
| INTEGRATION_ONLY | 577 |
| UNSAFE_TO_AUTO_RUN | 214 |
| UNVERIFIED | 1658 |

Safe parameterized probe: **477/508 PASS**, failures=0.

> UNVERIFIED не превращается в PASS из-за наличия кода. UNSAFE_TO_AUTO_RUN также не считается рабочим доказанно без специальной сертификации.

Критический backlog (memory/self/world/learning): **945**.

UNVERIFIED без статических ссылок: **152**.
Из них в первые 400 входят наиболее критичные кандидаты.
