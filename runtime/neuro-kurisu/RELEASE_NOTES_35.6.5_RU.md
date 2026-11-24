# Neuro-Kurisu 35.6.5 — B352

## Что сделано
- Кирпич 2: Spine-only long-horizon runtime получил checkpoint cadence 64 cycles вместо 16.
- Добавлен воспроизводимый 1000-cycle mobile-profile benchmark с restart на 500-м цикле.
- Benchmark: 1000 cycles / 14.864 s / ~14.864 ms per cycle / 1 restart / 1000 B269 learning updates.
- Кирпич 3: B269 включён в canonical spine-only loop как action-conditioned neural predictor.
- Neural predictor не становится отдельным policy writer: его прогноз смешивается в B299 как neural credit.
- Добавлен persistent structural lesion API для причинных экспериментов; старый diagnostic lesion API оставлен обратимо восстанавливающимся.
- Добавлен causal SNN holdout с одинаковым train/history, B269 ON/OFF и action-distribution comparison.

## Что доказано
- B269 структурно поражается: 90% нейронов, 286/288 синапсов удаляются в контрольном эксперименте.
- B269 ablation меняет распределение конечных действий: L1 ≈ 0.075 на 80-cycle matched holdout.
- Статус: causally-active-moderate, но не объявлен как полностью закрытый high-strength neural gate.
- B269 реально тикает и получает outcome learning в SPINE_ONLY.

## Что не доказано
- физический Android/Termux endurance PASS на конкретном телефоне;
- 1000 циклов на физическом устройстве;
- полноценная compositional action-space;
- полноценный imagination planner;
- phenomenal consciousness.

## Принцип
Timeout остаётся OPEN, а causal neural effect не повышается искусственно только ради зелёного PASS.


## Дополнительная перепроверка B351
- DIT теперь использует matched baseline и усреднённую 7-action softmax distribution.
- Полное поражение B299 identity-owner channel (100%) дало L1 history effect 0.3372 и lesion residual 0.00037.
- Ablation drop = 99.89%; sham drop ≈ 0.09%.
- Частичные 80–95% lesions сохранены как исследовательские partial-lesion эксперименты, но не используются для закрытия гейта.
