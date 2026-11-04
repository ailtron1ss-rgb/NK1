# N.E.K.O. external observation ingress — NK1

## Назначение

Адаптирован внешний plugin event ingress из N.E.K.O. SDK в существующую доказательную архитектуру NK1. Модуль не является шиной команд и не даёт plugin-процессу менять внутреннее состояние организма.

## Поток

`plugin event -> strict normalization -> host receive timestamp/tick -> ExternalObserverFabric -> CognitiveEventFabric(external-evidence)`

В NK1 это наблюдение, а не факт, не память, не цель и не подтверждённое действие.

## Безопасность и происхождение

- Plugin обязан передать `pluginId`, `eventId`, `claimKey`, `summary`; допустимо не более восьми коротких facts.
- Поля `confidence`, `sourceClass`, `independenceKey`, `verified`, `tick` и любые неизвестные поля не принимаются. Tick и время получения предоставляет хост.
- `reportedAt` сохраняется только как диагностическая метка и не влияет на свежесть, trust или порядок событий.
- Все plugin events классифицируются хостом как `sourceClass=unknown`, `channel=tool`, независимость ограничена одним plugin namespace.
- Коэффициент уверенности и надёжности источника фиксирован на `0.25`; plugin не может повысить его своими данными.
- Уже отключённый хостом source остаётся отключённым; адаптер не переактивирует его при регистрации.
- Даже точное текстовое совпадение не повышает plugin observation до `verified`: проверка ExternalObserverFabric по-прежнему требует независимого доверенного источника и собственного порога.
- Нет прямого пути в MemoryOS2, belief/self-model, goals, policy, ActionGateway или tool receipts.
- Proxy/getter, символы, sparse arrays, экзотические прототипы, управляющие символы, лишние поля и превышение лимитов отвергаются без вызова пользовательского getter.

## Повторы и конфликты

Ключ `pluginId:eventId` связывается с fingerprint канонического payload. Повтор с тем же fingerprint возвращает прежние IDs без повторной записи. Тот же event ID с изменённым содержимым создаёт конфликт и не добавляет наблюдение. Bounded receipt ledger поддерживает snapshot/restore; размер по умолчанию — 512 событий.

## Что не подключено

Модуль — host-side ingress port. Сам по себе он не открывает сеть, не запускает plugin, не включает автоматический discovery и не меняет routing в PluginGatewayAdapter. Для активации transport должен передавать payload вместе с доверенными host tick/receive time, а состояние bridge receipt ledger должно сохраняться вместе с runtime state.

## Проверки

- `tests/neko-external-observation-bridge.mjs`: тестовые группы на маршрутизацию в external evidence, trust ceiling, exact replay, конфликт event ID, snapshot/restore, hostile payload, limits и сохранение host disable.
- CI дополнительно прогоняет существующие regression suites ExternalObserverFabric, CognitiveEventFabric и полный runtime typecheck.
