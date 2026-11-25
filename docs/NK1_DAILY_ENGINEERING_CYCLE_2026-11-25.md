# NK1 / NeuroCore — ежедневный инженерный цикл — 2026-11-25

## Краткий результат

Цикл выполнен частично, но с одним завершённым и проверенным кодовым work unit на существующей aspect-ветке. Каноническая исходная ветка, `main` и Release assets не изменялись.

- Канонический репозиторий: `ailtron1ss-rgb/NK1`.
- Live `workpass70-source` HEAD: `9008a8982a5173304456bee2c604bd0bc8665964`.
- Exact-SHA Actions для source HEAD: **31/31 SUCCESS**.
- Выполнено на существующей ветке `aspect/source-candidate-workspace-materializer-20261125`, PR [#1185](https://github.com/ailtron1ss-rgb/NK1/pull/1185), HEAD `651a3c92dae4e1b71d7dde69dedaa34999482a84`, base `9008a8982a5173304456bee2c604bd0bc8665964`.
- PR #1185: **14/14 exact-head Actions SUCCESS**, 0 failed, 0 active. Включены candidate-workspace regression, semantic runtime typecheck, Module Dependency Audit, core regression, integrated software baseline и Unified organism runtime.
- В ходе исправления два первых clean-startup smoke retry завершились ошибкой gateway readiness `fetch failed`; третья попытка прошла. Итоговый exact-head matrix полностью зелёный.
- PR #1185 остаётся Draft/open. Ни один PR этим циклом не сливался. Ветки не удалялись, force-push не выполнялся, `main` и Release не менялись.

## Счётчики

| Метрика | Значение | Пояснение |
|---|---:|---|
| generated | 18 | Все 18 обязательных направлений получили конкретные work units |
| attempted | 3 | Live source/PR/CI sync; candidate workspace implementation + regression; Release metadata/ZIP verification |
| completed | 1 | Host-admitted source candidate workspace на PR #1185 |
| partially_completed | 2 | Live sync без полного branch census; Release metadata проверена, ZIP bytes недоступны |
| blocked | 4 | Независимый RU/EN holdout, avatar license/visual gate, speech hardware soak, Android/Termux soak |
| deferred | 11 | Остальные направления отложены или имеют уже существующий зелёный PR без нового дефекта |
| verified | 1 | PR #1185: 14/14 exact-head checks и scoped acceptance |
| no_new_work | 7 | Нет нового независимого дефекта сверх уже проверенных/открытых work units |

`completed` означает завершение конкретного work unit на PR-ветке, не merge и не Release. `verified` учитывает только exact-head acceptance. Частично проверенные и human-only gates не получают verification credit.

## Пакет 18 направлений

| ID | Домен и конкретный результат | P | Зависимости | Риск / критерий приёмки | Статус / источник факта / доказательство |
|---|---|---:|---|---|---|
| NK1-D20261125-01 | **Core / OrganismBus.** Синхронизировать live source, source tree и exact-SHA CI; проверить, что последнее слияние decision-bound SelfAuthorship остаётся текущей базой. | P0 | Core decision ID → ActionGateway receipt → SelfAuthorship | Низкий, read-only; acceptance: live HEAD и exact-SHA checks подтверждены, без прямой записи в source. | **partially_completed** — HEAD `9008a898...`, source Actions 31/31 SUCCESS; полный 1,140-branch / 250-open-PR census не повторялся в этом запуске. [PR #1157](https://github.com/ailtron1ss-rgb/NK1/pull/1157) |
| NK1-D20261125-02 | **Perception / world model.** Сохранить grounded world evidence → appraisal/attention → planning контракт; новый source-дефект не вводить без воспроизводимого расхождения. | P1 | World evidence provenance → appraisal → attention | Низкий; acceptance: текущие regression gates остаются зелёными, отсутствие нового дефекта подтверждено. | **no-new-work** — текущий source exact-SHA matrix зелёный; отдельная новая world-model регрессия не воспроизведена. Существующий кандидат: [PR #1175](https://github.com/ailtron1ss-rgb/NK1/pull/1175). |
| NK1-D20261125-03 | **Memory ingest / admission.** Составить hunk-level reconciliation для MemoryOS2 identity/revision/restore изменений из #1149/#1153 относительно уже интегрированного owner; переносить только уникальные исправления. | P0 | MemoryOS2 canonical owner → revision lineage → restore | Средний/высокий; acceptance: ни один уникальный fix не теряется, same-ID/different-content не перезаписывается, нет второго write owner. | **deferred** — старые PR имеют overlap и старую base; автоматическое копирование/слияние небезопасно. Основание: предыдущий consolidation ledger и текущий открытый PR census. |
| NK1-D20261125-04 | **Retrieval / RU-EN holdout.** Провести независимый source-clustered bilingual holdout с минимум 5 paired seeds, recall uplift и P50/P95 latency. | P0 | Memory ingest integrity → frozen split → paired evaluation | Средний; acceptance: recallDelta > 0 на независимом holdout без forgetting/false-recall регрессии; latency измерена на 10k записей. | **blocked** — в этом запуске независимый корпус и результаты пяти paired seeds не предоставлены/не подтверждены; синтетические CI не заменяют holdout. |
| NK1-D20261125-05 | **Consolidation / MemFS.** Сохранить единый generation boundary для Core и runtime sidecars; не создавать второй snapshot owner поверх существующего envelope. | P0 | Core commit boundary → owner snapshots → restore preflight | Средний; acceptance: invalid envelope fail-closed, crash/restore не смешивает разные поколения. | **deferred** — существующий checkpoint workstream #1170 остаётся отдельной Draft-зависимостью; в этом цикле новый дефект не воспроизводился. |
| NK1-D20261125-06 | **Motivation / drives / initiative.** Не дублировать lease/retry state machine; сохранить единственного владельца user-visible social initiative delivery. | P1 | Initiative engine → consent/quiet-hours → UI ACK | Средний; acceptance: один lease owner, bounded retry, ACK не превращается в learning credit. | **no-new-work** — [PR #1181](https://github.com/ailtron1ss-rgb/NK1/pull/1181), exact current HEAD `c92c734...`, **46/46 SUCCESS**; generic obligation outbox отделён в #1182. |
| NK1-D20261125-07 | **Planning / selector / Active Information Gain.** Не переносить повторно decision-attribution fix; сначала разрешить dependency stack #1170 → #1169 → #1160. | P1 | Runtime checkpoint envelope → plugin ingress → neural experience token | Средний; acceptance: hypothesis outcome остаётся связан с originating token после snapshot/restore; перед интеграцией — sync и exact-head CI. | **deferred** — [PR #1160](https://github.com/ailtron1ss-rgb/NK1/pull/1160) уже имеет 23/23 checks на своём head, но остаётся stacked и не является частью canonical source. |
| NK1-D20261125-08 | **ActionGateway / tools / Hermes permissions.** Сохранить host approval для destructive plugin tools; не создавать параллельный gateway. | P0 | Manifest policy → canonical ActionGateway descriptor → host approval | Высокий при внешнем side effect; acceptance: destructive/privileged tool не может обойти approval через `permissionClass: none`. | **no-new-work** — [PR #1184](https://github.com/ailtron1ss-rgb/NK1/pull/1184), exact current HEAD `0ceea1d...`, **12/12 SUCCESS**. |
| NK1-D20261125-09 | **Reflection / outcome / learning credit.** Сохранять settlement только после exact decision-linked host-attested postcondition; не начислять credit по одному selection. | P0 | Decision ID → ActionGateway receipt → verified outcome | Средний; acceptance: unmatched/duplicate/external outcome не создаёт intrinsic credit. | **no-new-work** — PR #1157 уже в source HEAD; текущие source Actions 31/31 SUCCESS. Нового attribution-дефекта в этом цикле не обнаружено. |
| NK1-D20261125-10 | **SelfModel / self-development.** Реализовать isolated host-admitted source candidate workspace на существующей PR-ветке: exact base SHA, before-hash, bounded edits, content-addressed tree, host receipt, no-overwrite materialization. | P1 | Host-owned source snapshot → admission callback → isolated staging directory | Средний; acceptance: exact admission binding, path traversal/reserved path rejection, collision no-overwrite, manifest-last; candidate остаётся `not-executed`. | **done (PR branch, not merged)** — [PR #1185](https://github.com/ailtron1ss-rgb/NK1/pull/1185), HEAD `651a3c92...`, **14/14 SUCCESS**. Реальные изменения: `SourceCandidateWorkspace.ts`, `source-candidate-workspace.mjs`, workflow, `CHANGELOG.md`. |
| NK1-D20261125-11 | **UserModel / ToM / explicit-forget.** Сохранить tombstone/forget replay integrity; не менять owner без воспроизводимой регрессии. | P0 | UserModel evidence → tombstone → restore/replay | Низкий для regression-only; acceptance: explicit forget не воскресает после replay/restore. | **no-new-work** — source exact-SHA matrix зелёный; на exact head PR #1185 отдельный UserModel explicit-forget workflow SUCCESS. |
| NK1-D20261125-12 | **EthicalGate / PEA / privacy.** Сохранить fail-closed plugin ingress и default-deny credential inheritance; не смешивать эти authority с candidate workspace admission. | P0 | Host plugin authorization → CognitiveImmuneSystem; LearningProcessSupervisor env gate | Высокий; acceptance: hostile plugin не попадает в cognition, credential env не наследуется без exact host grant. | **no-new-work** — [PR #1183](https://github.com/ailtron1ss-rgb/NK1/pull/1183) **12/12 SUCCESS**, [PR #1184](https://github.com/ailtron1ss-rgb/NK1/pull/1184) **12/12 SUCCESS**; оба Draft, не merged. |
| NK1-D20261125-13 | **Embodiment integration.** Сохранить renderer-neutral ownership affect/motor state; не вводить второй state owner для 2D/2.5D/3D. | P1 | Canonical affect frame → MotorFrame → renderer adapters | Средний; acceptance: renderer только consumer, no duplicated affect/motor state. | **deferred** — существующий affect/embodiment workstream #1173 уже имеет собственную проверочную историю; новый integration дефект в этом цикле не выбран. |
| NK1-D20261125-14 | **Avatar asset pipeline.** Проверить GLB/VRM preview, rig/motion и лицензии до использования asset в Release. | P1 | Asset provenance → MIME/SHA preflight → visual review → license | Высокий, human-only gate; acceptance: визуальный review, права на asset и redistribution подтверждены человеком. | **blocked** — [PR #1164](https://github.com/ailtron1ss-rgb/NK1/pull/1164) остаётся Draft; в этом запуске не выполнялся визуальный/лицензионный sign-off. |
| NK1-D20261125-15 | **Speech / STT-TTS / prosody / lip-sync.** Измерить interrupt latency и audio-lip drift на реальном устройстве, а не только browser contract. | P1 | Speech provider → audio clock → avatar mouth state | Средний; acceptance: interrupt ≤200 ms и lip-sync drift ≤80 ms на измеренном устройстве. | **blocked** — реальный audio/device soak не выполнялся; CI не подменяет физическое измерение. |
| NK1-D20261125-16 | **Mobile / Android / Termux.** Провести 10k deterministic ticks и phone soak с измерением времени/памяти/тепла. | P1 | Runtime build → offline mode → Android scheduler/storage | Средний/высокий; acceptance: ≤50 ms phone tick и стабильное восстановление после suspend/restart на целевом устройстве. | **blocked** — физический Android/Termux runtime не подключён к этому запуску; hardware gate не имитировался. |
| NK1-D20261125-17 | **App/API/infrastructure.** Не дублировать delivery queue и subprocess environment policy; сохранить границы существующих owners. | P1 | Initiative delivery owner #1181; obligation outbox #1182; process supervisor #1183 | Средний; acceptance: initiative-message не попадает в generic outbox, secret env default-deny, persistence до ACK. | **no-new-work** — #1182 **81/81 SUCCESS**, #1181 **46/46 SUCCESS**, #1183 **12/12 SUCCESS** на exact текущих PR HEADs; production sender/deployment не подключались. |
| NK1-D20261125-18 | **Validation / CI / Release / provenance.** Сверить latest source, exact checks и Release metadata; попытаться получить ZIP bytes для extraction/hash/parity. | P0 | Source SHA → Release tag/assets → manifest/hash → license gate | Низкий для metadata, высокий для release; acceptance: ZIP реально скачан, SHA-256 пересчитан, manifest сравнен, human license approval получен. | **partially_completed** — source 31/31 и PR #1185 14/14 SUCCESS. Последний опубликованный по времени asset — prerelease `workpass70-hotfix1-2026-10-19`, `Neuro_Kurisu_WORKPASS70_HOTFIX1_2026-10-19.zip`, 136,354,713 bytes, metadata digest `sha256:9effadfcf0d402b462dd9cf2fd5b5793742039c9260db80578be830952bf52eb`. Stable tag `Neuro` ZIP: 135,290,615 bytes, digest `sha256:c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`. ZIP bytes не удалось materialize/download в доступной среде; digest не пересчитывался, extraction/parity UNVERIFIED. |

## Реальные изменения этого цикла

**Branch:** `aspect/source-candidate-workspace-materializer-20261125`  
**PR:** [#1185](https://github.com/ailtron1ss-rgb/NK1) — Draft/open, не merged.  
**Commit:** `651a3c92dae4e1b71d7dde69dedaa34999482a84`  
**Base:** `workpass70-source@9008a8982a5173304456bee2c604bd0bc8665964`.

- `runtime/neuro-kurisu/src/organism/analysis/SourceCandidateWorkspace.ts`: candidate snapshot/edit validation, exact SHA binding, host admission callback, content-addressed staging, bounded writes, no-overwrite directory claim, manifest-last.
- `runtime/neuro-kurisu/tests/source-candidate-workspace.mjs`: real temp-directory regression; tampered snapshot rejected before admission; path traversal/reserved path rejection; duplicate edit rejection; denied/mismatched host receipt; no-overwrite collision; input-order-independent candidate identity; reserved manifest-file collision.
- `.github/workflows/nk1-unified-organism-runtime.yml`: new focused test step was already part of the existing PR branch.
- `CHANGELOG.md`: semantic type fix, reserved receipt names, deterministic path ordering and regressions.
- Никаких файлов в `workpass70-source` или `main` не изменялось.

## Implemented / connected / tested / released

| Состояние | Результат |
|---|---|
| implemented | Да — изолированный candidate materializer и fail-closed admission contract |
| connected | Частично — host callback является обязательной точкой подключения, но реальный host admission service ещё не подключён |
| tested | Да — exact-head 14/14 Actions; candidate workspace test, semantic runtime typecheck, dependency audit, core regression и organism smoke прошли |
| released | Нет — PR Draft/open, source unchanged, Release ZIP unchanged |

Это не полноценный self-modification loop: candidate code не запускается, patch не валидируется и не promoted. Следующий этап — host-owned signed PatchReceipt + paired holdout admission, затем allowlisted validation через существующий LearningProcessSupervisor в OS-isolated sandbox, после чего только независимая evaluation/rollback gate.

## Dependency graph и следующий порядок

1. `workpass70-source@9008a898...` остаётся canonical source.
2. PR #1185 materializes только host-admitted candidate в отдельный staging root; не пишет в canonical checkout.
3. Следующая зависимость: host-owned signed PatchReceipt, exact edit-set digest и independent paired-holdout admission.
4. Только после admission — allowlisted validation через существующий LearningProcessSupervisor в OS-level isolated sandbox; никакого выполнения untrusted candidate в текущем PR.
5. После независимой evaluation — shadow evidence, approval, reversible activation/restart/rollback. P53 self-promotion остаётся fail-closed до внешнего доказательства.
6. Отдельный stacked chain `#1170 → #1169 → #1160` не переписывать и не дублировать; обновление основы/порядка интеграции требует отдельной проверки.
7. Delivery ownership остаётся раздельным: #1181 — user-visible social initiative lease/UI ACK; #1182 — generic task/reminder/notification outbox; ActionGateway — единственная side-effect authority.

## Ограничения и human-only gates

- ZIP Release metadata прочитана, но бинарный ZIP не был получен в runtime; release parity не доказана.
- В текущем handoff зафиксирован pending human license review: root license `NOASSERTION`, runtime private/all-rights-reserved, redistribution approval=false. Не публиковать новый Release и не переносить внешние assets без решения правообладателя.
- Нет независимого RU/EN holdout с 5 paired seeds.
- Нет реального Android/Termux phone soak и физического audio/lip-sync измерения.
- Полный branch/PR census не повторялся: в этом цикле проверены canonical source, текущие ключевые PR и recent PR listing; не утверждается полный подсчёт всех refs.

## Следующие 5 действий

1. Сохранить Draft #1185; получить независимый code review по candidate path, manifest reservation, workspace isolation и admission callback.
2. Подготовить host-owned signed PatchReceipt/paired-holdout admission как отдельный слой, не добавляя второй candidate store.
3. Свести MemoryOS2 overlap #1149/#1153 с canonical owner через hunk matrix, не копируя старые Core/SelfAuthorship blobs.
4. Получить независимый frozen RU/EN corpus и выполнить минимум 5 paired seeds с recall/forgetting/latency metrics.
5. Материализовать Release ZIP bytes, пересчитать SHA-256, извлечь manifest и провести human license review; до этого Release readiness не повышать.

## Источники и evidence

- Canonical source branch: [workpass70-source](https://github.com/ailtron1ss-rgb/NK1/tree/workpass70-source) @ `9008a8982a5173304456bee2c604bd0bc8665964`.
- Merged SelfAuthorship milestone: [PR #1157](https://github.com/ailtron1ss-rgb/NK1/pull/1157).
- Candidate workspace: [PR #1185](https://github.com/ailtron1ss-rgb/NK1/pull/1185), exact-head 14/14 Actions.
- Initiative delivery lease: [PR #1181](https://github.com/ailtron1ss-rgb/NK1/pull/1181), 46/46.
- Generic delivery outbox: [PR #1182](https://github.com/ailtron1ss-rgb/NK1/pull/1182), 81/81.
- Credential environment guard: [PR #1183](https://github.com/ailtron1ss-rgb/NK1/pull/1183), 12/12.
- Destructive plugin approval class: [PR #1184](https://github.com/ailtron1ss-rgb/NK1/pull/1184), 12/12.
- Active Information Gain attribution stack: [PR #1160](https://github.com/ailtron1ss-rgb/NK1/pull/1160), 23/23 on its current head; not merged.
- Release metadata: GitHub Releases API, tags `workpass70-hotfix1-2026-10-19` and `Neuro`; binary asset not independently verified.

**No PR merge, Release publication, branch deletion, force-push, production change, secret/permission change or paid action was performed.**
