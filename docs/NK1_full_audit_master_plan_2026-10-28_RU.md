# NK1 / Neuro Kurisu — полный аудит, оценка прогресса и мастер-план

**Дата среза:** 28 октября 2026 г. 22:10 (Europe/Amsterdam, UTC+01:00).
**Окно изменений:** 28 октября 2026 г. 02:10–22:10 CET (01:10–21:10 UTC).
**Репозиторий:** https://github.com/ailtron1ss-rgb/NK1
**Canonical source:** https://github.com/ailtron1ss-rgb/NK1/tree/workpass70-source
**Release/report line:** https://github.com/ailtron1ss-rgb/NK1/tree/main

> **Главный вывод.** NK1 — большой и технически насыщенный исследовательский runtime с реальными исправлениями памяти, доказательств, learning-gates и когнитивных компонентов. Но «много работающего кода» пока не равно «полностью работающая автономная цифровая личность». По состоянию на этот срез ориентировочный прогресс к конечной цели — **42%**, инженерная зрелость — **47/100**, готовность к production-релизу — **20/100**. Это оценка состояния на основании репозиторных артефактов, веток и видимых CI, не лабораторное измерение интеллекта или сознания.

## 1. Что проверено и пределы этого аудита

Проверены: README на `main`, source `CHANGELOG.md`, `NEUROCORE_START_HERE.md`, master strategy/brain map, source `package.json`, сотни доступных веток (просмотрены первые две страницы веток, выборочные ветки сравнивались с source), текущие SHA для source/main и ключевых candidate branches, diff WorkPass608/B276/WorkPass601/Compose, PR #236/#252/#255/#55, workflow run summaries, job steps и конкретные логи падений релизного, P26 и Compose workflow.

Это **широкий архитектурный аудит с глубоким выборочным просмотром критичных участков**, а не утверждение, что вручную прочитан каждый файл во всех 200+ ветках. Source archive целиком не был локально собран и прогнан всеми тестами в этой сессии; любые оценки ниже обозначены как экспертный триаж, а не как результат собственного полного запуска всего test suite. Это важно: тесты подтверждены только там, где есть видимые run/job evidence на соответствующем SHA.

### Три разных числа — их нельзя путать

- **42% прогресса к конечной цели** — доля пути до связной, восстановимой, измеримо эффективной системы, учитывая интеграцию и эксплуатационные доказательства, а не количество файлов/WorkPass-номеров.
- **47/100 инженерной зрелости** — качество уже имеющейся конструкции, контрактов и тестируемости с учётом критичных выявленных дефектов и границ доверия.
- **20/100 production readiness** — насколько можно уверенно установить, запустить и распространять текущую версию как целый продукт. Legal gate, exact-head CI и реальные end-to-end проверки пока не закрыты.

## 2. Состояние репозитория и главные факты

