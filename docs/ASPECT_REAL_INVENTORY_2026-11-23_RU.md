# NK1 / NeuroCore — реальная инвентаризация 75 аспектов

**Дата:** 2026-11-23  
**Ствол:** `workpass70-source` @ `71343b17c`  
**Тип:** проверка фактического кода: owner-файл, экспорты, тесты, ветки/PR, readiness и gaps.

## 0. Резюме

| Показатель | Значение |
|---|---:|
| Аспектов | 75 |
| Owner-файлов существует | **75 / 75** |
| Owner-файлов / каталогов | 67 / 8 |
| Аспектов с найденными тестами | 65 |
| Веток, привязанных к аспектам | 711 |
| Open PR в аспектах | 164 |
| Candidate owners | 10 |
| PLANNED | 11 |
| Без тестов | 10 |
| Без веток | 20 |

**Главное:** owner-покрытие **75/75**. Три ранее `UNKNOWN` назначены candidate-owners: N.E.K.O. → `integration/neko`, autonomy-soak → `p2684-mobile-soak.mjs`, device-e2e → `big-pass-177-device-truthfulness.mjs`. Это candidate, evidence-gate ещё не пройден.

## 1. Readiness

| Readiness | Аспектов | Что означает |
|---|---:|---|
| `owner+tests+branches` | 48 | owner + тесты + ветки: strongest current evidence |
| `owner+branches` | 7 | owner + ветки, тесты не найдены |
| `owner+tests` | 17 | owner + тесты, веток нет |
| `owner-only` | 3 | только owner-файл |
| `owner-missing` | 0 | owner отсутствует |

`testsFound` — эвристика: `git grep` по owner basename/aspect id в `runtime/neuro-kurisu/tests` и `tools`. Это сигнал, не доказательство.

## 2. Аспекты без тестов

| n | Аспект | Система | Owner | Веток |
|---:|---|---|---|---:|
| 28 | `3d-avatar` | `embodiment` | `app/src/components/avatar/vrmRuntimeAdapter.ts` | 41 |
| 48 | `memory-safety` | `governance` | `runtime/neuro-kurisu/src/organism/memory/EvidenceLineageProvenance.ts` | 2 |
| 49 | `tool-security` | `governance` | `runtime/neuro-kurisu/src/organism/system/ToolInputContract.ts` | 4 |
| 53 | `desktop` | `embodiment` | `app` | 0 |
| 56 | `ui-ux` | `embodiment` | `app/src/components/AvatarStage.tsx` | 3 |
| 57 | `avatar-interface` | `embodiment` | `app/src/components/avatar/rendererCapabilityManifest.ts` | 0 |
| 62 | `architecture-tests` | `research` | `tools/verify-integration.mjs` | 4 |
| 69 | `branch-consolidation` | `governance` | `docs/BRANCH_CONVERGENCE_AUDIT_2026-11-01_RU.md` | 15 |
| 73 | `documentation` | `governance` | `README.md` | 14 |
| 74 | `backup-recovery` | `governance` | `tools/super-backup.mjs` | 0 |

## 3. Аспекты без веток

