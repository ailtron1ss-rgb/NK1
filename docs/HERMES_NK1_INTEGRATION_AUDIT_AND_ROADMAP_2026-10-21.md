# Addendum WorkPass330 — production host evaluator wiring (2026-10-23)

WorkPass330 fixes a concrete runtime composition gap found while tracing the real P23 path. The server previously supplied the revision provider and candidate store but omitted the independent-evaluation factory that `OrganismRuntime` requires in production. Production mode still fails closed when no separate host evaluator config is set; the guard was not weakened.

The new `NEURO_COMPOUND_REPAIR_EVALUATION_CONFIG_MODULE` loads a distinct host-owned config whose `createIndependentEvaluationHostConfig({ stateDirectory })` returns three separate host-owned commands, a task builder, environment fingerprint and production experiment authority. It is prepared by the existing host-owned services factory, then connected to the already-canonical P23 revision coordinator. The config is not given engine/store/registry capabilities.

An optional `NEURO_COMPOUND_REPAIR_BACKGROUND_REVISION_JSON` enables the existing resource-aware scheduler. The scheduler only creates staged candidates from verified non-holdout repair evidence and does not bypass independent evaluation, signed shadow evidence or authenticated approval.

The 11-case wiring contract test is committed and included in root quick audit and WorkPass71 CI. The host evaluator module is now required to be a regular file outside mutable state, not group/world-writable on POSIX, and distinct from the repair provider. Exact-head execution remains unverified because hosted jobs still stop before executing steps. This does **not** complete the deployment-specific host authority setup or establish measurable learning uplift. See [WorkPass330 report](WORKPASS330_PRODUCTION_REVISION_WIRING_2026-10-23.md).

---

# Addendum WorkPass329 — multi-dimensional holdout guard (2026-10-23)

This addendum supersedes neither the examined HEAD nor the production-path findings below; it records a later, narrow code change in the canonical P23 learning path.

## Implemented from Hermes Agent Self-Evolution

