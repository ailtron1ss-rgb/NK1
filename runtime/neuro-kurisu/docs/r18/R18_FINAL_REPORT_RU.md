# Neuro-Kurisu 35.32.1 / R18.1 — итог прохода

## Что сделано

R18.1 закрывает три связанные проблемы:

1. **устаревшая память** — добавлено bounded implicit-conflict adjudication в canonical MemoryOS2. При конфликте новая запись сохраняется, старая получает `validUntilAt`, `supersededById` и contradiction links; исходная информация не удаляется;
2. **адаптивная retention-экономика** — MemoryRetentionEconomy теперь обновляет веса от фактической наблюдаемой полезности и сохраняет learned state;
3. **контекстная world-confidence** — WorldCausalCalibration получил context-conditioned statistics, а OrganismCore теперь использует matured calibration прямо в candidate confidence/score path.

Дополнительно:
- decision trace получил канонический `worldContextKey`, чтобы последующая feedback/calibration запись не теряла контекст;
- добавлены P2890 и P2891 для проверки именно живых межсистемных связей;
- обновлены release metadata до 35.32.1/R18.1;
- исследования сохранены отдельно в `research/2026-09-30/`.

## Проверка

- TYPECHECK: PASS
- P2887: PASS
- P2888: PASS
- P2889: PASS
- P2890: PASS
- P2891: PASS
- P2842 calibration: PASS
- P2855 integration: PASS
- P2855 policy ablation: PASS
- P2875 host-pressure isolation: PASS
- P2876 mobile diagnostic hotpath: PASS
- architecture: PASS
- hygiene: 0 errors / 0 warnings
- forensics: 0 duplicate content / 0 duplicate names / 0 stale markers
- integrity: PASS
- syntax: PASS

## Реальный измеримый результат

- implicit conflicts resolved: 1 in bounded closure test;
- stale retrieval avoidance: 1 in closure test;
- adaptive memory learning: 96 samples in P2888;
- contextual calibration readiness: ~0.893 in P2889;
- live cold→warm confidence delta: ~+0.0656 in P2890;
- P2855 policy ablation retained +0.10 absolute accuracy gain after R18 changes.

## Ограничения

Эти изменения не доказывают субъективное сознание. Они усиливают функциональные свойства persistent cognitive organism: state revision, uncertainty calibration, continuity of evidence and learned retention.

P2867 остаётся отдельным mobile/RSS gate: он превышает жёсткий post-GC порог и при этом аналогично превышался на исходном R16 baseline, поэтому текущая величина не трактуется как доказанная R18-регрессия и требует отдельного воспроизводимого Android/RSS протокола.

P2868 получил deterministic logical clock и deterministic test RNG. Дополнительно mobile теперь использует тот же balanced semantic configuration для cognitive engines (B2501/B2503/B2504/B291/B292/B297/B451/adaptive budget), а mobile-only различия оставлены в execution/persistence. Два независимых normal/mobile повторных запуска дали одинаковую последовательность действий. Массовый 5-run batch упёрся в общий внешний timeout, поэтому это не объявляется пяти-кратной репликацией.
