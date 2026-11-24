# NK1 / NeuroCore — ежедневный инженерный цикл — 2026-11-24

## Краткий результат

Цикл выполнен частично, с двумя завершёнными и проверенными work units на изолированных PR-ветках. Каноническая исходная ветка не изменялась.

- Канонический репозиторий: `ailtron1ss-rgb/NK1`.
- Live `workpass70-source` HEAD на момент синхронизации: `87c9ed9034e09ca9fb83fd676ac52bb46434c4fe`.
- Этот SHA — merge commit PR #1161, созданный GitHub 2026-11-24T11:28:30Z. Слияние обнаружено как external/observed; не выполнено этим циклом.
- Exact-SHA checks на `87c9ed9`: **11/11 SUCCESS**.
- PR #1161 перевёл branch-retirement workflow в ручной read-only audit: `contents: read`, только GET-запросы, автоматическое удаление refs отсутствует.
- Ни один PR этим циклом не сливался; Release не публиковался; ветки не удалялись.

## Счётчики

| Метрика | Значение | Пояснение |
|---|---:|---|
| generated | 18 | Все 18 доменов покрыты конкретными work units |
| attempted | 4 | Core decision lineage, plugin quarantine, avatar pipeline, live validation |
| completed | 2 | #1167 и #1169 — scoped acceptance выполнен на PR-ветках |
| partially_completed | 2 | #1164 software pipeline; source/Release verification |
| blocked | 4 | Memory overlap, независимый retrieval holdout, speech hardware, Android soak |
| deferred | 2 | Cross-owner snapshot protocol; stacked planning dependency |
| verified | 2 | Полные acceptance на точных PR SHA: 73/73 и 68/68 |
| in_progress | 4 | Motivation, ActionGateway, reflection/outcome, SelfModel |
| no_new_work | 4 | Нет нового дефекта сверх уже прошедших exact-SHA gates |

`verified` считает только work units с полным scoped acceptance на точном SHA. Проверенные части partial-задач не увеличивают этот счётчик. `completed` означает готовность конкретного PR work unit, а не merge или Release.

## Пакет 18 направлений

