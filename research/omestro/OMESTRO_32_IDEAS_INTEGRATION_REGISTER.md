# OmeStro — реестр интеграции 32 идей в NK1

**Снимок:** 17 ноября 2026  
**Репозиторий:** `ailtron1ss-rgb/NK1`  
**Каноническая исходная ветка:** `workpass70-source`  
**Исходный HEAD на момент создания реестра:** `bee2b133fdedd48723bc49b3eedae5f0df929c1c`  
**Источник концепций:** `OmeStro.docx` (32 пункта).

## 1. Что означает статус

Реестр различает наличие идеи, код в ветке, PR, слияние в source и выпуск в Release ZIP. Открытая ветка или Draft PR не считаются интеграцией. Даже merged PR не означает независимую научную проверку или наличие функции в последнем Release ZIP.

- **MERGED** — PR закрыт слиянием в `workpass70-source`.
- **DRAFT** — отдельный открытый Draft PR; требуется проверка diff, точного HEAD, CI, зависимостей и отката.
- **STACKED** — PR направлен не в source напрямую, а в другой aspect-PR; сначала необходимо пройти родительскую ветку.

На этом снимке подтверждены два слияния: #901 ChronoTruth и #913 Cognitive Immune System. Остальные 30 направлений существуют в отдельных PR/ветках, но ещё не объединены в source.

## 2. Полный каталог

