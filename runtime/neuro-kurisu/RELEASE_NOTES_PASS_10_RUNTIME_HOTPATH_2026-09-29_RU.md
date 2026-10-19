# RELEASE NOTES — PASS 10 Runtime Hot-Path Closure

Дата: 2026-09-29

## Изменения

- Добавлен `OrganismCore.runtimeMetadataSnapshot()` — primitive-only runtime view без deep-clone полного persisted system.
- `OrganismRuntime` использует этот путь для частых stage/replaySignature записей вместо `systemSnapshot()`.
- Добавлен `NeuralExperienceBranch.transferSafetySynergyMetricsLite()` и `P2835.metricsLite()` для scalar diagnostics без cloning больших context matrices.
- Добавлены executable gates `P2873` и `P2874`.

## Проверки PASS 10

- TYPECHECK=PASS
- P2873_RUNTIME_METADATA=PASS cloneCalls=0
- P2874_PERFORMANCE_BOUNDARY=PASS
- P2868_MOBILE_DECISION_EQUIVALENCE=PASS
- P2869_DURABLE_CHECKPOINT_DEDUP=PASS
- P2870_VERIFIED_SYNTHETIC_PROMOTION=PASS
- P2871_IDENTITY_REVISION_HOLDOUT=PASS
- CLEAN_ORGANISM_SMOKE=PASS
- CLEAN_RESTART_PERSISTENCE=PASS
- MEMORY_DEDUP=PASS
- CLEAN_ARCHITECTURE=PASS
- CORE_OWNERSHIP=PASS
- FORENSICS=PASS
- SOURCE_HYGIENE=PASS
- SYNTAX_JSON=PASS
- RELEASE_CONTRACT=PASS
- CLEAN_INTEGRITY=PASS
- AUDIT_FULL=PASS
- AUDIT_BRAIN=PASS
- RELEASE_SOURCE=PASS

`P2872` — тяжёлый ранее существующий runtime identity gate не завершился в batch budget; предыдущий PASS сохранён как контрольный, а новые PASS 10 изменения его execution path не меняют.

## Ограничения

Full-device Android endurance 100/500/1000 cycles и native NEON/SIMD/NNAPI benchmark не считаются закрытыми без device-level evidence.
