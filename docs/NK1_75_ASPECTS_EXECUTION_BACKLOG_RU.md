# NK1 / NeuroCore — 75 аспектов: исполняемый backlog и учёт прогресса

**Версия:** 04.11.2026 · **Рабочая ветка:** `workpass70-source`

**Наблюдаемый source HEAD на момент составления:** `06e8831447b29bc128cc56ba03dbf942471bea5b`

> Observed at authoring time only; refresh the live workpass70-source head before relying on this value. Never assume it stays current.

Машиночитаемый источник истины этого плана — [`engineering-os/aspects.v1.json`](../engineering-os/aspects.v1.json). Документ ниже — его человекочитаемая проекция; при расхождении верен JSON. Проверка и отчёты выполняются через `npm run aspects:validate`, `npm run aspects`, `npm run aspects:report`, `npm run aspects:next`.

## Как это устроено

- **75 аспектов** сгруппированы в **10 предметных областей** (I–X) и разложены по **6 волнам** исполнения.
- У каждого аспекта есть владелец (`owner`), статус владельца (`canonical` / `candidate` / `candidate-pr` / `unmapped`), зависимости (`dependsOn`), ворота проверки (`verificationGate`) и текущий статус.
- Статусы: `PLANNED`, `IMPLEMENTED`, `CONNECTED`, `TESTED`, `PROVEN`, `BLOCKED`, `DEFERRED`, `REJECTED`. **Проверенными считаются только `CONNECTED`/`TESTED`/`PROVEN`.**
- **Fail-closed:** статус `CONNECTED`/`TESTED`/`PROVEN` без непустой ссылки на свидетельство делает реестр невалидным. `REJECTED` обязан содержать причину.
- **`IMPLEMENTED` не значит «подключено».** Наличие интерфейса, записи в каталоге или открытого PR — это не функциональность.
- Зависимости ацикличны; волны могут пересекаться (стабилизационный аспект может готовить более позднюю волну). Тег `wave` аспекта равен самой ранней волне, где он встречается.

## Волны

| Волна | Название | Аспектов | Проверено |
|---|---|---:|---:|
| 1 (критическая) | Стабилизация | 12 | 0 |
| 2 | Единый организм | 15 | 0 |
| 3 | Самостоятельность | 14 | 1 |
| 4 | Внешнее взаимодействие | 20 | 0 |
| 5 | Реальные платформы | 10 | 0 |
| 6 | Подтверждение готовности | 7 | 0 |

> Волна 1 помечена как критическая в исходном плане. Пересечение волн 1 и 2 (аспекты 04–06) сохранено: стабилизация ядра/цикла/Engineering OS одновременно готовит единый организм.

## Реестр аспектов

### I. Фундамент и архитектура

| № | Аспект | Владелец | Статус владельца | Ворота | Зависит от | Статус |
|---:|---|---|---|---|---|---|
| 01 | Core Architecture | `runtime/neuro-kurisu/src/organism/core/OrganismCore.ts` | canonical | architecture | — | IMPLEMENTED |
| 02 | OrganismBus | `runtime/neuro-kurisu/src/organism/cognition/CognitiveNetworkBus.ts` | canonical | integration | core-architecture | IMPLEMENTED |
| 03 | OrganismState | `runtime/neuro-kurisu/src/organism/persistence/FileStateStore.ts` | canonical | integration | core-architecture | IMPLEMENTED |
| 04 | Cognitive Kernel | `runtime/neuro-kurisu/src/organism/core/CognitiveKernelCoordinator.ts` | canonical | integration | core-architecture | IMPLEMENTED |
| 05 | Cognitive Cycle | `runtime/neuro-kurisu/src/organism/core/CognitiveCycleBoundary.ts` | canonical | integration | cognitive-kernel, organism-bus, organism-state | IMPLEMENTED |
| 06 | Engineering OS | `engineering-os/manifest.v1.json` | canonical | architecture | core-architecture | IMPLEMENTED |

### II. Интеллект и познание