| № | Идея OmeStro | PR | Снимок состояния | Ветка / зависимость |
|---:|---|---:|---|---|
| 01 | NeuroForge | [#897](https://github.com/ailtron1ss-rgb/NK1/pull/897) | DRAFT | `aspect/neuroforge-donor-capability-engine-20261116` |
| 02 | Dyadic Mind | [#898](https://github.com/ailtron1ss-rgb/NK1/pull/898) | DRAFT | `aspect/dyadic-mind-collaboration-layer-20261117` |
| 03 | Proof-Carrying Skills | [#899](https://github.com/ailtron1ss-rgb/NK1/pull/899) | DRAFT | `aspect/proof-carrying-skills-20261117` |
| 04 | Undo-First Intelligence | [#910](https://github.com/ailtron1ss-rgb/NK1/pull/910) | DRAFT | `aspect/undo-first-intelligence-20261117` |
| 05 | Cognitive Immune System | [#913](https://github.com/ailtron1ss-rgb/NK1/pull/913) | MERGED | `feature/ome-stro-05-cognitive-immune` |
| 06 | Shared Future | [#903](https://github.com/ailtron1ss-rgb/NK1/pull/903) | DRAFT | Корень цепочки сценариев |
| 07 | Developmental Genome | [#902](https://github.com/ailtron1ss-rgb/NK1/pull/902) | DRAFT | Родитель для #912 |
| 08 | ChronoTruth | [#901](https://github.com/ailtron1ss-rgb/NK1/pull/901) | MERGED | `aspect/chrono-truth-bitemporal-memory-20261117` |
| 09 | Negative Space Memory | [#900](https://github.com/ailtron1ss-rgb/NK1/pull/900) | DRAFT | `aspect/negative-space-memory-20261117` |
| 10 | Mechanism Serendipity | [#904](https://github.com/ailtron1ss-rgb/NK1/pull/904) | DRAFT | `aspect/mechanism-serendipity-20261117` |
| 11 | Cognitive Parliament | [#905](https://github.com/ailtron1ss-rgb/NK1/pull/905) | DRAFT | `aspect/cognitive-parliament-evidence-deliberation-20261117` |
| 12 | Intent Compiler | [#906](https://github.com/ailtron1ss-rgb/NK1/pull/906) | DRAFT | `aspect/intent-compiler-20261117` |
| 13 | Open Loop Radar | [#909](https://github.com/ailtron1ss-rgb/NK1/pull/909) | DRAFT | `aspect/open-loop-radar-20261117` |
| 14 | The Invention Loop | [#907](https://github.com/ailtron1ss-rgb/NK1/pull/907) | DRAFT | Родитель для #911 |
| 15 | World Forge | [#916](https://github.com/ailtron1ss-rgb/NK1/pull/916) | STACKED | Базируется на #903 |
| 16 | Synaptic Commons | [#919](https://github.com/ailtron1ss-rgb/NK1/pull/919) | DRAFT | `aspect/synaptic-commons-independent-20261117` |
| 17 | Morphogenesis | [#912](https://github.com/ailtron1ss-rgb/NK1/pull/912) | STACKED | Базируется на #902 |
| 18 | Science Republic | [#911](https://github.com/ailtron1ss-rgb/NK1/pull/911) | STACKED | Базируется на #907 |
| 19 | Developmental Multiverse | [#914](https://github.com/ailtron1ss-rgb/NK1/pull/914) | DRAFT | `workpass19-developmental-multiverse` |
| 20 | Constitution Evolution | [#915](https://github.com/ailtron1ss-rgb/NK1/pull/915) | DRAFT | `aspect/omestro-20-constitution-evolution-20261117` |
| 21 | Consequence Ecology | [#928](https://github.com/ailtron1ss-rgb/NK1/pull/928) | STACKED | Базируется на #916 |
| 22 | Substrate Independence | [#927](https://github.com/ailtron1ss-rgb/NK1/pull/927) | DRAFT | `aspect/omestro-22-substrate-independence-20261117` |
| 23 | Neuro-Plastic Core | [#936](https://github.com/ailtron1ss-rgb/NK1/pull/936) | DRAFT | Source-synchronized LoRA/QLoRA pipeline; supersedes closed unmerged #930 |
| 24 | Layer Force | [#931](https://github.com/ailtron1ss-rgb/NK1/pull/931) | STACKED | Базируется на #925 |
| 25 | Adaptive Synaptic Matrix | [#939](https://github.com/ailtron1ss-rgb/NK1/pull/939); legacy [#921](https://github.com/ailtron1ss-rgb/NK1/pull/921) | STACKED | P25 policy/router over canonical #936 registry; legacy standalone registry is superseded |
| 26 | Hyper-Plastic Network | [#920](https://github.com/ailtron1ss-rgb/NK1/pull/920) | DRAFT | `aspect/ome26-hyper-plastic-network` |
| 27 | Test-Time Neuroplasticity | [#924](https://github.com/ailtron1ss-rgb/NK1/pull/924) | DRAFT | Контекстно-ограниченная адаптация |
| 28 | Neural Prosthesis | [#925](https://github.com/ailtron1ss-rgb/NK1/pull/925) | DRAFT | Родитель для #931 |
| 29 | Teacher-Student Distillation | [#929](https://github.com/ailtron1ss-rgb/NK1/pull/929) | DRAFT | Верифицируемый distillation pipeline |
| 30 | Elastic Neural Plasticity | [#923](https://github.com/ailtron1ss-rgb/NK1/pull/923) | DRAFT | Селективные parameter updates |
| 31 | Cognitive-to-Neural Bridge | [#922](https://github.com/ailtron1ss-rgb/NK1/pull/922) | DRAFT | Cognitive state → neural control metadata |
| 32 | NeuroCore Neural JIT | [#926](https://github.com/ailtron1ss-rgb/NK1/pull/926) | DRAFT | Shadow compiler; promotion не предполагается |

## 3. Реальные цепочки зависимостей

Стрелка означает, что дочерняя работа уже направлена в ветку родительского PR и не может быть объединена в source отдельно от корректной последовательности:

- **#903 Shared Future → #916 World Forge → #928 Consequence Ecology**
- **#902 Developmental Genome → #912 Morphogenesis**
- **#907 Invention Loop → #911 Science Republic**
- **#925 Neural Prosthesis → #931 Layer Force**

Остальные PR в этом реестре направлены непосредственно в `workpass70-source`, если в таблице не указано иное.

## 4. Очередность консолидации

Это порядок проверки и объединения, а не приказ автоматически слить все PR.

### Этап A — доказательства, эпистемика и безопасные действия

1. Проверить уже объединённые #901 и #913 на текущем source HEAD и наличие их тестов в полном прогоне.
2. Разобрать #899 Proof-Carrying Skills, #910 Undo-First Intelligence, #900 Negative Space Memory, #905 Cognitive Parliament, #906 Intent Compiler и #909 Open Loop Radar.
3. Проверить #898 Dyadic Mind на совместимость с UserModel, canonical memory, явным подтверждением пользователя и существующими gateway/permissions.
4. Применять один canonical owner на тип данных/решение; не добавлять дублирующие memory stores или параллельные execution gateways.

### Этап B — развитие архитектуры и мировых моделей

1. Синхронизировать и проверить #902 → #912.
2. Синхронизировать и проверить #903 → #916 → #928.
3. Проверить #907 → #911, затем #904 Mechanism Serendipity, #915 Constitution Evolution, #914 Developmental Multiverse, #919 Synaptic Commons, #897 NeuroForge и #927 Substrate Independence.
4. Применять изменения только после инвариантов, сценариев отката, версионности и независимых регрессионных проверок.

### Этап C — адаптация нейронного субстрата

1. #930 Neuro-Plastic Core: offline LoRA/QLoRA pipeline, неизменяемая базовая модель, holdout и provenance.
2. #921 Adaptive Synaptic Matrix и #920 Hyper-Plastic Network: маршрутизация только проверенных артефактов с гарантированным возвратом к baseline.
3. #924 Test-Time Neuroplasticity и #929 Teacher-Student Distillation: отдельные budget/holdout/rollback gates.
4. #925 Neural Prosthesis → #931 Layer Force: боковой Transformers sidecar; Layer Force должна оставаться выключенной по умолчанию и не воздействовать на скрытые состояния через prompt metadata.
5. #923 Elastic Neural Plasticity, #922 Cognitive-to-Neural Bridge и #926 Neural JIT: только после согласования общих контрактов, одного владельца модели/адаптеров и явного promotion gate.

## 5. Интеграционные ворота

Для каждого PR проверять по точному HEAD:

- реальный diff и отсутствие повторной реализации существующего canonical owner;
- тесты нового поведения и регрессии соседней подсистемы;
- GitHub Actions на HEAD PR, а не на прежнем коммите;
- exact base SHA и правильный parent/child порядок; при движении source повторно синхронизировать цепочку;
- сценарии отключения, fallback, rollback и восстановления после ошибки;
- доказательства качества на holdout / paired seeds там, где заявлено обучение или адаптация;
- измерения latency, memory и целевого устройства там, где заявлена realtime/phone пригодность;
- классификацию IMPLEMENTED / INTEGRATED / TESTED / INDEPENDENTLY CONFIRMED / RELEASED.

Ни концептуальный документ, ни открытый PR, ни зелёный unit test не доказывают production quality или независимое улучшение когнитивной системы.

## 6. Блокеры текущего снимка

- `workpass70-source` на момент реестра: `bee2b133fdedd48723bc49b3eedae5f0df929c1c`.
- PR #925 всё ещё указывает базовый SHA `1e83a011fc677ff20f2348570322bd562181d9ff`, который старше текущего source и предшествует слияниям #901 и #913. Перед финальной интеграцией #925 его необходимо обновить на актуальную source-основу; после этого проверить/перестроить дочерний #931 поверх обновлённого #925.
- #931 — Draft PR; он не является частью #925, пока не будет принят в родительскую aspect-ветку.
- Latest Release ZIP остаётся отдельным источником истины для выпуска. Ни этот реестр, ни любой из открытых PR не должны описываться как released, пока проверка самого опубликованного ZIP не подтвердит содержимое.

## 7. Следующий исполняемый шаг

После завершения текущей проверки #931 выполнить отдельный интеграционный проход: синхронизировать #925 с текущим `workpass70-source`, повторно проверить точный HEAD #925, затем перебазировать/обновить #931 на новый HEAD родителя и повторить весь relevant CI. Только после этого продолжать этап A–C по очереди выше.

## 8. Проверка актуальности на 18 ноября 2026

Последняя повторная сверка GitHub:

- `workpass70-source`: `bee2b133fdedd48723bc49b3eedae5f0df929c1c`.
- Последний Release по-прежнему `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`, опубликован 19 октября 2026, SHA-256 `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`.
- #901 и #913 остаются единственными подтверждёнными merged PR из этого каталога.
- #930 Neuro-Plastic Core закрыт без слияния и помечен как superseded. Его source-synchronized replacement #936 остаётся Draft на HEAD `05ba70cc7e2c7aec2d84de1b609b548c59c0c918`, base SHA `bee2b133fdedd48723bc49b3eedae5f0df929c1c`.
- #922 Cognitive-to-Neural Bridge обновлён 18 ноября до `4ffa92dee1f461903982d3a2fd213c6a03088dfb`, base остаётся `1e83a011fc677ff20f2348570322bd562181d9ff`.
- #926 Neural JIT обновлён 18 ноября до `ab75af47ab8c47bf82a2822e3c6861d818021f48`, base остаётся `1e83a011fc677ff20f2348570322bd562181d9ff`.
- #931 Layer Force обновлён 18 ноября до PR HEAD `661827ad6eb1eb636d4f8bcad7f1d351f51756eb`; кодовый HEAD `06a52dea266e3f23b77c41fcfc7ebdf81abeaef3` прошёл точный Python + Node CI в run `44239599893` (38 Python tests, runtime typecheck, Neural Prosthesis/P40 regression). PR остаётся Draft и stacked на #925.
- #925 по-прежнему HEAD `8ae6445642f52f9eef06fb1a3070682129764558`, base SHA `1e83a011fc677ff20f2348570322bd562181d9ff`.
- #934 этот реестр остаётся Draft и имеет актуальную для момента создания базу `bee2b133fdedd48723bc49b3eedae5f0df929c1c`.

### Синхронизация source

Для 28 открытых PR (кроме #930, чей base уже перешёл на merge commit #901, и stacked children, чьи базы являются feature heads) найден stale source base `1e83a011fc677ff20f2348570322bd562181d9ff`. Эти ветки не следует массово сливать поверх нового source без обновления базы и exact-head CI. Сначала нужно обновить базовые aspect PR и их дочерние зависимости в правильном порядке.

### Статус Layer Force после последнего расширения

В #931 добавлены два новых обязательства к контракту:

1. Профиль загружается/валидируется без установки PyTorch hooks; hooks ставятся лениво только при входе в явный request-scoped `activate(profile_id)`. Это убирает hook overhead в выключенном режиме и при preloading профилей без default selection.
2. Низкоточная FP16/BF16 запись должна строго соблюдать per-token delta cap после округления к dtype модели, а не только до округления в FP32.

На HEAD `06a52dea266e3f23b77c41fcfc7ebdf81abeaef3` run `44239599893` завершился `success` для обеих job. Дополнительно проверены lazy hooks, zero-strength no-hook, atomic rollback/retry, пост-cast FP16/BF16 cap и sidecar opt-in. Последний PR HEAD `661827ad6eb1eb636d4f8bcad7f1d351f51756eb` после успешной проверки менял только документацию.


## 9. Обнаруженные пересечения файлов между aspect PR

Повторно проверенные changed-file sets на 18 ноября показывают реальные конфликты интеграции, которые раньше не были явно отражены в очередности:

| Пересечение | Общие runtime-файлы | Риск / решение |
|---|---|---|
| #922 Cognitive-to-Neural Bridge ↔ #936 Neuro-Plastic Core | `OpenAICompatibleLocalChatProvider.ts`, `LanguageOrgan.ts`, `server.mjs` | Оба меняют local-provider path и передачу control/adapter metadata. Нельзя принимать оба PR независимо от старых баз; объединять как одну серию совместимых изменений и сохранять оба набора контрактных тестов. |
| #922 Cognitive-to-Neural Bridge ↔ #926 Neural JIT | `OrganismRuntime.ts`, `LanguageOrgan.ts`, `server.mjs` | Оба расширяют runtime orchestration. Согласовать один lifecycle/owner и event boundary; Neural JIT остаётся shadow-only, не должен напрямую менять policy/параметры. |
| #936 Neuro-Plastic Core ↔ #926 Neural JIT | `LanguageOrgan.ts`, `server.mjs` | Общая точка регистрации/маршрутизации local inference; проверить fallback и не допустить скрытого включения экспериментальных артефактов. |
| #925 Neural Prosthesis ↔ #931 Layer Force | Один Python sidecar и общая decoder layer stack; #931 stacked на #925 | Слияние строго в порядке родитель → ребёнок после синхронизации #925 с актуальным source. |
| #903 → #916 → #928 | Отдельная stacked-цепочка | Не поднимать #928 на source напрямую; сначала проверить весь граф сценариев → world model → causal consequence. |
| #902 → #912 | Отдельная stacked-цепочка | Morphogenesis должен собираться поверх Developmental Genome, не обходить его контракты. |
| #907 → #911 | Отдельная stacked-цепочка | Science Republic использует Invention Loop как процессный родитель. |

### Рекомендуемая координация по runtime-пересечениям

1. Сначала синхронизировать #922 с актуальным `workpass70-source` и сохранить cognitive-control контракт в `OrganismRuntime`/provider; metadata не должна обходить user consent, approval или safety gates.
2. Интегрировать #936 как единственный canonical владелец LoRA/QLoRA artifact admission, independent evaluation, approval, activation and fallback.
3. Перестроить #921 поверх #936 как policy/router facade, а не второй подписанный adapter registry.
4. Перестроить #926 поверх общей capture/decision boundary, сохраняя strict shadow-only execution и no-live-promotion.
5. #925/#931 держать в отдельной цепочке до согласования model revision/config, residual adapter lifecycle, hook order and resource budgets.

Это рекомендуемая последовательность ревью, а не подтверждение совместимости: для каждого перехода ещё нужны exact-base diff, re-run тестов, fallback/rollback тесты и holdout результаты.

## 10. Canonical artifact-owner decision (18 November 2026)

Последняя проверка PR подтвердила, что #930 закрыт без слияния и прямо помечен superseded by #936. #936 — текущая source-synchronized ветка Neuro-Plastic Core: head `05ba70cc7e2c7aec2d84de1b609b548c59c0c918`, base `workpass70-source` at `bee2b133fdedd48723bc49b3eedae5f0df929c1c`. Это единственный актуальный PR для идеи #23; старый #930 больше не включать в merge queue.

### Единственный владелец artifact lifecycle

#936 `NeuroPlasticAdapterRegistry` + `NeuroPlasticArtifactVerifier` + `NeuroPlasticInferenceAdapter` уже реализуют signed manifest admission, независимые paired-holdout receipts, human approval, active/disabled state, exact base-model binding, artifact integrity verification, domain/model-aware selection и base-model retry при отказе артефакта.

#921 `AdaptiveSynapticMatrix` независимо реализует второй candidate/manifest/activation/verification/selection/disable/restore state machine. Его changed files не пересекаются с #936 напрямую, но его доменная ответственность частично дублирует authority #936. Интеграционное решение:

1. **#936 становится единственным canonical owner** подписанных артефактов, training/evaluation provenance, human approval, activation state, quarantine/disable, exact base-model identity и фактического adapter execution/fallback.
2. **#921 остаётся P25 policy/router layer**: вычисляет task/context/confidence/uncertainty/resource-risk, conflict resolution и route-decision telemetry; не хранит вторую независимую копию manifests, подписи, eligibility и activation state. Решение о конкретном артефакте подтверждается canonical #936 registry непосредственно перед inference.
3. Когда #921 retarget/rebase будет построен поверх #936, его runtime API должен использовать narrow selector/registry port к #936. Сохранённый P25 route должен содержать adapter ID + base model fingerprint + reason; provider повторно проверяет текущий active status и artifact digest, а не доверяет сохранённому P25 snapshot.
4. Любое несоответствие identity, model alias, backend support, confidence/risk/context budget или artifact digest возвращает base-model path. Никакой P25/JIT/cognitive metadata не может самостоятельно активировать веса.

### Точные границы трёх когнитивно-нейронных PR

- **#922 Cognitive-to-Neural Bridge** создаёт валидируемый cognitive control profile и ограниченные sampling hints. В профиле `controlsConfigured.adapterSelection`, `activationSteering` и `residualBlock` остаются `false`; это означает, что profile сам по себе не включает адаптер или скрытые-state steering. Provider forwarding в llama.cpp включается отдельным operator option и снабжён receipt/fingerprint.
- **#936 Neuro-Plastic Core** — единственный путь для реального LoRA/QLoRA model-alias selection; модельные артефакты проходят проверку подписи/holdout/human approval и integrity проверки до запроса, с возвратом к base alias при ошибке.
- **#926 Neural JIT** принимает только host-verified, decision-linked activation captures; отдельно разделяет train/holdout, требует не менее 12 train traces, 8 holdout traces, 8 independent holdout task fingerprints и 5 seeds, а candidate/projected residual остаётся `shadow` с `appliedToInference=false` и `base-inference-path` fallback. Promotion/live inference этим PR не разрешены.
- **#925/#931 Neural Prosthesis/Layer Force** — отдельная residual/activation hook подсистема на том же model lifecycle. Она должна согласовать точный model revision/config и очистку hooks с #936 before any sidecar is enabled; Layer Force остаётся disabled-by-default и проверяет post-cast FP16/BF16 bounds.

### Актуальные exact refs

| PR | Head | Base SHA | Состояние |
|---:|---|---|---|
| #921 | `48d1a63d93f8851bb4feee901f3e04cda13a27d0` | `1e83a011fc677ff20f2348570322bd562181d9ff` | Draft, needs canonical-registry integration |
| #922 | `bc4b975387f9200c2db62a40e3af1903815ec482` | `1e83a011fc677ff20f2348570322bd562181d9ff` | Draft, stale source base |
| #925 | `8ae6445642f52f9eef06fb1a3070682129764558` | `1e83a011fc677ff20f2348570322bd562181d9ff` | Draft, stale parent base |
| #926 | `a2e7b6a77d02a146a4bd8c30aa82195a34504b07` | `1e83a011fc677ff20f2348570322bd562181d9ff` | Draft, stale source base; shadow-only |
| #931 | PR HEAD `661827ad6eb1eb636d4f8bcad7f1d351f51756eb` (code CI head `06a52dea266e3f23b77c41fcfc7ebdf81abeaef3`) | #925 head `8ae6445642f52f9eef06fb1a3070682129764558` | Draft, stacked; Python/Node CI success on code head |
| #936 | `05ba70cc7e2c7aec2d84de1b609b548c59c0c918` | `bee2b133fdedd48723bc49b3eedae5f0df929c1c` | Draft, source-synchronized #23 implementation |

Recommended next sequence: finish exact-head CI on #939, then update/close the legacy #921 and initial #938 branches as superseded; synchronize #922 with current source and connect its advisory controls through the host policy boundary; keep #926 shadow-only and connect only through a host-owned capture/decision interface. #925 must be synchronized before #931 can leave its stacked state.


## 11. P25 canonical-routing child PR — 18 November 2026

Legacy #921 was not genuinely rebased when its base was retargeted. To avoid a false stacked relationship, a new child branch was created directly from #936 and the nine P25 changed files were ported to it.

- New PR: [#939 — P25 canonical registry-backed synaptic routing](https://github.com/ailtron1ss-rgb/NK1/pull/939)
- Child branch: `aspect/p25-neuroplastic-canonical-routing-v2-20261118`
- Latest head at register update: `1f6d4a655c11a04d71804c6f6818a6cb444b44bb`
- Parent branch: `aspect/neuro-plastic-core-lora-adapters-20261118`
- Parent base SHA shown by GitHub: `125621918f70117f43aa86617f116879eaf1a42f`
- #939 remains Draft; its P25 workflow is queued and exact-head verification has not completed.

### Changes in #939

1. P25 receives the typed full routing input in its host executor: task, base-model ID/fingerprint, context estimate, confidence, uncertainty and resource-risk.
2. #936 `NeuroPlasticInferenceAdapter` now accepts an optional `expectedAdapterId`. A canonical/P25 adapter mismatch returns the untouched base alias and `p25-canonical-selection-mismatch`; it does not substitute another adapter and does not disable the healthy canonical artifact.
3. P25 records a canonical base fallback without increasing adapter-failure counters; the already-produced base response is returned directly, preventing a duplicate base-model request.
4. Host wiring in `server.mjs` is opt-in only: model aliases enabled, immutable base-model ID/fingerprint configured, P25 HMAC key secret and key ID available. P25 policy HMAC is an additional host gate, not a replacement for #936's independent evaluator receipt, human approval or artifact validation.
5. Host validates exact ID, model ID/revision fingerprint, weights SHA, adapter method, llama.cpp backend, served base alias and one-to-one P25 task-to-domain mapping before canonical inference.
6. P25 workflow now runs the canonical #936 tests, P25 unit/runtime tests, runtime typecheck and P40/organism smoke tests; it is scoped to the stacked #936 base and the relevant changed files.

The first P25 workflow attempt at old child heads was cancelled by the overlapping push/PR workflow triggers. The push trigger has been removed; the latest P25 workflow on head `1f6d4a655c11a04d71804c6f6818a6cb444b44bb` is pending. No green result is claimed for #939 yet.
