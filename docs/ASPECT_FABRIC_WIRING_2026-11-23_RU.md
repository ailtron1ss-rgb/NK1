# NK1 / NeuroCore — Aspect Integration Fabric (wiring)

**Дата:** 2026-11-23  
**Ствол:** `workpass70-source` @ `fba16fa1f`  
**Модель:** `organism → 7 физических систем → 75 аспектов → зависимости + branch/PR provenance`  
**Тип:** read-only слой подключения; поведение runtime не меняется.

## 0. Что подключено

| Узел | Кол-во |
|---|---:|
| Аспекты | 75 |
| Домены | 10 |
| Физические системы | 7 |
| Узлы графа (organism + systems + aspects) | 83 |
| Рёбра графа (dependencies + owns + composes) | 175 |
| Ветки в provenance | 1106 |
| Owner-файлы существуют | 72 / 75 |
| Связность | PASS (83/83) |

Граф связывает каждый аспект с физической системой, каждую систему — с корнем `organism`, а зависимости — с другими аспектами. Ветки и PR не мержатся: они привязаны к аспекту как provenance, чтобы одна и та же ветка не могла «принадлежать» двум аспектам.

## 1. Семь физических систем

| Система | Название | Аспектов | Домены | Примеры аспектов |
|---|---|---:|---|---|
| `self` | Self / личность и ядро | 11 | I, II, IV | 1 core-architecture, 2 organism-bus, 3 organism-state, 4 cognitive-kernel |
| `governance` | Governance / безопасность и релиз | 19 | I, VI, VII, VIII, X | 6 engineering-os, 43 replit-github, 45 ethical-gate, 46 permission-system |
| `memory` | Memory / память и обучение | 5 | III | 13 memoryos2, 14 retrieval, 15 consolidation, 16 continual-learning |
| `world` | World / восприятие и познание | 4 | II | 7 perception, 8 world-model, 9 reasoning, 10 planning |
| `embodiment` | Embodiment / тело, голос, аватары | 13 | V, VIII | 25 embodiment, 26 live2d, 27 2-5d, 28 3d-avatar |
| `agency` | Agency / автономность и мотивация | 2 | IV | 23 motivation, 24 autonomy |
| `research` | Research / интеграции и научная проверка | 21 | III, IX, VI | 18 evaluation, 33 neko, 34 hermes, 35 firecrawl |

## 2. Десять доменов

| Домен | Название | Система | Аспектов | Примеры |
|---|---|---|---:|---|
| I | Фундамент и архитектура | `self` | 6 | 1 core-architecture, 2 organism-bus, 3 organism-state, 4 cognitive-kernel |
| II | Интеллект и познание | `world` | 6 | 7 perception, 8 world-model, 9 reasoning, 10 planning |
| III | Память и обучение | `memory` | 6 | 13 memoryos2, 14 retrieval, 15 consolidation, 16 continual-learning |
| IV | Личность, мотивация и автономность | `self` | 6 | 19 selfmodel, 20 usermodel, 21 personality, 22 affect-system |
| V | Тело, голос и взаимодействие | `embodiment` | 8 | 25 embodiment, 26 live2d, 27 2-5d, 28 3d-avatar |
| VI | Интеграции и инструменты | `research` | 12 | 33 neko, 34 hermes, 35 firecrawl, 36 tinyfish |
| VII | Безопасность и надёжность | `governance` | 8 | 45 ethical-gate, 46 permission-system, 47 action-verification, 48 memory-safety |
| VIII | Приложение и платформы | `embodiment` | 7 | 53 desktop, 54 android, 55 termux, 56 ui-ux |
| IX | Тестирование и научная проверка | `research` | 9 | 60 unit-tests, 61 integration-tests, 62 architecture-tests, 63 math-tests |
| X | Релиз и развитие | `governance` | 7 | 69 branch-consolidation, 70 ci-cd, 71 release-pipeline, 72 license-review |

> Домен — это группа реестра; его `system` — доминирующая система. Отдельные аспекты домена могут быть в другой системе: например, 6 `engineering-os` → governance, 18 `evaluation` → research, 23–24 `motivation/autonomy` → agency. Точная привязка — в таблице 75 аспектов.

## 3. 75 аспектов: система, owner, зависимости, ветки