| № | Аспект | Владелец | Статус владельца | Ворота | Зависит от | Статус |
|---:|---|---|---|---|---|---|
| 07 | Perception | `runtime/neuro-kurisu/src/organism/body/PerceptionRouter.ts` | canonical | integration | cognitive-cycle | IMPLEMENTED |
| 08 | World Model | `runtime/neuro-kurisu/src/organism/world/WorldModel.ts` | canonical | integration | perception | IMPLEMENTED |
| 09 | Reasoning | `UNKNOWN` | unmapped | cognitive | cognitive-kernel | IMPLEMENTED |
| 10 | Planning | `runtime/neuro-kurisu/src/organism/world/PlanEngine.ts` | canonical | cognitive | reasoning, world-model | IMPLEMENTED |
| 11 | Metacognition | `runtime/neuro-kurisu/src/organism/cognition/MetaCognitiveMonitor.ts` | canonical | cognitive | cognitive-kernel | IMPLEMENTED |
| 12 | Attention | `runtime/neuro-kurisu/src/organism/cognition/P81PredictiveAttention.ts` | canonical | cognitive | cognitive-kernel | IMPLEMENTED |

### III. Память и обучение

| № | Аспект | Владелец | Статус владельца | Ворота | Зависит от | Статус |
|---:|---|---|---|---|---|---|
| 13 | MemoryOS2 | `runtime/neuro-kurisu/src/organism/developmental/MemoryOS2.ts` | canonical | integration | organism-state | IMPLEMENTED |
| 14 | Retrieval | `runtime/neuro-kurisu/src/organism/developmental/MemorySignalFusion.ts` | canonical | math | memoryos2 | IMPLEMENTED |
| 15 | Consolidation | `runtime/neuro-kurisu/src/organism/memory/MemoryConsolidationController.ts` | canonical | integration | memoryos2 | IMPLEMENTED |
| 16 | Continual Learning | `runtime/neuro-kurisu/src/organism/learning/ContinualReplayBuffer.ts` | canonical | cognitive | retrieval, consolidation | IMPLEMENTED |
| 17 | Skill System | `runtime/neuro-kurisu/src/organism/learning/ProceduralSkillLibrary.ts` | canonical | integration | continual-learning | IMPLEMENTED |
| 18 | Evaluation | `runtime/neuro-kurisu/src/organism/memory/MemoryRetrievalBenchmark.ts` | canonical | independent | math-tests | IMPLEMENTED |

### IV. Личность, мотивация и автономность

| № | Аспект | Владелец | Статус владельца | Ворота | Зависит от | Статус |
|---:|---|---|---|---|---|---|
| 19 | SelfModel | `runtime/neuro-kurisu/src/organism/cognition/P32CausalSelfModel.ts` | canonical | integration | memoryos2, metacognition | IMPLEMENTED |
| 20 | UserModel | `runtime/neuro-kurisu/src/organism/cognition/UserModelEvidenceModel.ts` | canonical | integration | selfmodel | IMPLEMENTED |
| 21 | Personality | `runtime/neuro-kurisu/src/organism/cognition/P2702PersistentPersonalityDynamics.ts` | canonical | integration | selfmodel | IMPLEMENTED |
| 22 | Affect System | `runtime/neuro-kurisu/src/organism/system/EmotionAppraisalEngine.ts` | canonical | integration | personality | IMPLEMENTED |
| 23 | Motivation | `runtime/neuro-kurisu/src/organism/cognition/IntrinsicMotivationGoalCoupling.ts` | canonical | integration | affect-system, selfmodel | IMPLEMENTED |
| 24 | Autonomy | `runtime/neuro-kurisu/src/organism/system/AutonomousRuntimeLifeController.ts` | canonical | soak | motivation, planning, ethical-gate | IMPLEMENTED |

### V. Тело, голос и взаимодействие

