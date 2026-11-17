# OmeStro → NeuroCore / NK1: интеграция 32 идей

Дата: 2026-11-17

Ветка: \`aspect/omestro-integrated-cognition-20261117-r2\`

База: \`workpass70-source\` @ \`bee2b133fdedd48723bc49b3eedae5f0df929c1c\`

## Что сделано

OmeStro реализован как интеграционный слой над уже существующими подсистемами NK1, а не как второй параллельный runtime. Новые контракты экспортируются из \`src/organism/index.ts\`; \`OrganismCore\` создаёт \`OmeStroIntegrationKernel\` с прямыми ссылками на канонические \`CognitiveImmuneSystem\`, P25, P28, \`NeuroDigitalEvolutionEngine.substratePortability\` и \`NeuralMorphogenesisEngine\`. Новые OmeStro-ledger сохраняются в \`facets.advanced.omeStro\`, восстанавливаются при старте и входят в hot/full projection и durable checkpoints. Так не создаются конкурирующие копии P25/P28/immune-состояния.

| Класс статуса | Количество | Смысл |
|---|---:|---|
| \`existing_partial\` | 6 | В NK1 уже есть первичная реализация; OmeStro добавляет карту интеграции и/или недостающие границы |
| \`foundation_added\` | 21 | Добавлены исполняемые контракты/алгоритмы и регрессионные тесты; это ещё не доказательство промышленной готовности всей функции |
| \`research_gated\` | 5 | Нужен реальный neural backend, артефакты обучения или измерительная инфраструктура; нельзя честно объявить feature полностью реализованной |

Реестр содержит ровно 32 идеи, проверяет уникальность и полноту идентификаторов. Статусы и ограничения находятся в \`OmeStroConceptRegistry.ts\`.

## Карта всех 32 идей

| № | Идея | Текущий статус | Реализационный слой |
|---:|---|---|---|
| 1 | NeuroForge | existing_partial | Источники, lineage, license/SBOM/sandbox gate |
| 2 | Dyadic Mind | foundation_added | Раздельные principals, consent и scoped task-only sharing |
| 3 | Proof-Carrying Skills | existing_partial | Signed outcomes, independent evaluator, verified promotion |
| 4 | Undo-First Intelligence | foundation_added | Preflight compensation plan, idempotency и approval необратимых шагов |
| 5 | Cognitive Immune System | existing_partial | Reuse quarantine, evidence firewall и integrity mechanisms |
| 6 | Shared Future | foundation_added | Сценарии, assumptions, dependencies, revisit triggers |
| 7 | Developmental Genome | foundation_added | Версионируемый DAG, инварианты, migration/tests/rollback |
| 8 | ChronoTruth | foundation_added | Append-only bi-temporal facts, correction/retraction, consent/sensitivity gate |
| 9 | Negative Space Memory | foundation_added | Причины отказа, evidence refs, повторное открытие по trigger |
| 10 | Mechanism Serendipity | foundation_added | Сопоставление механизмов; результат маркируется только как hypothesis |
| 11 | Cognitive Parliament | foundation_added | Разделённые исследовательские роли, независимая репликация, safety/audit gates |
| 12 | Intent Compiler | foundation_added | Goal/outputs/constraints/permissions/acceptance/stops; неполнота остаётся blocker |
| 13 | Open Loop Radar | foundation_added | Owner, due/review/expiry, status и evidence-linked closure |
| 14 | Invention Loop | existing_partial | Preregister → validation → holdout → independent replication |
| 15 | World Forge | foundation_added | Split-safe world/task manifest; fingerprint leakage rejection |
| 16 | Synaptic Commons | foundation_added | Только allowlisted reusable artifacts; private episodes/credentials запрещены |
| 17 | Morphogenesis | foundation_added | Genome validation и candidate-shadow-only structural evolution |
| 18 | Science Republic | foundation_added | Discoverer/theorist/experimentalist/replicator/skeptic/auditor/safety |
| 19 | Developmental Multiverse | existing_partial | Existing shadow/fork engines + matched environment eligibility |
| 20 | Constitution Evolution | foundation_added | Candidate invariants cannot remove inherited safety/provenance invariants |
| 21 | Consequence Ecology | foundation_added | Bounded probability/impact paths with delayed exposure by stakeholder |
| 22 | Substrate Independence | existing_partial | Reuse portability engine; add state round-trip, paired-seed, regression and fallback gate |
| 23 | Neuro-Plastic Core | research_gated | Adapter training requires real offline LoRA/QLoRA backend and measured artifacts |
| 24 | Layer Force | research_gated | Requires layer-activation instrumentation, calibration and a hard bypass |
| 25 | Adaptive Synaptic Matrix | foundation_added | Validated adapter manifest routing; incompatible/unknown adapters fall back to base |
| 26 | Hyper-Plastic Network | research_gated | Need a bounded hypernetwork/low-rank generator and reproducible training benchmark |
| 27 | Test-Time Neuroplasticity | foundation_added | Session-only deltas, strict norm/TTL/reset; no silent consolidation |
| 28 | Neural Prosthesis | research_gated | Residual trainable model modules require an actual compatible inference backend |
| 29 | Sparse Plasticity | foundation_added | Explicit allowlist, protected-parameter rejection, ≤5% mask cap |
| 30 | Neural Micro-Adapters | foundation_added | Verified lifecycle/routing contract; real trained artifacts still backend-dependent |
| 31 | Cognitive-to-Neural Bridge | foundation_added | Bounded normalized controller vector; application is backend-opt-in only |
| 32 | NeuroCore Neural JIT | research_gated | Emits inert, provenance-bound skill capsules; native model/JIT compilation still gated |

## Новые файлы

- \`src/organism/system/OmeStroConceptRegistry.ts\` — каталог 32 идей и проверка целостности реестра.
- \`src/organism/system/OmeStroCognitiveGovernance.ts\` — intent compiler, ChronoTruth, negative-space ledger, open-loop radar, undo-first plan, consequence ecology, substrate migration gate.
- \`src/organism/system/OmeStroDevelopmentProtocol.ts\` — developmental genome, World Forge, Parliament, Invention Loop, NeuroForge intake, shared futures, dyadic scope, commons gate, fork comparison.
- \`src/organism/system/OmeStroNeuralAdaptation.ts\` — adapter evidence validation/routing, ephemeral plasticity, bounded state controls, sparse mask, inert JIT capsules and promotion gates.
- \`src/organism/system/OmeStroIntegrationKernel.ts\` — dependency-injected composition with canonical CognitiveImmuneSystem, P25, P28, SubstratePortability and NeuralMorphogenesis owners.
- \`src/organism/core/OrganismCore.ts\` + \`core/types.ts\` — canonical runtime wiring, startup restore, state projection/checkpoint persistence and Core-facing governance methods.
- \`tests/omestro-integrated-foundations.mjs\` — functional and negative-path regression tests.
- \`src/organism/index.ts\` — public barrel exports.
- \`package.json\` — \`test:omestro\` command.

## Запуск проверок

Из каталога \`runtime/neuro-kurisu\`:

\`\`\`bash
npm run test:omestro
npm run typecheck
\`\`\`

Проверки, выполненные на актуальном PR HEAD: `test:omestro`, полноценный `typecheck-runtime` под TypeScript 5.9.3, Cognitive Immune health, P25 science/integration, P28 plasticity/integration, P26 holdout provenance, полный P23 learning-governance набор, cognitive-cycle boundary + runtime wiring, memory-restore integrity и workpass96 action-finalizer boundary. Выводы и команды отражены в PR; эти проверки не означают, что gated neural-backend capabilities уже существуют.

### Проверки, выполненные на PR HEAD

Дата: 2026-11-17. Временный shallow clone использовался только для чтения/проверки; изменения отправлялись через GitHub в эту branch. Проверки локально зелёные, а GitHub Actions validation matrix также завершилась успешно по состоянию на последнюю проверку.

- `node --experimental-strip-types tests/omestro-integrated-foundations.mjs` → `OMESTRO_INTEGRATED_FOUNDATIONS=PASS` (32 идеи, ChronoTruth, genome DAG, adapter routing, TTL plasticity и injection canonical owners).
- `node scripts/typecheck-runtime.mjs` → `TYPECHECK=PASS mode=tsc compiler=app-lock` с закреплённым TypeScript 5.9.3.
- `test:cognitive-immune-health`, `test:p25:science`, `test:p28:plasticity`, `test:cognitive-cycle-boundary`, `test:memory-restore-integrity` → PASS.
- `test:p25:integration`, `test:p28:integration`, `test:p26:holdout-provenance`, `test:p23:learning-governance`, `test:workpass96:finalizer-boundary`, `test:cognitive-cycle-boundary-runtime-wiring` → PASS.
- `test:organism-smoke`, `test:revision-aware-projection`, `test:revision-graph:persistence` → PASS.

## Архитектурные границы

1. Новые идеи не обходят \`VerifiedOutcomeLedger\`, independent evaluator, promotion gate или evidence firewall.
2. Holdout — только для финальной оценки; он не должен использоваться для выбора гиперпараметров или доработки adapter.
3. Новый архитектурный граф — candidate-only: отдельная ветка, проверка DAG/invariants, migration, tests, rollback, затем независимая оценка.
4. Необратимое действие блокируется до явного approval. Компенсационный план не обещает отменить физически необратимое последствие.
5. ChronoTruth принимает только low-risk consented claims; correction/retraction не переписывают историю и не открывают прежние значения до правильного valid-time.
6. Shared/dyadic context по умолчанию содержит только scope текущей задачи; приватные эпизоды, credentials и персональные данные не экспортируются.
7. P28 — существующий когнитивный пластический substrate, а не автоматическое доказательство изменения весов LLM.
8. Реестр адаптеров не тренирует и не загружает произвольные веса. Он допускает к маршрутизации только совместимые проверенные manifests; иначе работает base-model fallback.
9. Activation steering, QLoRA training, hypernetwork generation, residual neural prosthesis и native JIT остаются gated, пока нет совместимого backend, independent holdout, ≥5 paired seeds, ablation, safety and rollback evidence.
10. Никакая идея не объявляется «полностью готовой» только потому, что для неё создан интерфейс или тестовая модель.

## Published artifact baseline

На 2026-11-17 GitHub API указывает последний stable release \`Neuro\` (19 Oct 2026) с ZIP \`Neuro_Kurisu_WORKPASS70_2026-10-19.zip\`, 135,290,615 bytes, SHA-256:

\`c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286\`

Последний prerelease — \`workpass70-hotfix1-2026-10-19\`, ZIP \`Neuro_Kurisu_WORKPASS70_HOTFIX1_2026-10-19.zip\`, 136,354,713 bytes, SHA-256:

\`9effadfcf0d402b462dd9cf2fd5b5793742039c9260db80578be830952bf52eb\`

Метаданные этих артефактов проверены, но байты архива не были доступны в текущем runtime для распаковки и сравнения. Поэтому этот PR нельзя считать включённым в опубликованный ZIP; release parity остаётся обязательным отдельным gate.
