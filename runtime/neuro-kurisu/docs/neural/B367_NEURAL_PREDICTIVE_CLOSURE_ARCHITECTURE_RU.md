# B367 — Neural Predictive Closure

Статус: CURRENT
Дата: 2026-09-15
Тип: архитектурное развитие существующего B365, без создания параллельного neural policy owner.

## Цель

Замкнуть причинную цепь внутри единого нейронного ядра:

`experience → neural state → action-conditioned prediction → policy → outcome → prediction error → plasticity → future policy`

и одновременно связать её с уже существующим world model:

`world prediction → B365 predictive field → action → verified outcome → B365 forecast learning → later decision`.

## Что добавлено

### 1. Action-conditioned neural forecasts

Для каждого из 7 действий B365 теперь хранит:

- reward prediction;
- utility prediction;
- uncertainty;
- confidence;
- mean forecast error;
- sample count;
- temporal update tick;
- compact learned delta readout.

Это состояние является частью B365 persistence и не является отдельной policy system.

### 2. World-model transfer

Spine-only runtime один раз получает world prediction для всех действий и передаёт эти данные внутрь B365 через `actionContext`.

B365 вычисляет собственный predictive field и сравнивает его с внешним world prediction через `modelAgreement01`.

### 3. Counterfactual predictive field

B365 оценивает каждое действие относительно среднего прогнозного поля и формирует `counterfactualDivergence01`.

Предсказательный field реально участвует в вероятностном action readout. Удаление forecast subsystem меняет policy.

### 4. Outcome learning

После outcome B365 получает:

- reward;
- prediction error;
- verification/external evidence;
- predicted reward;
- predicted utility;
- actual utility;
- фактическое изменение world state;
- фактическую уверенность world outcome.

Из этого обновляются action-conditioned forecast heads, forecast readouts и recurrent synaptic state.

### 5. Persistence repair

Исправлена ошибка глубокого aliasing в `restore()`: вложенные neural area states теперь восстанавливаются через deep clone. Доказательство: restart comparison `L1 = 0` в B367 battery.

### 6. Forensic cleanup

Исторические дубликаты документации перенесены в `docs/history/FORENSIC_DEDUP_2026-09-15/` без переписывания их содержимого.

Long-line и whitespace нарушения исправлены.

## Causal evidence

B367 battery: 6 seeds, 360 learning cycles/seed.

Минимальные результаты:

- external predictive field L1: **1.604969**;
- learned forecast transfer L1: **0.014191**;
- forecast subsystem lesion L1: **0.006932**;
- restart drift: **0**;
- forecast samples: **51+ на action family в probe**;
- forecast confidence: около **0.933+**;
- forecast error: около **0.055–0.059**.

Старые regressions:

- B365 unified causal: PASS, minimum lesion L1 **0.043220**, minimum lesion/sham **5.43×**;
- B365 outcome transfer: PASS, minimum policy L1 **1.086810**;
- B366 neural action commitment: PASS;
- B351 developmental identity test: PASS, history effect **0.289825**, lesion-vs-normal **0.290279**.

## Что это НЕ доказывает

B367 не доказывает phenomenal consciousness.

B367 не доказывает физический Android sensorimotor loop: текущий device preflight выполняется в host environment, а Termux API пакеты отсутствуют.

B367 также не означает, что world model и B365 теперь одинаковы. Они остаются разными уровнями одной causal цепи: world model предлагает state-conditioned prediction, B365 преобразует его через собственную neural dynamics и outcome-trained predictive field.
