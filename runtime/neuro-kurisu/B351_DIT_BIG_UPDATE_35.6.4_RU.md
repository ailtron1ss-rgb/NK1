# B351 — SCS-DIT / Causal Identity Gate

## Что изменено
35.6.4 — первый проход, который не добавляет ещё одного независимого brain module. Вместо этого включён режим `SPINE_ONLY` и проверена одна причинная цепь.

## 1. SPINE_ONLY
`OrganismCore` получил явный `spineOnly` режим и поддержку `KURISU_SPINE_ONLY=1`.

В режиме разрешены только:
- B299 learned identity;
- world-model prediction;
- homeostatic pressure;
- constitutional safety veto.

Остальные policy writers не получают права менять action distribution в этом режиме.

### Простыми словами
Вместо 25+ советчиков и сотен полей организм временно принимает решение через одну узкую проверяемую ветвь.

## 2. Cheap spine cycle
Полный `OrganismCore` в старом пути слишком дорог для длинного телефона-ориентированного эксперимента. Для spine-only вынесен ранний живой цикл, который повторно использует существующие state, B299, world model, homeostasis, constitutional layer и persistence.

Измерение host mobile-profile:
- прежний ориентир полного тика: ~648 ms;
- spine-only ориентир: ~18.8 ms.

Это не реальный Android benchmark; физическое устройство ещё требуется проверить.

## 3. Настоящий DIT
Прогон:
- 64 endogenous training cycles;
- 40 unseen holdout cycles;
- restart from snapshot;
- B299 lesion 80%;
- sham perturbation;
- action-distribution measurement.

### Последний PASS
- endogenous learning updates: 64;
- history effect L1: **0.55**;
- lesion residual L1: **0.15**;
- sham residual L1: **0.55**;
- ablation drop: **0.7273**;
- sham drop: **0**;
- lesion stronger than sham: PASS.

### Interpretation
Baseline и trained организм дают разные распределения действий. После реального B299 lesion большая часть этой разницы исчезает. Малое равномерное sham-возмущение такого эффекта не создаёт.

Это является доказательством causal identity influence **в контролируемом SPINE_ONLY environment**.

Это НЕ является доказательством:
- открытого action space;
- causal influence B269 SNN;
- long-horizon autonomy на телефоне;
- consciousness;
- поведения в реальном физическом мире.

## 4. Исправленная семантика lesion
B299 `predictOutcome()` теперь учитывает lesion scale. Это нужно потому, что старое обнуление `actionBias` оставляло predictive/history signal активным и не являлось настоящим поражением identity source.

## 5. Performance / Brick 2 checkpoint

120 последовательных `SPINE_ONLY` cycles на host mobile-profile:
- total: **3.588 s**;
- **29.9 ms/cycle**;
- процесс ~**170 MiB RSS**;
- `learningUpdates=120`.

Это заметный прогресс для long-horizon исследования, но это всё ещё host measurement, а не физический Android/Termux benchmark.

## 6. Проверка честности
Не считать полный regression suite PASS: часть тяжёлых aggregate-команд упирается в timeout. Завершённые targeted проверки являются доказательствами только тех свойств, которые они реально проверяют.