| n | Аспект | Система | Owner | Deps | Веток | open | Owner OK |
|---:|---|---|---|---:|---:|---:|---|
| 1 | `core-architecture` | `self` | `runtime/neuro-kurisu/src/organism/core/OrganismCo…` | 0 | 27 | 10 | yes |
| 2 | `organism-bus` | `self` | `runtime/neuro-kurisu/src/organism/cognition/Cogni…` | 1 | 2 | 0 | yes |
| 3 | `organism-state` | `self` | `runtime/neuro-kurisu/src/organism/persistence/Fil…` | 1 | 17 | 3 | yes |
| 4 | `cognitive-kernel` | `self` | `runtime/neuro-kurisu/src/organism/core/CognitiveK…` | 1 | 6 | 5 | yes |
| 5 | `cognitive-cycle` | `self` | `runtime/neuro-kurisu/src/organism/core/CognitiveC…` | 3 | 6 | 3 | yes |
| 6 | `engineering-os` | `governance` | `engineering-os/manifest.v1.json` | 1 | 1 | 0 | yes |
| 7 | `perception` | `world` | `runtime/neuro-kurisu/src/organism/body/Perception…` | 1 | 3 | 1 | yes |
| 8 | `world-model` | `world` | `runtime/neuro-kurisu/src/organism/world/WorldMode…` | 1 | 1 | 0 | yes |
| 9 | `reasoning` | `world` | `runtime/neuro-kurisu/src/organism/cognition/Perce…` | 1 | 1 | 0 | yes |
| 10 | `planning` | `world` | `runtime/neuro-kurisu/src/organism/world/PlanEngin…` | 2 | 4 | 0 | yes |
| 11 | `metacognition` | `self` | `runtime/neuro-kurisu/src/organism/cognition/MetaC…` | 1 | 8 | 2 | yes |
| 12 | `attention` | `self` | `runtime/neuro-kurisu/src/organism/cognition/P81Pr…` | 1 | 6 | 2 | yes |
| 13 | `memoryos2` | `memory` | `runtime/neuro-kurisu/src/organism/developmental/M…` | 1 | 158 | 31 | yes |
| 14 | `retrieval` | `memory` | `runtime/neuro-kurisu/src/organism/developmental/M…` | 1 | 7 | 0 | yes |
| 15 | `consolidation` | `memory` | `runtime/neuro-kurisu/src/organism/memory/MemoryCo…` | 1 | 8 | 4 | yes |
| 16 | `continual-learning` | `memory` | `runtime/neuro-kurisu/src/organism/learning/Contin…` | 2 | 22 | 8 | yes |
| 17 | `skill-system` | `memory` | `runtime/neuro-kurisu/src/organism/learning/Proced…` | 1 | 9 | 3 | yes |
| 18 | `evaluation` | `research` | `runtime/neuro-kurisu/src/organism/memory/MemoryRe…` | 1 | 7 | 0 | yes |
| 19 | `selfmodel` | `self` | `runtime/neuro-kurisu/src/organism/cognition/P32Ca…` | 2 | 9 | 2 | yes |
| 20 | `usermodel` | `self` | `runtime/neuro-kurisu/src/organism/cognition/UserM…` | 1 | 13 | 0 | yes |
| 21 | `personality` | `self` | `runtime/neuro-kurisu/src/organism/cognition/P2702…` | 1 | 13 | 5 | yes |
| 22 | `affect-system` | `self` | `runtime/neuro-kurisu/src/organism/system/EmotionA…` | 1 | 33 | 5 | yes |
| 23 | `motivation` | `agency` | `runtime/neuro-kurisu/src/organism/cognition/Intri…` | 2 | 4 | 2 | yes |
| 24 | `autonomy` | `agency` | `runtime/neuro-kurisu/src/organism/system/Autonomo…` | 3 | 16 | 3 | yes |
| 25 | `embodiment` | `embodiment` | `runtime/neuro-kurisu/src/organism/body/Embodiment…` | 1 | 48 | 7 | yes |
| 26 | `live2d` | `embodiment` | `app/public/live2d` | 1 | 6 | 4 | yes |
| 27 | `2-5d` | `embodiment` | `app/src/components/avatar/depthRig.ts` | 1 | 12 | 6 | yes |
| 28 | `3d-avatar` | `embodiment` | `app/src/components/avatar/vrmRuntimeAdapter.ts` | 1 | 41 | 8 | yes |
| 29 | `body-intelligence` | `embodiment` | `runtime/neuro-kurisu/src/organism/body/P35Semanti…` | 2 | 4 | 0 | yes |
| 30 | `speech` | `embodiment` | `runtime/neuro-kurisu/src/organism/body/VoiceEmbod…` | 1 | 1 | 1 | yes |
| 31 | `voice-interaction` | `embodiment` | `runtime/neuro-kurisu/src/organism/body/NativeSpee…` | 1 | 0 | 0 | yes |
| 32 | `multimodal-interaction` | `embodiment` | `runtime/neuro-kurisu/src/organism/body/Multimodal…` | 2 | 0 | 0 | yes |
| 33 | `neko` | `research` | `**UNKNOWN**` | 2 | 41 | 1 | **no** |
| 34 | `hermes` | `research` | `runtime/neuro-kurisu/src/organism/learning/Hermes…` | 1 | 2 | 1 | yes |
| 35 | `firecrawl` | `research` | `engineering-os/manifest.v1.json` | 1 | 0 | 0 | yes |
| 36 | `tinyfish` | `research` | `engineering-os/manifest.v1.json` | 1 | 0 | 0 | yes |
| 37 | `context7` | `research` | `engineering-os/manifest.v1.json` | 1 | 0 | 0 | yes |
| 38 | `supabase` | `research` | `engineering-os/manifest.v1.json` | 1 | 0 | 0 | yes |
| 39 | `mongodb` | `research` | `engineering-os/manifest.v1.json` | 1 | 0 | 0 | yes |
| 40 | `redis` | `research` | `engineering-os/manifest.v1.json` | 1 | 0 | 0 | yes |
| 41 | `local-models` | `research` | `runtime/neuro-kurisu/src/organism/integration/loc…` | 1 | 1 | 1 | yes |
| 42 | `cloud-models` | `research` | `runtime/neuro-kurisu/src/organism/learning/P40Mod…` | 1 | 1 | 0 | yes |
| 43 | `replit-github` | `governance` | `.github/workflows` | 1 | 0 | 0 | yes |
| 44 | `agent-ecosystem` | `research` | `tools/neurok-os-coordinator.mjs` | 2 | 0 | 0 | yes |
| 45 | `ethical-gate` | `governance` | `runtime/neuro-kurisu/src/organism/system/ActionGa…` | 1 | 16 | 4 | yes |
| 46 | `permission-system` | `governance` | `runtime/neuro-kurisu/src/organism/system/ApiSecur…` | 1 | 1 | 0 | yes |
| 47 | `action-verification` | `governance` | `runtime/neuro-kurisu/src/organism/system/OutcomeC…` | 2 | 25 | 10 | yes |
| 48 | `memory-safety` | `governance` | `runtime/neuro-kurisu/src/organism/memory/Evidence…` | 1 | 2 | 0 | yes |
| 49 | `tool-security` | `governance` | `runtime/neuro-kurisu/src/organism/system/ToolInpu…` | 1 | 4 | 1 | yes |
| 50 | `self-modification` | `governance` | `runtime/neuro-kurisu/src/organism/system/Sandboxe…` | 2 | 4 | 2 | yes |
| 51 | `reliability` | `governance` | `runtime/neuro-kurisu/src/organism/persistence/Rec…` | 1 | 8 | 0 | yes |
| 52 | `observability` | `governance` | `runtime/neuro-kurisu/src/organism/persistence/Ope…` | 1 | 0 | 0 | yes |
| 53 | `desktop` | `embodiment` | `app` | 1 | 0 | 0 | yes |
| 54 | `android` | `embodiment` | `runtime/neuro-kurisu/src/organism/body/AndroidEmb…` | 1 | 2 | 1 | yes |
| 55 | `termux` | `embodiment` | `runtime/neuro-kurisu/src/organism/body/NativeSpee…` | 1 | 0 | 0 | yes |
| 56 | `ui-ux` | `embodiment` | `app/src/components/AvatarStage.tsx` | 1 | 3 | 0 | yes |
| 57 | `avatar-interface` | `embodiment` | `app/src/components/avatar/rendererCapabilityManif…` | 3 | 0 | 0 | yes |
| 58 | `synchronization` | `governance` | `runtime/neuro-kurisu/src/organism/persistence/Por…` | 1 | 5 | 0 | yes |
| 59 | `performance` | `governance` | `runtime/neuro-kurisu/src/organism/system/RuntimeP…` | 1 | 0 | 0 | yes |
| 60 | `unit-tests` | `research` | `runtime/neuro-kurisu/tests` | 1 | 0 | 0 | yes |
| 61 | `integration-tests` | `research` | `runtime/neuro-kurisu/tests` | 1 | 1 | 0 | yes |
| 62 | `architecture-tests` | `research` | `tools/verify-integration.mjs` | 1 | 4 | 2 | yes |
| 63 | `math-tests` | `research` | `runtime/neuro-kurisu/src/organism/memory/MemoryRe…` | 1 | 0 | 0 | yes |
| 64 | `cognitive-benchmarks` | `research` | `runtime/neuro-kurisu/src/organism/memory/MemoryRe…` | 1 | 7 | 3 | yes |
| 65 | `autonomy-soak` | `research` | `**UNKNOWN**` | 1 | 0 | 0 | **no** |
| 66 | `device-e2e` | `research` | `**UNKNOWN**` | 2 | 0 | 0 | **no** |
| 67 | `regression` | `research` | `.github/workflows` | 1 | 4 | 1 | yes |
| 68 | `independent-holdout` | `research` | `runtime/neuro-kurisu/tests/INDEPENDENT_BILINGUAL_…` | 1 | 22 | 2 | yes |
| 69 | `branch-consolidation` | `governance` | `docs/BRANCH_CONVERGENCE_AUDIT_2026-11-01_RU.md` | 1 | 15 | 3 | yes |
| 70 | `ci-cd` | `governance` | `.github/workflows` | 1 | 4 | 0 | yes |
| 71 | `release-pipeline` | `governance` | `scripts/publish-workpass70-main-sync.ps1` | 2 | 23 | 4 | yes |
| 72 | `license-review` | `governance` | `contracts/RELEASE_LICENSE_REVIEW.json` | 1 | 4 | 1 | yes |
| 73 | `documentation` | `governance` | `README.md` | 1 | 14 | 8 | yes |
| 74 | `backup-recovery` | `governance` | `tools/super-backup.mjs` | 1 | 0 | 0 | yes |
| 75 | `continuous-development` | `governance` | `engineering-os/manifest.v1.json` | 2 | 5 | 4 | yes |