| ID | Домен и конкретный результат | P | Зависимости | Риск / обратимость и критерий приёмки | Статус / evidence |
|---|---|---:|---|---|---|
| NK1-D20261124-01 | **Core / OrganismBus.** Привязать все 11 operational stage receipts и metacognitive episode к одному `OrganismCore` decision ID; отвергать mixed/missing identity до принятия полного цикла. | P0 | Core decision trace → CEF → runtime | Низкий, additive; все 11 receipts имеют один ID, tamper-after-restore и conflict-before-append тесты проходят. | **done (PR branch, not merged)** — #1167, head `eccbb9238d9a97cc7389e9d04064ebd251218a6b`, 73/73 checks SUCCESS. PR body обновлён; base старше live source на один commit. |
| NK1-D20261124-02 | **Perception / world model.** Сохранить matched world-model holdout integrity на текущем source SHA; новый дефект в этом цикле не обнаружен. | P1 | World model + independent evidence | Низкий; exact-SHA world-model check должен оставаться зелёным, но это не заменяет внешний device truth. | **no-new-work** — exact source checks `source-lineage-contract`, `matched-holdout` и `browser-affect` SUCCESS на `87c9ed9`; нового perception-дефекта в этом цикле не воспроизведено. Это не доказывает независимую world-model calibration. |
| NK1-D20261124-03 | **Memory ingest.** Свести explicit-ID collision, revision и restore изменения к одному canonical MemoryOS2 write owner. | P0 | MemoryOS2 identity + revision + restore | Средний; сохранить все distinct fixes, не допустить same-ID/different-content overwrite и не потерять predecessor lineage. | **blocked** — #1152 merged; #1149 и #1153 остаются открытыми и основаны на старом `54f9ec7`; deep plan прямо фиксирует overlap. Нужна hunk matrix, не ещё один duplicate PR. |
| NK1-D20261124-04 | **Retrieval / RU-EN holdout.** Провести frozen independent source-clustered RU/EN сравнение с ≥5 paired seeds и P50/P95 latency. | P0 | Memory ingest integrity → frozen split → paired evaluation | Средний; holdout нельзя использовать для tuning. Acceptance: positive recall/task uplift без false-recall и forgetting regressions, latency в бюджете. | **blocked** — в текущем цикле нет подтверждённого независимого корпуса/результата; CI retrieval checks не считаются измеренным uplift. |
| NK1-D20261124-05 | **Consolidation / MemFS.** Проверить единый generation ID для owner facets при snapshot/restore и crash между facet writes. | P0 | Owner matrix → time semantics → persistence | Средний, rollback обязателен; fault injection не должен восстанавливать смешанное поколение состояния. | **deferred** — сначала закрепить owner matrix и decision/evidence identity; не создавать второй persistence owner. |
| NK1-D20261124-06 | **Motivation / drives.** Завершить разделение internal initiative planning и external delivery consent, не выводя affirmative consent из отсутствующего legacy-поля. | P0 | Initiative engine → consent policy → delivery API | Средний; безопасная миграция должна сохранять внутреннюю рефлексию при запрете внешней доставки. | **in_progress** — #1168 проверен 35/35, но отдельная consent migration/API policy остаётся открытой. |
| NK1-D20261124-07 | **Planning / selector.** Связать Active Information Gain с точным action outcome и originating neural experience. | P1 | Decision identity + outcome receipt | Средний; один outcome не должен обучать другой decision/experience. | **deferred** — #1160 stacked поверх #1157; сначала синхронизировать зависимости, не создавать parallel implementation. |
| NK1-D20261124-08 | **ActionGateway / Hermes tools.** Сохранить idempotency и pending-reconcile после timeout/lost ACK; не повторять side effect вслепую. | P0 | ActionGateway receipt → provider postcondition | Высокий при внешнем side effect; acceptance: exact decision receipt и read-only reconciliation без повторного действия. | **in_progress** — #1168 содержит settlement по verified ActionGateway receipt, exact head 35/35; live provider soak ещё отсутствует. |
| NK1-D20261124-09 | **Reflection / outcome.** Начислять learning credit только после exact executed outcome, не по одному выбранному действию. | P0 | Action receipt + independent postcondition | Средний; duplicate/unrelated/external-goal outcome не получает intrinsic credit. | **in_progress** — #1168 head `19e4089674067ba30bb8c30947c3ef261ba10940`, 35/35 checks SUCCESS; не merged. |
| NK1-D20261124-10 | **SelfModel / SelfAuthorship.** Сохранять origin → decision → execution → verified outcome lineage и spine-only parity. | P0 | Core decision ID + ActionGateway receipt | Средний; только internal-origin matching verified execution даёт bounded credit. | **in_progress** — #1162/#1165/#1166 и связанные stacked PRs; не сливать в произвольном порядке. |
| NK1-D20261124-11 | **UserModel / ToM.** Сохранить explicit-forget и tombstone/replay boundary на текущем source. | P0 | UserModel evidence lineage + restore | Низкий для read-only проверки; acceptance: forget не воскресает после replay/restore. | **no-new-work** — exact-SHA `UserModel explicit-forget` check SUCCESS на `87c9ed9`; новая регрессия не обнаружена. |
| NK1-D20261124-12 | **EthicalGate / privacy.** Проверить реальный PluginMessageIngress → OrganismRuntime путь: hostile content quarantined до cognition, host denial до runtime, SHA-256 digest-only, restart restore. | P0 | Host authorization → PluginMessageIngress → CognitiveImmuneSystem | Низкий/обратимый, test-only continuation; acceptance: hostile/safe/denied/malformed/direct-user cases и sidecar restart. | **done (PR branch, not merged)** — commit `91ce0af2629e2583ce6aa107d3e6c6ac2b4096fa`, PR #1169, exact checks 68/68 SUCCESS. |
| NK1-D20261124-13 | **Embodiment integration.** Проверить source-level coupling canonical cognitive affect/motor state с Original 2D и avatar stage. | P1 | Core affect projection → renderer adapters | Низкий; renderer остаётся consumer, не второй owner state. | **no-new-work** — оба source workflows `Original 2D cognitive motor coupling` и `avatar cognitive-affect motor coupling` SUCCESS на `87c9ed9`; browser E2E отдельно не доказан. |
| NK1-D20261124-14 | **Avatar asset pipeline.** Проверить GLB v7 preview path: MIME/size/SHA preflight, preview-only storage, PBR maps и accessible mobile controls. | P1 | GLB preflight → renderer → visual/license review | Средний; v5 остаётся canonical, v7 не должен попасть в persistent catalog/Release без review. | **partially_completed** — #1164 exact head `846519a5e1952bf790562cf2d35d9d43cee83099`, 15/15 SUCCESS; v7 preview-only. Visual acceptance и asset licensing остаются human gates; Meshy 6 job не создан из-за нулевого paid-credit balance. |
| NK1-D20261124-15 | **Speech / STT-TTS.** Проверить interrupt → provider stop confirmation → mouth reset/audio-lip lifecycle на реальном устройстве. | P1 | ASR/STT event boundary → TTS playback → avatar motor frame | Высокий; нельзя объявлять playback complete без acoustic evidence; acceptance: drift ≤80 ms, interrupt ≤200 ms. | **blocked** — software boundary PR #1147 существует, но реальный device/audio soak не подтверждён. |
| NK1-D20261124-16 | **Mobile runtime.** Выполнить 10k deterministic ticks и phone soak с измерением ≤50 ms/tick, offline recovery и thermal/resource behavior. | P0/P1 | Core tick → persistence → Android/Termux device | Высокий; hardware-only acceptance, не заменять симуляцией. | **blocked** — в этой среде нет подключённого Android/Termux устройства и измерений. |
| NK1-D20261124-17 | **App/API/infrastructure.** Проверить, есть ли обоснованный adapter/migration к уже существующим Supabase/MongoDB/Redis. | P2 | Confirmed runtime requirement + owner approval | Низкий при no-op; не подключать сервисы и не менять production без разрешения. | **no-new-work** — нового доказанного инфраструктурного блокера нет; новые сервисы не подключались. |
| NK1-D20261124-18 | **Validation / CI / Release provenance.** Сверить live branch, exact-SHA Actions, PR ancestry и metadata последнего Release; проверить ZIP bytes и parity. | P0 | Source sync → release asset download → hash/tree comparison | Средний; не заявлять released/parity без фактического ZIP и manifest. | **partially_completed** — source sync и `87c9ed9` 11/11 SUCCESS подтверждены; latest Release metadata: tag `Neuro`, published 2026-10-19, ZIP `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`, 135,290,615 bytes. ZIP не удалось получить: web fetch для asset отключён, container не разрешил `github.com`; content hash/parity не заявляются. |

