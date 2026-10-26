# NK1 — полный аудит дерева веток и связности файлов
**Дата снимка:** 2026-10-26  
**Базовый source stack для сравнения деревьев:** `workpass70-source` — `a4cf11141c0e8083e5f8a35bec8c6c2bebac640b`

## Важные выводы

1. **`main` не является рабочим source stack.** На момент обхода его recursive Git tree содержал 14 объектов, включая всего 11 blob-файлов; в нём отсутствуют исходники `runtime/neuro-kurisu/src/` и тесты runtime. Базовая ветка `workpass70-source` содержит 9 658 blob-файлов, в том числе 641 runtime-исходник, около 2 302 тестов и 21 workflow. Переключаться на `main` как на основной runtime нельзя без полноценной интеграции и проверки.
2. **PR #90 направлен в нерабочую базу.** `nk1-skill-promotion-gate-20261024` открыт против `main`, а дерево его head содержит около 12 blob-файлов. Это не полноценная интеграция promotion gate в runtime. Перед слиянием PR требуется перенести изменения в выбранную полную ветку source stack и прогнать её проверки; данный аудит не изменял base PR #90.
3. **Названия веток сильно преувеличивают число разных версий.** Во время одного из снимков API выдавал 165 refs и около 84 уникальных head SHA; 82 исторических имени ссылались на общий commit `82ea7a8b7c9b036e65c8b056acedd1176952dd8f` (дерево практически совпадает с source baseline: одна небольшая разница в changelog и одно удаление). Это алиасы истории, а не 82 независимых реализации. Числа являются снимком во время активных pushes и могут измениться.
4. **Ветки действительно содержат непохожие изменения.** В них разное количество source/test/workflow-файлов, меняются `OrganismCore.ts`, `OrganismRuntime.ts`, P23/P26 learning, manifests и CI. Нельзя безопасно интегрировать все refs простым слиянием по алфавиту или WorkPass-номеру.
5. **Опубликованный релиз отстаёт от дерева исходников.** Последний найденный релиз `Neuro` / `NeuroKurisu0.1` содержит `Neuro_Kurisu_WORKPASS70_2026-10-19.zip` размером около 135 MB; его публикация датирована 2026-10-19. Он не подтверждает наличие последующих интеграционных исправлений.

## Сравнение активных веток с `workpass70-source`

Значения A/M/D — число путей, которые при сравнении полного дерева текущего head с деревом baseline соответственно добавлены, имеют другой blob SHA или отсутствуют. Колонки source/tests/workflows считают затронутые пути этих категорий вместе; это **не** число всех файлов в текущей папке и не число ошибок. Снимки выполнены в условиях параллельных pushes, поэтому для merge необходим новый точный diff.

| Ветка / head SHA (сокращённо) | A / M / D | Затронуто: source / tests / workflows | Наблюдение |
|---|---:|---:|---|
| `feature/learning` — `840ed03` | 64 / 101 / 1 | 58 / 58 / 4 | Наиболее выраженное расширение P23/P26 обучения; нужна полная проверка replay, regression и restore. |
| `feature/memory` — `4f2def8` | 13 / 48 / 1 | 33 / 17 / 3 | Изменения памяти пересекаются с Core и общими learner-слоями. |
| `feature/memory-budget-restore-integrity-20261025` — `076375e` | 10 / 60 / 0 | 30 / 24 / 6 | Защитные изменения восстановления/бюджета; важна совместная проверка restore и runtime wiring. |
| `feature/perception` — `d28e2e7` | 13 / 52 / 1 | 30 / 21 / 5 | Ветка затрагивает Core/Runtime и требует проверки сквозного observation path. |
| `feature/emotional-continuity-ready-20261025` — `2c1e06e` | 5 / 63 / 1 | 24 / 20 / 9 | Много изменённых файлов при малом числе новых; сверять совместимость состояния эмоций с ядром. |
| `feature/visual-embodiment` — `be77eae` | 23 / 28 / 1 | 9 / 5 / 1 | Интеграция UI/embodiment; проверять, что avatar state отражает runtime-state и не становится вторым владельцем логики. |
| `operation-omega-hexis-deep-pass-2026-10-24` — `1301088` | 87 / 40 / 1 | 37 / 8 / 1 | Большой перенос новых файлов; требуются проверки зависимостей и provenance источников. |
| `optimization/process-supervision-20261024` — `c270a70` | 101 / 64 / 1 | 36 / 19 / 4 | Крупнейший из проверенных наборов добавлений; нужен отдельный shutdown/process-supervision прогон. |
| `workpass331-project-ordering-unified-20261024` — `2efa91a` | 111 / 55 / 7 | 33 / 19 / 4 | Высокий объём добавлений и удалений. Слияние без проверки deletion diff небезопасно. |
| `workpass332-live-runtime-kernel-2026-10-24` — `2fb6f77` | 91 / 59 / 1 | 35 / 22 / 3 | Существенное изменение runtime kernel и пути выполнения действий. |
| `workpass335-hermes-host-owned-evaluator-2026-10-24` — `d5c3e85` | 100 / 64 / 1 | 41 / 25 / 5 | Hermes/evaluator слой; при интеграции сохранять host-owned оценку и запрет автоматической активации. |
| `workpass335-paired-seed-growth-2026-10-24` — `39e9c77` | 99 / 60 / 1 | 37 / 25 / 4 | Оценка обучения и paired-seed evidence должны оставаться отдельно от обычной метрики тренировки. |
| `workpass339-intrinsic-drive-goal-bridge-2026-10-25` — `7e58d6c` | 92 / 65 / 1 | 37 / 25 / 4 | Мотивационный сигнал пересекается с целями и Core action arbitration. |
| `workpass538-memory-recall-rebased` — `aa03f2f` | 15 / 66 / 1 | 34 / 31 / 7 | Повышенный объём регрессий памяти и recall; проверять recall/continuity, а не только компиляцию. |
| `fix/mega-cognitive-integrity-audit-2026-10-25` — `2373df3` | 4 / 61 / 1 | 28 / 20 / 6 | Интеграционная ветка с большим числом модификаций Core и тестов. |
| `fix/mega-cognitive-progress-tracking-2026-10-26-r3` — head двигался во время обхода | около 27 / 75 / 0 | около 35 / 31 / 6 | На актуальном head прошли P26 Learning Validation и Unified project integration suite; этот результат не означает, что все остальные workflow зелёные. |
| `fix/runtime-typecheck-dependency-contracts-2026-10-25` — `eaac293` | 10 / 68 / 1 | 28 / 23 / 6 | Ветвь семантического typecheck; на ней есть отдельные незакрытые проблемы запуска/typecheck и несовпадений тестовых контрактов. |
| `fix/unified-substrate-runtime-wiring-rebased-2026-10-25` — `d0d8e73` | 10 / 51 / 0 | 29 / 19 / 5 | Перекрывается с runtime wiring и Core; сравнивать с текущим интеграционным head перед cherry-pick. |
| `fix/restored-action-receipt-integrity-2026-10-25` — исправленная ветка этого прохода | 9 / 57 / 0 | 29 / 22 / 4 | Содержит исправленный P26 interleaved replay; повторная проверка PR #140 запущена. |
| `work/nk1-toolchain-cognitive-closure-20261025-r2` — `4d1a25d` | 13 / 56 / 0 | 28 / 18 / 5 | Toolchain/dependency closure; в манифестах пять затронутых файлов — lock/pin надо сверять согласованно. |