## 4. Пробелы подключения

| n | Аспект | Проблема | Что сделать |
|---:|---|---|---|
| 33 | `neko` | owner = `UNKNOWN` | Назначить canonical/adapter owner и добавить evidence |
| 65 | `autonomy-soak` | owner = `UNKNOWN` | Назначить canonical/adapter owner и добавить evidence |
| 66 | `device-e2e` | owner = `UNKNOWN` | Назначить canonical/adapter owner и добавить evidence |

Остальные 72 аспекта имеют существующий owner-файл. 3 `UNKNOWN` — это N.E.K.O. (33), autonomy-soak (65), device-e2e (66); они не ломают граф, но остаются `owner-missing` и должны быть закрыты до объявления полной связности.

## 5. Branch/PR provenance

| Показатель | Значение |
|---|---:|
| Всего веток | 1106 |
| Привязано к 75 аспектам | 711 |
| group-only (домен без под-аспекта) | 353 |
| legacy (broad/независимые) | 42 |
| PR merged / closed / open / нет PR | 403 / 324 / 269 / 110 |

Provenance не означает, что ветку нужно мержить. Это карта «какая ветка относится к какому аспекту»; решение о merge принимается отдельно по focused/rebase/CI.

## 6. Как проверить

```bash
node tools/neurok-aspect-fabric.mjs --check --json
node tools/neurok-aspect-fabric.mjs --write   # пересобрать manifest
npm --prefix runtime/neuro-kurisu run test:aspect-fabric
```

Ожидаемый результат: `ASPECT_FABRIC=PASS aspects=75 domains=10 systems=7 connected=true nodes=83` и `ASPECT_FABRIC_INTEGRATION=PASS`.

## 7. Что это даёт для объединения проекта

1. **Единая карта.** Любая ветка/PR теперь имеет аспект и физическую систему, а не живёт отдельно.
2. **Один граф зависимостей.** Можно строить порядок подключения: `topologicalOrder()` и `path(from,to)`.
3. **Один health-контур.** `OrganismAspectFabric.health()` проверяет граф, 7 систем и 7 подсистем одновременно.
4. **Безопасное подключение runtime.** `OrganismRuntime.attachAspectFabric()` добавляет слой после конструктора, не меняя цикл и не запуская side effects.
5. **Следующий шаг.** Закрыть 3 `UNKNOWN` owner, затем для каждого аспекта выбрать одну canonical-ветку; остальные — archive. Merge — только focused + rebase + exact-head CI.
