# NK1 / NeuroCore — исполняемый backlog: 75 аспектов, 6 волн

**Версия:** 04.11.2026 · **База:** `workpass70-source` · **Ветка:** `aspect-backlog-75-2026-11-04`
**Машинный источник истины:** [docs/nk1-aspect-progress.json](nk1-aspect-progress.json)
**Инструмент прогресса:** `npm run aspect:progress` (человеческий отчёт), `npm run aspect:progress:json`, `npm run aspect:progress:check` (валидация в CI)

## Как это читать

- Этот файл — исполнимый backlog к плану «75 аспектов / 6 волн», а не отчёт о достижениях.
- Единственный источник истины по статусу — `docs/nk1-aspect-progress.json`. Отчёт выше строится из него.
- **Статус аспекта поднимается только при наличии связанного доказательства.** Аспект не может стать
  `PASS` без артефакта доказательства; проходящий unit-test, существующий файл или число модулей
  сами по себе статус не поднимают.
- Один аспект = одна ветка (`aspect-NN-slug`) = один PR. Ветки не удаляются без явного указания.
- Зависимости (`dependsOn`) задают порядок: начинать с аспектов, у которых все зависимости уже `PASS`
  (отчёт печатает `next actionable`).

## Статусы

`PLANNED`, `IN_PROGRESS`, `BLOCKED`, `PASS`, `FAIL`, `DEFERRED`, `REJECTED`.
Только `PASS` требует проверяемого артефакта. `REJECTED` требует причины (не создавать код ради плана).

## Критерии готовности (gates)

| Gate | Цель |
| --- | --- |
| `TICK-10000` | 10 000 детерминированных ticks без расхождения |
| `SEARCH-10K<=30MS` | memory search / 10k ≤ 30 мс |
| `RECALL-DELTA>0` | улучшение recall > 0 на независимом holdout |
| `PAIRED-SEEDS>=5` | ≥ 5 парных seed-прогонов |
| `TICK<=50MS-MOBILE` | tick latency на телефоне ≤ 50 мс |
| `LIPSYNC<=80MS` | lip-sync drift ≤ 80 мс |
| `INTERRUPT<=200MS` | interrupt latency ≤ 200 мс |
| `INITIATIVE>=1/H` | автономные инициативы ≥ 1/час |
| `RESTART-NO-LOSS` | runtime recovery без потери подтверждённого состояния |
| `RELEASE-ZIP-PROVENANCE` | проверенный ZIP с provenance и разрешённой лицензией |
| `GOV-1OWNER` | один канонический владелец на изменяемую способность |
| `STATE-MIGRATION` | миграции состояния применяются без потери данных |
| `CI-REQUIRED` | единая обязательная проверка CI на exact head |
| `LICENSE-REVIEW` | полный license/SBOM review пройден |
| `HOLDOUT-INDEPENDENT` | независимый holdout не использовался для настройки |
| `SOAK-24H` | ≥ 24 ч endurance soak с логами latency/RAM/thermal |
| `DEVICE-E2E` | реальный ПК и Android E2E |

## Волны и порядок

- **Волна 1 — стабилизация (критическая):** этапы 01–06, 60–63, 69–70. Расхождения, защита веток,
  целостность состояния и CI.
- **Волна 2 — единый организм:** 04–18 (+64). Связность восприятия, мышления, памяти и обучения.
- **Волна 3 — самостоятельность:** 19–24, 45–52. Личность, мотивация, инициативы, безопасность.
- **Волна 4 — внешнее взаимодействие:** 25–44. Тело, речь, интеграции, модели и инструменты.
- **Волна 5 — реальные платформы:** 53–59, 65–67. ПК, Android, Termux, производительность, soak.
- **Волна 6 — подтверждение готовности:** 68, 71–75. Holdout, лицензирование, релиз, развитие.

Не выполнять все 75 направлений одновременно. Внутри волны независимые аспекты допускают
параллельные ветки; зависимости между волнами соблюдать.

## Аспекты по волнам

### W1 — Стабилизация (12 аспектов)