| n | Аспект | Система | Owner | Тестов |
|---:|---|---|---|---:|
| 31 | `voice-interaction` | `embodiment` | `runtime/neuro-kurisu/src/organism/body/NativeSpeechEventChannel.ts` | 1 |
| 32 | `multimodal-interaction` | `embodiment` | `runtime/neuro-kurisu/src/organism/body/MultimodalPerception.ts` | 3 |
| 35 | `firecrawl` | `research` | `engineering-os/manifest.v1.json` | 2 |
| 36 | `tinyfish` | `research` | `engineering-os/manifest.v1.json` | 2 |
| 37 | `context7` | `research` | `engineering-os/manifest.v1.json` | 2 |
| 38 | `supabase` | `research` | `engineering-os/manifest.v1.json` | 3 |
| 39 | `mongodb` | `research` | `engineering-os/manifest.v1.json` | 2 |
| 40 | `redis` | `research` | `engineering-os/manifest.v1.json` | 8 |
| 43 | `replit-github` | `governance` | `.github/workflows` | 11 |
| 44 | `agent-ecosystem` | `research` | `tools/neurok-os-coordinator.mjs` | 2 |
| 52 | `observability` | `governance` | `runtime/neuro-kurisu/src/organism/persistence/OperationalJournal.ts` | 51 |
| 53 | `desktop` | `embodiment` | `app` | 0 |
| 55 | `termux` | `embodiment` | `runtime/neuro-kurisu/src/organism/body/NativeSpeechHostRouter.ts` | 37 |
| 57 | `avatar-interface` | `embodiment` | `app/src/components/avatar/rendererCapabilityManifest.ts` | 0 |
| 59 | `performance` | `governance` | `runtime/neuro-kurisu/src/organism/system/RuntimePerformanceGovernor.ts` | 338 |
| 60 | `unit-tests` | `research` | `runtime/neuro-kurisu/tests` | 1546 |
| 63 | `math-tests` | `research` | `runtime/neuro-kurisu/src/organism/memory/MemoryRetrievalExperiment.ts` | 3 |
| 65 | `autonomy-soak` | `research` | `runtime/neuro-kurisu/tests/p2684-mobile-soak.mjs` | 1 |
| 66 | `device-e2e` | `research` | `runtime/neuro-kurisu/tests/big-pass-177-device-truthfulness.mjs` | 1 |
| 74 | `backup-recovery` | `governance` | `tools/super-backup.mjs` | 0 |

## 4. Candidate owners

| n | Аспект | Owner | Gaps |
|---:|---|---|---|
| 9 | `reasoning` | `runtime/neuro-kurisu/src/organism/cognition/PerceptualEpistemicGraph.t` | candidate-owner |
| 33 | `neko` | `runtime/neuro-kurisu/src/organism/integration/neko` | candidate-owner, status-planned |
| 35 | `firecrawl` | `engineering-os/manifest.v1.json` | candidate-owner, no-branches, status-planned |
| 36 | `tinyfish` | `engineering-os/manifest.v1.json` | candidate-owner, no-branches, status-planned |
| 37 | `context7` | `engineering-os/manifest.v1.json` | candidate-owner, no-branches, status-planned |
| 38 | `supabase` | `engineering-os/manifest.v1.json` | candidate-owner, no-branches, status-planned |
| 39 | `mongodb` | `engineering-os/manifest.v1.json` | candidate-owner, no-branches, status-planned |
| 40 | `redis` | `engineering-os/manifest.v1.json` | candidate-owner, no-branches, status-planned |
| 65 | `autonomy-soak` | `runtime/neuro-kurisu/tests/p2684-mobile-soak.mjs` | candidate-owner, no-branches, status-planned |
| 66 | `device-e2e` | `runtime/neuro-kurisu/tests/big-pass-177-device-truthfulness.mjs` | candidate-owner, no-branches, status-planned |

## 5. PLANNED

| n | Аспект | Система | Owner | Веток | Тестов |
|---:|---|---|---|---:|---:|
| 33 | `neko` | `research` | `runtime/neuro-kurisu/src/organism/integration/neko` | 41 | 20 |
| 35 | `firecrawl` | `research` | `engineering-os/manifest.v1.json` | 0 | 2 |
| 36 | `tinyfish` | `research` | `engineering-os/manifest.v1.json` | 0 | 2 |
| 37 | `context7` | `research` | `engineering-os/manifest.v1.json` | 0 | 2 |
| 38 | `supabase` | `research` | `engineering-os/manifest.v1.json` | 0 | 3 |
| 39 | `mongodb` | `research` | `engineering-os/manifest.v1.json` | 0 | 2 |
| 40 | `redis` | `research` | `engineering-os/manifest.v1.json` | 0 | 8 |
| 65 | `autonomy-soak` | `research` | `runtime/neuro-kurisu/tests/p2684-mobile-soak.mjs` | 0 | 1 |
| 66 | `device-e2e` | `research` | `runtime/neuro-kurisu/tests/big-pass-177-device-truthfulness.mjs` | 0 | 1 |
| 68 | `independent-holdout` | `research` | `runtime/neuro-kurisu/tests/INDEPENDENT_BILINGUAL_HOLDOUT.md` | 22 | 1 |
| 75 | `continuous-development` | `governance` | `engineering-os/manifest.v1.json` | 5 | 2 |

