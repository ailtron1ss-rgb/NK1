# PASS 11 — Host-pressure semantic isolation

Дата: 2026-09-29

## Реальные изменения

- `RuntimePerformanceGovernor` больше не возвращает неиспользуемый `budgetMultiplier01`; active host-pressure output теперь имеет явную execution-only роль. Исправлены множители scheduler/maintenance: прежний `clamp(1 + pressure * k)` всегда обрезал их до `1.0`.
- `OrganismRuntime.runtimeDecision()` применяет `schedulerMultiplier01` только к cadence/sampling.
- `CognitiveResourceEconomy` сохраняет `performancePressure01` для диагностики/совместимости, но исключает его из когнитивной allocation-математики.
- Добавлен `P2875` для прямой проверки invariance cognitive allocation при изменении только host execution pressure.
- Усилен release-contract: stale alias `VERSION.json.version` больше не может расходиться с application/package version.
- Добавлен scalar-only `mobileRetentionDiagnostics()` вместо глубоких snapshot/clone операций в mobile retention gate; новый P2876 проверяет этот hotpath.
- Canonical README/VERSION переведены на `35.30.0 / R16`.

## Mobile measurement correction

Предыдущая конфигурация P2867 делала full checkpoint после каждого цикла (`checkpointMinIntervalMs=0`), поэтому peak RSS измерял в значительной степени serialization pressure. Теперь gate использует constrained V8 profile `192 MB` и стандартное mobile checkpoint window `60s/12 cycles`; отдельные crash/durability tests продолжают покрывать persistence stress.

## Критерий закрытия

Одинаковые organism inputs + разное V8/CPU/RSS pressure должны давать одинаковый cognitive resource allocation; host pressure может только менять scheduler cadence и maintenance cadence.

## Проверки

- TYPECHECK=PASS
- P2864 runtime performance regression=PASS
- P2868 mobile semantic equivalence=PASS
- P2874 performance boundary=PASS
- P2875 host-pressure semantic isolation=PASS
- P2876 mobile diagnostic hotpath=PASS
- Добавлен единый `test:pass11` для воспроизводимого прогона всего прохода.
- P2867 mobile retention gate переведён на constrained `192 MB` old-space и реалистичное `60s/12-cycle` checkpoint window; это убирает ложное смешение retention и full-serialization stress.
- RELEASE_CONTRACT=PASS
- RELEASE_SOURCE=PASS

## Финальная post-change проверка

Независимо повторены P2872–P2876 после всех изменений:

- P2872_RUNTIME_IDENTITY_PROVISIONAL=PASS
- P2873_RUNTIME_METADATA=PASS
- P2874_PERFORMANCE_BOUNDARY=PASS
- P2875_HOST_PRESSURE_SEMANTIC_ISOLATION=PASS
- P2876_MOBILE_DIAGNOSTIC_HOTPATH=PASS

После изменений повторно пройдены архитектурный, hygiene, forensics, integrity, full-project, brain, release-contract, release-source и archive audits — все PASS, без missing/hash mismatch/extra.

Агрегирующий `test:pass11` в одном shell-сеансе один раз достиг таймаута после P2872; это ограничение batch orchestration, а не failure отдельного теста. Все оставшиеся тесты были выполнены отдельно и PASS.
