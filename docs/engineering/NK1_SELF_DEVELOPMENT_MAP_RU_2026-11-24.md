# NeuroCore / NK1 — карта направления «Саморазвитие и самоулучшение»
Дата сверки: 24 ноября 2026 года  
Проверенная интеграционная база: `workpass70-source @ 87c9ed9034e09ca9fb83fd676ac52bb46434c4fe`

## 1. Цель и границы

Саморазвитие — это управляемый контур, который обнаруживает собственные ограничения, формирует внутренние цели, выбирает допустимые изменения, проверяет их независимыми измерениями, связывает фактические результаты с породившими их решениями и сохраняет только воспроизводимые улучшения.

Это направление не должно присваивать себе владение чужими подсистемами. Оно использует их контракты:
- память хранит опыт и происхождение свидетельств;
- самомодель описывает предсказания и причинные связи системы с собственными действиями;
- идентичность хранит устойчивые ограничения и непрерывность;
- модель пользователя хранит только сведения о пользователе;
- мотивация и экология целей выбирают, зачем развиваться и на что тратить ресурс;
- шлюз действий исполняет только разрешённые действия и предоставляет проверяемые receipts.

## 2. Карта подсистем и владельцев

| Слой | Текущие владельцы / артефакты | Роль в развитии | Состояние на проверенном HEAD |
|---|---|---|---|
| Самодиагностика | `P32CausalSelfModel`, `SelfModelV2`, `SelfModelValidationEngine`, `LiveSelfImprovementSupervisor` | Сравнивать прогнозы с исходами; находить расхождения; решать продолжить, перенаправить или остановить цикл | Исходники есть; качество и полнота реального runtime-подключения ещё требуют сквозной проверки |
| Структурный анализ собственного кода | PR #698: `SourceGraph`, `SelfModificationGuard`, `DangerModel`, `SelfImprovementCandidatePool` | Строить граф исходников, обратное влияние изменений, запрещать правки доверенных evaluators/holdout/approval | Не входят в дерево текущего `workpass70-source`; PR #698 старый Draft, нельзя переносить целиком без выборочной интеграции |
| Авторство и агентность | `SelfAuthorshipEngine`, `CanonicalSelfAgencyAuthority`, Core decision traces, ActionGateway receipts | Различать намерение, выбранное действие, выполненное действие и подтверждённый результат | Критичный разрыв был в прежнем HEAD: выбор действия сразу повышал авторство. Исправление подготовлено в цепочке #1153 → #1156 → #1157; в настоящем интеграционном PR переносится только соответствующий SelfAuthorship/Core/CEF слой |
| Мотивация и цели | `P67AutonomousGoalGenesis`, `P68GoalEcology`, `AgencySubsystemRuntime`, `AutonomousSocialInitiativeEngine`, PR #1124 | Порождать внутренние цели, оценивать устаревание/конфликты/прогресс, учитывать ресурсы и согласие | Значительная часть подключена и PR #1124 уже слит; цель должна проходить lifecycle/holdout/causal gates |
| Обучение и варианты улучшений | `P23LearningEngine`, `P23ReflectiveCandidatePopulationSearch`, `P23CandidateParetoArchive`, `ValidationOnlySkillCandidateEvaluator`, P26 replay/holdout | Создавать ограниченное число вариантов, оценивать на validation, не раскрывать holdout генератору | P23-кандидатный контур в текущем HEAD; holdout-firewall и независимые оценки присутствуют, но нужны end-to-end проверки promotion/rollback |
| Научная проверка гипотез | `TheInventionLoop` | Протокол, независимые проверяющие, репликации и holdout, critique, подписанные артефакты, аудит | Реализация есть в исходниках; фактическое подключение к каждому каналу улучшения нужно подтвердить |
| Изменение поведения и архитектуры | `P53DevelopmentalSelfModificationLab`, `AdaptiveSynapticMatrix`, `NeuralMorphogenesisEngine`; ветки #902/#912 | Разрешать только обратимые изменения ограниченных параметров; архитектурные изменения рассматривать отдельно | P53 и NeuralMorphogenesisEngine есть; крупный Developmental Genome / Morphogenesis пакет остаётся отдельной веткой, не считать его слитым |
| Приёмка патчей собственного кода | #698, #743, #708/#1130 | Подписанный patch receipt от host-owned ключа, фиксированный base SHA, точные файлы/диапазоны, независимые paired outcomes | Paired-divergence guard уже интегрирован через #1130; structural SourceGraph/patch receipt trust path пока не полностью в current tree |
| Сохранение и восстановление | `OrganismCore`, `PersistenceProjectionCoordinator`, `StateMigrations`, `CognitiveEventFabric`, ActionGateway ledger/archive | Связать decisionId, executionId, receipt, outcome и проекцию состояния; восстановить незавершённое после перезапуска без повторного side effect | Базовые механизмы существуют; SelfAuthorship связка с ActionGateway receipt исправляется в текущем этапе |

## 3. Сквозной контракт взаимодействия

