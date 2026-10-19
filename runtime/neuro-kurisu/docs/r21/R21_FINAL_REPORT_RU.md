# Neuro-Kurisu 35.35.0 / R21 — Final Report

## Главный результат

R21 не добавляет ещё один cognitive layer. Главная работа — убрать маскирующие слои и сделать truth surface явным:
- misleading `NoopOperationalJournal` удалён;
- capability claims стали доказательно типизированными;
- simulation lane отделён от grounded-world lane;
- anti-decoration audit проверяет конкретные code-path invariants.

## Фактический diff R20 → R21

- изменено: **65** файлов;
- добавлено: **6** файлов;
- удалено: **1** файл (`src/organism/persistence/NoopOperationalJournal.ts`);
- из изменённой поверхности кода/tests/scripts: **44** файла;
- внешние runtime dependencies: **0**.

Большая часть 65 изменённых файлов — release/archive manifests и существующие тесты, где заменено misleading имя журнала.

## Ключевые изменения

### 1. No-op stub closure

`NoopOperationalJournal` больше не существует. `BoundedOperationalJournal` — единственное canonical имя реального bounded journal.

### 2. Capability truth surface

Каждая capability теперь имеет:
- `status`;
- `evidence`;
- `owner`;
- `available`.

`world.simulation` явно является `simulation-only`; Android capability становится `device-verified` только при live Termux detection.

### 3. Simulation promotion barrier

`RealityShadowBridge` теперь явно различает:
- `predictive-sandbox`;
- `grounded-world`.

У simulation lane `promotionEligible=false`; external lane может быть promotion-eligible после существующих evidence/postcondition checks.

## Verification

- typecheck: PASS
- P2901 runtime claim truth: PASS
- P2901 static anti-decoration: PASS
- P2868 mobile semantic equivalence: PASS
- P2875 host-pressure isolation: PASS
- P2876 mobile diagnostic hotpath: PASS
- P2870 verified synthetic trajectory gate: PASS
- P2887–P2894: PASS
- architecture: PASS
- hygiene: 0 errors / 0 warnings
- forensics: 0 duplicate content / 0 duplicate names
- syntax: PASS
- release contract: PASS
- release source: PASS
- integrity: PASS
- archive manifest: PASS (4050 files; missing=0; hash mismatches=0; extra=0)

## Незакрытый вопрос

Aggregate long-horizon runner P2895 остаётся отдельным orchestration/timeout issue. Я не объявляю его aggregate release PASS; это следующий технический долг release harness, а не основание снижать критерии самого long-horizon теста.