| ID | Аспект | Зависит от | Владелец (hint) | Выходное доказательство | Gate |
| --- | --- | --- | --- | --- | --- |
| `A01` | Core Architecture | — | `runtime/neuro-kurisu/src/organism/core/OrganismCore.ts` | owner path + behavioral regression + typecheck | GOV-1OWNER |
| `A02` | OrganismBus | A01 | _инвентаризация_ | owner path + behavioral regression + typecheck | — |
| `A03` | OrganismState | A01 | `runtime/neuro-kurisu/src/organism/core/OrganismRuntime.ts` | owner path + behavioral regression + typecheck | STATE-MIGRATION, RESTART-NO-LOSS |
| `A04` | Cognitive Kernel | A01, A02, A03 | _инвентаризация_ | owner path + behavioral regression + typecheck | — |
| `A05` | Cognitive Cycle | A04 | _инвентаризация_ | owner path + behavioral regression + typecheck | TICK-10000 |
| `A06` | Engineering OS | A01 | `tools/neurok-os.mjs` | owner path + behavioral regression + typecheck | — |
| `A60` | Unit Tests | A01 | `runtime/neuro-kurisu/tests` | regression test + exact-SHA CI run | — |
| `A61` | Integration Tests | A60 | _инвентаризация_ | regression test + exact-SHA CI run | — |
| `A62` | Architecture Tests | A60 | _инвентаризация_ | regression test + exact-SHA CI run | — |
| `A63` | Mathematical Tests | A14, A18 | _инвентаризация_ | regression test + exact-SHA CI run | — |
| `A69` | Branch Consolidation | A01 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A70` | CI/CD | A69 | `.github/workflows` | CI run / release artifact + provenance | CI-REQUIRED |

### W2 — Единый организм (16 аспектов)

| ID | Аспект | Зависит от | Владелец (hint) | Выходное доказательство | Gate |
| --- | --- | --- | --- | --- | --- |
| `A04` | Cognitive Kernel | A01, A02, A03 | _инвентаризация_ | owner path + behavioral regression + typecheck | — |
| `A05` | Cognitive Cycle | A04 | _инвентаризация_ | owner path + behavioral regression + typecheck | TICK-10000 |
| `A06` | Engineering OS | A01 | `tools/neurok-os.mjs` | owner path + behavioral regression + typecheck | — |
| `A07` | Perception | A03 | `runtime/neuro-kurisu/src/organism/body/MultimodalPerception.ts` | behavioral diff + regression + owner path | — |
| `A08` | World Model | A07 | `runtime/neuro-kurisu/src/organism/body/P35SemanticWorldBody.ts` | behavioral diff + regression + owner path | — |
| `A09` | Reasoning | A08 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A10` | Planning | A09 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A11` | Metacognition | A05, A09 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A12` | Attention | A04, A07 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A13` | MemoryOS2 | A03 | `runtime/neuro-kurisu/src/organism/developmental/MemoryOS2.ts` | behavioral diff + regression + owner path | RECALL-DELTA>0, SEARCH-10K<=30MS |
| `A14` | Retrieval | A13 | `runtime/neuro-kurisu/src/organism/memory/MemoryRetrievalBenchmark.ts` | behavioral diff + regression + owner path | RECALL-DELTA>0, PAIRED-SEEDS>=5 |
| `A15` | Consolidation | A13, A14 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A16` | Continual Learning | A14, A15 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A17` | Skill System | A10, A16 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A18` | Evaluation | A13, A14, A16 | _инвентаризация_ | behavioral diff + regression + owner path | PAIRED-SEEDS>=5 |
| `A64` | Cognitive Benchmarks | A09, A10, A13 | _инвентаризация_ | regression test + exact-SHA CI run | — |

### W3 — Самостоятельность (14 аспектов)

| ID | Аспект | Зависит от | Владелец (hint) | Выходное доказательство | Gate |
| --- | --- | --- | --- | --- | --- |
| `A19` | SelfModel | A03, A13 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A20` | UserModel | A19 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A21` | Personality | A19, A22 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A22` | Affect System | A05, A19 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A23` | Motivation | A19, A22 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A24` | Autonomy | A10, A23, A45, A46, A47 | _инвентаризация_ | behavioral diff + regression + owner path | INITIATIVE>=1/H |
| `A45` | EthicalGate | A04 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A46` | Permission System | A45 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A47` | Action Verification | A46 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A48` | Memory Safety | A13, A47 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A49` | Tool Security | A46 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A50` | Self-Modification | A47, A49 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A51` | Reliability | A03, A47 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A52` | Observability | A03 | _инвентаризация_ | behavioral diff + regression + owner path | — |

### W4 — Внешнее взаимодействие (20 аспектов)

