# Neuro-Kurisu — Audit Recheck 35.6.15 / B363

## Статус
B363 завершает переход Brick 5 от трёхшагового к пятишаговому predictive planning.

## Что перепроверено
1. B362 5-seed Core causal selection сохранён и проходит после введения horizon configuration.
2. Пятишаговый planner работает на component-level 5/5 с real lesion/sham.
3. Persistence после restart сохраняет полный 5-step plan; обнаруженная обрезка restore до 3 была исправлена.
4. Real Core формирует 5-step plan в 5/5 независимых запусках.
5. Real Core ON/OFF/SHAM score-field causality проходит 5/5: minimum causal L1 ≈0.236726, minimum ratio ≈20×.
6. SHAM совпадает с OFF во всех 5 seed.

## Честная оценка
B363 доказывает functional predictive influence и persistent five-step imagination. Он не доказывает, что planner всегда определяет конечный action: downstream constitutional/governance layers сохраняют право изменить argmax.

## Progress 1–100
- B283 predictive planning component: 82/100.
- Core causal predictive selection: 68/100.
- Compositional execution branch: 76/100.
- Neural causal branch B269→policy: 72/100.
- Persistent developmental plasticity: 73/100.
- Real autonomous organism as a whole: **49/100**.
- Physical Android/Termux verification: **OPEN / не засчитано**.
- Phenomenal consciousness: **UNKNOWN / не оценивается как доказанная возможность**.

49/100 здесь означает долю заявленного функционального organism-goal, для которой уже есть реализованные и воспроизводимые runtime-доказательства; это не процент «готовности сознания».

## Следующий gate
Brick 6: long-horizon/device-life verification — 100→500→1000 cycles, restart, resource limits, а затем body/sensor causality. Нельзя считать автономный организм завершённым только на основании пятишагового планировщика.
