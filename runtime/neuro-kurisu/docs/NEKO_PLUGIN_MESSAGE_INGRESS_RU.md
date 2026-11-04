# N.E.K.O. push_message.v2 → NK1: вход когнитивных сообщений

Статус: host-composable ingress в отдельной aspect-ветке/PR #805; live transport listener, plugin discovery и production presentation provider пока не подключены.

## Источник контракта

Адаптация основана на plugin/sdk/shared/core/push_message_schema.py, plugin/core/context.py и plugin/server/messaging/proactive_bridge.py из загруженного N.E.K.O. SDK. Его штатный канал plugin → host — ctx.push_message; ctx.bus остаётся read/watch API и не получает несуществующего emit/publish.

Канонический wire envelope несёт type=MESSAGE_PUSH, schema=push_message.v2, host-stamped plugin_id и message_id, visibility, ai_behavior и упорядоченный parts. SDK также добавляет legacy-поля для совместимости; ingress их игнорирует и использует только v2-поля.

## Поведение двух независимых осей

| N.E.K.O. значение | NK1 обработка | Прямой показ |
|---|---|---|
| ai_behavior=respond | Вход через OrganismRuntime.step; обычная генерация ответа разрешена | Только если visibility содержит chat или hud |
| ai_behavior=read | Вход через тот же cognitive runtime, но с suppressResponse=true | Только по независимому visibility |
| ai_behavior=blind | Не вызывается cognitive runtime и LLM | Только по независимому visibility |

visibility=[] означает, что исходные parts не показываются пользователю; это не меняет AI-поведение.

## Граница доверия

- Хост передаёт аутентифицированную пару {pluginId, messageId} отдельно от payload. Значения plugin_id/message_id внутри wire envelope обязаны совпасть с transport identity.
- Плагин должен входить в host allowlist и пройти authorize. Разрешения не выводятся из source, metadata, priority или содержимого сообщения.
- Текст плагина поступает как наблюдение с provenance neko-plugin:<pluginId> и externalMessageId. Политика evidence-only запрещает автоматически превращать сообщение в externalGoal.
- target_lanlan, в том числе legacy metadata.target_lanlan, запрещён: плагин не может переключать persona/session.
- Proxies, getters/setters, экзотические объекты, циклы, разреженные массивы, небезопасные ключи и payload за пределом лимитов отклоняются.
- В первой версии разрешены только parts:[{type:text,text:...}]. Image/audio/video/html-card/ui_action возвращают явный unsupported-part; ничего не отбрасывается молча.
- message_id обеспечивает bounded dedupe (256 последних завершённых попыток по умолчанию). `snapshot()` экспортирует versioned receipt checkpoint; `restore()` восстанавливает его до начала приёма сообщений, только для plugin IDs из текущего allowlist. Snapshot содержит fingerprint и terminal result, копирует вложенные visibility-массивы и отклоняет malformed/hostile/не canonical SHA-256 записи.
- In-flight операции не сериализуются. Restore при наличии in-flight работы возвращает 0 и не заменяет состояние. Конфликтующие дубликаты receipt в checkpoint исключаются.
- Это host persistence seam, не самостоятельное durable-хранилище: host должен сохранить результат `snapshot()` в своём существующем durable store и вызвать `restore()` до открытия входящего канала. Без этого после рестарта exactly-once не обещается.

## Реальный путь исполнения

PluginMessageIngress.handle → authorize → normalize → dedupe → OrganismRuntime.step → OrganismCore.observe → perception/memory/CEF

OrganismRuntime.step сохраняет свой сериализованный runtime queue. Новый второй mutable OrganismBus не создаётся: существующий CognitiveEventFabric остаётся ledger причинной трассы, а OrganismCore — владельцем когнитивного состояния.

## Что ещё нужно для production

1. Host transport должен передавать аутентифицированную transport identity (нельзя брать её только из JSON payload).
2. Host должен предоставить собственный authorize policy и конкретный present provider.
3. После тестов текста отдельно адаптировать image/audio/video через существующие perception adapters; не переносить base64/URL parts прямо в prompt.
4. Подключить versioned ingress checkpoint к существующему durable host state store: сохранять `snapshot()` после завершённых попыток и восстанавливать до открытия транспорта; проверить crash-window между side effect и checkpoint.
5. Подключать listener и plugin lifecycle только в отдельном host runtime PR с disable/rollback controls.

## Проверки

tests/neko-plugin-message-ingress.mjs покрывает respond/read/blind, независимость visibility, authenticated identity, allowlist, persona-route rejection, schema/media/size boundaries, hostile input, replay conflict, restore/replay across restart, conflicting replay, invalid checkpoint and canonical hash validation. Выделенный workflow запускает этот контракт, parent gateway regressions, ActionGateway integration, tool-input regression и runtime typecheck.