## Реальные изменения этого цикла

### Code/test

- PR #1169, branch `aspect/p0-plugin-input-quarantine-20261124`.
- Commit: `91ce0af2629e2583ce6aa107d3e6c6ac2b4096fa`.
- Изменён только `runtime/neuro-kurisu/tests/cognitive-immune-plugin-runtime-gate.mjs`.
- Тест теперь использует реальный `PluginMessageIngress`, проверяет host authorization denial до cognition, hostile/safe ingress, malformed metadata, direct user input и восстановление immune sidecar новым `OrganismRuntime`.
- Exact-head checks: **68/68 SUCCESS**.
- PR #1169 остаётся Draft/open; merge не выполнялся.

### PR metadata / evidence

- PR #1167: обновлено описание, потому что старый текст ошибочно говорил, что implementation ещё предстоит. Зафиксированы реальные изменения CEF/runtime, тестовые сценарии и **73/73 SUCCESS** на `eccbb9238d9a97cc7389e9d04064ebd251218a6b`. PR остаётся Draft/open; base `8328336` старше live source.
- PR #1168: подтверждено **35/35 SUCCESS** на `19e4089674067ba30bb8c30947c3ef261ba10940`; изменения agency receipts/self-authorship остаются в отдельной Draft ветке.
- PR #1164: подтверждено **15/15 SUCCESS** на `846519a5e1952bf790562cf2d35d9d43cee83099`; v7 остаётся preview-only.
- PR #1161 merge наблюдался извне: `87c9ed9034e09ca9fb83fd676ac52bb46434c4fe`, 11/11 exact-SHA checks SUCCESS. Никакие refs этим циклом не удалялись.

### Канонический source

- Прямых коммитов в `workpass70-source` нет.
- `main` не изменялся.
- Никакой PR не merged этим циклом.
- Release не опубликован и не изменён.
- Новые сервисы/секреты/production не подключались.

## Implemented / connected / tested / released

