# V94 — Neural Regulation / Regeneration

## Реальная работа

- Добавлен opt-in NeuralLifecycleController для одного canonical hidden-unit bank.
- Реализованы online EMA activity/contribution/silence, maturity, replacement credit и редкое partial rejuvenation.
- При rejuvenation сбрасываются соответствующие Adam/AdamW moment slices.
- Добавлена opt-in bounded homeostatic gain с медленной non-gradient регуляцией.
- Все per-unit lifecycle/homeostatic buffers принадлежат recurrent spine и сериализуются один раз.
- Current defaults остаются выключенными: механизм является CANDIDATE, а не автоматически promoted feature.

## Evidence

Короткие прогоны показали почти нулевой эффект; один более длинный seed показал отрицательную динамику. Поэтому promotion отклонён.

## Process rule

Новые механизмы не попадают в current автоматически. Они проходят DISCOVER → BUILD → QUALIFY → PROMOTE/REJECT.
