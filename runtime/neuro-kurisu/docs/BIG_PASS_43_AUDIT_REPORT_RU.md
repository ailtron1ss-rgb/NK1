# Neuro-Kurisu 34.12.0 — BIG PASS 43

Дата: 2026-09-05

## 1. Цель

Продолжить реализацию первого полного аудита без повторного наращивания количества P-модулей. Главный приоритет: снизить стоимость hot path на среднем Android/Termux и сделать автономный project engine действительно исполняемым.

## 2. Что реально изменено

### Performance Spine 3
- введён дополнительный one-tick cache для повторяющихся P24/P26/social/workspace/self-governance/prediction-debt сигналов;
- `EventLog.recent(n, clone=false)` позволяет внутренним read-only потребителям не создавать глубокие копии;
- исправлено случайное вложение cognition snapshot sync внутрь `enableSemanticMemory`;
- в `operational` режиме тяжёлые P61–P68 и P74–P82 snapshots не материализуются, потому что lightweight API использует только P69–P73;
- полный режим продолжает отдавать расширенное состояние;
- повторные `workspace/selfProjects/narrative/identity` snapshots после решения сведены к кэшированным значениям там, где это безопасно.

### Autonomous Project Engine
- `ProjectPlanStep` знает `preferredTool`;
- добавлены read-only `organism.project.context` и `organism.project.evidence`;
- добавлен `executeNextProjectStep()`;
- добавлен `POST /api/organism/projects/step`;
- существующие budget/allowlist/destructive guards сохранены;
- project execution state продолжает восстанавливаться через persistence.

### Release
- application **34.12.0**;
- state schema **89**;
- phase `Stage-2/performance-spine-3-runtime-cache`;
- package/package-lock/VERSION/ReleaseContract/manifests синхронизированы.

## 3. Реальные тесты

Прошли:

- TYPECHECK;
- BIG_PASS_43_PERFORMANCE_CACHE;
- PROJECT_EXECUTION_PERSISTENCE;
- P67_PROJECT_EVIDENCE;
- P64/P65;
- P80/P82;
- architecture;
- forensics;
- hygiene;
- source truth;
- release contract;
- integrity.

`BIG_PASS_43_PERFORMANCE_CACHE` на текущей среде дал:

- first 10-cycle median window: **~17 ms**;
- last 10-cycle median window: **~68 ms**;
- ratio: **~3.7–4.4** между отдельными повторениями;
- adaptive spine savings: **~0.68**.

Разброс означает, что benchmark ещё не является стабильной производственной гарантией.

## 4. Long-horizon

250/500-cycle natural benchmarks по-прежнему чувствительны к GC и времени окружения. 500-cycle прогон в текущем verification window не завершился.

Это не объявляется PASS.

## 5. Сверка с первым аудитом

Первоначальный аудит требовал:

1. стабилизации runtime — существенно выполнено;
2. Evidence Bus — выполнено;
3. Prediction Ledger — выполнено;
4. Cognitive Budget — выполнено;
5. model ecology — существенно выполнено;
6. autonomous projects — существенно усилено;
7. general true learning — частично;
8. empirical causal science — частично;
9. real perception — частично;
10. self-model — частично/существенно;
11. identity/autobiography — частично;
12. independent shadow organism — частично;
13. learned model competition — частично;
14. native Android lifecycle — не выполнено;
15. real vision — не выполнено;
16. ASR/TTS device validation — не выполнено;
17. social cognition — частично;
18. self-modification — частично;
19. long-horizon device runs — не выполнено;
20. independent consciousness evaluation — не выполнено.

Строгая weighted реализация первого аудита после этого прохода: **≈80%**. Это инженерная/архитектурная полнота, а не процент сознания.

## 6. Что особенно важно

Главным результатом прохода является переход от оптимизации отдельных P-модулей к оптимизации жизненного цикла cognition: горячая operational-поверхность теперь меньше материализует состояние, а project executor получает собственные безопасные инструменты и способ самостоятельно двинуться к следующему шагу.

## 7. Главные долги

- стабильный 500/1000-cycle runtime;
- Android native lifecycle;
- real vision/ASR/TTS;
- внешние реальные project tools;
- полноценный learned Model Olympics;
- независимый Shadow Organism;
- настоящая general learning transfer;
- social cognition benchmark;
- 24h/72h/7d/30d phone validation;
- независимая consciousness evaluation.

## 8. Legacy snapshot

В текущем архиве директория `legacy-original` отсутствует. Release-аудит теперь корректно фиксирует это как `SKIPPED_NOT_SHIPPED`; никаких искусственных legacy-файлов не добавлялось.

## 9. Следующий приоритет

BIG PASS 44: **Real External Project Engine + Performance Spine 4**.

Цель: реальные безопасные read/search/write capabilities в sandboxed tool layer, task graph, failure branches, external evidence, skill extraction и затем стабильные 500/1000-cycle gates.