| Capability | Implemented | Connected | Tested | Released |
|---|---|---|---|---|
| 11-stage decision lineage | Да, в #1167 | Да, на PR-ветке runtime/CEF | 73/73 exact head | Нет, PR open |
| Plugin quarantine | Да, в #1169 | Да, через PluginMessageIngress → runtime на PR-ветке | 68/68 exact head | Нет, PR open |
| Agency outcome / SelfAuthorship | Да, в #1168 | Да, на PR-ветке Core/ActionGateway/CEF | 35/35 exact head | Нет, PR open |
| Avatar v7 preview | Да, в #1164 | Preview route only; v5 остаётся canonical | 15/15 exact head | Нет, preview-only |
| Branch retirement safety | Да, в #1161 | В current source `87c9ed9` | 11/11 exact source checks | В source; Release ZIP parity unknown |

## Адаптация целей

1. Повысить P0 causal identity: один Core decision ID должен проходить все 11 стадий и metacognitive reflection.
2. Повысить P0 plugin ingress quarantine: test должен проходить через реальный host-owned PluginMessageIngress, а не только прямой вызов runtime.
3. Не создавать новые MemoryOS2 PR: #1152 уже merged, #1149/#1153 имеют overlap и старый base; следующая работа — hunk matrix и один canonical integration path.
4. Не считать CI retrieval workflows независимым uplift: frozen RU/EN holdout ≥5 paired seeds остаётся отдельным acceptance gate.
5. 3D generation не повторять без доступного одобренного бюджета; v7 остаётся preview-only до visual/license review.
6. Не пересчитывать общий readiness без независимого holdout и реального phone soak.

## Главные блокеры и handoff

1. **MemoryOS2:** сравнить #1149/#1153 с уже merged #1152 и текущим source; составить hunk matrix по write identity, revision, restore, byte accounting и SelfAuthorship; не создавать дубликат.
2. **Causal spine:** #1167 exact checks зелёные, но base старый. Перед будущим merge требуется full diff against live `87c9ed9`, sync без history rewrite и exact-head CI.
3. **Agency / consent:** #1168 35/35, но consent defaults/migration и отдельный internal-plan vs external-delivery boundary ещё не закрыты.
4. **Retrieval:** заморозить независимый RU/EN source-clustered holdout; минимум 5 paired seeds; отдельно публиковать recallDelta, precision, false recall, forgetting violations и P50/P95 latency.
5. **Release/device:** получить реальные байты Release ZIP и сравнить manifest/hash/tree; отдельно провести Android/Termux 10k-tick + speech interrupt/lip-sync soak.

### Источники состояния

- Root `AGENTS.md`, `README.md`, `NEUROCORE_START_HERE.md`, `docs/NK1_100_PERCENT_COMPLETION_PROGRAM_RU_2026-11-18.md`, `docs/RESEARCH_INTAKE_LEDGER.md` прочитаны в начале цикла.
- Внутренний Analysis 0.8 от 23.11 и Deep Foundations plan от 24.11 использованы как design input. Deep Foundations документ ссылается на `54f9ec7`; этот SHA не использовался как live truth.
- Новых внешних исследований или runtime dependencies в этом цикле не добавлено.

**Следующий запуск:** начать с live `workpass70-source` HEAD/PR/Actions, затем продолжить MemoryOS2 hunk matrix или актуализировать один из существующих P0 PR; не начинать новые ветки до проверки существующих owners/dependencies.


## Дополнительная проверка job logs

После завершения exact-head Actions прочитаны логи конкретных jobs:

- PR #1169: run `45404907366`, job `138482844556`. Лог подтверждает запуск `tests/cognitive-immune-plugin-runtime-gate.mjs`; вывод содержит `authenticatedPluginIngress=true`, `hostilePluginQuarantined=true` и `immuneSidecarRestoredAcrossRuntimeRestart=true`.
- PR #1167: run `45385415177`, job `138414930033`. Лог подтверждает запуск `tests/metacognitive-episode-decision-lineage.mjs`; вывод содержит `decisionLineageComplete=true`, `tamperRejected=true` и `legacyCompatible=true`.
- В обоих jobs строка typecheck сообщает `TYPECHECK=PASS mode=node-strip-syntax-only files=746`, но также явно указывает: TypeScript compiler not installed; semantic `tsc` check unavailable.

**Ограничение:** 68/68 и 73/73 exact checks остаются успешными, а целевые regression scripts действительно исполнялись. Однако эти jobs не дают доказательства semantic TypeScript typecheck; это отдельный tooling gap, который нужно закрыть без установки зависимостей наугад.
