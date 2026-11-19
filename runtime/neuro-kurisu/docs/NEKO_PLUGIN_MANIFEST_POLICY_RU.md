# N.E.K.O. Plugin Manifest Policy для NK1

## Назначение и владение полномочиями

Реестр отделяет декларацию возможностей плагина от фактических полномочий NK1. Он не загружает и не исполняет код плагина. Его задача — проверить, что манифест запрашивает только те инструменты и уровни доступа, которые уже существуют в каноническом `ActionGateway`.

Реестр владеет декларативной политикой плагина. Он не является исполнителем и не заменяет:
- регистрацию и описание инструментов в `ActionGateway`;
- проверку входных данных;
- host approval;
- idempotency и durable receipts;
- исполнение, постусловия и проверку результата.

## Контракт манифеста

Верхний уровень содержит:
- `schemaVersion`, `id`, `name`, `version`;
- `enabled`;
- явные `protocols`;
- список `tools`.

Каждый tool описывает:
- `id`;
- `capability`;
- `destructive`;
- `permissionClass`;
- `requiresHostApproval`;
- разрешённые действия `tool_call` и/или `resource_read`.

Идентификатор инструмента должен находиться в namespace соответствующего плагина: `<pluginId>.<toolName>`. ID нормализуются и ограничиваются безопасным алфавитом. Протоколы и действия перечисляются явно; wildcard и allow-all по умолчанию запрещены.

## Проверка против ActionGateway

При регистрации и при каждом `authorize()` реестр сверяет декларацию с актуальным `ActionGateway.listTools()`:
- точный `id`;
- `capability`;
- `destructive`;
- `permissionClass`;
- `requiresApproval`.

Это повторное сравнение важно: декларация не должна сохранять право на вызов после изменения реального инструмента или его требований.

`resource_read` разрешается только для недеструктивного инструмента с read capability, заканчивающейся на `.read` или `:read`. Привилегированные permission classes требуют host approval. Манифест не может отменить approval, который уже требует ActionGateway.

## Fail-closed валидация

Реестр отклоняет:
- неизвестные поля и несовместимые версии;
- некорректные или повторяющиеся plugin/tool ID;
- tool ID вне namespace плагина;
- wildcard/неподдерживаемые protocol и action;
- несоответствие живому descriptor ActionGateway;
- getters/setters, Proxy и иные активные/экзотические объекты;
- разреженные массивы, дубли snapshot-записей и данные за пределами установленных ограничений размера/структуры.

Возвращаемые значения отделены от внутреннего состояния; зарегистрированные декларации не должны изменяться через ссылку, переданную вызывающим кодом.

## Атомарное восстановление snapshot

`restore(snapshot)` заменяет реестр целиком. Валидация проходит во временной карте:
1. Текущее состояние очищается.
2. Проверяется версия и структура snapshot.
3. Каждая запись нормализуется и проверяется.
4. Дубликат или некорректная запись отклоняют весь snapshot.
5. Только после проверки всех элементов новая карта целиком устанавливается в реестр.

Нельзя оставлять валидный префикс snapshot, если более поздняя запись некорректна: частичное восстановление могло бы оставить непредусмотренную часть разрешений активной. Для невалидного snapshot результат — ноль восстановленных записей и пустой реестр.

## Жизненный цикл

`register`, `replace`, `remove`, `setEnabled`, `snapshot` и `restore` управляют только декларативной политикой. `authorize()` — один policy gate, а не выдача разрешения на исполнение. После успешной авторизации запрос всё равно проходит обычный путь NK1 через `ActionGateway`.

Runtime composition использует реестр как host-owned authorizer:
- host protocol allowlist задаёт верхний предел;
- manifest может только сузить разрешённые protocols/actions;
- host явно регистрирует рассмотренный manifest и управляет enablement;
- импорт манифеста сам по себе не включает плагин и не запускает listener.

## Проверки и CI

Контрактные сценарии находятся в:
- `runtime/neuro-kurisu/tests/neko-plugin-manifest-policy.mjs`;
- `runtime/neuro-kurisu/tests/neko-plugin-runtime-composition.mjs`;
- `runtime/neuro-kurisu/tests/neko-plugin-gateway-adapter.mjs`;
- `runtime/neuro-kurisu/tests/neko-plugin-gateway-real-action-gateway.mjs`.

Существующий общий workflow `.github/workflows/nk1-neko-plugin-runtime-composition.yml` запускает gateway contract, manifest policy contract, real ActionGateway boundary, runtime composition и runtime typecheck. Отдельный второй workflow только для manifest policy не нужен: он дублировал бы уже действующее покрытие.

В manifest-policy тесте 12 групп сценариев, включая атомарное восстановление, некорректные и дублирующиеся snapshot-записи, а также успешное восстановление валидного snapshot. Само наличие теста или строки `PASS cases=12` не заменяет подтверждение свежего запуска CI на конкретном commit SHA.

## Границы интеграции

- Не загружать и не исполнять plugin code.
- Не создавать второй executor, отдельный approval-механизм или отдельный receipt ledger.
- Не подключать автоматически транспорт, сеть или background listener.
- Не превращать plugin observation в пользовательскую команду/цель без отдельной политики и аутентифицированного provenance.
- Не объявлять N.E.K.O. плагины live-enabled или production-ready только на основании наличия registry/adapter.

## Источники и происхождение

Документ сохраняет полезную спецификацию исходной aspect-ветки `aspect/neko-plugin-manifest-policy-20261104` (PR #784, head `4ea30182896910e53254dd828dd3529257aced8f`; исходный blob документа `45176431f3ce7c91ce76087680a6952aec8e5c1f`).

Runtime-реестр и тесты не копируются из старой ветки: текущая source-линия содержит усиленные версии:
- `NekoPluginManifestPolicyRegistry.ts` blob `5a485ce02e2ade050b04bbade6602831aacd78be`;
- `neko-plugin-manifest-policy.mjs` blob `9d436775d2ec447a0b2175d5d3a6e15b0a927262`;
- общий CI workflow blob `15eacd36e0cfd9bdfbdf053ffb6d0ecc5fb9e2c6`.

Поэтому в эту интеграцию переносится недостающая документация, а не старая реализация или второй workflow.