## 6. Полная таблица 75 аспектов

| n | Аспект | Система | Owner | Тип | Тестов | Веток | open | Readiness | Gaps |
|---:|---|---|---|---|---:|---:|---:|---|---|
| 1 | `core-architecture` | `self` | `runtime/neuro-kurisu/src/organism/core/OrganismCore.ts` | file | 368 | 27 | 10 | `owner+tests+branches` | — |
| 2 | `organism-bus` | `self` | `runtime/neuro-kurisu/src/organism/cognition/CognitiveNetwo…` | file | 3 | 2 | 0 | `owner+tests+branches` | — |
| 3 | `organism-state` | `self` | `runtime/neuro-kurisu/src/organism/persistence/FileStateSto…` | file | 93 | 17 | 3 | `owner+tests+branches` | — |
| 4 | `cognitive-kernel` | `self` | `runtime/neuro-kurisu/src/organism/core/CognitiveKernelCoor…` | file | 12 | 6 | 5 | `owner+tests+branches` | — |
| 5 | `cognitive-cycle` | `self` | `runtime/neuro-kurisu/src/organism/core/CognitiveCycleBound…` | file | 6 | 6 | 3 | `owner+tests+branches` | — |
| 6 | `engineering-os` | `governance` | `engineering-os/manifest.v1.json` | file | 8 | 1 | 0 | `owner+tests+branches` | — |
| 7 | `perception` | `world` | `runtime/neuro-kurisu/src/organism/body/PerceptionRouter.ts` | file | 52 | 3 | 1 | `owner+tests+branches` | — |
| 8 | `world-model` | `world` | `runtime/neuro-kurisu/src/organism/world/WorldModel.ts` | file | 84 | 1 | 0 | `owner+tests+branches` | — |
| 9 | `reasoning` | `world` | `runtime/neuro-kurisu/src/organism/cognition/PerceptualEpis…` | file | 25 | 1 | 0 | `owner+tests+branches` | candidate-owner |
| 10 | `planning` | `world` | `runtime/neuro-kurisu/src/organism/world/PlanEngine.ts` | file | 35 | 4 | 0 | `owner+tests+branches` | — |
| 11 | `metacognition` | `self` | `runtime/neuro-kurisu/src/organism/cognition/MetaCognitiveM…` | file | 8 | 8 | 2 | `owner+tests+branches` | — |
| 12 | `attention` | `self` | `runtime/neuro-kurisu/src/organism/cognition/P81PredictiveA…` | file | 190 | 6 | 2 | `owner+tests+branches` | — |
| 13 | `memoryos2` | `memory` | `runtime/neuro-kurisu/src/organism/developmental/MemoryOS2.…` | file | 91 | 158 | 31 | `owner+tests+branches` | — |
| 14 | `retrieval` | `memory` | `runtime/neuro-kurisu/src/organism/developmental/MemorySign…` | file | 105 | 7 | 0 | `owner+tests+branches` | — |
| 15 | `consolidation` | `memory` | `runtime/neuro-kurisu/src/organism/memory/MemoryConsolidati…` | file | 77 | 8 | 4 | `owner+tests+branches` | — |
| 16 | `continual-learning` | `memory` | `runtime/neuro-kurisu/src/organism/learning/ContinualReplay…` | file | 7 | 22 | 8 | `owner+tests+branches` | — |
| 17 | `skill-system` | `memory` | `runtime/neuro-kurisu/src/organism/learning/ProceduralSkill…` | file | 9 | 9 | 3 | `owner+tests+branches` | — |
| 18 | `evaluation` | `research` | `runtime/neuro-kurisu/src/organism/memory/MemoryRetrievalBe…` | file | 88 | 7 | 0 | `owner+tests+branches` | — |
| 19 | `selfmodel` | `self` | `runtime/neuro-kurisu/src/organism/cognition/P32CausalSelfM…` | file | 4 | 9 | 2 | `owner+tests+branches` | — |
| 20 | `usermodel` | `self` | `runtime/neuro-kurisu/src/organism/cognition/UserModelEvide…` | file | 4 | 13 | 0 | `owner+tests+branches` | — |
| 21 | `personality` | `self` | `runtime/neuro-kurisu/src/organism/cognition/P2702Persisten…` | file | 115 | 13 | 5 | `owner+tests+branches` | — |
| 22 | `affect-system` | `self` | `runtime/neuro-kurisu/src/organism/system/EmotionAppraisalE…` | file | 4 | 33 | 5 | `owner+tests+branches` | — |
| 23 | `motivation` | `agency` | `runtime/neuro-kurisu/src/organism/cognition/IntrinsicMotiv…` | file | 29 | 4 | 2 | `owner+tests+branches` | — |
| 24 | `autonomy` | `agency` | `runtime/neuro-kurisu/src/organism/system/AutonomousRuntime…` | file | 215 | 16 | 3 | `owner+tests+branches` | — |
| 25 | `embodiment` | `embodiment` | `runtime/neuro-kurisu/src/organism/body/EmbodimentRuntime.t…` | file | 254 | 48 | 7 | `owner+tests+branches` | — |
| 26 | `live2d` | `embodiment` | `app/public/live2d` | directory | 6 | 6 | 4 | `owner+tests+branches` | — |
| 27 | `2-5d` | `embodiment` | `app/src/components/avatar/depthRig.ts` | file | 1 | 12 | 6 | `owner+tests+branches` | — |
| 28 | `3d-avatar` | `embodiment` | `app/src/components/avatar/vrmRuntimeAdapter.ts` | file | 0 | 41 | 8 | `owner+branches` | no-tests |
| 29 | `body-intelligence` | `embodiment` | `runtime/neuro-kurisu/src/organism/body/P35SemanticWorldBod…` | file | 3 | 4 | 0 | `owner+tests+branches` | — |
| 30 | `speech` | `embodiment` | `runtime/neuro-kurisu/src/organism/body/VoiceEmbodiment.ts` | file | 23 | 1 | 1 | `owner+tests+branches` | — |
| 31 | `voice-interaction` | `embodiment` | `runtime/neuro-kurisu/src/organism/body/NativeSpeechEventCh…` | file | 1 | 0 | 0 | `owner+tests` | no-branches |
| 32 | `multimodal-interaction` | `embodiment` | `runtime/neuro-kurisu/src/organism/body/MultimodalPerceptio…` | file | 3 | 0 | 0 | `owner+tests` | no-branches |
| 33 | `neko` | `research` | `runtime/neuro-kurisu/src/organism/integration/neko` | directory | 20 | 41 | 1 | `owner+tests+branches` | candidate-owner, status-planned |
| 34 | `hermes` | `research` | `runtime/neuro-kurisu/src/organism/learning/HermesVerifiedE…` | file | 1 | 2 | 1 | `owner+tests+branches` | — |
| 35 | `firecrawl` | `research` | `engineering-os/manifest.v1.json` | file | 2 | 0 | 0 | `owner+tests` | candidate-owner, no-branches, status-planned |
| 36 | `tinyfish` | `research` | `engineering-os/manifest.v1.json` | file | 2 | 0 | 0 | `owner+tests` | candidate-owner, no-branches, status-planned |
| 37 | `context7` | `research` | `engineering-os/manifest.v1.json` | file | 2 | 0 | 0 | `owner+tests` | candidate-owner, no-branches, status-planned |
| 38 | `supabase` | `research` | `engineering-os/manifest.v1.json` | file | 3 | 0 | 0 | `owner+tests` | candidate-owner, no-branches, status-planned |
| 39 | `mongodb` | `research` | `engineering-os/manifest.v1.json` | file | 2 | 0 | 0 | `owner+tests` | candidate-owner, no-branches, status-planned |
| 40 | `redis` | `research` | `engineering-os/manifest.v1.json` | file | 8 | 0 | 0 | `owner+tests` | candidate-owner, no-branches, status-planned |
| 41 | `local-models` | `research` | `runtime/neuro-kurisu/src/organism/integration/local/OpenAI…` | file | 4 | 1 | 1 | `owner+tests+branches` | — |
| 42 | `cloud-models` | `research` | `runtime/neuro-kurisu/src/organism/learning/P40ModelEcology…` | file | 3 | 1 | 0 | `owner+tests+branches` | — |
| 43 | `replit-github` | `governance` | `.github/workflows` | directory | 11 | 0 | 0 | `owner+tests` | no-branches |
| 44 | `agent-ecosystem` | `research` | `tools/neurok-os-coordinator.mjs` | file | 2 | 0 | 0 | `owner+tests` | no-branches |
| 45 | `ethical-gate` | `governance` | `runtime/neuro-kurisu/src/organism/system/ActionGateway.ts` | file | 43 | 16 | 4 | `owner+tests+branches` | — |
| 46 | `permission-system` | `governance` | `runtime/neuro-kurisu/src/organism/system/ApiSecurityPolicy…` | file | 1 | 1 | 0 | `owner+tests+branches` | — |
| 47 | `action-verification` | `governance` | `runtime/neuro-kurisu/src/organism/system/OutcomeCognitionF…` | file | 5 | 25 | 10 | `owner+tests+branches` | — |
| 48 | `memory-safety` | `governance` | `runtime/neuro-kurisu/src/organism/memory/EvidenceLineagePr…` | file | 0 | 2 | 0 | `owner+branches` | no-tests |
| 49 | `tool-security` | `governance` | `runtime/neuro-kurisu/src/organism/system/ToolInputContract…` | file | 0 | 4 | 1 | `owner+branches` | no-tests |
| 50 | `self-modification` | `governance` | `runtime/neuro-kurisu/src/organism/system/SandboxedSelfRewr…` | file | 3 | 4 | 2 | `owner+tests+branches` | — |
| 51 | `reliability` | `governance` | `runtime/neuro-kurisu/src/organism/persistence/RecoveryWatc…` | file | 37 | 8 | 0 | `owner+tests+branches` | — |
| 52 | `observability` | `governance` | `runtime/neuro-kurisu/src/organism/persistence/OperationalJ…` | file | 51 | 0 | 0 | `owner+tests` | no-branches |
| 53 | `desktop` | `embodiment` | `app` | directory | 0 | 0 | 0 | `owner-only` | no-tests, no-branches |
| 54 | `android` | `embodiment` | `runtime/neuro-kurisu/src/organism/body/AndroidEmbodimentBr…` | file | 35 | 2 | 1 | `owner+tests+branches` | — |
| 55 | `termux` | `embodiment` | `runtime/neuro-kurisu/src/organism/body/NativeSpeechHostRou…` | file | 37 | 0 | 0 | `owner+tests` | no-branches |
| 56 | `ui-ux` | `embodiment` | `app/src/components/AvatarStage.tsx` | file | 0 | 3 | 0 | `owner+branches` | no-tests |
| 57 | `avatar-interface` | `embodiment` | `app/src/components/avatar/rendererCapabilityManifest.ts` | file | 0 | 0 | 0 | `owner-only` | no-tests, no-branches |
| 58 | `synchronization` | `governance` | `runtime/neuro-kurisu/src/organism/persistence/PortableSubj…` | file | 1 | 5 | 0 | `owner+tests+branches` | — |
| 59 | `performance` | `governance` | `runtime/neuro-kurisu/src/organism/system/RuntimePerformanc…` | file | 338 | 0 | 0 | `owner+tests` | no-branches |
| 60 | `unit-tests` | `research` | `runtime/neuro-kurisu/tests` | directory | 1546 | 0 | 0 | `owner+tests` | no-branches |
| 61 | `integration-tests` | `research` | `runtime/neuro-kurisu/tests` | directory | 1546 | 1 | 0 | `owner+tests+branches` | — |
| 62 | `architecture-tests` | `research` | `tools/verify-integration.mjs` | file | 0 | 4 | 2 | `owner+branches` | no-tests |
| 63 | `math-tests` | `research` | `runtime/neuro-kurisu/src/organism/memory/MemoryRetrievalEx…` | file | 3 | 0 | 0 | `owner+tests` | no-branches |
| 64 | `cognitive-benchmarks` | `research` | `runtime/neuro-kurisu/src/organism/memory/MemoryRetrievalBe…` | file | 10 | 7 | 3 | `owner+tests+branches` | — |
| 65 | `autonomy-soak` | `research` | `runtime/neuro-kurisu/tests/p2684-mobile-soak.mjs` | file | 1 | 0 | 0 | `owner+tests` | candidate-owner, no-branches, status-planned |
| 66 | `device-e2e` | `research` | `runtime/neuro-kurisu/tests/big-pass-177-device-truthfulnes…` | file | 1 | 0 | 0 | `owner+tests` | candidate-owner, no-branches, status-planned |
| 67 | `regression` | `research` | `.github/workflows` | directory | 71 | 4 | 1 | `owner+tests+branches` | — |
| 68 | `independent-holdout` | `research` | `runtime/neuro-kurisu/tests/INDEPENDENT_BILINGUAL_HOLDOUT.m…` | file | 1 | 22 | 2 | `owner+tests+branches` | status-planned |
| 69 | `branch-consolidation` | `governance` | `docs/BRANCH_CONVERGENCE_AUDIT_2026-11-01_RU.md` | file | 0 | 15 | 3 | `owner+branches` | no-tests |
| 70 | `ci-cd` | `governance` | `.github/workflows` | directory | 11 | 4 | 0 | `owner+tests+branches` | — |
| 71 | `release-pipeline` | `governance` | `scripts/publish-workpass70-main-sync.ps1` | file | 2 | 23 | 4 | `owner+tests+branches` | — |
| 72 | `license-review` | `governance` | `contracts/RELEASE_LICENSE_REVIEW.json` | file | 5 | 4 | 1 | `owner+tests+branches` | — |
| 73 | `documentation` | `governance` | `README.md` | file | 0 | 14 | 8 | `owner+branches` | no-tests |
| 74 | `backup-recovery` | `governance` | `tools/super-backup.mjs` | file | 0 | 0 | 0 | `owner-only` | no-tests, no-branches |
| 75 | `continuous-development` | `governance` | `engineering-os/manifest.v1.json` | file | 2 | 5 | 4 | `owner+tests+branches` | status-planned |

## 7. Как проверить

```bash
node tools/neurok-aspect-inventory.mjs --check --json
node tools/neurok-aspect-inventory.mjs --write
npm --prefix runtime/neuro-kurisu run test:aspect-inventory
```

## 8. Что делать дальше

1. **10 аспектов без тестов** — добавить/указать тест; самый быстрый рост readiness.
2. **20 аспектов без веток** — выбрать canonical-ветку или зафиксировать реализацию в стволе.
3. **10 candidate owners** — собрать evidence и повысить до canonical либо оставить candidate с gate.
4. **11 PLANNED** — реализовать/подключить; не выдавать за готовые.
5. **711 веток** — provenance, не разрешение на merge. Merge только focused + rebase + exact-head CI.