- **Pinned upstream reference:** [`0a929e3aa20e15cf04dc7c28492a7d41a5139125`](https://github.com/NousResearch/hermes-agent-self-evolution/commit/0a929e3aa20e15cf04dc7c28492a7d41a5139125). Relevant files inspected: `evolution/skills/evolve_skill.py`, `evolution/core/fitness.py`, `evolution/core/constraints.py`, and `pyproject.toml`.
- **Adapted mechanism:** multi-dimensional quality and explicit constraints instead of relying solely on the donor's 50/30/20 composite. NK1's existing `SkillLearnBenchAdapter` now independently gates normalized holdout declines for task success, trajectory quality and skill quality (default tolerance 0.02 per axis).
- **Failure mode addressed:** a candidate could have an improved aggregate score while execution trajectory quality fell materially. The new behavioral regression explicitly creates this trade-off and requires rejection even when the aggregate decline threshold is permissive.
- **Lifecycle boundary:** no new learner, second evaluation service or parallel store; existing matched evaluation, hard safety gate, P23 candidate storage, signed shadow evidence and authenticated approval are still required. This gate does not autonomously activate candidates.
- **Wiring:** focused regression added to root `audit:quick` and WorkPass71 core CI. The upstream donor is recorded in the registry/map as a **native adaptation**, not a vendored runtime dependency.
- **License/dependencies:** upstream README and project metadata declare MIT; a standalone `LICENSE` file was not retrievable at the pinned path, so the review is partial. No upstream file was copied and no dependency was added.
- **Validation:** the test and runtime typecheck are not yet confirmed on the exact new head. Current hosted Actions runs terminate before runner assignment (`runner_id=0`, zero steps/logs), so neither PASS nor code failure is inferred.

Implementation/evidence report: [WorkPass329](WORKPASS329_HERMES_MULTIAXIS_HOLDOUT_GATE_2026-10-23.md). Preserve the prior critical finding below: production provider bootstrap and the full real execution → independent evaluation → signed evidence → approval path remain the larger open integration objective.

---

# Hermes → NK1: полный аудит интеграции и план дальнейшей работы

**Дата аудита:** 2026-10-21  
**Репозиторий:** ailtron1ss-rgb/NK1  
**Актуальный examined HEAD:** 75d1825e209f78c8633137c7aa7f43867f5dbee1  
**Рабочая цепочка:** PR #21–#45, текущий хвост — PR #45 / WorkPass172–183  
**Документ:** живой план реализации; он не означает, что незавершённые пункты уже реализованы или что PR слит.

## 1. Резюме

Главный вывод: NK1 уже содержит крупную нативную TypeScript-инфраструктуру памяти, планирования, действий, обучения, реестра навыков, проверки исходов и управляемого продвижения кандидатов. Наиболее полезно адаптировать к ней механизмы Hermes, а не переносить Hermes как вторую параллельную агентную архитектуру.

Сильная сторона текущей Hermes-цепочки — формирование ревизий навыков на основе ошибок с сохранением границы доверия: план исправлений и генератор создают только кандидата; подтверждённый исход, подписанное evidence, shadow-run и авторизованное продвижение должны оставаться отдельными этапами.

Критический незакрытый участок — переход от набора адаптеров к штатному производственному пути. WorkPass183 добавил локальную модель как реальный генератор JSON-полезной нагрузки, но приложение по-прежнему должно явно включить модуль NEURO_COMPOUND_REPAIR_REVISION_PROVIDER_MODULE. Этот модуль обязан самостоятельно подготовить подлинное предложение P23, запустить независимые оценки исходного и нового кандидатов и вернуть проверяемые данные в канонический жизненный цикл. Поэтому статус цикла — **частично соединён; полностью автономный и измеримо улучшающийся контур пока не подтверждён**.

Не следует наращивать ещё десятки самостоятельных движков, пока не закрыта эта граница. В первую очередь нужно сделать один первый-классный путь «реальное наблюдение → объяснение → план ревизии → генератор → реальное выполнение кандидата → независимые baseline/candidate оценки → подписанное shadow-evidence → авторизованное решение», подключённый к существующему реестру и доступный через действующую поверхность приложения.

## 2. Фактическое состояние GitHub — не смешивать ветки

1. README ветки main описывает её как хранилище release-процессов, отчётов и архивов. В README полная исходная база вынесена в workpass70-source. Поэтому чтение только main не является чтением рабочего дерева приложения.
2. На examined PR HEAD дерево содержит 10 346 элементов. Это количество узлов дерева Git на конкретной ревизии, а не число исходных файлов и не утверждение, что все элементы нужны в production.
3. PR #45 открыт как draft и основан на ветке workpass171-hermes-repair-evidence-p23-bridge. Последний проверенный HEAD — 75d1825e209f78c8633137c7aa7f43867f5dbee1; в метаданных PR указано 11 изменённых файлов, +499/-8. Никакого merge не выполнялось.
4. Связанные PR #21–#45 нужно считать цепочкой предлагаемого кода, а не функциями, уже установленными на main. Для проверки каждой функции необходимо проверять соответствующую ветку/коммит и конкретный call path.
5. На HEAD 75d1825e209f78c8633137c7aa7f43867f5dbee1 следующие workflow завершились failure: WorkPass105 verified outcome ledger, WorkPass108 paired evidence identity and verified promotion gate и WorkPass110 continual learning metrics. У заданий не предоставлены выполненные шаги/логи, поэтому точная причина не установлена. Это блокирует заявление о зелёном CI, но само по себе не доказывает дефект новых строк кода.

## 3. Что уже найдено в NK1

### 3.1 Путь навыков и обучение

В рабочем дереве присутствуют:

- P23LearningEngine.ts — центральный движок обучения и verified-skill lifecycle.
- SkillLearnBenchAdapter.ts — раздельная оценка независимо проверенного успеха задания, качества самого навыка и траектории действий; текущие веса 50/30/20 остаются эвристикой проекта, а не универсально доказанными коэффициентами.
- SkillRevisionPlan.ts — формирование адресных целей исправления из validation-отчётов и сигналов обобщения.
- HermesVerifiedEvidenceBinding.ts — связывание отчётов оценки с verified shadow evidence.
- VerifiedSkillPromotion.ts, VersionedSkillCandidateStore.ts, VerifiedSkillLifecycleBootstrap.ts и AuthenticatedSkillPromotionApproval.ts — предложения о продвижении, версии кандидатов, долговременное хранилище и отделённое одобрение.
- VerifiedOutcomeArtifact.ts, VerifiedOutcomeLedger.ts, VerifiedOutcomeLedgerFileStore.ts и VerifiedOutcomePromotionGate.ts — артефакты проверенного исхода, журнал и gate продвижения.
- TrustedSkillShadowRunRegistry.ts и P23TrustedShadowLearningScheduler.ts — контекст shadow-запуска, реестр и путь планирования.
- ProceduralSkillLibrary.ts — процедурные навыки, составные навыки, варианты и записи исправлений.
- SkillRetrievalAugmentation.ts — небольшой evidence-ranked набор навыков и ограниченное влияние извлечённых навыков на действие.
- ReplaySelectionPolicy.ts, ReservoirReplayPolicy.ts, ContinualLearningMetrics.ts, ContinualOutcomeMatrix.ts и LearningExperimentPlan.ts — инфраструктура повторного опыта и измерения непрерывного обучения.

Наличие этих файлов означает, что не нужно строить второй SkillStore или второй P23 gate. Но само наличие файлов не доказывает, что все production callers проходят через один canonical path.

### 3.2 Исполнение, агентность и проверка результата

В дереве присутствуют OrganismRuntime.ts, OrganismCore.ts, ActionGateway.ts, CognitiveExecutionPlanner.ts, PlanEngine.ts, ExternalPostconditionVerifier.ts, RealityEvidenceLedger.ts, RealityShadowBridge.ts, EmbodiedRecoveryController.ts и RiskAwareRecoveryController.ts. Они дают подходящие места интеграции для планирования, выполнения, наблюдения результата и восстановления после ошибок.

Следующий приоритет — связывание уже существующих средств с единым контрактом выполнения. Не следует создавать второй планировщик Hermes: новый механизм должен возвращать результат в существующие решения NK1 и получать фактические постусловия действия.

### 3.3 Память и опыт

В дереве присутствуют MemoryFabric.ts, UnifiedMemorySystem.ts, SemanticMemoryGraph.ts, AutobiographicalMemory.ts, MultiTimescaleMemory.ts, MemoryConsolidationController.ts, MemoryRetrievalBenchmark.ts, MemoryRetrievalExperiment.ts, MemoryOS2.ts, MemoryResidencyGovernor.ts, SourceMonitor.ts, P65EpistemicLedger.ts, EventSourcing.ts и несколько мостов между памятью и обучением.

Это широкий набор существующих механизмов, но наличие нескольких уровней памяти делает опасным ещё один отдельный «Hermes memory store». Нужны общий retrieval contract, доказуемая provenance, правила устаревания и один поток в планировщик/обучение. До объединения нужно прочитать call graph и владельцев состояния; удалять похожие компоненты по имени нельзя.

### 3.4 Когнитивная архитектура

В дереве присутствуют CognitiveEventFabric, RuntimeEvidenceBus, ContinuityLedger, CognitiveResourceEconomy, AutonomousProjectExecutor, RuntimeClockScheduler, AdaptiveConsolidationGate, ReafferenceEvidenceCodec, EvidenceFirewall, ExternalEvidenceTrust, AutonomousLearningMemoryGovernor и большое количество cognition/developmental-модулей.

Это означает, что интеграция должна использовать текущие события, бюджеты, evidence-политики, действие и память. В то же время большой объём когнитивных модулей не доказывает, что каждый из них включён в production-петлю. Для приоритизации нужен анализ вызовов и владельцев состояния, а не количество файлов или название подсистемы.

### 3.5 Локальная модель и WorkPass183

P23LocalModelSkillRevisionGenerator.ts использует OpenAICompatibleLocalChatProvider из organism/integration/local. Генератор:

- требует настроенного локального provider и ненулевые evidence-backed targets;
- ограничивает размер сериализованных исходного payload и validation evidence;
- передаёт модели validation evidence и цели исправления;
- передаёт только скалярный aggregate holdout signal, не список примеров holdout;
- требует JSON-результат и отклоняет некорректный/слишком большой ответ;
- явно трактует результат как недоверенного кандидата, не как прошедшее оценку или активированное умение.

Server composition передаёт функцию generateSkillRevision в настроенную фабрику trusted provider. Само включение контура опционально и зависит от NEURO_COMPOUND_REPAIR_REVISION_PROVIDER_MODULE; без него обычная runtime-петля не начинает revision loop. Внешняя фабрика остаётся ответственна за подлинное proposal и независимые baseline/candidate evaluations. Это и есть ближайшая граница для следующего кода.

## 4. Что означает перенос Hermes на архитектуру NK1

Официальная документация Hermes Agent выделяет инструменты и toolsets, навыки с progressive disclosure, постоянную курируемую память, файлы контекста, checkpoints, browser automation, делегирование, code execution и планируемые задания. Это полезные референсы интерфейсов и поведения, но не список обязательных новых подсистем для NK1.

Hermes Agent Self-Evolution описывает текущую фазу оптимизации навыков на DSPy + GEPA и размечает эволюцию описаний инструментов, системного промпта, кода и непрерывный автоматический цикл как следующие фазы плана. Значит, нельзя представлять эти следующие фазы как готовый код, который достаточно скопировать. Лучше нативно реализовать нужные свойства в TypeScript, используя подходы поиска кандидатов, диагностики по execution trace, evaluation sets, ограничители размера, независимые проверки и review.

Darwinian Evolver указан в upstream-плане отдельно с лицензией AGPL v3. Не встраивать этот компонент автоматически. Отдельно проверить лицензию каждого донора и не переносить зависимости без реальной необходимости.

## 5. Статус 80 направлений из исходного списка

Метки:
- **Частично** — есть смежный механизм или участок цепочки, но сквозная интеграция/производственное доказательство отсутствует.
- **Пробел** — в проверенном call path нет достаточного основания считать механизм интегрированным.
- **Есть основа** — конкретная инфраструктура найдена; остаётся проверить ширину подключения и критерии использования.

### A. Самообучение и эволюция навыков

1. **Реальный генератор навыков в учебном пути — Частично.** WorkPass183 добавляет локальный генератор; штатное включение зависит от внешней trusted provider factory. Следующее действие: использовать существующую P23 lifecycle и реальный production evaluator через first-party provider, без фиктивных результатов.
2. **Замкнутый цикл самоулучшения — Частично.** Наблюдения ремонта, coordinator, P23-план, генерация и staging есть в цепочке PR; независимое выполнение кандидата и дальнейшее продвижение не замкнуты внутри единого production flow.
3. **Обучающие примеры из реальных сессий — Пробел.** Нужен нормализованный конвертер реальных ActionGateway/runtime/reality-evidence событий в датасет с источником, задачей, версиями, таймингом, исходом и фильтрацией секретов.
4. **Train / validation / holdout — Частично.** Разделение и защита от прямого holdout feedback присутствуют в P23-пути; необходимо единое правило идентичности задачи и near-duplicate между всеми наборами и новыми ревизиями.
5. **Причина провала по траектории — Частично.** SkillLearnBenchAdapter сравнивает ожидаемые и наблюдённые шаги; нужно связать реальную траекторию и typed tool errors с целями генератора в штатной петле.
6. **Качество навыка против реального результата — Частично.** Несколько осей оценки уже выделены; требуется калибровка на реальных результатах, интервалы неопределённости и повторяемость, а не настройка 50/30/20 только по впечатлению.
7. **Автоматические специализированные eval-наборы — Пробел.** Добавить генерацию кандидатов заданий из verified failure/success cases и проверенных контрастных вариантов; добавлять в канонический набор только после dedupe и ручного/авторизованного admission.
8. **Информационная ценность примеров — Частично.** Есть replay selection, surprise, information gain и curriculum; провести эту политику через skill-revision dataset и ограниченный бюджет, не дублируя replay subsystem.
9. **Несколько кандидатов — Пробел.** Генерировать небольшой bounded portfolio для одного revision plan, выполнять на одинаковых baseline conditions и сохранять лучшего допустимого, не последнего по времени.
10. **Многоцелевая оценка — Частично.** Успех, trajectory, skill quality и безопасность присутствуют; объединить стоимость, задержку, размер и regression/transfer ограничения в constrained decision, без скрывающего риски одного среднего балла.
11. **Продолжение эксперимента после остановки — Частично.** Долговременные state stores есть; отдельное durable-состояние итерации генератора, бюджета и eval-run нужно сделать частью эксперимента.
12. **Версионирование датасета — Частично.** Версии навыков, provenance и plan fingerprint есть; закрепить dataset manifest, rubric version, provider/model config, evaluator version и набор seeds в одном revision run record.
13. **Регрессионные ограничения — Частично.** Gate и holdout есть; нужен закреплённый regression suite предыдущих успешных навыков с индивидуальными неухудшаемыми пределами.
14. **Защита от разрастания навыков — Частично.** Генератор ограничивает размер входа/выхода; добавить лимит на размер/сложность конечного навыка, дубли, число шагов и цену поддержки.
15. **Обучение на исправлениях пользователя — Пробел.** Нужен путь «исправление пользователя → локальное правило/пример → предложение навыка → validation», без автоматического превращения одной реплики в глобальную истину.

### B. Навыки как долговременная процедурная память

16. **Progressive disclosure — Частично.** В проекте есть skill-файлы и retrieval-модули; проверить единый интерфейс summary → загрузка полной процедуры → связанных reference assets.
17. **Семантический поиск навыков — Частично.** SkillRetrievalAugmentation ранжирует навыки с учётом контекста, применимости и evidence; расширять только после сравнения lexical/context retrieval с LocalEmbeddingProvider и существующими memory retrievers.
18. **Извлечение процедур из успешных действий — Частично.** ProceduralSkillLibrary хранит compound skills и execution feedback; нужен admission из подтверждённых траекторий, чтобы навык извлекался из исполнения, а не выдумывался только генератором.
19. **Слияние похожих навыков — Пробел.** Добавить candidate-level merge/dedupe по нормализованным шагам, входам/выходам и подтверждённым outcome; не создавать ещё один реестр.
20. **Зависимости между навыками — Частично.** Композиционные навыки и шаги уже существуют; формализовать зависимости, версии, предусловия и обратимые переходы в одном schema.
21. **Выбор версии навыка — Частично.** VersionedSkillCandidateStore и promotion lifecycle есть; resolver должен использовать только активную разрешённую версию с доказательствами применимости.
22. **Устаревание навыков — Частично.** Есть confidence/use/validation-based retrieval и жизненный цикл памяти; добавить freshness по времени, изменению окружения и сроку валидности evidence.
23. **Diff и объяснение различий версий — Частично.** Revision plan и provenance есть; сохранять конкретный payload diff, причину, связанные доказательства, изменения поведения и необходимые регрессии.
24. **Ограниченное распространение навыка — Частично.** Verified promotion и approval существуют; добавить область действия/контекст навыка и запрет глобального использования при узкой валидации.
25. **Agent Skills format — Пробел/потенциал.** Не вводить параллельный формат без нужды; проверить совместимость текущего skill schema, затем добавить экспорт/импорт SKILL.md и ссылки на файлы как адаптер существующего реестра.

### C. Память, опыт и контекст

26. **Поиск прошлых сессий — Частично.** В NK1 много механизмов retrieval и опытной памяти; найти фактический cross-session search call path и подключить похожие подтверждённые случаи перед planner/revision.
27. **Курируемая долговременная память — Частично.** Есть несколько систем памяти и жизненный цикл; выбрать существующий canonical authority, согласовать ownership фактов/предпочтений/гипотез/временного контекста.
28. **Происхождение воспоминаний — Частично.** Источники, epistemic ledger и evidence provenance присутствуют; распространить source/time/confidence/revocation на все извлекаемые записи.
29. **Релевантное извлечение — Частично.** Есть MemoryRetrievalBenchmark/Experiment и retrieval subsystems; доказывать recall/precision на размеченном наборе, не считать наличие retriever доказательством его полезности.
30. **Сжатие контекста — Частично.** ContextBudgetLedger и контекстные компоненты есть; требуется одна политика сохранения цели, ограничений, решений, evidence links и незакрытых действий.
31. **Файлы контекста проекта — Частично.** В репозитории есть локальные инструкции/skills; проверить их реальную загрузку runtime и source boundary, прежде чем добавлять автопоиск файлов Hermes.
32. **Ссылки на файлы/diff/URL — Частично.** Есть файловые и исследовательские механизмы; добавить единый typed reference, чтобы источник попадал в context retrieval и provenance без встраивания больших файлов в prompt.
33. **Память об удачах и ошибках — Частично.** Outcome/trace/replay инфраструктура есть; свести успешные процедуры и причины провала в общий retrieval контракт.
34. **Профиль пользователя отдельно от задачи — Частично.** Есть разные состояния runtime и контекста; закрепить границу пользовательских предпочтений и временных параметров задачи, включая права/сроки хранения.
35. **Старение воспоминаний — Частично.** Memory lifecycle, retention economy и consolidation-модули есть; единый пересмотр фактов должен учитывать freshness, противоречия и стоимость вытеснения.
36. **Внешние memory providers — P3 / отложить.** Сначала сравнить существующие memory backends, локальные embeddings и retrieval quality; новый провайдер добавлять только по измеримому преимуществу.

### D. Планирование, агентность и исполнение

37. **Декомпозиция целей — Частично.** PlanEngine и CognitiveExecutionPlanner есть; связать подзадачи, prerequisites, бюджет и проверяемые exit criteria в единую структуру runtime задачи.
38. **Уточнение неоднозначностей — Частично.** Планирование и LanguageOrgan имеются; определить риск-ориентированную политику clarification и цену неверных предположений.
39. **Динамический выбор инструмента — Частично.** ActionGateway, action policy и несколько tool interfaces есть; централизовать доступность, стоимость, риск, typed schema и фактические постусловия.
40. **Проверка состояния мира после действия — Частично.** ExternalPostconditionVerifier и reality evidence имеются; включить их после каждого значимого tool execution, а не полагаться на текстовый ответ инструмента.
41. **Восстановление после ошибки — Частично.** Recovery controllers и repair evidence существуют; обеспечить, чтобы следующий план менялся по типизированной причине неудачи и не повторял ту же операцию без изменения.
42. **Делегирование подзадач — Пробел.** Не переносить Hermes delegate_task целиком; позже добавить ограниченную делегацию через существующий runtime/tool ownership с отдельными полномочиями и structured result.
43. **Структурированный обмен агентами — Частично.** Event fabrics/journal есть; зафиксировать schema передаваемого результата, evidence links, ограничения и ошибки для будущих делегированных задач.
44. **Длительные фоновые задачи — Частично.** Есть runtime schedulers/supervisors; требуется durable job state, cancellation, restart recovery и возвращение результата в основной планировщик.
45. **Расписание по времени/событию — Частично.** RuntimeClockScheduler и scheduler-модули есть; не добавлять второй cron, пока не найден canonical orchestration surface.
46. **Бюджет исполнения — Частично.** CognitiveBudgetManager/ResourceEconomy и bounded generation существуют; объединить число моделей, действий, retries, времени и размера данных в один распространяемый budget context.
47. **Ожидаемая полезность действия — Частично.** Utility/reward/uncertainty компоненты есть; действие оценивать по ожидаемому эффекту, риску и цене и сравнивать прогноз с реальным исходом.
48. **Возврат результата планировщику — Частично.** Есть unified cognitive cycle и evidence bus; закрепить один runtime contract observation → postcondition → plan update для разных видов инструментов.

### E. Надёжность, безопасность, обратимость

49. **Контрольные точки изменений — Частично.** Атомарное persistence и revision/version history существуют; расширить контрольную точку на весь изменяемый артефакт, включая связанные state/metadata, прежде чем выполнять эксперимент.
50. **Откат отдельного изменения — Частично.** Для навыков предусмотрены версии и rollback approvals; общий код/файлы/конфигурацию откатывать только как отдельную изолированную способность.
51. **Просмотр diff — Частично.** Candidate version/provenance есть; сделать diff, rationale и impact scope доступными при review кандидата в UI/API.
52. **Изоляция экспериментов — Частично.** Shadow-run registry и durable candidates есть; обеспечить отдельное окружение исполнения кандидата и одинаковые условия baseline/candidate.
53. **Разделение полномочий — Основа есть.** Authentic proposal, trusted evidence, signed shadow-run и authenticated approval уже существуют; не допускать обхода со стороны generator, provider module или runtime route.
54. **Ограничение опасных инструментов — Частично.** ActionGateway и API/security policies есть; применять policy к конкретному tool, области файлов, сети, ресурсам и уровню риска до вызова.
55. **Фильтрация секретов в обучающих данных — Пробел для сквозного training path.** Даже если отдельные redaction/credential mechanisms присутствуют, пока не доказано их применение ко всем траекториям до сохранения. Сделать sanitization до записи в dataset.
56. **Происхождение результата — Частично/сильная основа.** Signed evidence, run registry, ledger и candidate provenance существуют; связать их одним immutable experiment record от исходной задачи до promotion/rollback.
57. **Защита обучающих данных от загрязнения — Частично.** Verified outcome admission есть; отсеивать model self-report, неподтверждённые внешние инструкции и дубли до попадания в training/eval datasets.
58. **Инструкции из недоверенных файлов/web/tool outputs — Основа есть.** EvidenceFirewall и ExternalEvidenceTrust существуют; проверить, что retrieved content никогда не получает полномочий system/policy уровня.
59. **Ограничения рекурсивного планирования — Частично.** Runtime/resource budgets есть; ввести единые пределы глубины делегации, циклов исправления и порождения заданий.
60. **Изоляция ресурсов — Частично.** Ограничения тела/model call и resource governors присутствуют; недоверенный код требует отдельной sandbox границы, а не только prompt-инструкций.

### F. Инструменты, интеграции, мультимодальность

61. **Единый реестр инструментов — Частично.** ActionGateway и tool interfaces уже есть; описания схемы, разрешений, стоимости, типовых ошибок и постусловий должны быть единообразны.
62. **Выбор минимального набора инструментов — Частично.** Policy arbiters есть; добавлять динамическое сужение набора на задачу только при сохранении единого canonical registry.
63. **MCP — P2 / частичный задел.** Найден WillMcpJsonRpc, но это само по себе не доказывает универсальную MCP-интеграцию NK1; расширять через адаптеры существующего tool contract.
64. **Типизированные ошибки инструментов — Частично.** Runtime содержит execution/recovery contracts; унифицировать ошибки invalid-args, permission, missing-resource, transient, timeout, state-conflict и postcondition-failed.
65. **Изменяющиеся стратегии retry — Частично.** Recovery/repair path существует; retries должны зависеть от категории ошибки и изменённого плана, с backoff/budget и idempotency.
66. **Структурированное состояние браузера — Пробел/P2.** Browser-related UI code не равен агентному браузеру; при нужном сценарии добавить snapshot/DOM/accessibility tree через tool adapter, а не координатную эмуляцию как единственную модель.
67. **Визуальное восприятие интерфейса — Частично.** Camera evidence и VisionSemanticBackend существуют; не доказана сквозная связь screenshot → target selection → action → verified postcondition для UI.
68. **Фоновые процессы — Частично.** Есть scheduler/supervisor-модули; обобщить управление процессами только при наличии нужных production-сценариев и durable status.
69. **Изображения и голос — Частично/по потребности.** Vision, Live2D и embodied surface присутствуют; подключать генерацию/voice отдельно, не копируя внешнюю media architecture Hermes.
70. **Общий API адаптеров — Частично.** Есть ряд adapters/providers; единый interface нужен для capability, schema, credentials, risk, timeout, errors и evidence capture.

### G. Расширенная эволюция системы

71. **Оптимизация описаний инструментов — Пробел; upstream phase 2 запланирована.** Сначала собрать реальные ошибки выбора инструмента, затем предложить кандидаты описания без изменения реальной сигнатуры и полномочий.
72. **Оптимизация инструкций планировщика — Пробел; upstream phase 3 запланирована.** Делать только на versioned prompt sections с protected policy, paired eval и явным diff.
73. **Эволюция алгоритмического кода — P3 / отложить.** Upstream phase 4 описана как направление с внешним Darwinian Evolver AGPL v3; не встраивать её автоматически. Только отдельный isolated branch/worktree, воспроизводимые тесты и review.
74. **Сравнение стратегий на одинаковых заданиях — Частично.** Есть paired/seed-aware outcome metrics и learning experiment plan; запустить полные версии task manifests, seeds, model config и независимого holdout.
75. **Измерение фактического улучшения — Частично, доказанный эффект отсутствует.** Наличие метрик не равно uplift. Нужны точные данные от реальных независимых запусков, размер выборки, интервалы/вариативность и regression report.
76. **Цена улучшения — Частично.** Runtime performance/resource modules есть; записывать tokens/calls, latency, compute, memory, retries и стоимость на каждую ревизию.
77. **Протокол продвижения — Основа есть.** Authenticated approval и signed shadow evidence — существующий canonical trust path. Генератор не должен иметь права активировать вариант.
78. **План следующего улучшения — Частично.** OutcomeReflectionCurriculum и target-ranking компоненты существуют; объединить severity, expected benefit, recurrence, information gain, cost и risk в очередь реальных улучшений.
79. **Портфель экспериментов — Частично.** Store может хранить разные кандидаты; добавить сравниваемые варианты и выбор лучшего допустимого с удержанием baseline.
80. **Единая история развития навыка — Частично.** Repair ledger, candidate provenance, evidence ledger и shadow registry имеются раздельно; связать их run/candidate/skill IDs в сквозную navigable историю.

## 6. Приоритетный план исполнения

Порядок ниже — реальные проходы реализации, а не 80 независимых модулей.

### WorkPass184 — First-party trusted provider и запуск ревизии без внешней заглушки (P0)

Цель: соединить доступный из runtime revision entry point с существующими P23 интерфейсами так, чтобы не требовать от оператора написания нового модуля для каждого запуска.

Работа:
- Сверить существующие API VersionedSkillCandidateStore, VerifiedSkillPromotion, TrustedShadowLearningRunCoordinator, TrustedSkillShadowRunRegistry, VerifiedOutcomeLedger и production evaluator.
- Подключить реальные получение source candidate, baseline, candidate execution, independent verifier reports и authentic promotion proposal.
- Встроить P23LocalModelSkillRevisionGenerator в тот же путь через provider interface; не генерировать фиктивные proposal/evaluation artifacts.
- Сохранить явные trusted keys, approval boundary и fail-closed startup.
- Если отсутствует пригодный реальный executor/evaluator, не подменять его синтетическим: реализовать недостающее звено в существующих интерфейсах и явно обозначить оставшуюся зависимость.

Готово, когда: входной маршрут вызывается обычным runtime/learning flow; в журнале есть единая связанная цепочка evidence → plan → generator → candidate → actual candidate execution → independent reports → staging; кандидат не активируется до авторизованного verified path.

### WorkPass185 — Выполнение и независимая оценка исходного/нового навыка (P0)

- Одинаковые задачи, ресурсы, timeout, model/tool configuration и seed для baseline и candidate.
- Candidate запускается в контролируемом окружении; исход оценивается внешним verifier, не самогенератором.
- Сохраняются реальные trace, postconditions, ошибки, стоимость и latency.
- Validation может вести поиск исправления; holdout — только независимое агрегированное решение, никогда не prompt с отдельными holdout примерами.
- Signed shadow evidence привязано к candidate ID, source revision, task manifest и evaluator run.

Готово, когда: можно показать минимум один полный реальный baseline/candidate run с независимыми raw outcomes; synthetic fixtures считаются только проверками контракта и не засчитываются как эффект обучения.

### WorkPass186 — Реальные сессии в версионированный датасет (P0)

- Источники: RuntimeEvidenceBus, OperationalJournal, ActionGateway trace, ExternalPostconditionVerifier и verified outcome ledger.
- Нормализованная запись: task/family ID, timestamp, source reference, current skill version, ordered actions, tool error type, expected/observed postcondition, outcome verifier, environment/model config и consent/policy scope.
- Санитизация секретов/PII до записи; записи сохраняют provenance и могут быть отозваны.
- Deterministic task identity + exact/near duplicate fingerprint; держать все повторы одной задачи в одном split.
- Dataset manifest фиксирует train/validation/holdout IDs, version и причины admission/rejection.

Готово, когда из реальных запусков строится воспроизводимый dataset без model-generated truth labels, а один task/family нельзя случайно распределить по нескольким splits.

### WorkPass187 — Оценочные наборы из повторяющихся реальных ошибок (P1)

- Генерировать синтетические кандидаты заданий из verified failures; не маркировать синтетическую цель как истинную без verifier.
- Семейства: обычные задачи, граничные параметры, ambiguous inputs, ошибки permissions, временные сбои, recovery, регрессии и multi-step execution.
- Дедупликация и diversity; ограничение веса повторяющихся семейств.
- Изменение canonical eval set допускается через контролируемый admission, с версиями и сохранением прежней независимой оценки.

### WorkPass188 — Портфель вариантов и защита от регрессии (P1)

- Генерировать ограниченное число вариантов из одного плана.
- Отправлять их на одинаковый benchmark и baseline сравнение.
- Выбирать Pareto-допустимый кандидат по success, trajectory, skill quality, safety, regression, cost/latency и size.
- Не допускать продвижения по одному среднему числу, если ухудшился critical safety или одна из критических task families.
- Сохранять baseline и каждый candidate result для воспроизводимости.

### WorkPass189 — Восстановление/возобновление опыта и история ревизий (P1)

- Сохранять experiment ID, iteration, remaining budget, candidate IDs, eval run IDs, dataset/rubric/model versions и последний шаг.
- Продолжать прерванный эксперимент из сохранённого состояния без повторной генерации успешных или уже оценённых кандидатов.
- Связать repair record → revision plan → version diff → evaluation → approval/rollback.
- Использовать текущие stores/ledger; избегать отдельной не связанной базы.

### WorkPass190 — Процедурная память и retrieval (P1)

- Подключить retrieval успешных/провалившихся историй перед планированием.
- Поддержать summary-first progressive disclosure, затем детальные steps/references только для выбранной процедуры.
- Отдавать приоритет не просто частоте использования, а evidence, freshness, applicability, failure cost и независимой валидации.
- Сливать дубли на уровне candidate, а не создавать второй skill registry.
- Устаревшие/противоречивые процедуры помечать для ревизии и ограничивать область действия.

### WorkPass191 — Планирование и action feedback (P1)

- Единый state transition contract: proposal → authorized action → tool result → independent postcondition → world/task state update → next plan.
- Распространить типизированные errors, idempotency и ограниченные retries.
- Передать результат в существующие PlanEngine/CognitiveExecutionPlanner и repair ledger.
- Измерять число бесполезных повторов и успешность recovery, не только общий task completion.

### WorkPass192+ — Выборочные возможности Hermes (P2/P3)

- Agent Skills export/import и project context file adapter только если совместимость помогает переиспользованию skills.
- MCP adapter поверх существующего ActionGateway, с allowlist toolset и provenance.
- Structured browser state и screen-action verification при необходимости реального пользовательского UI automation.
- UI для просмотра статуса эксперимента, diff, evidence и одобрения кандидата — по текущим app surfaces, без отдельного frontend.
- Эволюция tool descriptions/prompt sections только после появления надёжного датасета; эволюция кода последней.

## 7. Сквозные условия качества — не считать самостоятельными фичами

Эти условия являются частью перечисленных интеграций и acceptance criteria, а не заменой реальной разработки:

1. Одна canonical store для версий и одна canonical promotion boundary.
2. Никаких синтетических подписанных доказательств и никакого model-as-verifier вместо независимой проверки.
3. Holdout нельзя раскрывать генератору на уровне отдельных задач; любое изменение skill candidate требует нового независимого evaluation run.
4. Вся цепочка должна иметь provenance и версионированные артефакты.
5. Идентичность задачи и близкие дубликаты нельзя размножать между train/validation/holdout.
6. Генерация, staging, shadow run, approval и activation — разные состояния.
7. Улучшение считается доказанным только после реального сравнения с baseline, достаточной выборки и отчёта о регрессиях/неопределённости.
8. UI/API должны показывать фактическое состояние и причину отказа, а не декоративный статус «learning complete».
9. Все действия ограничены доступами, resource budget, тайм-аутами, idempotency и возможностью отмены/rollback.
10. Test fixture не является доказательством способности в production; не объявлять CI зелёным, пока точный HEAD не имеет доступных успешных результатов.

## 8. Что не делать

- Не встраивать Hermes Agent как параллельного агента, планировщик, память и skill store.
- Не добавлять обязательную Python/DSPy/GEPA runtime-зависимость для TypeScript-приложения, если нужный механизм можно реализовать существующими интерфейсами и измерить пользу.
- Не копировать AGPL-компонент в NK1 без отдельного лицензионного решения.
- Не создавать ещё один memory store или skill registry ради похожего названия.
- Не считать число модулей, тестовых файлов или строк кода доказательством полезности.
- Не удалять исторические/legacy-компоненты лишь по имени или похожей структуре. Для удаления сначала доказать отсутствие production caller, данных и нужной совместимости.
- Не включать автоматическую активацию модели-генератора и не позволять ей утверждать успешность собственной работы.
- Не расширять browser, voice, MCP или multi-agent функциональность до закрытия P0, если это отвлекает ресурсы от реального цикла обучения.

## 9. Приоритетный backlog — текущий статус

| Приоритет | Задача | Статус |
|---|---|---|
| P0 | Локальная модель как generator candidate payload | Код добавлен в WorkPass183; тесты не запускались |
| P0 | Вызов генератора из trusted production provider | Частично: функция инъецируется, но provider module обязателен для включения |
| P0 | Настоящее baseline/candidate выполнение и независимая оценка | Не закрыто единым first-party производственным путём |
| P0 | Train/validation/holdout для потока реальных сессий | Частично в P23-evolution path, ещё не общий dataset pipeline |
| P0 | Сквозная provenance от исходного repair до verified decision | Частично: основные ledger/store есть, требуется связать run record |
| P0 | Точный-head CI | Блокер: WorkPass105/108/110 failed, доступных job steps/logs нет |
| P1 | Автоматическое построение/обогащение eval-наборов | Не закрыто |
| P1 | Несколько кандидатов + constrained selection | Не закрыто |
| P1 | Dataset/rubric/model versioning | Частично |
| P1 | Regression suite на ранее освоенных задачах | Частично |
| P1 | Возобновляемые длительные эксперименты | Частично |
| P1 | Единый retrieval процедурной памяти | Частично |
| P2 | Skill-format / MCP / structured browser adapters | Отложено до P0 |
| P3 | Evolution system prompts/tool descriptions/code | Отложено до качественного real-session dataset и оценки |

## 10. Источники и ключевые файлы

### NK1
- [Полная исходная ветка workpass70-source](https://github.com/ailtron1ss-rgb/NK1/tree/workpass70-source)
- [Текущая цепочка WorkPass172–183, PR #45](https://github.com/ailtron1ss-rgb/NK1/pull/45)
- [P23LearningEngine.ts](https://github.com/ailtron1ss-rgb/NK1/blob/workpass172-hermes-compound-revision-orchestrator/runtime/neuro-kurisu/src/organism/learning/P23LearningEngine.ts)
- [P23LocalModelSkillRevisionGenerator.ts](https://github.com/ailtron1ss-rgb/NK1/blob/workpass172-hermes-compound-revision-orchestrator/runtime/neuro-kurisu/src/organism/learning/P23LocalModelSkillRevisionGenerator.ts)
- [P23CompoundRepairRevisionCoordinator.ts](https://github.com/ailtron1ss-rgb/NK1/blob/workpass172-hermes-compound-revision-orchestrator/runtime/neuro-kurisu/src/organism/learning/P23CompoundRepairRevisionCoordinator.ts)
- [SkillLearnBenchAdapter.ts](https://github.com/ailtron1ss-rgb/NK1/blob/workpass172-hermes-compound-revision-orchestrator/runtime/neuro-kurisu/src/organism/learning/SkillLearnBenchAdapter.ts)
- [SkillRevisionPlan.ts](https://github.com/ailtron1ss-rgb/NK1/blob/workpass172-hermes-compound-revision-orchestrator/runtime/neuro-kurisu/src/organism/learning/SkillRevisionPlan.ts)
- [VersionedSkillCandidateStore.ts](https://github.com/ailtron1ss-rgb/NK1/blob/workpass172-hermes-compound-revision-orchestrator/runtime/neuro-kurisu/src/organism/learning/VersionedSkillCandidateStore.ts)
- [VerifiedSkillLifecycleBootstrap.ts](https://github.com/ailtron1ss-rgb/NK1/blob/workpass172-hermes-compound-revision-orchestrator/runtime/neuro-kurisu/src/organism/learning/VerifiedSkillLifecycleBootstrap.ts)
- [WorkPass150 research/implementation notes](https://github.com/ailtron1ss-rgb/NK1/blob/workpass172-hermes-compound-revision-orchestrator/docs/WORKPASS150_HERMES_FITNESS_ADAPTER_2026-10-21.md)
- [Continual learning scorecard](https://github.com/ailtron1ss-rgb/NK1/blob/workpass172-hermes-compound-revision-orchestrator/docs/P23_CONTINUAL_LEARNING_SCORECARD_2026-10-20.md)

### Upstream Hermes
- [Hermes Agent](https://github.com/NousResearch/hermes-agent)
- [Hermes Agent tools and toolsets](https://hermes-agent.nousresearch.com/docs/user-guide/features/tools/)
- [Hermes Agent skills system](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills)
- [Hermes Agent persistent memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory)
- [Hermes Agent Self-Evolution README](https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/README.md)
- [Hermes Agent Self-Evolution plan](https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/PLAN.md)
- [Self-Evolution fitness reference](https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/evolution/core/fitness.py)
- [Self-Evolution optimization loop](https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/evolution/skills/evolve_skill.py)

## Итог

Нужна не новая архитектура, а **доведение уже начатой цепочки до одного настоящего производственного пути**. Ближайшая работа — first-party trusted provider, реальное выполнение baseline/candidate и связывание независимого результата с verified promotion gate. После этого реальные сессии можно безопасно превращать в датасет, строить разнообразные оценки и выбирать лучший вариант вместо случайного последнего. Все остальные направления Hermes должны присоединяться к этим существующим подсистемам, а не становиться отдельными конкурирующими движками.
