# NK1 — проверка производственных 2.5D-ассетов

**Дата интеграционного прохода:** 2026-11-20  
**Рабочая ветка:** `workpass70-source`  
**Источник функционала:** исторический PR #673; код перенесён выборочно на актуальную рабочую линию.

## Назначение

Наличие математического depth-rig ещё не доказывает, что существует полноценный художественный 2.5D-персонаж. Этот preflight связывает обязательные узлы rig с реально существующими слоями, геометрией общего canvas, декларациями деформации, hidden-area paint, перекрытиями и provenance.

## Что входит

- `DepthRigAssetManifest v1` и JSON Schema.
- Валидатор, сверяющий manifest с rig и filesystem-derived inventory.
- CLI: `npm run validate:2p5d-assets -- <rig.json> <manifest.json> <asset-root>`.
- Сканер `layers/`, `masks/`, `provenance/`: symlink не принимаются, глубина/файлы/все посещённые directory entries/размеры файлов ограничены.
- PNG читается только в пределах 1 MiB заголовка для определения IHDR-размеров и alpha; PSD/WEBP автоматически не декодируются.
- При открытии PNG используется `O_NOFOLLOW`, если платформа его поддерживает; сверяются inode/device с предшествующим `lstat`.
- Проверяются безопасные относительные пути, уникальность слоёв, размеры, alpha, границы canvas, hidden-area paint, occlusion strategy, masks и provenance evidence.
- Aspect 04 CI исполняет существующие rig regressions плюс тесты manifest и filesystem inventory.

## Ограничения и границы доказательств

1. Реальные художественные слои Курису, маски и hidden-area paint этим переносом не создаются.
2. PNG — текущий поддерживаемый формат анализа слоёв/масок; PSD/WEBP требуют отдельного экспортного шага.
3. `reviewStatus: approved` и evidence path — данные manifest, а не криптографическая подпись или автоматическое юридическое одобрение.
4. Сканер пропускает замеченные symlink и защищает открытие конечного PNG от symlink там, где есть `O_NOFOLLOW`, но не является полной изоляцией от всех атак с одновременной подменой каталогов.
5. Успешный preflight не доказывает визуальный E2E, Android soak, производительность, правильность деформаций или production readiness аватара.

## Команды

Запускать из `app/`:

```bash
node --experimental-strip-types --test scripts/depth-rig-assets.test.mjs
npm run test:2p5d-asset-inventory
npm run validate:2p5d-assets -- <rig.json> <manifest.json> <asset-root>
```

## Статус

- Контракт, валидатор, scanner и CLI: включены в ветку консолидации.
- Регрессионные тесты: включены в Aspect 04 workflow; итог зависит от exact-head CI.
- Наличие реального производственного asset pack: **не подтверждено**.
- Release ZIP от 19 октября и `main`: **не изменялись**.
