# B287 — Audit and Decision Log

1. Первый Core результат показал почти нулевое direct causal action effect. Это не было объявлено успехом.
2. Action readout был переведён на normalized cosine relation-specific decoder.
3. В Core добавлен bounded multiplier relationship bias 1.40 и goal bias 1.15.
4. Identity ablation переведён с одной точки last-action на worst-case action-bias comparison по набору действий.
5. После этих изменений Core всё ещё показывает небольшой, но ненулевой action-bias delta (~0.00510). Это честно сохраняется как limitation.
6. Standalone/hidden relation differentiation значительно сильнее Core, поэтому следующий developmental шаг должен переносить relation learning глубже в live organism dynamics, а не просто усиливать численный bias.

Решение: выпускать B287 как relationship-value developmental bridge, а не как самостоятельную social policy.