| № | Аспект | Владелец | Статус владельца | Ворота | Зависит от | Статус |
|---:|---|---|---|---|---|---|
| 25 | Embodiment | `runtime/neuro-kurisu/src/organism/body/EmbodimentRuntime.ts` | canonical | integration | cognitive-cycle | IMPLEMENTED |
| 26 | Live2D | `app/public/live2d` | canonical | device | embodiment | IMPLEMENTED |
| 27 | 2.5D | `app/src/components/avatar/depthRig.ts` | canonical | device | embodiment | IMPLEMENTED |
| 28 | 3D Avatar | `app/src/components/avatar/vrmRuntimeAdapter.ts` | canonical | device | embodiment | IMPLEMENTED |
| 29 | Body Intelligence | `runtime/neuro-kurisu/src/organism/body/P35SemanticWorldBody.ts` | canonical | integration | embodiment, affect-system | IMPLEMENTED |
| 30 | Speech | `runtime/neuro-kurisu/src/organism/body/VoiceEmbodiment.ts` | canonical | device | embodiment | IMPLEMENTED |
| 31 | Voice Interaction | `runtime/neuro-kurisu/src/organism/body/NativeSpeechEventChannel.ts` | canonical | device | speech | IMPLEMENTED |
| 32 | Multimodal Interaction | `runtime/neuro-kurisu/src/organism/body/MultimodalPerception.ts` | canonical | integration | perception, voice-interaction | IMPLEMENTED |

### VI. Интеграции и инструменты

| № | Аспект | Владелец | Статус владельца | Ворота | Зависит от | Статус |
|---:|---|---|---|---|---|---|
| 33 | N.E.K.O. | `UNKNOWN` | candidate-pr | integration | permission-system, skill-system | PLANNED |
| 34 | Hermes | `runtime/neuro-kurisu/src/organism/learning/HermesVerifiedEvidenceBinding.ts` | canonical | integration | skill-system | IMPLEMENTED |
| 35 | Firecrawl | `engineering-os/manifest.v1.json` | candidate | integration | permission-system | PLANNED |
| 36 | TinyFish | `engineering-os/manifest.v1.json` | candidate | integration | permission-system | PLANNED |
| 37 | Context7 | `engineering-os/manifest.v1.json` | candidate | integration | permission-system | PLANNED |
| 38 | Supabase | `engineering-os/manifest.v1.json` | candidate | integration | permission-system | PLANNED |
| 39 | MongoDB | `engineering-os/manifest.v1.json` | candidate | integration | permission-system | PLANNED |
| 40 | Redis | `engineering-os/manifest.v1.json` | candidate | integration | permission-system | PLANNED |
| 41 | Local Models | `runtime/neuro-kurisu/src/organism/integration/local/OpenAICompatibleLocalChatProvider.ts` | canonical | integration | reasoning | IMPLEMENTED |
| 42 | Cloud Models | `runtime/neuro-kurisu/src/organism/learning/P40ModelEcology.ts` | canonical | integration | local-models | IMPLEMENTED |
| 43 | Replit / GitHub | `.github/workflows` | canonical | architecture | engineering-os | IMPLEMENTED |
| 44 | Agent Ecosystem | `tools/neurok-os-coordinator.mjs` | canonical | architecture | engineering-os, replit-github | IMPLEMENTED |

### VII. Безопасность и надёжность

| № | Аспект | Владелец | Статус владельца | Ворота | Зависит от | Статус |
|---:|---|---|---|---|---|---|
| 45 | EthicalGate | `runtime/neuro-kurisu/src/organism/system/ActionGateway.ts` | canonical | integration | permission-system | IMPLEMENTED |
| 46 | Permission System | `runtime/neuro-kurisu/src/organism/system/ApiSecurityPolicy.ts` | canonical | integration | core-architecture | IMPLEMENTED |
| 47 | Action Verification | `runtime/neuro-kurisu/src/organism/system/OutcomeCognitionFabric.ts` | canonical | integration | permission-system, autonomy | IMPLEMENTED |
| 48 | Memory Safety | `runtime/neuro-kurisu/src/organism/memory/EvidenceLineageProvenance.ts` | canonical | integration | memoryos2 | IMPLEMENTED |
| 49 | Tool Security | `runtime/neuro-kurisu/src/organism/system/ToolInputContract.ts` | canonical | integration | permission-system | IMPLEMENTED |
| 50 | Self-Modification | `runtime/neuro-kurisu/src/organism/system/SandboxedSelfRewriteEngine.ts` | canonical | integration | permission-system, action-verification | IMPLEMENTED |
| 51 | Reliability | `runtime/neuro-kurisu/src/organism/persistence/RecoveryWatchdog.ts` | canonical | integration | organism-state | TESTED |
| 52 | Observability | `runtime/neuro-kurisu/src/organism/persistence/OperationalJournal.ts` | canonical | integration | engineering-os | IMPLEMENTED |