```text
Самодиагностика / metacognitive episode
  → подтверждённая проблема или возможность
  → P67: внутренняя цель (с origin/provenance)
  → P68: актуальность, конфликт, приоритет, lifecycle
  → мотивация + resource budget + consequence gate
  → P23: ограниченная популяция вариантов
  → validation-only evaluator + safety scanner
  → независимый holdout / TheInventionLoop / paired downstream outcomes
  → promotion authority + host-owned patch receipt + rollback plan
  → разрешённый executor / ActionGateway
  → host receipt + postcondition verifier
  → settlement ровно того decisionId, который породил действие
  → причинная самомодель + learning/replay + goal progress
  → консолидация только подтверждённого результата
```

Отказ, неоднозначный receipt, недостаток выборки, утечка holdout, несовпадение SHA, нарушение identity invariant или превышение бюджета закрывают путь по умолчанию. Восстановление после сбоя — read-only reconciliation; повторное выполнение внешнего side effect не является допустимым способом «проверки».

## 4. Разделение данных и прав записи

- `SelfAuthorship`: происхождение внутренних намерений и авторство только после фактического подтверждённого действия.
- `P32CausalSelfModel`: прогнозы своих действий, ошибка прогнозирования и причинные наблюдения; не является хранилищем идентичности.
- `SelfModelV2` / Identity: устойчивые self-state и identity invariants; изменения медленные, bounded и проверяемые.
- `UserModelEvidenceModel`: только пользовательские утверждения/наблюдения, не переносить в self-authorship.
- `P67/P68`: создание и lifecycle целей; не дублировать список целей в SelfAuthorship.
- `P23/P26`: генерация кандидатов и обучение; не владеют approval keys, holdout labels или identity invariants.
- `ActionGateway` + host verifier: единственный источник подтверждения внешнего исполнения; модель не может сама объявить собственное исполнение проверенным.
- `CognitiveEventFabric`: causal correlation/trace; decision reference не равна parent edge, если родительский узел отсутствует.

## 5. Главные дефекты и незакрытые места

1. **P0 — авторство по выбору, а не по результату.** Прежний `SelfAuthorshipEngine.observeDecision` увеличивал счётчики/commitments при выборе. Исправление переводит это в bounded pending ledger, привязанный к точному `decisionId`; settlement выполняется только по совпавшему verified outcome.
2. **P0 — авторство после внешнего действия и restart.** Verified ActionGateway postcondition должна закрывать тот же pending decision; при потере ACK нужен read-only provider reconciliation, без повторного executor вызова и без двойного credit.
3. **P1 — структура собственного кода и запретные зоны.** В current HEAD отсутствуют `SourceGraph` и `SelfModificationGuard`; старый PR #698 не должен переноситься целиком. Нужна узкая интеграция с текущими paired evidence и host-owned patch receipt.
4. **P1 — единый lifecycle кандидата.** Доказать одну цепочку candidate → validation → independent holdout → signed admission → apply → postcondition → rollback. Наличие классов и workflow отдельно не доказывает её runtime работу.
5. **P1 — безопасная пластичность.** Behavioral parameters, skill weights, model adapters и live executable architecture — разные классы изменений с разными разрешениями. Запретить самоправку evaluators, trust keys, identity anchors, holdout datasets и approval workflow.
6. **P2 — измеримая полезность.** Считать paired seeds, downstream outcomes, regression rate, rollback recovery, latency/resource cost, transfer и calibration. Proxy-score не является результатом.
7. **P2 — длительная непрерывность.** Проверить restart/soak, идемпотентность, ограничение очередей, stale intent expiry, checkpoint parity и способность остановиться.

## 6. Критерии качества направления

- Никакого авторства или обучения по одному намерению/выбранному действию.
- Каждое изменение имеет происхождение, базовый SHA, список затронутых файлов, проверяющего, независимое evidence и rollback path.
- Минимум пять независимых пар для paired proxy/downstream проверки, если gate использует установленную политику.
- Holdout недоступен генератору и автору кандидата до завершения admission.
- Изменения evaluator/holdout/approval/identity/trust root заблокированы; только host-owned trust config может разрешить доверенный receipt.
- Результат повторяется на фиксированных seed и независимом split; отрицательный эффект или регрессия отвергает кандидата.
- Внешнее действие подтверждается host-side postcondition, не текстом модели.
- После рестарта pending decision связывается с одним receipt; replay не создаёт второй side effect или второй credit.
- Ошибка/неопределённость приводит к abort/quarantine/rollback, не к optimistic promotion.

## 7. Порядок доработки

1. Завершить и проверить P0 SelfAuthorship → Core decision → ActionGateway receipt → restart reconciliation.
2. Выборочно встроить SourceGraph/SelfModificationGuard на актуальную базу и подключить в реальный self-rewrite proposal path.
3. Свести P23/P26/InventionLoop/SelfAgency admission в один прослеживаемый promotion contract; убрать обходы и дублирующие владельцы.
4. Развести behavioral plasticity, skill/model adaptation и архитектурную morphogenesis по отдельным уровням допуска.
5. Прогнать end-to-end restart, holdout, negative-control, rollback, performance и длительный soak.
6. Обновить scorecard только по exact-head CI и независимым измерениям; отдельно сверить опубликованный Release ZIP. Никаких заявлений о включении в Release до проверки архива.

## 8. Текущий этап

В интеграционную ветку переносится только P0 SelfAuthorship runtime correction: pending intent, exact decision ID, verified execution settlement, durable recovery, CEF correlation reference, tests и focused CI. Остальные этапы выше — план следующих независимых проверяемых изменений, а не уже выполненная работа.
