# Neuro-Kurisu Organism Core 3.0.0-p3 — финальный аудит

Дата: 2026-08-25  
Application: 99.80.3  
Organism Core: 3.0.0-p3  
Organism state schema: 5  
World state schema: 1

## Результат

Функциональный P3 milestone: PASS. Архив допускается к device-side проверке.

## Что проверено

- P0/P1/P2/P3 regression tests: PASS.
- P3 runtime smoke: 30 полноценных циклов, restart preservation: PASS.
- P3 synthetic longitudinal benchmark: 5,000 циклов, deterministic replay: PASS, regressionCount=0.
- Strict TypeScript по `src/organism/*.ts`: PASS.
- Source verification: 533 files, parseErrors=0, missingRelativeImports=0, duplicateImports=0.
- Integrity verification: 533 files, duplicateExports=0.
- Architecture efficiency: 533 files, missingRelativeImports=0, duplicateExports=0, importCycles=0, dynamicCode=0.
- NPM script target audit: 440 scripts, 0 missing targets.
- Organism final static audit: PASS, new-core TODO/FIXME/HACK markers=0.
- Release verifier: PASS_WITH_WARNINGS only for missing package-lock.json.

## Исправленные проблемы во время P3

1. Миграция state schema 4 → 5 первоначально требовала `worldModel`; теперь неполные P2-снимки корректно мигрируются.
2. `PlanStep` использует `predictedReward`, исправлен ошибочный reference на `expectedReward` в sensorimotor integration.
3. `feedback()` обращался к decision trace до объявления; исправлено.
4. `p3.valueRevisionLog` получил точный тип `ValueRevision[]` вместо конфликтующего union.
5. Активные P0/P1/P2 tests обновлены до current schema 5 и current organism version.
6. Termux service больше не содержит hardcoded build-container path `/mnt/data/...`; root вычисляется относительно скрипта или `KURISU_ROOT`.
7. Current docs/README/version markers приведены к Organism Core 3.0.0-p3; исторические release artifacts оставлены как provenance.
8. Duplicate export names `AttentionState`, `WorkspaceItem`, `BodyState`, `KURISU_CANON` устранены в canonical organism surface.
9. Architecture audit был исправлен так, чтобы одинаковый export дважды в одном shim-файле не считался межфайловым duplicate.
10. P3 runtime получил self-authorship, value revision journal, sensorimotor feedback and longitudinal benchmark.

## P3 architecture additions

### Self-authorship

Организм фиксирует самостоятельные действия, commitment-like цели и revision history. Это не доказательство метафизической свободы воли; это operational authorship signal.

### Value revision

Adaptive values меняются малым bounded step и сохраняются как отдельные revisions. Canonical Kurisu invariants не перезаписываются автоматически.

### Sensorimotor loop

Для каждого world action сохраняются expected reward, actual reward, reward prediction error, state prediction error и body cost.

### Longitudinal benchmark

Benchmark отдельно проверяет determinism, memory continuity, goal persistence, self-prediction calibration, autonomy rate and regression count. Synthetic benchmark прямо помечен как functional, not consciousness evidence.

### Termux supervisor

Добавлен restart-safe supervisor. State checkpoint сохраняется отдельно; crash не должен уничтожать последнюю принятую state transition.

## Known external blocker

`package-lock.json` не создан внутри build container. `npm install --package-lock-only --ignore-scripts --offline` вернул `ENOTCACHED` для `@google/genai`; registry access недоступен. Создавать фиктивный lockfile нельзя.

На networked release machine:

```bash
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
npm ci
npm run verify:organism-core-p3
npm run build
```

## Device gate

Нельзя из контейнера утверждать реальную Android/Termux stability. Перед production-like запуском нужны: 24–168h soak, thermal throttling, battery depletion, process restart, screen-off behaviour, Termux permissions, KoboldCpp/local GGUF inference and package-lock/build verification.
