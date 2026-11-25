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
