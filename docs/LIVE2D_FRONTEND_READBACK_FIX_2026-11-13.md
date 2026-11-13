# Live2D frontend acknowledgement and runtime alignment — 2026-11-13

## Что было неисправно

Главная страница монтирует `app/public/live2d/viewer.html`, а `AvatarStage` уже ожидает от iframe частичный `live2d_intent_ack`. До этого ACK/readback реализован был только в отдельной копии `runtime/neuro-kurisu/public/live2d/viewer.html`. Поэтому проверка runtime-копии проходила, но реальный UI-viewer не отправлял ожидаемое подтверждение применения параметров.

Дополнительно frontend-viewer запоминал выражение и motion key до подтверждения успешного старта. Ошибка или отказ провайдера могли зафиксировать неуспешное действие как уже выполненное и блокировать повторную попытку.

## Что изменено

- Добавлен revision-bound partial ACK в реально монтируемый frontend viewer.
- Readback шести Cubism-параметров выполняется из `beforeModelUpdate` после применения overrides.
- Статусы выражения и движения агрегируются вместе с readback. ACK ждёт разрешения асинхронных действий и относится только к актуальной версии intent.
- ACK явно содержит `complete:false` и `visualCompletionVerified:false`: прочитанные параметры и старт команды не выдаются за подтверждение кадра на экране.
- Expression cache обновляется только после успешного `model.expression()`; ошибка остаётся повторяемой.
- Motion deduplication key освобождается после отказа или ошибки только если за это время его не сменил более новый intent.
- Regression test теперь проверяет обе viewer-копии и отдельно доказывает, что `AvatarStage` монтирует frontend viewer.
- В CI добавлены проверки целостности canonical Live2D model assets и фактического frontend expression cache.

## Контракт доказательств

`parameters-observed` означает только, что Cubism вернул конечные значения перечисленных параметров после setters. `accepted-unverified` означает, что readback недоступен, хотя intent был принят обработчиком. `started` означает, что API действия вернуло успешный старт. Ни один из статусов не доказывает GPU presentation, фактическую артикуляцию или точность lip-sync.

Browser SpeechSynthesis в текущем UI по-прежнему выдаёт grapheme/boundary-based приближение. Это не акустические фонемы и не синхронизация с PCM. Для проверки drift/jitter необходимы browser/device E2E и реальные RU/EN аудиосессии.

## Что проверяет CI

- Обе viewer-копии имеют revision-bound ACK/readback контракт.
- `AvatarStage` использует viewer, для которого выполняются проверки.
- Expression/motion failures не навсегда занимают cache/dedup key.
- Модельные JSON, локальные ссылки, мобильная и quality текстуры, expressions и motions проходят existing Live2D integrity check.
- Frontend expression transition cache запускается явно в workflow WorkPass71.

## Что остаётся вне подтверждённого состояния

Нужны реальный browser/WebGL test с сохранением скриншота или кадра и Android device soak; RU/EN audio latency/jitter measurements; проверка поведения при background/visibility, iframe reload, low-memory devices и потере ресурсов. До этого Live2D runtime может быть source-level/CI-проверенным, но не объявляется полностью подтверждённым на физическом устройстве.
