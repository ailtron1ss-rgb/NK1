# P2854 — Design rationale

## Архитектурная идея

P2853 уже имел context-conditioned slow memory. P2854 добавляет второй, более медленный уровень — schema prototypes. Context representation обучается быстрее, schema representation медленнее и используется как устойчивый общий prior. Transfer принимается только при совместимости текущего context trace и schema prototype.

## Behavioral credit

P2854 добавляет отдельный компактный context/schema action trace. Он получает bounded advantage `(reward - 0.5)` для выбранного действия и слабое противоположное обновление для остальных действий. Это позволяет проверять, появляется ли реальное поведенческое удержание, а не только изменение prediction weights.

## Mobile constraint

Иерархическая память имеет фиксированный размер: 8 context slots × 16 dimensions, 4 schema slots × 16 dimensions, affinity 8×4 и два компактных action tables 8×7 + 4×7. Она не зависит от длины истории и поэтому подходит как low-overhead long-memory layer для on-device execution.

## Falsification criteria

P2854 benchmark специально оставляет случаи, в которых replay или slow hierarchy могут ухудшать unseen holdout. Это намеренная проверка отрицательного transfer, а не только поиск положительных результатов.