| ID | Аспект | Зависит от | Владелец (hint) | Выходное доказательство | Gate |
| --- | --- | --- | --- | --- | --- |
| `A25` | Embodiment | A05, A08 | `runtime/neuro-kurisu/src/organism/core/EmbodimentSubsystemRuntime.ts` | behavioral diff + regression + owner path | — |
| `A26` | Live2D | A25 | `app/` | behavioral diff + regression + owner path | — |
| `A27` | 2.5D | A25 | `app/src/components/avatar/depthRig.ts` | behavioral diff + regression + owner path | — |
| `A28` | 3D Avatar | A25 | `app/src/components/avatar/vrmHumanoidRigAdapter.ts` | behavioral diff + regression + owner path | — |
| `A29` | Body Intelligence | A22, A23, A25 | `runtime/neuro-kurisu/src/organism/body` | behavioral diff + regression + owner path | — |
| `A30` | Speech | A25 | _инвентаризация_ | behavioral diff + regression + owner path | LIPSYNC<=80MS |
| `A31` | Voice Interaction | A30 | _инвентаризация_ | behavioral diff + regression + owner path | INTERRUPT<=200MS |
| `A32` | Multimodal Interaction | A07, A30, A31 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A33` | N.E.K.O. | A44 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A34` | Hermes | A17, A44 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A35` | Firecrawl | A44 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A36` | TinyFish | A44 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A37` | Context7 | A44 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A38` | Supabase | A44 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A39` | MongoDB | A44 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A40` | Redis | A44 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A41` | Local Models | A05 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A42` | Cloud Models | A41 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A43` | Replit / GitHub | A06, A70 | `.github/` | behavioral diff + regression + owner path | — |
| `A44` | Agent Ecosystem | A06 | _инвентаризация_ | behavioral diff + regression + owner path | — |

### W5 — Реальные платформы (10 аспектов)

| ID | Аспект | Зависит от | Владелец (hint) | Выходное доказательство | Gate |
| --- | --- | --- | --- | --- | --- |
| `A53` | Desktop | A56 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A54` | Android | A53, A59 | _инвентаризация_ | behavioral diff + regression + owner path | TICK<=50MS-MOBILE |
| `A55` | Termux | A41, A53 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A56` | UI/UX | A32 | `app/` | behavioral diff + regression + owner path | — |
| `A57` | Avatar Interface | A26, A27, A28 | `app/` | behavioral diff + regression + owner path | — |
| `A58` | Synchronization | A03, A53 | _инвентаризация_ | behavioral diff + regression + owner path | — |
| `A59` | Performance | A53 | _инвентаризация_ | behavioral diff + regression + owner path | TICK<=50MS-MOBILE |
| `A65` | Autonomy Soak | A24, A51 | _инвентаризация_ | recorded E2E/soak trace + metrics | SOAK-24H |
| `A66` | Device E2E | A54, A55, A59 | _инвентаризация_ | recorded E2E/soak trace + metrics | DEVICE-E2E |
| `A67` | Regression | A60, A61 | _инвентаризация_ | regression test + exact-SHA CI run | — |

### W6 — Подтверждение готовности (6 аспектов)

| ID | Аспект | Зависит от | Владелец (hint) | Выходное доказательство | Gate |
| --- | --- | --- | --- | --- | --- |
| `A68` | Independent Holdout | A18, A63 | _инвентаризация_ | independent holdout report + paired stats | HOLDOUT-INDEPENDENT |
| `A71` | Release Pipeline | A70 | `tools/verify-final-release.mjs` | CI run / release artifact + provenance | RELEASE-ZIP-PROVENANCE |
| `A72` | License Review | A71 | `tools/audit-release-license-readiness.mjs` | CI run / release artifact + provenance | LICENSE-REVIEW |
| `A73` | Documentation | A71 | `docs` | CI run / release artifact + provenance | — |
| `A74` | Backup & Recovery | A51 | `tools/super-backup.mjs` | CI run / release artifact + provenance | — |
| `A75` | Continuous Development | A70, A74 | _инвентаризация_ | CI run / release artifact + provenance | — |

## Правила разработки (из плана, §13)

- Каждое направление — отдельная aspect-ветка.
- Не создавать дублирующие владельцы состояния; один канонический владелец на изменяемую способность.
- Перед интеграцией проверять актуальный source SHA (база может уйти вперёд).
- Сначала код и интеграция, затем тесты и отчёт.
- Не считать интерфейс подключённой функциональностью.
- Не считать успешный unit test доказательством реального поведения.
- Не удалять полезные ветки и историю.
- Каждое улучшение должно иметь измеримые доказательства.
- Все изменения должны доходить до проверенного Release ZIP.
- Не объявлять завершённым то, что не прошло соответствующий gate.

## Ограничения и честная граница

- Все 75 аспектов стартуют как `PLANNED`; ни один не объявлен `PASS`.
- Владельцы-подсказки (`ownerPaths`) отмечены `HINT`; для аспектов без найденного владельца
  статус `TO-INVENTORY` — путь нужно подтвердить в живой инвентаризации до реализации.
- Субъективное сознание остаётся `UNKNOWN / UNRESOLVED`; план не является таким доказательством.
- Обновление статуса в JSON — часть определения «сделано» для аспекта, наряду с кодом, тестом и CI.
