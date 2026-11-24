# B372 — Reality-Gated Neural Action Learning

## Цель
B372 закрывает причинный разрыв между сенсомоторным действием и изменением единого нейронного субстрата B365.

Раньше цикл уже умел:
`план восприятия → наблюдение → B365 → прогноз → действие → simulated outcome → learning`

Но физическое последствие Android-действия не имело отдельного строгого шлюза, который позволял бы именно физическому доказательству менять B365, а host-fallback ошибочно классифицировался в одном месте runtime как `device-observation`.

B372 переводит поток в две строго разделённые ветви:

`SIMULATION → simulated learning`

`REAL DEVICE + fresh + independent + executed → reality-gated neural learning`

Ни одна из ветвей не может скрытно подменить другую.

## Что добавлено

### 1. Reality Action Learning внутри B365
Новый механизм является частью существующего canonical neural substrate, а не отдельным decision-owner.

Он хранит:
- число наблюдений последствий;
- число verified-обновлений;
- число отвергнутых непроверенных наблюдений;
- среднюю ошибку последствия;
- среднюю доказанность;
- последнюю связку action → consequence;
- per-action statistics.

Verified physical consequence изменяет `actionReadout` и `forecastReadout` B365, поэтому опыт способен менять будущую policy.

### 2. Жёсткий физический evidence gate
Neural update разрешён только при одновременном выполнении:
- `verified01 >= 0.99`;
- `independent01 >= 0.99`;
- источник ровно `android-termux`.

В противном случае состояние обучения не меняет canonical neural readout.

### 3. Исправление evidence boundary
Host fallback теперь записывается как `derived / host-resource-sample-derived`.
Только свежий `android-termux` sample может получить `device-observation`.

Это исправляет обнаруженный в recheck B371 разрыв, где один runtime ledger entry безусловно назывался `device-observation` даже для host fallback.

### 4. Causal future-policy test
Для одинакового входа сравнивается future policy:
- SHAM/host: физический update отсутствует;
- ON/verified: B365 изменён;
- затем выполняется новый neural tick в том же контексте.

Таким образом проверяется не только `state mutated`, но и влияние изменения на будущую policy.

### 5. Persistence
Весь `realityActionLearning` входит в B365 snapshot и восстанавливается после restart/restore.

### 6. Release contract
В package scripts зарегистрирован B371 performance test, который ранее существовал как файл, но не имел npm-команды.
Добавлен также B372 test script.

## Почему это не декорация
Механизм имеет наблюдаемую causal chain:

`physical proof → B365 readout update → future policy divergence`

Имеется SHAM-контроль, ON-эксперимент, persistence и runtime host-boundary regression.

## Доказательство
B372 test:
- 16 host/unverified samples → 0 neural policy mutation;
- 32 verified Android samples → 1152 readout update operations;
- policy L1 divergence на будущем tick: 0.08993791;
- persisted state после restore: PASS;
- host evidence promotion: FALSE;
- explicitly verified device evidence promotion: TRUE.

## Ограничение
Физический Android сейчас не сертифицирован в среде разработки. Поэтому успешный тест `android-termux` является контролируемым causal fixture, а не утверждением, что реальный телефон был измерен.
Физическая метрика Android остаётся ограниченной до запуска на устройстве пользователя.