### VIII. Приложение и платформы

| № | Аспект | Владелец | Статус владельца | Ворота | Зависит от | Статус |
|---:|---|---|---|---|---|---|
| 53 | Desktop | `app` | canonical | device | embodiment | IMPLEMENTED |
| 54 | Android | `runtime/neuro-kurisu/src/organism/body/AndroidEmbodimentBridge.ts` | canonical | device | embodiment | IMPLEMENTED |
| 55 | Termux | `runtime/neuro-kurisu/src/organism/body/NativeSpeechHostRouter.ts` | canonical | device | android | IMPLEMENTED |
| 56 | UI/UX | `app/src/components/AvatarStage.tsx` | canonical | device | embodiment | IMPLEMENTED |
| 57 | Avatar Interface | `app/src/components/avatar/rendererCapabilityManifest.ts` | canonical | device | live2d, 2-5d, 3d-avatar | IMPLEMENTED |
| 58 | Synchronization | `runtime/neuro-kurisu/src/organism/persistence/PortableSubjectContract.ts` | canonical | integration | organism-state | IMPLEMENTED |
| 59 | Performance | `runtime/neuro-kurisu/src/organism/system/RuntimePerformanceGovernor.ts` | canonical | device | reliability | IMPLEMENTED |

### IX. Тестирование и научная проверка

| № | Аспект | Владелец | Статус владельца | Ворота | Зависит от | Статус |
|---:|---|---|---|---|---|---|
| 60 | Unit Tests | `runtime/neuro-kurisu/tests` | canonical | unit | core-architecture | IMPLEMENTED |
| 61 | Integration Tests | `runtime/neuro-kurisu/tests` | canonical | integration | cognitive-cycle | IMPLEMENTED |
| 62 | Architecture Tests | `tools/verify-integration.mjs` | canonical | architecture | core-architecture | IMPLEMENTED |
| 63 | Mathematical Tests | `runtime/neuro-kurisu/src/organism/memory/MemoryRetrievalExperiment.ts` | canonical | math | integration-tests | IMPLEMENTED |
| 64 | Cognitive Benchmarks | `runtime/neuro-kurisu/src/organism/memory/MemoryRetrievalBenchmark.ts` | canonical | cognitive | math-tests | IMPLEMENTED |
| 65 | Autonomy Soak | `UNKNOWN` | unmapped | soak | autonomy | PLANNED |
| 66 | Device E2E | `UNKNOWN` | unmapped | device | desktop, android | PLANNED |
| 67 | Regression | `.github/workflows` | canonical | unit | unit-tests | IMPLEMENTED |
| 68 | Independent Holdout | `runtime/neuro-kurisu/tests/INDEPENDENT_BILINGUAL_HOLDOUT.md` | canonical | independent | evaluation | PLANNED |

### X. Релиз и развитие

| № | Аспект | Владелец | Статус владельца | Ворота | Зависит от | Статус |
|---:|---|---|---|---|---|---|
| 69 | Branch Consolidation | `docs/BRANCH_CONVERGENCE_AUDIT_2026-11-01_RU.md` | canonical | architecture | engineering-os | IMPLEMENTED |
| 70 | CI/CD | `.github/workflows` | canonical | architecture | architecture-tests | IMPLEMENTED |
| 71 | Release Pipeline | `scripts/publish-workpass70-main-sync.ps1` | canonical | release | ci-cd, branch-consolidation | IMPLEMENTED |
| 72 | License Review | `contracts/RELEASE_LICENSE_REVIEW.json` | canonical | release | release-pipeline | BLOCKED |
| 73 | Documentation | `README.md` | canonical | architecture | core-architecture | IMPLEMENTED |
| 74 | Backup & Recovery | `tools/super-backup.mjs` | canonical | integration | reliability | IMPLEMENTED |
| 75 | Continuous Development | `engineering-os/manifest.v1.json` | canonical | architecture | engineering-os, ci-cd | PLANNED |

## Легенда ворот проверки

