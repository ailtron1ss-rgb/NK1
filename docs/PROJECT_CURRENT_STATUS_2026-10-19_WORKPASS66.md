# Текущий статус Neuro Kurisu — WorkPass 66 (19 октября 2026)

**Каноническая рабочая версия:** runtime `35.86.0`, persisted schema `225`, база `Neuro_Kurisu_WORKPASS65_2026-10-19.zip`. **Релиз не одобрен.** Этот проход исправляет воспроизводимость установки и release contract; он не выдаёт локальные тесты за production build или live provider proof.

## Изменения в коде

1. `tools/super-install.mjs` теперь устанавливает по committed lockfile оба пакета — `app/` и `runtime/neuro-kurisu/`. До изменения дерева проверяет package/lock identity и version, ограничивает npm retries/deadline и завершает проход при первой ошибке.
2. `runtime/neuro-kurisu/scripts/typecheck-runtime.mjs` предпочитает TypeScript из runtime workspace, затем version, закреплённую app lockfile, и лишь затем `tsc` из `PATH`. Syntax-only fallback маркируется отдельно.
3. Исправлено реальное расхождение в исходном WorkPass65: runtime `VERSION.json` был `35.85.0 / WorkPass65`, а `RELEASE_MANIFEST.json` и `RELEASE_ARCHIVE_MANIFEST.json` оставались `35.84.0 / WorkPass64`; `audit:contract` и `verify:release-source` поэтому падали. WorkPass66 заново генерирует runtime manifests из `VERSION.json`.
4. Добавлены 4 installer contract tests и тест выбора pinned compiler.

## Проверки

- Installer orchestration: **4/4 PASS** (fake npm, без сети).
- Runtime pinned-compiler selection: **PASS**.
- Runtime TypeScript typecheck: **PASS** с доступным `tsc` 5.8.3 из PATH. Locked TypeScript не скачан; тестом изолированно доказано, что app-lock compiler будет иметь приоритет после установки.
- WorkPass65 архивные receipt/replay regressions: **PASS**.
- App source scripts: **218/218 PASS**.
- Browser-smoke comparator contract: **51/51 PASS**; не является реальным браузерным E2E.
- Release metadata contract, runtime release contract/integrity/source verification: результаты включены в новый audit после генерации manifests.

## Ограничение текущего окружения

`npm run install:all` реально запущен и завершился с `EAI_AGAIN` при разрешении `registry.npmjs.org/ajv`; lockfile не изменён. NPM дополнительно сообщил об optional peer предупреждении: `@hookform/resolvers@5.9.1` ожидает `ajv@^8.12.0`, а текущий корневой Ajv — `6.15.0`. Это требует повторяемого разрешения в среде с доступным registry; lockfile не менялся вручную. Зависимости app не установлены; production Vite build и app typecheck не выполнялись. Не заявляю, что настоящее браузерное/Live2D E2E или live provider/device ACK-gap завершены. Внешний provider/device acceptance, reconnect, независимый read-after-write, rollback и soak остаются открытыми.

## Прогресс и release gate

Инвентарь: **100 задач — 82 DONE / 10 PARTIAL / 8 TODO**. Итоговый архив сохраняет все 10 164 исходных пути; добавлено 8 файлов, изменено 17 существующих, удалений нет; `runtime/RELEASE_ARCHIVE_MANIFEST.json` содержит 4 257 записей. Взвешенная дорожная карта остаётся **80,1%**; этот проход улучшает инженерную воспроизводимость, но не закрывает внешние release gates. Memory retrieval remains `recallDelta=0`; vector candidate `not-promoted`.

Подробности: `docs/WORKPASS66_CODE_CHANGES_2026-10-19.md`, `docs/WORKPASS66_HANDOVER_2026-10-19.md`, `docs/ROADMAP_GAPS_TO_TARGET_WORKPASS66.md`.
