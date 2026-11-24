# B378 — Physical Action Consequence Gate

Дата: 2026-09-15
Релиз: 35.6.28
Фаза: Stage-27/SCS-DIT/brick-13-physical-action-consequence-gate

## Что изменено
B378 не создаёт новый decision owner и не добавляет параллельный мозг. Изменение сделано в существующем `EmbodiedActionExecutor`, который получает действие уже после выбора канонического B365/OrganismRuntime.

Главное изменение — строгое разделение четырёх состояний доказательства:

1. `device-observation` — свежая независимая Android/Termux телеметрия после исполняемого observation-действия.
2. `device-actuation` — реальная команда устройству успешно выполнена, но её внешний эффект независимо не доказан.
3. `derived` — локальный/симуляционный переход или отсутствие физического доказательства.
4. `external-observation` — внешний наблюдательный источник, когда он используется.

TTS (`respond`) больше не может получить `consequenceVerification.verified=true` только из-за того, что после команды удалось снова прочитать датчики. Это принципиальный causal/evidence firewall.

## Причинная цепочка после B378
`B365 decision → EmbodiedActionExecutor → live Termux command/observation → independent post-action sample → verificationMode → realityEvidence → B365 embodied consequence learning`

Для observation-действий свежая независимая физическая выборка может быть верифицированным outcome.
Для actuator-команд вроде TTS фиксируется только receipt/actuation execution; без независимого внешнего измерителя effect не продвигается как verified physical consequence.

## Что намеренно НЕ заявляется
- физический Android/Termux в текущей среде не сертифицирован;
- TTS не объявляется независимо доказанным акустическим эффектом;
- `rest` не объявляется физическим воздействием на телефон;
- phenomenal consciousness не выводится из этого механизма.

## Сохранена архитектурная дисциплина
Канонический neural substrate остаётся B365 (96 нейронов / 4 области), а B372 reality gate остаётся фильтром обучения. B378 усиливает границу между исполнением действия и доказанным outcome, не создавая второго decision maker.
