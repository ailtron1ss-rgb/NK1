# Neuro-Kurisu 35.13.0 / P2742 — Release Status

## Итог

P2742 — крупный production-first проход. Реально расширены neural/world-model связи, а не только документация.

### Доля работы прохода

- production code: **84%**
- tests / ablations / validation: **10%**
- research / docs / release evidence: **6%**

## Выполненные пункты

1. P2742 online causal-predictive controller — DONE
2. Context-conditioned latent dynamics — DONE
3. Uncertainty-aware intervention scoring — DONE
4. Epistemic `verify/explore` pressure — DONE
5. Counterfactual action comparison — DONE
6. Model-guided replay utility — DONE
7. Predictive learning-rate gate — DONE
8. Continuous `microTick` integration — DONE
9. Snapshot/restore — DONE
10. P2742-only ablation — DONE
11. P2734/P2726/P2720 regression — DONE
12. P2716/P2708 regression — DONE
13. Research record update — DONE
14. Static/release audit — DONE

## Основные результаты

P2742:

- 445 outcomes
- 6 contexts
- 5 context switches
- 90 interventions
- 78 high-information outcomes
- information gain 0.4039
- transition confidence 0.4229
- model calibration 0.4049
- counterfactual gap 0.0520
- restart PASS

P2734:

- 320 outcomes
- 6 contexts
- 32 switches
- replay feedback 320
- replay entropy 1.0000
- consolidations 613
- calibration 0.7742
- trajectory difference 37.5924

## Что улучшилось архитектурно

До P2742:

`context/replay/meta/world-model` были связаны несколькими отдельными control loops.

После P2742:

`latent state → context → predictive model → epistemic/pragmatic action bias → outcome → model update → counterfactual gap → replay utility → learning gate`

Это снижает риск того, что world model останется только диагностикой, а replay — отдельным memory mechanism.

## Текущие долги

- полный structural causal discovery ещё не реализован;
- task-boundary matrix с false-positive/false-negative sweep ещё не закрыта;
- physical Android/Termux telemetry ещё не получена;
- RSS memory floor всё ещё высок для medium-phone target;
- anti-forgetting effect должен проверяться независимой factorial suite.


## Финальная проверка релиза

- TYPECHECK=PASS
- CLEAN_ARCHITECTURE=PASS sourceFiles=1586 canonicalFiles=511 missing=0 cycles=0 legacyLeakage=0
- RELEASE_CONTRACT=PASS
- SOURCE_HYGIENE=PASS files=3518 errors=0 warnings=0
- FORENSICS=PASS activeFiles=3503 empty=0 duplicateContent=0 duplicateNames=0 pathMarkers=0 staleMarkers=0
- CLEAN_INTEGRITY=PASS files=3524 release=35.13.0 core=100.4.0-causal-predictive-intervention-p2742 schema=203
- SYNTAX_JSON=PASS js=1097 sh=6 json=240 parser=typescript
- RELEASE_SOURCE=PASS application=35.13.0 core=100.4.0-causal-predictive-intervention-p2742 schema=203
- MANIFESTS_GENERATED canonical=511 source=1598
- ARCHIVE_MANIFEST=PASS files=3764 missing=0 hashMismatches=0 extra=0
- CLEAN_ORGANISM_SMOKE=PASS (separate process; host RSS ~673 MB)
- P2724_MOBILE_ENDURANCE=PASS cycles=1500 outcomes=750 maxGrowthMB=25.2 endGrowthMB=38.0 restartOk=1
- SERVER_SMOKE=PASS with project-native `node --experimental-strip-types tests/server-smoke.mjs` invocation

### Ресурсное ограничение

Длинные последовательные цепочки тестов остаются чувствительными к накоплению RSS/GC pressure. Это не скрывается как PASS. Компоненты проходят в изолированных процессах, а medium-phone optimisation остаётся отдельным инженерным долгом.
