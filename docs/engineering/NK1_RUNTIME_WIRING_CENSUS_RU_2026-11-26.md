# NK1 / NeuroCore — перепись подключений runtime и гейт самоизменения P53

Дата: 26 ноября 2026 года
База: `workpass70-source @ 9008a89` (`feat(self-development): verify authorship through decision-bound receipts`)
Метки доказательств: `IMPLEMENTED` — код есть и исполняется в тесте; `OBSERVED` — измерено в указанном прогоне; `UNRESOLVED` — не проверено.

## 1. Зачем эта работа

Требование «всё подключить между собой» без измерения превращается в утверждения. Здесь добавлены два механизма, которые не позволяют заявлять о подключении без доказательства:

1. `scripts/audit-runtime-wiring.mjs` — перепись модулей: какие канонические модули `src/organism/**` реально достижимы из точки входа runtime по цепочке относительных импортов.
2. Гейт P53 — promotion самоизменения теперь невозможен без независимого sealed-holdout, а повторный прогон тех же входов не считается свидетельством.

## 2. Перепись подключений (`OBSERVED`)

Прогон: `node scripts/audit-runtime-wiring.mjs` в `runtime/neuro-kurisu`.

| Метрика | Значение |
|---|---|
| Точек входа | 4 (`OrganismCore.ts`, `OrganismSystemFabric.ts`, `organism/index.ts`, `server/server.mjs`) |
| Всего файлов источника под `src/` | 760 (включая `.mjs`) |
| Канонических модулей | 700 |
| Достижимых | 635 |
| Недостижимых (orphans) | 65 |
| Доля подключения | 0,9071 |

Перепись следует только относительным импортам проекта. Разбор импортов разделительный, без регулярок: первая версия использовала regex-литералы, и ошибка экранирования тихо обнуляла сканирование. Это значит:

- модуль, импортируемый лишь тестом, в runtime **не** подключён — тест не является точкой входа;
- модуль, который host подключает снаружи (например `OrganismAspectFabric` через `OrganismRuntime.attachAspectFabric`), тоже попадает в orphans: контракт attach — это host-side подключение, а не runtime-импорт;
- dynamic `import('...')` с литеральным путём учитывается, шаблонные и вычисляемые пути — нет.

Семь модулей, которые regex-версия ошибочно считала недостижимыми, теперь видны как подключённые: `NekoAudioFrameBuffer.ts`, `NekoVoiceTurnCoordinator.ts`, `CycleCompletenessPolicy.ts` и четыре `OmeStro*.ts`. Это исправление измерения, а не новое подключение; в baseline их уже нет.

### 2.1 Семьи неподключённых модулей (важнейшее)

| Семья | Примеры | Что это значит |
|---|---|---|
| Проверяемое продвижение свидетельств | `VerifiedOutcomePromotionGate.ts`, `VerifiedOutcomeLedgerStore.ts`, `VerifiedOutcomeLedgerFileStore.ts`, `VerifiedReplayAdmission.ts` | Гейт продвижения по проверенным исходам существует как класс, но в runtime-путь не включён. Ни один цикл OrganismCore его не создаёт и не вызывает. Это главный незакрытый контракт «кандидат → проверка → продвижение». |
| Host-evaluator P36 | `P36HostEvaluatorBootstrap.ts`, `P36VerifiedOutcomeLedgerEvaluator.ts` | Загрузчик подписанных независимых свидетельств готов, но runtime его не вызывает: нужен host-конфиг (публичные ключи верификаторов, манифест, каталог артефактов) и явная точка boot. |
| Teacher/student дистилляция | `TeacherStudentDistillation.ts`, `TeacherStudentDistillationGate.ts`, `TeacherStudentDistillationGateFileStore.ts`, `TeacherStudentDistillationTrainer.ts` | Кандидатный контур дистилляции изолирован; разрешения на его подключение к живому обучению нет. |
| Continual/drift обучение | `ContinualOutcomeMatrix.ts`, `ContinualReplayBuffer.ts`, `PageHinkleyDriftDetector.ts`, `AdaptiveWindowDriftDetector.ts`, `DriftAwareLearningController.ts`, `PrioritizedReplaySampler.ts`, `ReservoirReplayPolicy.ts` | Метрики continual-обучения и политики replay измеримы, но обучающий цикл Core их не потребляет; часть используется только тестами. |
| Neko plugin runtime | `NekoPluginGatewayRuntime.ts`, `NekoPluginEventBridge.ts`, `PluginMessageIngress.ts`, `PluginGatewayAdapter.ts` | Runtime плагинов Neko подключается host-слоем, а не Core; требует отдельного решения о точке входа, а не молчаливого импорта. |
| Aspect fabric | `OrganismAspectFabric.ts`, `AspectIntegrationGraph.ts` | Композиция «один организм → 7 систем → 75 аспектов» подключается host-методом `OrganismRuntime.attachAspectFabric`; это осознанный attach-контракт. |
| Прочие | `CodeAssimilation*.ts`, `Skeletal*3D.ts`, `neuroforge/*`, `BrainWideCausalBattery.ts`, `ScientificQuestionBank.ts`, `PerturbationalProbe.ts` | Изолированные исследовательские/инструментальные модули. Каждый требует отдельного решения: подключить или архивировать с манифестом. |