## Подтверждённые проблемы связности и что уже сделано

- **Missing workflow path**: в ветке аудита workflow указывал на отсутствующий `runtime/neuro-kurisu/tests/cognitive-dependency-runtime-wiring.mjs`. Тест восстановлен, `CHANGELOG.md` обновлён. GitHub Actions run [40227730216](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40227730216) завершился успешно, включая проверку зависимостей когнитивного графа и episode-linkage.
- **P26 API gap and replay plasticity**: benchmark вызывал `P26TrueLearningEngine.trainInterleaved()`, которого не было в ветке-носителе. Метод добавлен; первая версия теста нашла, что replay cadence мог быть равен current update cadence, и тем самым ухудшать new-task plasticity. Реализация заменена на проверенный контракт: число replay attempts ограничивается и заданным максимумом, и `floor(currentBatch.length * maxReplayRatio01)` (по умолчанию коэффициент 0.5). Конфликтный replay сравнивается с текущими примерами по признаковому контексту и bounded cap; синтетические метрики не приравниваются к independent holdout.
- На открытом PR #140 обновлён код и changelog, а PR повторно открыт для точной CI-проверки. P26 Learning Validation на head `28238e9` завершился успешно: [run 40250296334](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40250296334). WorkPass293 и WorkPass294 также прошли на том же head. На момент записи этого документа repository wiring audit и общий typecheck ещё выполнялись; готовность к production не утверждается.
- На активной r3-ветке P26 Learning Validation и Unified project integration suite прошли: [P26](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40250049230), [integration suite](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40250049192). Отдельная проверка WorkPass108 на том же head всё ещё падает и требует независимой работы.

## План безопасной интеграции

1. Временно использовать `workpass70-source` / ветки с полным runtime как рабочую основу, а не `main`.
2. До переноса ветки проверять exact-head tree, base/head SHA, path diff, deletion list, package scripts/workflow triggers и тесты изменяемого слоя.
3. Интегрировать по узким вертикальным срезам: toolchain + typecheck; единый cognitive cycle; action gateway + verified receipts; P23/P26 learning; memory/recall; embodiment/voice. Не объединять десятки веток одним большим merge commit.
4. Сохранить одну canonical owner для runtime action/finalization и одну persisted source of truth для памяти/learner snapshots. Не принимать duplicate helpers как интеграцию, если их нет в live runtime.
5. Перед новым release: clean-machine install, semantic runtime typecheck, unified runtime smoke/restart, CI-regression suite и exact release-asset rebuild; обновлять ZIP только после проверенного успешного exact-head результата.

## Ограничения обхода

Этот проход сравнил recursive Git trees и blob SHA по текущим branch heads, проверил пути/манифесты/workflow linkage и прочитал проблемные источники/тесты, которые воспроизводились в CI. Поскольку активные ветки продолжали получать pushes во время чтения, это не заменяет повторное сравнение непосредственно перед merge. Дерево не читает все строки каждого из ~9,600 файлов одновременно; для полного семантического source review нужен последовательный послойный проход по runtime modules с CI для каждого exact head.
