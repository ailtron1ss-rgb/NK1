# Neuro-Kurisu 34.43.0 — BIG PASS 72: Legacy Embodiment Reintegration + Cheap Operational Views

## Сделано

1. Реинтегрированы реальные Live2D assets из большого исторического архива в canonical `public/live2d/Kurisu/`.
2. Переработан Live2D viewer: origin-safe message bridge, bounded parameters, reduced idle FPS, graceful fallback.
3. Главный dashboard теперь использует реальную Live2D model через iframe, а не только декоративный CSS-avatar.
4. `/api/organism/status-lite` и `/api/organism/avatar` переведены на новый дешёвый `operationalStatusSnapshot()` и больше не делают полный deep snapshot для частого polling.
5. Частота тяжёлого dashboard refresh снижена до 30 секунд; лёгкий health/state polling — 5 секунд.
6. Создан `scripts/audit-legacy-reintegration.mjs`.
7. Добавлен реестр решений `docs/LEGACY_REINTEGRATION_RU.md`.
8. Сохранён curated historical reference packet для UI/research/Termux без импорта legacy runtime.

## Что намеренно не сделано

- Старые монолитные cognitive cores не подключены.
- Legacy React application stack не возвращён.
- Runtime dependencies не расширены.
- Никакие claims о сознании не усилены только из-за наличия аватара.

## Quality gate

Новый pass должен завершаться `typecheck`, syntax checks и `audit:legacy-reintegration`.

## BIG PASS 72 — legacy embodiment + operational efficiency

- В current canonical ветку возвращены реальные Live2D assets из исторического архива: модель, moc3, texture, physics/cdi, expressions и motions.
- Live2D viewer переработан под low-power mobile use с origin-safe messaging и fallback.
- `/api/organism/status-lite` и avatar path переведены на lightweight operational snapshot вместо полного deep snapshot.
- Добавлен `/api/embodiment/status` для проверки полноты runtime assets.
- Убраны повторные полные governance snapshots внутри одних и тех же projection paths.
- Добавлен `LEGACY_REINTEGRATION_MANIFEST.json` и расширен progress register для детерминированной миграции из старого архива.
- Проверки после прохода: typecheck, architecture, contract, source-truth, hygiene, syntax, forensics, legacy reintegration и server smoke — PASS.