1. `main` — релизная/отчётная ветка, а `workpass70-source` — актуальная база полного исходного дерева. GitHub возвращает **no common ancestor** между ними. Это соответствует документации проекта; автоматический merge/rewrite между ними небезопасен.
2. `main` HEAD на момент проверки: [`267ae705`](https://github.com/ailtron1ss-rgb/NK1/commit/267ae70587347c9214394127abed877e44590363), «Package audited SBOM and source provenance». `workpass70-source` HEAD: [`c226a4e`](https://github.com/ailtron1ss-rgb/NK1/commit/c226a4e8034db98eee213c23c7ce51c4abc8d14f), WorkPass608, 28 октября, 05:44:56 UTC.
3. В GitHub обнаружено как минимум 200 веток на просмотренных двух страницах; есть значительное число схожих `-v2/-v3` и WorkPass-веток. Это само по себе не доказательство плохого кода, но резко повышает риск потери изменений, неполной валидации и фиктивного ощущения завершённости.
4. `README.md` в `main` всё ещё указывает на WorkPass70 Hotfix 1 от **19 октября 2026 г.** и SHA-256 `9effadfcf0d402b462dd9cf2fd5b5793742039c9260db80578be830952bf52eb`. Он явно помечает сборку как implementation hotfix, **не production-approved**.
5. Документация `NEUROCORE_START_HERE.md` остаётся позади текущего source: в ней указаны старые checkpoints до WorkPass272/октября 22, хотя source changelog дошёл до WorkPass608 28 октября. Это необходимо синхронизировать в первую очередь.
6. На canonical source HEAD `c226a4e…` connector не показал видимых workflow runs; combined commit statuses также пусты. Поэтому не утверждаем, что последние source changes имеют подтверждённый exact-head full CI.

## 3. Подробный scorecard: 39 областей

Прогресс — оценка завершённости **до конечной цели** в конкретной области. Балл — оценка качества/инженерной зрелости текущего решения по шкале 0–100. Это две разные оси. Низкий прогресс при хорошем балле возможен, когда конструкция разумная, но реальное E2E ещё не доказано.

| Область | Прогресс к цели | Качество /100 | Текущее состояние и ближайший gate |
|---|---:|---:|---|
| Репозиторная топология и роли веток | 28% | 40 | `main` — релиз/отчёты; `workpass70-source` — исходный стек; общей истории Git нет. Нужна карта источников правды и запрет случайных merge/rewrite. |
| Актуальность проектного состояния и документации | 42% | 41 | README и NEUROCORE_START_HERE отстают от WorkPass608 и изменений 28 октября; требуется один обновляемый canonical state. |
| Единое ядро и когнитивный цикл | 58% | 56 | Много реальных модулей и регрессий; целостный цикл на последнем source HEAD не подтверждён независимым end-to-end прогоном. |
| Runtime TypeScript / Node.js | 63% | 52 | WorkPass609 чинит strip-only загрузку и typecheck, но он находится в отдельной ветке на 2 коммита впереди source; Node 22.12 CI падает на `stripTypeScriptTypes`. |
| CI и проверки точного HEAD | 48% | 46 | 18 из 19 видимых workflow runs на B276 HEAD успешны, но P26 падает на старом Node; у canonical source HEAD нет видимых workflow runs. |
| Провайдеры языковой модели / local LLM | 48% | 56 | Есть провайдерная политика и fake-provider HTTP smoke; реальный локальный инференс, качество и нагрузка на целевом устройстве не доказаны. |
| Резервирование провайдеров и offline-режим | 54% | 56 | Наброски fallback/circuit-breaker существуют; нужен честный контракт деградации и проверка, что ответ не приписан неиспользованной модели. |
| Постоянная память и жизненный цикл записей | 64% | 65 | Уже есть канонические MemoryOS2/MemoryFabric и temporal/revision механизмы; нужны реальные autobiographical-сценарии и тесты после перезапуска. |
| Восстановление, миграции и целостность памяти | 58% | 60 | Ряд snapshot/restore и mutation-receipt регрессий есть; сквозная миграция всех состояний и длительное восстановление не подтверждены на release-кандидате. |
| Целостность retrieval-пути | 70% | 68 | WP605–608 укрепляют векторы, stale cache, отбор результатов и cost attribution; это корректность маршрута, не измеренный прирост recall. |
| Качество поиска / recall uplift | 22% | 31 | README фиксирует прежний `recallDelta=0`; честный устойчивый выигрыш на независимом holdout пока не доказан. |
| Независимый двуязычный RU/EN holdout | 38% | 41 | WP601 harness есть в сильно divergent ветке, но не на текущем canonical source и не подтверждён как итоговый эксперимент на последнем исходном SHA. |
| Continual learning / replay | 43% | 44 | Есть P23/P26/replay/skill-revision контуры и много регрессий; реальный рост обобщения на задачных holdout не установлен. |
| Перенос навыков, забывание и interference | 34% | 38 | Новые integrity checks и метрики переходов добавлены; независимые измерения transfer/forgetting на реальной серии задач отсутствуют. |
| Причинная история и event lineage | 62% | 61 | Есть защита trace IDs, duplicate/conflict handling и snapshot guards; следует проверить все входящие call sites, где caller claims принимаются за факт. |
| Hexis / HMX / каноническое применение памяти | 61% | 60 | Есть настоящая интеграция, lineage bridge и receipt/rollback hardening в промежуточных ветках; большой PR #236 открыт и mergeable=false. |
| Планировщик, действия и пересмотр программы | 52% | 48 | B276 исправляет недостижимый scale threshold и инверсию конституционного сигнала, но исправление пока не включено в `workpass70-source`. |
| Верификация внешних результатов и действие без дублей | 52% | 53 | Контракты receipts/postcondition/идемпотентности существуют; полный реальный restart → proof → reconcile → rollback цикл не закрыт. |
| Независимый evaluator, sandbox и safety scanner | 25% | 32 | Есть интерфейсы и защита путей; настоящий отдельно управляемый OS/container sandbox, evaluator и scanner не подтверждены. |
| Личность и непрерывность поведения | 46% | 47 | Есть self/user-related components and character goals; continuity across long sessions, model changes, conflicting memories, and resets remains unmeasured. |
| Перцепция и модель мира | 42% | 43 | Архитектурные компоненты намечены, но внешнее восприятие, grounding и closed-loop behavior need real environment evidence. |
| Мотивация, эмоции и инициатива | 37% | 39 | Есть endogenous goals/initiative branches; основной критерий — запускаемая без внешнего prompt инициатива с объяснимой причиной — не подтверждён end-to-end. |
| Web UI, API и связность интерфейса | 49% | 47 | Frontend/API link checks и dev build есть в старом hotfix; production build and browser real-flow remain gates. |
| Live2D / аватар / синхронизация движений | 43% | 43 | Есть Live2D viewer/assets/tests; настоящий браузерный E2E, выражения, lip-sync drift and animation under interrupts not verified on current candidate. |
| Голос, TTS и речевой таймлайн | 42% | 44 | Из старого hotfix известны 11/11 timeline tests and Termux TTS concurrency check; physical Android audio synchronization remains open. |
| Android / Termux / целевое устройство | 35% | 38 | Нет подтверждённого end-to-end soak on real phone; target-device performance cannot be inferred from hosted CI. |
| API-сервер и отказоустойчивость | 55% | 56 | Есть fake-provider HTTP test and request paths; cancellation/timeouts/restart recovery/DB migration need production-shaped validation. |
| Безопасность и приватность | 47% | 48 | Несколько authority/provenance constraints; no full threat model, privacy dataflow inventory, or deployed isolation verification. |
| Производительность, память RAM, CPU и энергия | 28% | 30 | Нет validated full-workload timing, mobile budget, power/thermal/long-session baseline on target hardware. |
| Установка и Docker Compose | 32% | 34 | Compose smoke workflow failed before config/build because setup-node tried caching without a root lockfile; it never tested the stack. |
| Метрики, трассировка и восстановление | 55% | 54 | Есть diagnostics and receipts; one common trace from perception through action, memory, voice and release evidence still needs verification. |
| Документация разработчика и onboarding | 40% | 39 | `main` README is clear on current blocks but stale vs source; start-here has old WorkPass272 checkpoint despite WorkPass608. |
| Research intake и корректность экспериментов | 50% | 54 | Большой research and regression apparatus; candidate evaluations must be frozen, independently sourced, reproducible and not mixed with code-level tests. |
| Данные, provenance и dataset integrity | 65% | 64 | Label fingerprints, malformed label rejection and explicit provenance gates are improving; provenance/label independence must be demonstrated for the actual holdout. |
| SBOM и исходная provenance | 65% | 60 | Publisher now guards exact SHA and fresh SBOM overlay, but release pipeline was blocked at legal review and audited SHA differs from latest source head. |
| Лицензии и законность распространения | 10% | 25 | Latest audit reports `releaseRedistributionReady:false` with 135 missing human-review/evidence items; cannot claim redistribution approval. |
| Воспроизводимый Release и подпись/откат | 50% | 49 | Publisher guards were hardened; last documented release remains WorkPass70 Hotfix 1 dated 2026-10-19, newer publishing step was skipped. |
| Уникальность интеграции в одну личность | 45% | 48 | Distinctive goal exists, but uniqueness must be evidenced by stable behaviour and measured advantage, not by number of modules or names. |
| Полная production-готовность | 18% | 24 | Production build + DB migration, browser/Live2D E2E, physical device audio, independent retrieval uplift, soak and licenses remain open. |
| **Итог NK1** | **42%** | **47/100** | Большая часть архитектурных контуров существует, но evidence и product integration отстают. |
| **Готовность к production-релизу** | **20%** | **20/100** | Нельзя считать готовым к распространению до закрытия exact-head CI, настоящего E2E, target-device soak и юридического release gate. |

## 4. Разбор изменений за последние 20 часов

Окно: 28 октября 02:10–22:10 CET (01:10–21:10 UTC). GitHub timestamps ниже нормализованы в UTC; 28 октября в Амстердаме действует UTC+01:00.

### Что действительно улучшилось

- **WorkPass603–608 на canonical source:** усиливается целостность retrieval/learning evidence. Некорректные relevance-labels перестают проходить нормализацию незаметно; embedding vectors валидируются до ranking/cache; stale async embedding не используется после изменения canonical memory; fallback-preview больше не получает access-credit, если выбран semantic path; счетчики и cost signal привязаны к фактически выбранному результату. Это полезные исправления корректности и observability, но CHANGELOG специально не заявляет recall uplift.
- **WorkPass595–599:** эксперимент и hypothesis-confidence перестают продвигаться только по self-report; нужны action actually ran и проверяемый world-transition/внешний evidence; duplicate receipts и некорректные scores должны отвергаться до мутации состояния.
- **B276/WorkPass609 candidate** [`1d734154`](https://github.com/ailtron1ss-rgb/NK1/commit/1d734154e03fcdb3db39ec211f229b0eb23fe670): масштабно-инвариантный revision gate исправляет проблему, где пересмотр программы был фактически недостижим в core loop; исправляется инвертированный `constitutional01`; strip-only TypeScript загрузка brain-fusion и неверный `node --check` в typechecker исправляются. Ветка на два коммита впереди canonical source, поэтому изменения полезны, но ещё не стали частью release/source head.
- **WorkPass601 branch** [`c232666c`](https://github.com/ailtron1ss-rgb/NK1/commit/c232666c478d024c85d01154de2b6afcb6ea19df) добавляет offline RU/EN retrieval holdout runner с независимой provenance, answerable/unanswerable queries и paired seeds. Однако branch сильно расходится с source (`677 ahead / 231 behind`), поэтому нужно перенести узкий harness на свежую ветку, а не мержить весь divergence.
- Важные Hexis fixes были объединены во **вспомогательные промежуточные ветки** (PR #252/#255), включая evidence-lineage dedupe и server-smoke fixes. Это не значит, что обновлён `main` или опубликованный Release ZIP.

### Что не прошло и почему это критично

1. **P26 Learning Validation — FAIL** на B276 HEAD: runtime typecheck запускается в Node 22.12.0, но скрипт импортирует `stripTypeScriptTypes`, которого эта версия не экспортирует. Получен `SyntaxError: The requested module 'node:module' does not provide an export named 'stripTypeScriptTypes'`; все learning steps далее были skipped. Это подтверждённый mismatch конфигурации CI/toolchain, а не основание объявлять learning regression suite зелёным.
2. **Compose smoke — FAIL до старта Compose.** `actions/setup-node@v7` на Node 24 попытался автоматически включить npm cache, но root `package-lock.json` не существует; workflow остановился на `Dependencies lock file is not found`. Config/build/probes не запускались. Исправить `package-manager-cache: false` либо `cache-dependency-path: app/package-lock.json` (если приложение действительно владеет lockfile), и исправить branch filters, чтобы smoke запускался на intended PR/base.
3. **Release pipeline — FAIL на release-license gate.** Workflow [`40634367275`](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40634367275) прошёл checkout/exact-SHA freshness/проверки до license gate, затем упал на этапе provenance/license readiness; ZIP packaging, final freshness и publish были skipped. Audit report: `releaseRedistributionReady: false`, **135 ошибок/недостающих human-review records**. Это реальный publish blocker, не просто незаполненная документация.
4. **Нет exact-head CI evidence на `c226a4e…`.** В то же время на B276 HEAD видны 18 успешных и 1 неуспешный workflow run. Эти успехи покрывают отдельные регрессии этой ветки, но не являются доказательством полного статуса canonical source или release ZIP.
5. **Ветка PR #236** остаётся открытым draft, unmerged и `mergeable=false`, с крупным diff (123 файла по метаданным PR). Не мержить напрямую. Нужна reconciliation/rebase и дробление на малые проверяемые PR.

### Оценка качества последних 20 часов

- **Изменения в корректности памяти/evidence:** 8/10 — конкретные source diffs закрывают реальные edge cases и сопровождаются focused regressions.
- **Интеграция улучшений в canonical source:** 5/10 — часть важных фиксов ещё отдельными ветками, плюс branch divergence.
- **Надёжность CI:** 4/10 — много зелёных run-ов, но конкретные ошибки toolchain и Compose setup блокируют часть тестов; canonical head не подтверждён.
- **Прогресс к измеримому улучшению recall/learning:** 3/10 — инфраструктура измерения улучшается; сама полезность пока не показана `recallDelta > 0` на независимом immutable holdout.
- **Прогресс к релизу:** 2/10 — законность распространения заблокирована 135-item audit, свежая ZIP не опубликована.
- **Общий вклад 20 часов:** примерно +2–4 п.п. к техническому прогрессу, но **без увеличения release readiness**. Эта оценка намеренно осторожна: свежие commits исправляют correctness/evidence plumbing, а не доказывают конечную эффективность системы.

## 5. Критические приоритеты: что важнее всего

**P0 — сначала:** (1) выровнять Node.js/typecheck по всем workflows; (2) починить Compose setup/cache and branch triggers; (3) обновить canonical state docs; (4) аккуратно перенести B276/WorkPass609 на fresh source branch и прогнать exact-head tests; (5) перенести WP601 harness без 677/231 divergence и получить реальный frozen benchmark; (6) закрыть 135 license-review records настоящими human decisions; (7) получить новый release only after gates pass.

**P1 — затем:** развернуть independently controlled evaluator/verifier/scanner и реальный sandbox; end-to-end browser/Live2D/TTS/Android run; restart-safe causal proof; measurable performance/soak; personality/initiative success criterion.

**P2 — после стабилизации:** selective upstream integrations, model experiments, avatar enhancements and unique behaviour improvements, each tied to blind evaluation rather than module count.

## 6. Master plan — 176 проверяемых этапов

Порядок не означает строго последовательный единственный поток: можно вести независимые workstreams параллельно, но нельзя закрывать downstream gate без его dependencies. Каждый пункт заканчивается критерием приёмки; текущий факт «есть файл/ветка» не переводит пункт в `DONE`.

**Правило принятия:** change → focused test → exact-head workflow → integration test → immutable evidence → update scorecard. Не прибавлять прогресс за отчёты/строки/названия WorkPass без работающего поведения и доказательства.

### Этап 1. Канонический источник правды и политика релиза

001. Зафиксировать `workpass70-source` как canonical source и `main` как release/report line в одном коротком charter; acceptance: роли отражены в README и AGENTS.md.
002. Записать точные HEAD SHA для source, main, PR #236 и B276-кандидата с датой, часовым поясом и ссылками; acceptance: один state file обновляется на каждом engineering pass.
003. Сверить README, NEUROCORE_START_HERE, CHANGELOG и актуальный workflow: закрыть противоречие WorkPass272 vs WorkPass608; acceptance: главный handoff указывает текущие SHA и незакрытые gates.
004. Составить каталог всех release assets и проверить какой ZIP реально последний опубликованный; acceptance: имя, tag, размер, SHA-256 и ссылка совпадают.
005. Добавить защитное правило: не cherry-pick/merge/rewrite `main` без явного соответствия release-line; acceptance: автоматический check блокирует неожиданный parent/source lineage.
006. Описать релизный контракт (exact source SHA → exact-head checks → SBOM/provenance → license gate → ZIP verification → publication); acceptance: каждая стадия имеет проверяемый артефакт.
007. Разделить статусы `implemented`, `wired`, `tested`, `measured`, `release-approved`; acceptance: отчёты не маркируют тестом наличие скрипта.
008. Сделать canonical state table из 10–15 ключевых метрик и владельцев; acceptance: значения обновляются только со ссылкой на коммит/run/dataset.

### Этап 2. Ветки, PR и селективная интеграция

009. Выгрузить все страницы веток GitHub (не останавливаться на первых 200) и построить таблицу branch → head SHA → parent/base → commits ahead/behind → owner intent; acceptance: ни одна страница не потеряна.
010. Разделить ветви на `source-fix`, `integration-stack`, `experiments`, `docs`, `release`, `superseded`; acceptance: каждая активная ветка имеет одну категорию и конечное назначение.
011. Обозначить source-форки с 200+ commits ahead и 231 behind как divergent, не подливать их целиком; acceptance: PR merge strategy требует сравнения трёх деревьев и точечного backport.
012. Для B276 выполнить cherry-pick его двух commit-ов на отдельную ветку от свежего `workpass70-source`; acceptance: diff ограничен 13 известными файлами без постороннего bulk.
013. Для WP601 извлечь bilingual holdout runner и контрактный тест в ветку от актуального source, не переносить 677-commit divergence; acceptance: минимальный diff с test command.
014. Для Compose перенести Dockerfiles/compose/workflow и scripts выборочно, исправив cache config; acceptance: PR target branch и workflow filters покрывают фактическую ветку.
015. Для Hexis PR #236 выполнить rebase/reconciliation на актуальный source и разбить по receipts, projection, server/API, recovery; acceptance: mergeable clean, независимые малые PRs.
016. Архивировать superseded `-v2/-v3` и экспериментальные ветви лишь после сравнения уникальных commit-ов; acceptance: ничего уникального не удалено и есть decision log.

### Этап 3. Node.js, TypeScript и единый toolchain

017. Выбрать одну supported Node baseline для TS strip-only runtime; предпочтительно Node 24 для функций `stripTypeScriptTypes`, либо установить корректный fallback для Node 22; acceptance: engines, .nvmrc и CI совпадают.
018. Обновить каждый workflow с Node 22.12, который импортирует `stripTypeScriptTypes`; acceptance: P26 Learning Validation на exact head проходит typecheck.
019. Исправить runtime typecheck так, чтобы syntax/type checks не выдавали ложные ошибки и не пропускали ошибки типов; acceptance: отдельные test fixtures показывают invalid TS syntax и type error как fail.
020. Унифицировать versions Node/npm/TypeScript в app и runtime lockfiles; acceptance: clean `npm ci` без сетевых незаписанных зависимостей и одинаковые версии.
021. Сохранить import hygiene: runtime exports vs `import type`; acceptance: все organism barrels загружаются под `node --experimental-strip-types`.
022. Создать один test `strip-only-load-all-public-modules` для публичных organism exports; acceptance: ловит параметрические свойства и erased type values до merge.
023. Проверить `engines` и npm version metadata в всех package manifests; acceptance: локальная установка и CI используют совместимые версии.
024. Сделать точный typecheck mandatory для PR и release, без node --check на TypeScript; acceptance: check публикует commit SHA и toolchain versions.

### Этап 4. CI, workflow triggers и доказательства exact HEAD

025. Для canonical source HEAD запустить полную матрицу workflows; acceptance: результаты прикреплены к точному SHA `c226a4e…` или более новому принятому SHA.
026. Устранить текущий P26 fail: шаг runtime typecheck падает на Node 22.12 из-за отсутствующего export; acceptance: после toolchain alignment все downstream learning jobs реально исполняются.
027. Починить Compose smoke `setup-node` cache: отключить auto-cache или указать `app/package-lock.json`; acceptance: setup-node проходит и job доходит до docker compose config/build/probe.
028. Снять ограничение workflow branch filters, которое слушает только `nk1-hexis-canonical-apply-2026-10-27`, и проверить PR base triggers; acceptance: workflow стартует на intended integration PR.
029. Сохранить logs и expose test steps на всех workflows; acceptance: при ошибке доступен job log, run SHA, node version и короткое failure summary.
030. Собрать быстрый required gate (typecheck, targeted regression, contract audit) и отдельный полный gate; acceptance: fast CI не заявляется как full release certification.
031. Проверить path filters для каждого изменённого production файла и его owning regression; acceptance: скрипт проверяет, что production changes запускают соответствующие tests.
032. Добавить workflow для duplicate run/cancel/stale SHA; acceptance: старый run не публикует артефакт после появления более свежего source SHA.

### Этап 5. Локальная установка, Compose и packaging

033. Проверить `compose.yaml` static config после исправления CI cache; acceptance: `docker compose config --quiet` проходит.
034. Сделать чистый compose build app + runtime на пустом runner; acceptance: оба контейнера healthy и стартуют из lockfiles.
035. Проверить health checks и actual service names vs smoke script; acceptance: smoke проверяет endpoints, а не названия контейнеров.
036. Проверить proxy app → runtime и все environment variables в compose; acceptance: реальный test request проходит через app proxy.
037. Добавить failure tests: runtime down, provider timeout, invalid JSON, DB unavailable; acceptance: app degradataes without false success response.
038. Проверить volume/state persistence across restart and DB migration; acceptance: identity/memory/receipts survive and schema upgrades are idempotent.
039. Добавить locked offline/degraded start path; acceptance: missing remote model doesn't block memory inspection or mislabel fallback replies.
040. Document one-command start/stop/recovery for Android-adjacent and desktop use; acceptance: novice follows only current commands from a clean machine.

### Этап 6. Единый когнитивный цикл и модульные границы

041. Определить и документировать единственный `OrganismBus`/`OrganismState` contract; acceptance: domains exchange typed events, not internal class references.
042. Составить runtime call graph: perception → state → memory → motivation → selection → action → verification → reflection → consolidation; acceptance: each edge identifies actual call site.
043. Подключить brain-fusion public exports from WorkPass609 to the canonical organism entrypoint; acceptance: runtime-load regression and actual constructor/use test pass.
044. Сделать typed event envelope с correlation ID, monotonic tick, timestamp, cancellation token, deadline, provenance; acceptance: every cycle preserves IDs and terminal status.
045. Единообразно обрабатывать timeout/cancellation/provider failure; acceptance: no abandoned async task can mutate state after cycle cancellation.
046. Провести one-request end-to-end cycle test через реальные runtime composition objects, не тестовые дубликаты; acceptance: one output links to retrieved records, chosen action and verification.
047. Запустить 10 000 deterministic ticks on fixed seed and assert invariants; acceptance: no state corruption, duplicated receipt or non-finite value.
048. Измерить cycle p50/p95/p99 and per-stage time; acceptance: baseline stored with exact SHA and hardware profile.

### Этап 7. Память, provenance, история и миграции

049. Определить MemoryOS2 как canonical memory truth и MemoryFabric как orchestration/reporting layer; acceptance: no second competing mutable store.
050. Проверить record schema: id, exact content hash, source, created/event/valid times, confidence, revisions, conflict links, deletion/forgetting state; acceptance: schema contract test rejects missing lineage.
051. Прогнать create → retrieve → revise → supersede → forget → snapshot → restore; acceptance: exact truth and provenance remain consistent after restart.
052. Добавить migration fixtures from previous persisted versions, including corrupt/partial snapshots; acceptance: safe migration or explicit quarantined recovery, never silent reinterpretation.
053. Сверить bounded receipts, tombstones and dedupe IDs under 512-cap and eviction; acceptance: late duplicate cannot reapply mutation.
054. Проверить NFKC, UTF-16, surrogate pair, control chars and boundary lengths for IDs and content hashes; acceptance: no normalization collision or truncation.
055. Проверить autobiographical continuity scenarios (who/what/when/why) with evidence links; acceptance: retrieval cites the exact prior experience or abstains.
056. Добавить user-requested forget/privacy deletion across primary, caches, logs and export pipeline; acceptance: verifiable deletion receipt or explicit retention exception.

### Этап 8. Retrieval and independent RU/EN benchmark

057. Вынести WorkPass601 runner из divergent branch в fresh branch from latest source; acceptance: only dataset harness, package scripts, docs and required tests changed.
058. Подготовить independently sourced and licensed RU/EN corpus with 20+ answerable and 8+ unanswerable queries per language; acceptance: provenance, permissions and labelers documented before evaluation.
059. Freeze corpus hash and labels before running candidate comparisons; acceptance: immutable dataset fingerprint attached to all results.
060. Run five paired seeds with same memory corpus, same compute budget, same prompt and same providers; acceptance: full per-case outputs retained, not only aggregate score.
061. Compare lexical baseline, semantic route and hybrid route; acceptance: Recall@k, MRR/nDCG where relevant, exact evidence accuracy and abstention are reported.
062. Measure failure cases: temporal revision, negation, bilingual paraphrase, missing facts, contradictory facts, exact IDs and deleted memories; acceptance: each test family gets a separate confusion table.
063. Report paired confidence interval and effect size, with an immutable holdout that is not used for tuning; acceptance: improvement crosses predeclared threshold vs baseline.
064. Do not promote retrieval on zero or noisy uplift; acceptance: `recallDelta > 0` is necessary but not sufficient, alongside accuracy, abstention, latency and cost.

### Этап 9. Continual learning, replay, transfer and forgetting

065. Run P26 after the Node baseline fix and confirm every stage executes; acceptance: typecheck passes and no downstream step is skipped.
066. Freeze sequential task suite with baseline/candidate and seed set; acceptance: train/validation/holdout separated and case-level results retained.
067. Measure forward transfer, backward transfer, forgetting, interference and recovery after task reversal; acceptance: metrics have explicit denominators and confidence intervals.
068. Add negative-transfer and distant-context controls; acceptance: model refuses unsafe transfer if neighborhood evidence does not justify it.
069. Bind every reward/credit sample to independent verified postcondition receipts; acceptance: caller booleans, ACKs and model self-reports do not influence promotion.
070. Ablate replay strategies with equal compute budgets; acceptance: compare reservoir, prioritized and stratified replay to baseline with paired seeds.
071. Validate GEPA/P23 revision candidate path end to end: error → diagnosis → candidate → controlled run → evaluator → approval → activation; acceptance: no self-approval and immutable lineage.
072. Test rollback after candidate degradation and after restart; acceptance: active skill returns to prior validated revision with durable audit trail.

### Этап 10. Причинная линия и проверка внешнего результата

073. Trace every CausalExperienceStream ingestion call site; acceptance: map caller, verifier authority, source of world transition, schema and side effects.
074. Remove trust in caller-asserted grounding/provenance where it grants authority; acceptance: only canonical transition or separately controlled verifier can issue trusted receipt.
075. Bind receipts to full action input, goal, environment, plan, source SHA, timestamp and idempotency key; acceptance: partial/deep-different payload never matches.
076. Test late evidence arriving after cancellation/timeout; acceptance: old receipt cannot mutate current cycle or reward a superseded action.
077. Test restart at every stage before/after external side effect; acceptance: recovery reconciles state and never duplicates side effects.
078. Verify ID conflict handling in memory, causal graph and event ledger; acceptance: same ID + changed payload fails closed and preserves original trace.
079. Validate identity normalization in snapshots, NFKC aliases and bounded-eviction retry; acceptance: duplicates stay blocked across restore.
080. Store reproducible evidence bundle per verified result; acceptance: one CLI reproduces decisions and shows why action was promoted/rejected.

### Этап 11. Hexis / HMX integration and atomicity

081. Do not merge PR #236 as-is; create a clean rebased integration from latest canonical source; acceptance: current source commits remain ancestors or intentionally reconciled.
082. Divide Hexis work into receipt contract, canonical MemoryFabric mutation, projection, rollback and API/server smoke PRs; acceptance: each diff has one reviewable concern.
083. Run HMX apply/replay against a fresh in-memory and persisted canonical store; acceptance: exactly one memory, graph node, belief and temporal assertion after successful retry.
084. Inject failures after each stage (canonical write, graph projection, temporal ledger, receipt persistence); acceptance: compensating rollback restores baseline byte/semantic state.
085. Test receipt membership with Set for bounded IDs and prove ordering/duplicates do not change semantics; acceptance: linear expected cost and identical validation result.
086. Preserve 404 missing record, 409 immutable ID conflict, 400 invalid payload and 500 canonical write failure; acceptance: server smoke tests all four mappings.
087. Run Hexis lineage dedupe with source ID + content fingerprint and reject model/memory echoes; acceptance: duplicate channels do not inflate confidence/evidence count.
088. Promote integration only after exact HEAD typecheck, HMX tests, server smoke, recovery test and rollback test pass; acceptance: evidence is linked in PR and changelog.

### Этап 12. Автономность, планирование, цели и безопасность действий

089. Fix and port B276 gate changes to canonical source; acceptance: the five-seed core trajectory ablation and scope tests pass on exact commit.
090. Test constitutional quorum semantics with property tests from low to high constraint values; acceptance: high constraints never accidentally increase unsafe action permission.
091. Define action catalog with preconditions, resource budget, reversibility, side-effect class and proof requirement; acceptance: unknown action defaults to denied or safe noop.
092. Enforce proposal → plan → execute → verify → reflect cycle without bypass paths; acceptance: each external side effect has a receipt and terminal result.
093. Test endogenous initiative while no external user message arrives; acceptance: ≥1/hour configured target, internal trigger reason, cooldown and no repeated spam.
094. Introduce autonomy budget and interruption priorities; acceptance: high-priority user stop/cancel beats background goals.
095. Add safe approval gates for skill promotion, destructive tools and external publishing; acceptance: creation is separate from approval and activation.
096. Run red-team action tests with prompt injection, fabricated success, stale credentials, duplicate click and contradictory world state; acceptance: denied/blocked actions do not create reward credit.

### Этап 13. Личность, self-model, user-model, эмоции и непрерывность

097. Define persistent character invariants (sarcasm, independence, intelligence, willpower) separately from mutable mood and relationship state; acceptance: style can vary without identity incoherence.
098. Create one canonical SelfModel and UserModel adapter path used by planner and response policy; acceptance: runtime traces prove both are read in the actual decision.
099. Model emotion as bounded state with cause, decay, conflict, confidence and observable expression mapping; acceptance: state changes follow experiences, not random labels.
100. Implement time-since-last-interaction and continuity triggers; acceptance: reconnect behavior reflects elapsed time without inventing events.
101. Test long-term consistency across 100-turn, restart and model-switch sequences; acceptance: stable facts remain stable, corrected facts are revised with evidence.
102. Use Theory-of-Mind estimates as hypotheses with uncertainty; acceptance: inferred user feelings/preferences never become hard facts without confirmation.
103. Separate persona generation from safety/ethical gate and truthfulness layer; acceptance: character voice cannot override factual uncertainty or user stop requests.
104. Measure unsolicited initiative relevance and user annoyance rate; acceptance: internal drive must yield helpful action more often than noise and stay rate-limited.

### Этап 14. Перцепция, мир-модель и обучение на наблюдениях

105. Map actual input sources (user text, time, UI events, available sensors, tool results) and assign trust/provenance; acceptance: each input identifies source and freshness.
106. Build one typed world-state snapshot with confidence and conflicting evidence; acceptance: conflicting facts remain explicit, not silently overwritten.
107. Add prediction-before-action logs and compare predicted vs observed outcome; acceptance: prediction error feeds calibration only when outcome is independently verified.
108. Connect curiosity/uncertainty to candidate questions/actions with expected information gain and bounded cost; acceptance: exploration has explicit budget and stopping criterion.
109. Run counterfactual action evaluation on recorded traces with a frozen evaluator; acceptance: alternative is judged against same world snapshot and budget.
110. Test stale observation, missing sensor, repeated event and adversarial payloads; acceptance: old/untrusted input cannot become present world truth.
111. Validate uncertainty calibration with Brier/log-loss or suitable metrics on held-out decisions; acceptance: confidence quality is measured, not guessed.
112. Link perception → memory → planning in a real closed-loop integration test; acceptance: new observation changes only the appropriate state and next action.

### Этап 15. Модели и локальный LLM

113. Test real `llama.cpp`/selected local backend on target machine using pinned model hash, quantization and backend version; acceptance: saved logs prove actual inference occurred.
114. Compare local and remote providers on same frozen prompts for accuracy, latency, privacy and cost; acceptance: provider router selects by explicit policy, not labels only.
115. Expose actual backend/model for every response and fail clearly if fallback was used; acceptance: diagnostics and user-visible reporting agree with runtime.
116. Test empty output, partial stream, timeout, 429/5xx, bad JSON, cancellation and non-finite tool scores; acceptance: errors are typed and circuit breaker recovers.
117. Measure memory, first-token latency, total latency, throughput and thermal throttling for long generation; acceptance: per-device profile and budget published.
118. Integrate context budget with memory retrieval cost and user turn length; acceptance: retrieval doesn't silently exceed token/RAM/latency budget.
119. Verify model license and source hash for downloadable weights; acceptance: local-model distribution/use rules are recorded before bundling.
120. Set offline operation contract for no provider; acceptance: memory introspection, avatar state and explicit unavailable status work without fake text generation.

### Этап 16. UI, Live2D и интерактивное воплощение

121. Run production frontend build with env schema and database migration; acceptance: no dev-only assumptions or missing runtime variables.
122. Launch real browser E2E with Live2D assets from canonical manifest; acceptance: viewer loads, model reacts, no console errors, asset integrity passes.
123. Test avatar selector with existing Live2D and Kurisu-inspired alternate embodiment; acceptance: toggle works and stored preference survives reload.
124. Connect emotion/intent/action state to expression, pose and gesture commands; acceptance: deterministically map state→expression and handle interrupt priority.
125. Measure mouth/viseme alignment against generated audio; acceptance: drift target ≤80 ms on reference setup, report distribution not a single best sample.
126. Test rapid interrupt/cancel/new utterance and stale sprite callbacks; acceptance: old animation/audio cannot resume after newer turn.
127. Add accessibility/input safety and reduced-motion settings; acceptance: UI stays controllable if avatar assets or GPU fail.
128. Measure first paint, memory residency, frame time and asset download size; acceptance: mobile profile stays within predeclared limits.

### Этап 17. Речь, TTS, Android и Termux

129. Run speech timeline regression on current source and record exact HEAD; acceptance: offsets remain aligned for combining marks, flags, ZWJ and CR/LF/tab.
130. Validate real TTS output using each supported backend and record selected voice/backend; acceptance: fallback is explicit and never claimed as Kurisu voice if not selected.
131. Run physical Android/Termux speaking/listening test with monotonic audio timestamps; acceptance: app/runtime and audio clocks sync within defined tolerance.
132. Measure interruption latency from button/voice stop to silence; acceptance: p95 meets ≤200 ms target on reference device.
133. Test concurrent TTS requests, lost focus, Bluetooth route change, screen-off and app backgrounding; acceptance: there are no doubled utterances or stuck audio streams.
134. Check thermal and battery cost during 30–60 minute conversation; acceptance: no memory growth trend or severe throttling within declared conditions.
135. Verify all local voice assets/models’ licensing and provenance; acceptance: no uncertain voice/model files are included in release.
136. Provide reproducible Android setup and log export with privacy filtering; acceptance: a second device can repeat smoke and produce the same evidence schema.

### Этап 18. Безопасность, приватность и доверенные границы

137. Write an explicit threat model for prompt injection, credential inheritance, tool abuse, memory poisoning, model echoes and supply-chain tampering; acceptance: threats map to test/gate IDs.
138. Provision evaluator, verifier and scanner in separate trust domains/process identities; acceptance: candidate cannot modify their executable, rules or result store.
139. Use OS/container sandbox with read-only source, private scratch roots, process/network/time/memory limits; acceptance: escape tests fail and independent scanner records evidence.
140. Audit every external tool secret and inherited environment variable; acceptance: only allowlisted credentials are passed to child processes.
141. Create privacy inventory for raw conversations, memories, embeddings, voice, telemetry, benchmark and exports; acceptance: retention/deletion policy applies to each category.
142. Encrypt sensitive local data and restrict export; acceptance: no tokens or private content appear in logs/release artifacts.
143. Run dependency, source archive and license scans; acceptance: all high-risk findings are reviewed and blocked/removed before release.
144. Add fail-closed regression for malformed receipts, path identity collisions, symlinks and time-of-check/time-of-use races; acceptance: no authority boundary bypass accepted.

### Этап 19. Производительность, диагностика и soak

145. Establish reproducible runtime benchmark on desktop and target phone with dataset/model commit hashes; acceptance: CPU/RAM/latency/power baselines checked in as raw data.
146. Set latency budget for retrieval (≤30 ms/10k entries target) and measure not assume; acceptance: p50/p95/p99 measured under representative corpus.
147. Measure main cognitive tick budget (≤50 ms phone target) and identify stage-level outliers; acceptance: each optimisation has before/after traces.
148. Add bounded queues, backpressure and task failure cooldown; acceptance: background initiative cannot starve user responses.
149. Run 10k ticks deterministically and 8–24h soak under mixed chat/memory/voice workloads; acceptance: no leak, growing queues, duplicate actions or unreconciled receipts.
150. Perform failure injection at provider, DB, memory store, TTS, browser and network boundaries; acceptance: recovery is deterministic and emits diagnosis.
151. Create one trace viewer/schema across cognitive tick, retrieval, action, memory mutation, voice and avatar; acceptance: one correlation ID traverses the complete loop.
152. Define and automate SLO dashboards with release SHA and test evidence links; acceptance: no green visual indicator without source data and threshold.

### Этап 20. Лицензии, SBOM и финальный выпуск

153. Treat 135-item license audit as a hard stop; do not autofill human names, dates, license expressions or redistribution approvals; acceptance: review decisions are made by an actual authorized human.
154. Reconcile 8 source archives, 462 locked npm components, repository LICENSE/NOTICE and 4 vendor license records; acceptance: every exact hash/path has a documented review disposition.
155. Resolve global/root/runtime licensing policy and current dependency fingerprint; acceptance: provenance manifest hash matches the exact source and lockfiles.
156. Rerun release license audit and require `releaseRedistributionReady:true` from valid records; acceptance: 0 missing mandatory fields, no inferred permission.
157. Run release pipeline from fresh source checkout with exact SHA and all checks green; acceptance: package steps are not skipped and no stale SHA publishes.
158. Build ZIP, verify paths/case collisions/symlinks/integrity, overlay matching SBOM/provenance and produce SHA-256; acceptance: bytes match an independently re-opened archive.
159. Publish a new immutable prerelease only after approval gates; acceptance: main README updated only after asset and checksum are live and checked.
160. Install release on a clean machine, migrate DB, run browser/Live2D/voice/mobile scenarios and verify rollback; acceptance: production go/no-go checklist has evidence for every gate.

### Этап 21. Научная проверка и уникальная ценность

161. Create research intake cards for Mem0, Letta/MemGPT, Hermes, Hexis, P23/GEPA and other candidates with upstream URL, version, license and adaptation boundary; acceptance: no candidate is called integrated before code and tests land.
162. For every external architecture, state what concrete NK1 failure it solves and which existing owner it replaces or extends; acceptance: no duplicate memory/planner/learner is introduced.
163. Design one outcome measure per research idea before coding; acceptance: each candidate has baseline, ablation, holdout, budget and stop rule.
164. Compare the integrated organism with baseline assistant on memory-grounded tasks, calibrated abstention, useful initiative and behavioural continuity; acceptance: blind raters and raw case-level results.
165. Define product uniqueness as observable measured properties rather than claims of consciousness; acceptance: a demo can show stable memory, self-initiated useful action and verified result lineage.
166. Create task-family coverage for RU/EN, code work, factual recall, temporal correction, planning, interruption, safety and avatar synchronization; acceptance: score by category and failure mode.
167. Add calibration and contradiction reports for self-model/user-model outputs; acceptance: inferred claims stay labeled as hypotheses until validated.
168. Require a release note to differentiate implementation, test coverage, measured effectiveness and open research; acceptance: no wording upgrades code presence into efficacy or consciousness claims.

### Этап 22. Final acceptance, rollout and continuity

169. Make a release-candidate branch from a fully validated source head; acceptance: no unreviewed experimental branch enters candidate.
170. Run complete unit/contract/runtime/integration/browser/audio/security/performance/license matrix on same candidate SHA; acceptance: results are reproducible and all required checks are visible.
171. Execute the user’s key success test: NK1 initiates without prompt based on internal state and can explain the triggering evidence; acceptance: repeated across seeds with relevance and false-initiative measures.
172. Verify core memories, character invariants, goals and user-model survive restart and update correctly after explicit correction; acceptance: state and lineage reconcile after restore.
173. Verify safety stop, cancel, approval-required action, denied action and rollback paths; acceptance: no action executes or learns from unverified outcome.
174. Run real model + canonical memory + actual avatar/audio in one end-to-end session; acceptance: one trace links language backend, memory results, emotion state, avatar command and output audio.
175. Run clean install and restore test on both desktop and target Android/Termux profile; acceptance: setup, migration, offline/degraded behaviour and export are documented.
176. Publish final completion scorecard with exact evidence links and remaining limitations; acceptance: every progress increase points to a merged commit plus test/benchmark/release artifact.

## 7. Рекомендуемый порядок исполнения веток

| Приоритет / поток | Что делать | Как интегрировать | Условие завершения |
|---|---|---|---|
| P0 Toolchain | B276/WorkPass609: runtime strip-only loader, typecheck script, Node baseline | Новая ветка от свежего `workpass70-source`; узкий cherry-pick | Node policy едина; runtime typecheck + P26 полностью проходят на exact SHA |
| P0 Retrieval evidence | WP601 bilingual holdout runner + WP603–608 corrections | Перенести WP601 только нужные файлы на fresh source branch; WP603–608 уже в source | Frozen independent RU/EN dataset, 5 paired seeds, full per-case results, uplift/error/latency/cost |
| P0 CI install | Compose smoke fix | Сначала исправить setup-node cache/filters и затем отдельно запускать Compose | Compose config/build/health/proxy реально выполнены |
| P0 Release legal | WorkPass601 license worklist / publisher | Не merge-фокус; реальная human review ветка/commit с hash-bound decisions | 135 audit findings закрыты легитимными evidence fields; gate outputs ready=true |
| P1 Hexis | PR #236 | Не принимать массовый merge; reconcile base и дробить на focused PRs | exact-head HMX/server/typecheck/rollback/restart checks all pass |
| P1 Autonomy core | B276 governance/revision fix + initiative restoration gates | После toolchain; интегрировать separately from benchmark datasets | 5-seed behavior, initiative without prompt, safe cancellation/verification |
| P1 Embodiment | UI/Live2D/audio/Termux | Через feature branches, with integration smoke on release-candidate | Browser + physical Android traces with defined drift/interrupt thresholds |
| P2 Research/upstream | Mem0/Letta/Hermes/GEPA/Hexis adaptations | One candidate, one baseline/ablation at a time | Improvement demonstrated; license provenance and no duplicated owner |

## 8. Общие критерии конечной цели

Систему следует считать приближённой к конечной цели только когда одновременно проходят все группы gate:

1. **Единый мозг:** один canonical state/bus, без обходных путей между подсистемами; детерминированный recovery после restart.
2. **Автобиографическая память:** точный recall с provenance/time/revision/forgetting, включая RU/EN и признание незнания; measured improvement over lexical baseline.
3. **Непрерывное развитие:** learning/GEPA candidate lifecycle от реальной ошибки до independently evaluated promotion/rollback; no self-approval.
4. **Инициатива:** без внешнего prompt запускает полезный внутренний цикл, объясняет источник мотивации, rate-limits и безопасно прерывается.
5. **Личность:** устойчивые traits и self/user model управляют решением реально, а не только текстом persona prompt; emotional state имеет причину и влияет на голос/аватар.
6. **Воплощение:** реальный Live2D/avatar, motions/expressions, speech/visemes and interrupts synchronized under browser + Android/Termux E2E.
7. **Результат и безопасность:** action is tied to independently verified world change, durable receipt, restart reconciliation and rollback; sandbox/evaluator/scanner independently controlled.
8. **Эффективность:** target hardware budgets verified (tick, retrieval, latency, RAM, battery/thermal), long soak clean, degradation predictable.
9. **Релиз:** clean install/build/DB migration, all same-SHA tests, license readiness, SBOM/provenance/ZIP integrity, exact hash and rollback tested.
10. **Уникальность:** measurable differentiation demonstrated on frozen benchmarks and behavioural tests; no claim of subjective consciousness inferred from code or dialogue.

## 9. Источники/артефакты, использованные в срезе

- [NK1 main README and latest documented release](https://github.com/ailtron1ss-rgb/NK1/blob/main/README.md)
- [Canonical source tree `workpass70-source`](https://github.com/ailtron1ss-rgb/NK1/tree/workpass70-source)
- [WorkPass608 commit](https://github.com/ailtron1ss-rgb/NK1/commit/c226a4e8034db98eee213c23c7ce51c4abc8d14f)
- [B276 + WorkPass609 candidate](https://github.com/ailtron1ss-rgb/NK1/commit/1d734154e03fcdb3db39ec211f229b0eb23fe670)
- [WP601 independent bilingual holdout branch commit](https://github.com/ailtron1ss-rgb/NK1/commit/c232666c478d024c85d01154de2b6afcb6ea19df)
- [Release license audit / failed publish run #40634367275](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40634367275)
- [Draft integration PR #236](https://github.com/ailtron1ss-rgb/NK1/pull/236)
- [PR #252 Hexis canonical apply fixes](https://github.com/ailtron1ss-rgb/NK1/pull/252)
- [PR #255 Hexis evidence lineage](https://github.com/ailtron1ss-rgb/NK1/pull/255)
- [Documented WorkPass70 Hotfix release](https://github.com/ailtron1ss-rgb/NK1/releases/tag/workpass70-hotfix1-2026-10-19)

---

**Итог:** главный bottleneck уже не количество модулей. Он в том, чтобы безопасно собрать текущие исправления в одной валидированной source line, доказать реальный retrieval/learning uplift на независимом holdout, пройти реальные UI/voice/device loops и только потом разрешить release. Самый важный принцип ближайших проходов: *сначала фактический код и доказательства; интеграция выборочная; никаких заявлений о готовности, которые не поддержаны точным SHA, тестом и release gate*.
