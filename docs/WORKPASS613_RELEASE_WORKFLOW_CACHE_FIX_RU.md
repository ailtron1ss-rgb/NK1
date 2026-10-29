# NK1 WorkPass613 — исправление запуска release workflow

**Дата:** 2026-10-29  
**Ветка:** `main` (линия сборки релиза)  
**Статус:** изменение workflow; публикация релиза не подтверждена.

## Причина

Запуск `Publish WorkPass70 hotfix release` завершался до проверок происхождения исходников: `actions/setup-node@v7` автоматически включал npm cache по полю `packageManager` в корневом `package.json`, затем искал корневой `package-lock.json`, которого в репозитории нет. В журнале GitHub это проявлялось как `Dependencies lock file is not found in .../NK1/NK1`.

## Изменение

В шаге настройки Node оставлен единый pin `.nvmrc` и явно отключён автоматический npm cache через `package-manager-cache: false`. Это соответствует уже имеющемуся подходу workflow `publish-workpass70-main-sync.yml`.

## Границы

Это устраняет только преждевременный сбой подготовки runner. Workflow по-прежнему обязан пройти `test:provenance-current` и `audit:release-license-readiness`. Одобрения лицензий не создаются автоматически; при непройденном human-review gate пакетирование/публикация должно быть заблокировано. ZIP и существующие GitHub Release assets этим коммитом не меняются.
