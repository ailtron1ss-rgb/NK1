# NK1 / NeuroCore — реестр консолидации — 2026-11-25

## Каноническая линия и census

- Репозиторий: `ailtron1ss-rgb/NK1`; рабочий аккаунт: `ailtron1ss-rgb`.
- Каноническая ветка: `workpass70-source`.
- Source после интеграции этого запуска: `9008a8982a5173304456bee2c604bd0bc8665964`.
- Tree SHA source: `864841c05b5810e9c218dcf973d1e8b7307cb75e`.
- Предыдущий source до интеграции: `87c9ed9034e09ca9fb83fd676ac52bb46434c4fe`.
- Текущий `main`: `06e01cdd0a8e60ed70991f22e842887f544d1ebf`; в этом запуске не изменялся.
- Полный paginated census: **1 140 branch refs** (11 страниц по 100 и последняя страница 40); **250 открытых PR** (100 + 100 + 50).
- Предыдущая запись PR #1133: 1 121 refs и 235 open PR. Наблюдаемая динамика: **+19 refs, +15 open PR**. Для branch count предыдущий snapshot использовал другой endpoint; разницу нельзя трактовать как доказательство создания ровно 19 веток.
- После merge PR #1157 его branch ref остался в репозитории; физического удаления веток в этом запуске не было.

## Новое реальное слияние этого запуска

