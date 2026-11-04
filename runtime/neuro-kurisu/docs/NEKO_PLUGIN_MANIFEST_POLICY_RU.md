# N.E.K.O. Plugin Manifest Policy для NK1

## Назначение

Реестр отделяет декларацию plugin capabilities от фактических разрешений NK1. Он не загружает и не исполняет код плагина. Его задача — доказать, что plugin manifest просит ровно те инструменты и классы доступа, которые уже зарегистрированы в каноническом `ActionGateway`.

## Контракт манифеста

`schemaVersion`, `id`, `name`, `version`, `enabled`, `protocols`, `tools`. Каждый tool декларирует `id`, `capability`, `destructive`, `permissionClass`, `requiresHostApproval` и явный набор действий `tool_call` / `resource_read`.

## Проверки

- Plugin ID нормализуется и ограничивается безопасным алфавитом; tool ID обязан находиться в namespace `pluginId.`.
- Протоколы и действия задаются явно; нет wildcard/allow-all по умолчанию.
- Реестр сверяет точные `id`, `capability`, `destructive`, `permissionClass`, `requiresApproval` с живым `ActionGateway.listTools()` при регистрации и повторно на каждом authorize.
- `resource_read` доступен только для недеструктивного tool с read capability (`.read` или `:read`).
- Для любых привилегированных permission classes требуется декларация host approval. Манифест не может убрать approval, который уже требует ActionGateway.
- Дубли plugin/tool ID, неизвестные поля, getters/proxies, sparse arrays, чрезмерный размер и несовместимый snapshot отклоняются.
- `setEnabled`, `replace`, `remove`, `snapshot` и `restore` управляют только декларативной политикой. Возвращаемые объекты копируются, внутренние записи заморожены.

## Граница безопасности

Успешный `authorize()` — только один policy gate. Он не выдаёт approval, не исполняет инструмент и не заменяет `ActionGateway`; любой вызов всё равно проходит input contract, approval, idempotency ledger, execution и verification. Registry совместим с callback `PluginGatewayAdapter.authorize`, но автоматическое wiring/запуск plugin runtime оставлены отдельным изменением после review.

## Проверки

`tests/neko-plugin-manifest-policy.mjs` содержит 10 групп сценариев: exact binding, protocol/action deny, approval/capability drift, namespace, duplicate, live gateway drift, spoofed descriptor, lifecycle/snapshot, hostile object rejection и gateway outage. Отдельный CI запускает contract test, существующий tool-input regression и runtime typecheck.