| Ворота | Что требуется для перевода аспекта в проверенный статус |
|---|---|
| `architecture` | Проверка владения, импортов, контрактов и графа зависимостей. |
| `integration` | Реальная связка модулей и сквозной путь вызова, а не изолированный юнит. |
| `unit` | Поведенческая регрессия, которая падает до правки и проходит после неё. |
| `math` | Метрика (recall/confidence/calibration/значимость) на фиксированном протоколе. |
| `cognitive` | Бенчмарк рассуждения/планирования/памяти/переноса на независимых данных. |
| `independent` | Независимый holdout с парными seed-ами; промоушен только при измеренной пользе. |
| `device` | Реальное устройство/браузер: E2E, latency, drift, soak. |
| `soak` | Длительная автономная работа с объяснимыми внутренними причинами действий. |
| `release` | Воспроизводимый ZIP с provenance, SBOM и разрешённой лицензией. |

## Критерии готовности (из плана)

| Показатель | Цель |
|---|---|
| Детерминированные ticks | 10000 |
| Memory search / 10k | <= 30 мс |
| Recall improvement | > 0 |
| Paired seeds | >= 5 |
| Tick latency на телефоне | <= 50 мс |
| Lip-sync drift | <= 80 мс |
| Interrupt latency | <= 200 мс |
| Автономные инициативы | >= 1/час |
| Runtime recovery | Без потери подтверждённого состояния |
| Release | Проверенный ZIP с provenance и разрешённой лицензией |

## Текущая честная картина

По состоянию на 2026-11-04:

- Всего аспектов: **75**.
- `IMPLEMENTED` (код существует): **62**.
- `PLANNED` (не реализовано/не подключено): **11** — neko, firecrawl, tinyfish, context7, supabase, mongodb, redis, autonomy-soak, device-e2e, independent-holdout, continuous-development.
- `BLOCKED`: **1** — license-review.
- Проверено (`CONNECTED`/`TESTED`/`PROVEN`): **1** — reliability (PR #594 (11/11 exact-head checks) missing/corrupt-primary re…).

**Вывод:** плана 75 аспектов достаточно для разбиения работы, но глобальная готовность проекта этим не измеряется. `IMPLEMENTED` отражает существование кода, а не подтверждённую способность. Проверенные аспекты появятся только после прохождения соответствующих ворот с независимыми свидетельствами.

## Аспекты без подтверждённого владельца

Для следующих аспектов канонический владелец не подтверждён живой инвентаризацией. Перед изменением кода владелец должен быть найден, иначе аспект остаётся `unmapped`:

- **09 Reasoning** — No single reasoning owner; deductive/inductive/abductive/probabilistic capability is scattered (NeuroSymbolicConceptCompiler.ts is partial). Confirm the owner before changing.
- **33 N.E.K.O.** — Only open PRs (#780-#792) adapt the N.E.K.O. gateway; there is no merged canonical owner yet.
- **65 Autonomy Soak** — No long autonomous soak has run; >=1 initiative/hour and explainable causes are unproven.
- **66 Device E2E** — No real PC/Android E2E is recorded; lip-sync, interrupt and tick-latency targets are unmeasured.

## Правила разработки (из плана)

1. A CONNECTED/TESTED/PROVEN aspect must carry a non-empty evidence reference; otherwise the registry is invalid.
2. An interface, catalog entry or open PR is not connected functionality.
3. A passing unit test is not proof of real behaviour.
4. Do not create duplicate state owners; integrate into the canonical owner or mark the aspect REJECTED with a reason.
5. Refresh the live source SHA before integration; a moved base invalidates prior evidence.
6. Do not delete useful branches or history during consolidation.
7. Every improvement needs measurable evidence and must reach a verified Release ZIP.
8. Do not declare an aspect done before its corresponding gate passes.

## Что дальше

Этот реестр превращает 75 аспектов в исполняемый backlog. Следующие шаги:

1. `npm run aspects:next` — выбрать следующий аспект с уже проверенными зависимостями.
2. Взять отдельную ветку под аспект, реализовать минимальную поведенческую правку и регрессию.
3. Пройти ворота аспекта; только затем перевести статус в проверенный и добавить свидетельство.
4. Обновлять `observedSourceHead` и статусы по мере продвижения; еженедельный workflow напомнит о расхождении SHA.