PR [#1157 — Verify SelfAuthorship through decision-bound receipts](https://github.com/ailtron1ss-rgb/NK1/pull/1157) объединён в `workpass70-source` методом squash.

- Donor branch: `aspect/p0-actionreceipt-selfauthorship-recovery-20261124`.
- Exact PR HEAD: `a035fe8fafdb359b7c1e748eb95220123ae2c315`.
- Exact base: `workpass70-source @ 87c9ed9034e09ca9fb83fd676ac52bb46434c4fe`.
- PR tree SHA: `864841c05b5810e9c218dcf973d1e8b7307cb75e`.
- Merge result: `9008a8982a5173304456bee2c604bd0bc8665964`.
- Merge parent: `87c9ed9034e09ca9fb83fd676ac52bb46434c4fe`.
- Merge tree SHA **точно совпадает** с PR HEAD tree: `864841c05b5810e9c218dcf973d1e8b7307cb75e`.
- Diff: 13 файлов, +992 / −36; 25 commits в PR.
- Exact-head check-runs: **72/72 SUCCESS**. Единственный первоначальный провал clean prototype startup smoke был вызван неготовностью gateway health endpoint (`fetch failed`); rerun attempt 2 прошёл все шаги: [run #45474581152](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45474581152).
- Два специализированных P0 workflow также SUCCESS: [ActionGateway recovery](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45474580837), [spine-only parity](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45474580953).
- Review threads: 0; unresolved threads: 0. Branch protection endpoint недоступен подключению, но merge API принял точный expected HEAD.
- `npm run typecheck` в этих workflow — Node syntax-only режим; semantic TypeScript `tsc` не заявляется.

## Что интегрировано

- Bounded pending-decision ledger в SelfAuthorship: авторство не увеличивается при одном лишь выборе действия.
- Outcome связывается с точным Core decision ID; повторный, чужой, незавершённый, просроченный или внешний запрос не создаёт повторный intrinsic credit.
- Pending/settled facet сохраняется через существующий Core snapshot/restore boundary.
- Spine-only path теперь использует тот же decision-bound attribution; feedback остаётся привязанным к предыдущему trace и не дублируется на следующем решении.
- ActionGateway settlement выполняется только после точного decision-linked host-attested external postcondition и verified result. При неоднозначном provider acknowledgement операция остаётся pending; после restart допускается read-only receipt reconciliation без повторного внешнего side effect.
- CognitiveEventFabric сохраняет sanitized decision reference, но не создаёт фиктивную parent edge при отсутствии соответствующего CEF node; legacy receipt replay остаётся совместимым.
- Добавлены четыре регрессионных теста, два специализированных workflow, package scripts, changelog, карта направления и implementation plan.

## SHA / blob evidence по выбранной P0-группе

Полные tree SHA выбранных PR различаются; это не дубликаты целых деревьев:

| PR | Tree SHA |
|---|---|
| #1157 (merged) | `864841c05b5810e9c218dcf973d1e8b7307cb75e` |
| #1153 | `efc1faa0a6686ca5f5f356da1da515f25fbbdd80` |
| #1162 | `f4251e2234cf9cdbca6dcefdf91c55bcf2ba8cb2` |
| #1165 | `e54588e03f3d1291db76e40f35eada23886f72af` |
| #1166 | `a94882e586f3667c666368ac9006baf9ee846388` |
| #1167 | `909cee8715511a2f2b4af59247d93c660ecb7ba5` |

Точные совпадения отдельных blobs:

- `SelfAuthorship.ts`: PR #1153/#1162/#1165/#1166 разделяют старый blob `00e961754c952ac1cf96efe742db78de6f7eb22a`; в merged #1157 используется новый blob `b4ddc3fd63b83c9a55d77e57753dd0e3179d5099`. Старый вариант не переносить поверх нового.
- `self-authorship-verified-execution-workpass70.mjs`: #1153/#1162/#1165/#1166 имеют blob `ade88a0b85dfd6dc6efee16560fc88159fa98329`; merged #1157 содержит обновлённый тест blob `f3319b07deda3fd14e81fa62c21162e04dfd8ed5`.
- `self-authorship-spineonly-runtime-workpass71.mjs`: #1157/#1165/#1166 совпадают по blob `e59c538fa3585569e520fd9f2f4fb706f1c2a6dd`.
- `action-receipt-selfauthorship-recovery-workpass72.mjs`: #1157 и #1166 совпадают по blob `b75c1c71f1939b109bb7a22a514ab89ee7253377`.
- `CognitiveEventFabric.ts`: #1157 и #1166 совпадают по blob `2ad93f53bc0f0af78c38680c8682395a5ec9bc31`; #1167 имеет отдельную расширенную реализацию.
- `MemoryOS2.ts`: текущий source и #1162/#1165/#1166 используют blob `b0c54655e52fd66d377bbf506c898edd29ae68b7`; #1153 содержит отдельный blob `ef38bebf7e8d134c380a85996982e287b10016f5`. Это уникальный memory-кандидат для отдельного selective port.
- Core blobs и package manifests между этими PR не совпадают полностью; их нельзя считать точными дублями только по названию/назначению файлов.

## Сохранённые, но не закрытые направления

- **PR #1153 — MemoryOS2 integrity**: старый base `54f9ec7...`, compare с новым source — 5 ahead / 4 behind. Его уникальный `MemoryOS2.ts` blob и три byte-accounting/restore regressions не вошли в #1157. Сохранять; переносить только проверенные MemoryOS2 изменения, не старые SelfAuthorship/Core blobs.
- **PR #1162**: старый base `8328336...`, 3 ahead / 2 behind; старый SelfAuthorship blob совпадает с #1153, отдельный workflow и тестовые материалы требуют selective review.
- **PR #1165**: старый stacked base, 4 ahead / 2 behind; spine-only test blob уже сохранён в #1157, уникальный документ оставить до проверки содержимого.
- **PR #1166**: старый stacked base, 6 ahead / 2 behind; action receipt test, spine-only test и CEF blob совпадают с merged #1157, но Core/SelfAuthorship/package blobs различаются; PR не закрывать до проверки всех отличий и документа.
- **PR #1167 — decision lineage across eleven cognitive stages**: отдельная реализация, 19 ahead / 1 behind от нового source. Это не дубль SelfAuthorship; следующий кандидат после синхронизации base и повторного exact-head CI.
- PR #1156 сейчас закрыт без merge; его spine-only работа представлена в #1157. Его закрытие не считается слиянием этого запуска.

## Очистка, блокеры и Release

- Новых реальных merge в этом запуске: **1** — PR #1157.
- Безопасных кандидатов на удаление веток: **0**. Ни одна ветка не удалялась; PR donor branch #1157 сохранена.
- Глобальная побайтная проверка tree/blob для всех 1 140 refs не заявляется; SHA-анализ выше ограничен выбранной P0-группой.
- Блокеры: выборочный перенос уникального MemoryOS2 blob из #1153; старые Core/SelfAuthorship stacked diffs #1162/#1165/#1166; синхронизация #1167 с новым source и повтор CI.
- `main` не менялся: `06e01cdd0a8e60ed70991f22e842887f544d1ebf`.
- Последний Release: tag `Neuro` @ `c2e8e4a78431734612f89318e79d3491643f24f3`, ZIP `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`, 135 290 615 bytes; GitHub metadata digest `sha256:c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`.
- Бинарный ZIP не удалось скачать в runtime; digest не пересчитывался. Содержимое ZIP и parity с новым source **не проверены**. Изменения #1157 не объявляются частью `main` или Release.


## Последующая инженерная работа после census — 2026-11-25

После сохранённого census были выполнены selective source-based изменения на aspect-ветках. Canonical source остаётся `9008a8982a5173304456bee2c604bd0bc8665964`; никакой из этих PR не объединён этим обновлением документации.

| PR | Проверенный HEAD | Результат |
|---|---|---|
| [#1179](https://github.com/ailtron1ss-rgb/NK1/pull/1179) | `a33e889900a6575160cb8b5b96ab6b8d1cf61de1` | Metacognitive Neural Substrate alignment; 11/11 exact-head checks SUCCESS |
| [#1180](https://github.com/ailtron1ss-rgb/NK1/pull/1180) | `9c13acd0287314992a0d8a421c50533d2798231a` | P53 fail-closed self-promotion and v2→v3 legacy quarantine; 74/74 exact-head checks SUCCESS |
| [#1175](https://github.com/ailtron1ss-rgb/NK1/pull/1175) | `b1bce60c5d2ea79e24707597b77935764fc14cd1` | Grounded World→Appraisal/Attention→Goals/Planning; 51/51 exact-head checks SUCCESS |
| [#1173](https://github.com/ailtron1ss-rgb/NK1/pull/1173) | `b7b6a6d76141010677af36a8a8453fe7a3b52b86` | Canonical affect/mood frame and P66 temporal regulation; 95/95 exact-head checks SUCCESS |
| [#1174](https://github.com/ailtron1ss-rgb/NK1/pull/1174) | `e1f83557bc8f5e7d9b304f943f8fce8d9c9b6192` | Current-source continuity durability port; 76/76 checks SUCCESS, 0 failures, 0 pending; dedicated 11-step continuity acceptance workflow passed |

PR #1174 was updated in place: its existing aspect branch now includes the canonical source commit as a merge parent, without force-push or a successor branch. The compare from canonical source to the updated aspect head is 11 commits ahead / 0 behind and still contains nine intended files.

Previously open PR #1170 remains Draft with its 83/83 Actions matrix passing. Independent review and target-device/power-loss soak remain open. The current published Release/ZIP and legal blockers are unchanged.

These two neighbouring aspect PRs are existing work by their respective branch authors, not code changes from this pass. They were rechecked on their current exact HEADs after the above work and are recorded to preserve the whole cognitive chain in the handoff. Both remain Draft and unmerged.


## P23 signed Skill Shadow freshness — 2026-11-25 update

- Existing PR [#1177](https://github.com/ailtron1ss-rgb/NK1/pull/1177) was synchronized in place with canonical `workpass70-source@9008a8982a5173304456bee2c604bd0bc8665964` using two-parent merge commit `b77d904911a0cb97355e48cfc35a23c0819e19b2`; no force-push or successor branch.
- Latest inspected PR HEAD: `27c74e0502264f4a10959ad9f7cd49acfcd221c5`; compare: 15 ahead / 0 behind; six intended files.
- Strengthening covers 30-day evidence freshness, a five-minute future-clock allowance, exact candidate/version and Ed25519 binding, trusted external run context, explicit record/promotion/persisted-active verification purposes, and fail-closed safe-integer validation for clock and signed UTC millisecond timestamps.
- TDD red was observed at test-only HEAD `fc4247d26ae2e8e41377fdd256a86ae9e96a3b47`: exact assertion proved an unsafe finite clock passed persisted-active verification. Run [45606567069](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45606567069). Clock hardening followed in `b43d5b64068e2a8b14888cf41c3e5026022d3cfe`;  fractional receipt timestamp test and corresponding safe-integer validation followed in `27c74e0502264f4a10959ad9f7cd49acfcd221c5`.
- Dedicated exact-head P23 workflow [45607764358](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45607764358) completed **SUCCESS** for PR head `27c74e0502264f4a10959ad9f7cd49acfcd221c5` (GitHub merge head `e4e154aa4985f2ac9f2fe5103938570fb1e6adb5`). Focused freshness, signed-evidence, candidate-store and approval-request/default-deny tests passed. Runtime validation was Node strip-syntax-only for 746 files; semantic `tsc` was unavailable, so no semantic typecheck is claimed. Historical 63/63 checks belonged to the older base/head and are not reused as current proof.
- PR remains Draft/open/unmerged. No canonical source, `main`, Release tag or Release ZIP was changed. No skill-quality uplift, recall improvement, or live production verification is claimed.
- Full engineering record: [NK1_P23_SKILL_SHADOW_EVIDENCE_FRESHNESS_2026-11-25.md](../engineering/NK1_P23_SKILL_SHADOW_EVIDENCE_FRESHNESS_2026-11-25.md).


## Durable delivery ownership and crash reconciliation — 2026-11-25

### Social initiative delivery — existing PR #1181
- Branch `aspect/social-delivery-outbox-lease-20261125`, head `c92c734cc785fc4d36ba1cc9e9d471d0cf7c0436`, base canonical `workpass70-source@9008a8982a5173304456bee2c604bd0bc8665964`.
- Exact-head GitHub Actions: **46/46 SUCCESS**, including unified organism runtime and clean prototype startup.
- This state machine remains the exclusive owner of proactive social initiative leasing, retry scheduling, consent/quiet-hours re-check, stable UI turn identity and durable chat-before-ACK.

### Generic durable obligations — existing PR #1182
- Branch `aspect/openclaw-durable-delivery-outbox-20261125`, current PR head `b65bc0bbcb8596d9fc30922960b94f4703d923a9`, base `9008a898...`; compare: **27 commits ahead / 0 behind**, seven intended paths. A documentation-only commit followed code head `46c5b4aceda81585ebdd07c80d09a7abf0c3e176`.
- The generic outbox accepts task-completion, reminder, notification and custom obligations; it explicitly rejects `initiative-message`, avoiding a second queue/lease/ACK owner for the social-delivery domain in #1181.
- Its new `reconciliation-required` state quarantines expired leased deliveries. Unknown external outcome remains quarantined. Only host-authoritative `confirmed-delivered`, `confirmed-not-delivered` or `cancelled` reconciliation can settle/retry/terminate. Requeue after confirmed-not-delivered observes backoff and the attempt ceiling.
- Outbox was moved beneath `organism/persistence`, exposed through the existing `FileStateStore` persistence facade, and its direct import from central `OrganismRuntime` was removed. The architecture budget was **not** raised.
- Exact code-head audit [45610617629](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45610617629): **SUCCESS**; 65/65 dependency rules, zero budget violations, zero cycles, zero missing imports, zero boundary violations; semantic `tsc` also **PASS**. Transitive import audit [45610616775](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45610616775): **SUCCESS**.
- Dedicated current-head outbox contract workflow [45611057409](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45611057409) is queued. Do not claim the focused contract / proactive-consent / OpenLoop tests as passed until it finishes. Intermediate failures were fixed: an invalid TS non-null assertion in an `.mjs` test and the extra direct Runtime dependency that exceeded 45.
- PR #1182 remains Draft/open/unmerged; no source/main/Release change.

### P23 evidence freshness — #1177 exact-head CI
- Current head `27c74e0502264f4a10959ad9f7cd49acfcd221c5`; dedicated freshness workflow passed. The full exact-head check matrix completed **65/65 SUCCESS**. Runtime syntax/type verification in that matrix used node strip-syntax; semantic TSC was unavailable there. (The separate #1182 architecture workflow above did run semantic `tsc` successfully.)

All three aspect PRs are still Draft and unmerged. This checkpoint is a status/evidence handoff only and does not claim their code is integrated into canonical source.


## Проверка интеграционных границ и exact-head состояния — 2026-11-25, дополнительный проход

### Источник и метод

- Повторная сверка выполнена по PR API, актуальным head/base SHA и полным спискам изменённых файлов на 2026-11-25.
- Canonical source на момент этой сверки остаётся workpass70-source@9008a8982a5173304456bee2c604bd0bc8665964.
- Для всех записей ниже различаются: наличие кода, наличие теста, выполнение exact-head CI и merge/release. Отсутствие CI-статуса не трактуется как PASS.
- Новые merge не выполнялись; source, main и Release не изменялись.

### Проверенные PR и ограничения доказательств

| PR | Exact HEAD при проверке | Base | Суть / наблюдаемая граница | Статус доказательств |
|---|---|---|---|---|
| [#1182](https://github.com/ailtron1ss-rgb/NK1/pull/1182) | d8870dd796eecf8c406ba56e5c80d77074917a2f | workpass70-source@9008a898... | Durable host-admitted outbox, idempotency key, bounded lease/retry/reconciliation, transcript-before-ACK. Добавлен regression-тест: transport timeout должен перейти в reconciliation-required; retry допускается только после host-подтверждения confirmed-not-delivered. | Тест добавлен на exact branch head; GitHub Actions требует repository approval, поэтому результат именно этого head пока не наблюдался. Тест ожидаемо конфликтует с текущим recordFailure, которое возвращает любой timeout в pending; production fix не объявляется готовым. Draft/open/unmerged. |
| [#1181](https://github.com/ailtron1ss-rgb/NK1/pull/1181) | c92c734cc785fc4d36ba1cc9e9d471d0cf7c0436 | workpass70-source@9008a898... | Lease/retry реализован прямо в AutonomousSocialInitiativeEngine. Четыре файла пересекаются с #1182: OrganismRuntime, chatCache.ts, store.ts, proactive-chat test. | Архитектурное дублирование lease owner: выбрать один канонический delivery owner. Предпочтителен host-side outbox из #1182 при условии прохождения тестов; не сливать обе реализации целиком. Draft/open/unmerged. |
| [#1174](https://github.com/ailtron1ss-rgb/NK1/pull/1174) | e1f83557bc8f5e7d9b304f943f8fce8d9c9b6192 | workpass70-source@9008a898... | Crash-safe continuity journal / watchdog checkpoint semantics. | Предыдущий ledger записывает 76/76 и отдельный 11-step acceptance; текущая сверка подтвердила PR head/file set, но не повторяла physical power-loss/device soak. Два общих файла с #1170: OrganismCore.ts и package.json. Draft/open/unmerged. |
| [#1170](https://github.com/ailtron1ss-rgb/NK1/pull/1170) | 2095bce3353daacb8eebe567a53b33ef32ff1931 | workpass70-source@9008a898... | Atomic runtime checkpoint envelope for Core/world/sidecars and projection fault matrix. | Предыдущий ledger отмечает 83/83 Actions для ранее проверенного head; текущая сверка подтвердила PR head/file set, но не считает историческую матрицу доказательством нового head без exact-SHA rerun. Два общих файла с #1174. Draft/open/unmerged. |
| [#1169](https://github.com/ailtron1ss-rgb/NK1/pull/1169) | fd19ea915ea5cfd60bd16419efc3645b9b65a116 | #1170 @2095bce... | N.E.K.O. plugin ingress quarantine, one-use host capability, durable ingress receipts and restart behavior. | Stacked dependency: сначала проверить/принять parent checkpoint envelope #1170; #1169 нельзя рассматривать как самостоятельный прямой merge в source. Previous exact-head 68/68 относится к older head, не автоматически к этому SHA. Draft/open/unmerged. |
| [#1180](https://github.com/ailtron1ss-rgb/NK1/pull/1180) | abf87d02188265f2856cf07d84749a2012daea29 | workpass70-source@9008a898... | P53 self-modification preview-only без независимых holdout / transfer доказательств; legacy promotions quarantined при миграции. | Сильный safety design; exact-head CI для этого SHA текущей сверкой не подтверждён. Прежние 74/74 нельзя переносить на новый SHA без совпадения. Draft/open/unmerged. |
| [#1179](https://github.com/ailtron1ss-rgb/NK1/pull/1179) | b2bce0c294f0c4383fceb0bb9a333d9841232f14 | workpass70-source@9008a898... | Metacognitive neural integrity: 27-dimensional feature input, matched prediction targets / gradients, restore sanitization. | Предыдущий test-only RED установил 24-vs-27 input defect; текущий exact head всё ещё требует своего CI evidence. Нет утверждения о real-world cognition uplift или device validation. Draft/open/unmerged. |
| [#1177](https://github.com/ailtron1ss-rgb/NK1/pull/1177) | 27c74e0502264f4a10959ad9f7cd49acfcd221c5 | workpass70-source@9008a898... | P23 signed skill evidence freshness, exact-candidate/run binding, safe integer timestamps and verification purpose. | Dedicated freshness workflow на exact head записан как SUCCESS в предыдущем разделе P23. Semantic TypeScript и production skill-quality improvement не заявляются. Draft/open/unmerged. |
| [#1175](https://github.com/ailtron1ss-rgb/NK1/pull/1175) | 2b85d7465f69ec15a996993b2d3cf68cde825ebf | workpass70-source@9008a898... | Grounded world evidence → appraisal / predictive attention / planning. | Head изменился после ранее записанных SHA; прежние 51/51 нельзя считать доказательством текущего head без exact match. Draft/open/unmerged. |
| [#1167](https://github.com/ailtron1ss-rgb/NK1/pull/1167) | bf06021a161bd2acb5284532da20c510c2282b3d | workpass70-source@8328336... | Decision identity across cognitive stages and CEF / metacognitive episode boundary. | Base старше current source; синхронизировать/rebase и повторить exact-head matrix до интеграции. Прежние 73/73 относятся к older head. Draft/open/unmerged. |
| [#1168](https://github.com/ailtron1ss-rgb/NK1/pull/1168) | 404526bc8f23b942c22438dc5892a9d4f3b644f0 | workpass70-source@87c9ed... | Broad verified agency outcome loop; 37 changed files. Branch name has -r2 suffix. | Stale base и широкий diff повышают review cost. Не создавать следующие suffix variants; сначала hunk-level review с merged #1157 и SelfAuthorship stack #1162/#1165/#1166. Старое 35/35 не доказывает текущий base/head. Draft/open/unmerged. |
| [#1176](https://github.com/ailtron1ss-rgb/NK1/pull/1176) | 305d4f25d1ff174af6034f1989f3a1511368d681 | workpass70-source@87c9ed... | Read-only probes for every cognitive subsystem port. | Stale base; использовать как observability input только после синхронизации с текущими owner contracts. Draft/open/unmerged. |
| [#1164](https://github.com/ailtron1ss-rgb/NK1/pull/1164) | b78a525acaabe0a4de00fd807eefe87a44a93c75 | workpass70-source@8328336... | Avatar/3D stage, browser acceptance. Добавлен test-only raycast regression для static head meshes beside skinned torso, full-character contact bounds и floor exclusion. | Последний наблюдавшийся browser run на более раннем SHA завершился ошибкой: 3D head raycast не отправил canonical contact. Текущий test-only commit не имеет exact-head status; требуется repository approval. 3D E2E, Android soak, audio/lip-sync и release promotion не приняты. Draft/open/unmerged. |

### Интеграционные правила для следующих циклов

1. Durable delivery: #1182 — предполагаемый единый persistence/lease owner. Из #1181 можно перенести недостающие consent/quiet-hour lifecycle tests, но не добавлять две параллельные lease state machines в Core и outbox.
2. Runtime checkpoint + continuity: #1170 и #1174 дополняют друг друга, но оба меняют Core flush и package scripts. Свести hunks в один порядок checkpoint generation; continuity journal остаётся подчинённым canonical checkpoint owner.
3. Plugin trust boundary: #1169 зависит от #1170. Сохранить one-use host capability и durable receipt; интегрировать только после актуализации и проверки parent.
4. Self-improvement: #1180 должен оставаться fail-closed, пока отсутствуют независимые host-owned holdout/transfer evidence. Shadow score самого агента не является разрешением на promotion.
5. Neural self-observation: #1179 — исправление существующего neural substrate, а не второй metacognition engine. Сохранить schema, target semantics и migration под текущим owner.
6. Avatar: renderer остаётся потребителем shared Core/Motor state; тестировать реальный canvas input → perception evidence → UI snapshot. Внешний вид не сертифицирует interaction.

### Изменения, сделанные в ходе этого дополнительного прохода

- PR #1164: добавлен только тест геометрии / contact picking; production logic не менялась.
- PR #1182: добавлен только тест неоднозначного transport timeout; production logic не менялась.
- Оба теста не помечены как RED: exact GitHub Actions run заблокирован approval, локального repository sandbox нет.
- ProductOS sandbox команды недоступны из-за исчерпанного free-credit balance; это ограничение среды, не результат проверки кода.
- Ни один branch ref, protected setting, workpass70-source, main, Release или ZIP не изменялся.

### Следующий эффективный порядок

1. Разблокировать GitHub Actions для целевых PR; выполнить RED на #1164 и #1182 exact heads.
2. Исправить 3D picking: отделить rig-preferred camera-fit bounds от полного character-only pick mesh set и contact bounds.
3. Исправить ambiguous delivery: unknown transport outcome → reconciliation-required; retry только после authoritative host reconciliation confirmed-not-delivered.
4. Свести #1170 + #1174 на двух пересекающихся Core/package files и повторить exact-head CI; #1169 следует за parent.
5. Повторно проверить exact-head P53, metacognitive, P23 и world integration; синхронизировать stale bases до merge consideration.
6. Только после acceptance review проверять release manifest/ZIP hash и legal/license gate. Не называть изменения released до parity with artifact.

## Exact-head CI refresh — 2026-11-25

A fresh query of workflow runs associated with the exact current PR head SHAs returned the following results. Counts below are the returned PR-triggered workflow runs from the GitHub commit workflow-run endpoint (first page), not a claim that every check visible in every UI view was enumerated. All returned runs in each group were completed SUCCESS.

| PR | Exact HEAD | Returned runs | Successful | Relevant dedicated run |
|---|---|---:|---:|---|
| [#1177](https://github.com/ailtron1ss-rgb/NK1/pull/1177) | 27c74e0502264f4a10959ad9f7cd49acfcd221c5 | 65 | 65 | [Skill shadow evidence freshness](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45607764358) |
| [#1179](https://github.com/ailtron1ss-rgb/NK1/pull/1179) | b2bce0c294f0c4383fceb0bb9a333d9841232f14 | 11 | 11 | [Metacognitive Neural Integrity](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45609224720) |
| [#1180](https://github.com/ailtron1ss-rgb/NK1/pull/1180) | abf87d02188265f2856cf07d84749a2012daea29 | 70 | 70 | [P53 Self-Improvement Fail-Closed](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45608425117) |
| [#1175](https://github.com/ailtron1ss-rgb/NK1/pull/1175) | 2b85d7465f69ec15a996993b2d3cf68cde825ebf | 46 | 46 | All returned commit-associated workflow runs SUCCESS |
| [#1170](https://github.com/ailtron1ss-rgb/NK1/pull/1170) | 2095bce3353daacb8eebe567a53b33ef32ff1931 | 75 | 75 | All returned commit-associated workflow runs SUCCESS |
| [#1174](https://github.com/ailtron1ss-rgb/NK1/pull/1174) | e1f83557bc8f5e7d9b304f943f8fce8d9c9b6192 | 70 | 70 | [Continuity runtime durability](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45603680507) |

The exact-head refresh upgrades the evidence status for these six heads compared with the prior section's earlier cautious note. It does not remove independent review, stale dependency, overlapping-file, device-soak, or merge/release gates. In particular, #1170 and #1174 both pass their respective current matrices but still overlap in OrganismCore.ts and package.json; passing CI independently does not prove a correct combined result.

No exact-head workflow run was returned for current #1164 head b78a525acaabe0a4de00fd807eefe87a44a93c75 or current #1182 head d8870dd796eecf8c406ba56e5c80d77074917a2f. Their new regression tests remain unexecuted; no RED/green result is claimed.