Список целиком зафиксирован в `runtime/neuro-kurisu/scripts/runtime-wiring-baseline.json`.

### 2.2 Как это теперь проверяется

```bash
cd runtime/neuro-kurisu
node scripts/audit-runtime-wiring.mjs                                         # перепись и список orphans
node scripts/audit-runtime-wiring.mjs --strict --baseline scripts/runtime-wiring-baseline.json   # падает только на НОВЫХ orphans
node --experimental-strip-types tests/runtime-wiring-census.mjs              # регрессия контракта переписи
```

Эти команды пока не добавлены в `package.json`: подключение npm-скриптов лучше делать отдельным коммитом вместе с CI-workflow, чтобы не менять десятки существующих audit-цепочек в одном PR.

Baseline — это потолок: он может уменьшаться, но не расти. Любой новый канонический модуль, который никто не импортирует из runtime, роняет strict-прогон с перечислением путей. Так «подключение» становится проверяемым состоянием, а не формулировкой в отчёте.

## 3. Гейт самоизменения P53 (`IMPLEMENTED`, `OBSERVED`)

`P53DevelopmentalSelfModificationLab` действительно вызывается из `OrganismCore` (`periodic()` в исследовательском плане цикла, `p53Promote()` как host-API). Карта саморазвития от 24 ноября фиксировала дефект: `test()` вычислял holdout из тех же входов, что и shadow (`holdoutFactor01` по умолчанию 0.72), а `periodic()` мог продвинуть кандидата после накопления счётчика свидетельств. То есть promotion мог опираться на повторение одного и того же замера.

Изменённый контракт:

1. `test(id, input, holdout?)` принимает `holdout: { observed01, fingerprint, independent }`. Продвижение возможно только если `independent === true`, `observed01` конечно, а `fingerprint` непуст и **не совпадает** с отпечатком shadow-прогона.
2. Без такого holdout `holdout01 = 0`, `holdoutVerified = false`, кандидат остаётся `testing` — fail-closed.
3. Повторный прогон с тем же отпечатком не увеличивает `evidenceCount` (хранится до 8 отпечатков); повторение больше не является свидетельством.
4. `periodic()` самостоятельно не продвигает кандидатов: автономное продвижение требует явного `allowAutonomousPromotion: true` от host и проверенного holdout.
5. `promote()` отказывает, если `holdoutVerified !== true`.
6. `restore()` нормализует старые снапшоты: кандидат без `holdoutVerified` считается непроверенным, поэтому старый `promotable` не может быть продвинут после восстановления.

Регрессии:

- `tests/p53-independent-holdout-gate.mjs` — отсутствие holdout, повтор одного входа, поддельный holdout, честный holdout, восстановление legacy-снапшота, `periodic()` без автономного продвижения;
- `tests/p53-developmental-self-modification.mjs` обновлён под новый контракт (shadow-only больше не даёт `promotable`).

Прогон: оба теста PASS, `node scripts/typecheck-runtime.mjs` (`TYPECHECK=PASS mode=tsc`) PASS, `node scripts/audit-architecture.mjs` (`CLEAN_ARCHITECTURE=PASS`) и `node scripts/audit-core-ownership.mjs` (`CORE_OWNERSHIP=PASS`) без изменений, `node scripts/audit-source-hygiene.mjs` — 5 pre-existing замечаний в чужих docs (не из этого изменения).

## 4. Что этим НЕ доказано

- Promotion-путь «кандидат → независимый holdout → подписанный admission → применение → postcondition → rollback» по-прежнему не собран в один прослеживаемый цикл: `VerifiedOutcomePromotionGate` остаётся неподключённым (см. 2.1).
- P53 не имеет источника настоящего независимого holdout: теперь он честно fail-closed, но чтобы продвижение заработало, host должен поставлять sealed-артефакт (например через `P36HostEvaluatorBootstrap` + `VerifiedOutcomeLedger`).
- Перепись не является графом вызовов методов: она доказывает достижимость модуля, а не то, что все его публичные методы используются.
- Никакие заявления о recall uplift, автономной инициативе, производительности на устройстве или готовности релиза не делаются: для них нет независимых измерений в этом прогоне.

## 5. Следующие шаги (по возрастанию риска)

1. Подключить `VerifiedOutcomePromotionGate` к одному реальному пути продвижения (P23/P36) с host-owned ключами и регрессией на отказ при отсутствии подписи.
2. Дать P53 источник sealed holdout через тот же ledger; тогда `periodic()` сможет продвигаться только по настоящим свидетельствам.
3. Разобрать семью continual/drift: либо подключить метрики к обучающему циклу, либо архивировать модули с манифестом (`docs/REPOSITORY_CLEANUP_AUDIT_WORKPASS72.md` — прецедент обратимого архива).
4. Для каждой изолированной исследовательской семьи (`neuroforge`, `CodeAssimilation`, `ScientificQuestionBank`, `PerturbationalProbe`) принять явное решение: точка входа или архив.
