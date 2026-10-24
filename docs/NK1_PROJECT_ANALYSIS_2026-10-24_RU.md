# NK1 / Neuro Kurisu — технический анализ проекта
**Срез:** 2026-10-24  
**Источник кода:** `ailtron1ss-rgb/NK1`; отдельная публикационная линия `main`, рабочая исходная база `workpass70-source`, категорийные изменения — через PR в `integration`.  
**Статус документа:** инженерная оценка по уже изученным веткам, PR и фрагментам CI. Это не заявление о полном построчном аудите всего репозитория.

## 1. Итог

NK1 — большой многослойный runtime цифрового организма, а не законченный автономный агент. В разных ветках присутствуют ядро когнитивного цикла, память и происхождение свидетельств, P23 learning, цели и саморегуляция, self/user model, проверка исходов, эмоциональное состояние и avatar/voice. Главный разрыв сейчас не в отсутствии ещё одной подсистемы, а в том, что ключевые связи и критерии достоверности должны быть едины между ветками, пройти проверяемые тесты на точных commit heads и попасть в воспроизводимый релиз.

**Главная техническая цель следующего этапа:** единая доказательная цепочка
`decision → action receipt → independent postcondition evidence → canonical memory → P65 belief update → P23 learning/candidate → isolated validation+holdout → gated promotion/rollback`.
Идентификаторы, provenance и уровень доверия должны сохраняться на каждом переходе; один и тот же факт не должен повторно засчитываться из-за retry, переименования источника или восстановления snapshot.

Hexis используется как источник отдельных инженерных приёмов — evidence-based belief revision, долгоживущей identity/worldview, бюджетированного heartbeat/OODA и проверяемого self-repair. Целевые владельцы этих функций остаются в NK1. Второй параллельный Hexis runtime и лишняя зависимость не нужны.

## 2. Архитектура и владельцы

| Система/ветка | Каноническая ответственность | Главный критерий готовности |
|---|---|---|
| Core / cognitive cycle | Perceive → appraise → plan → act → reflect; причинный граф и единый путь исполнения | Ни один planner не обходит ActionGateway; полный цикл имеет проверяемые parent/receipt связи |
| `feature/perception` | Приём наблюдений, время, источник, независимость, уверенность и отделение наблюдения от вывода | Observation envelope сохраняет provenance до памяти и verifier |
| `feature/memory` | MemoryOS2, долговременный контекст, временная история, источники и консолидация | Дедупликация по устойчивой lineage/evidence identity; hostile restore/replay безопасны |
| `feature/learning` | P23, опыт и replay, формирование кандидатов навыков и оценка качества | Ошибка → diagnosis → candidate → независимая оценка → контролируемое promotion/rollback |
| `feature/feedback` | Outcome verification, внешние свидетельства, event identity, конфликтующие результаты | Самоотчёт/ACK не считается истиной; повтор результата идемпотентен, конфликт карантинится |
| `feature/personality` | SelfModel, устойчивые ценности, модель пользователя и метакогнитивные обновления | Опыт меняет убеждения постепенно, не переписывая произвольно базовую идентичность |
| `feature/emotions` | Динамическое аффективное состояние и его влияние на поведение | Эмоции изменяют стиль/приоритеты, но не обходят EthicalGate и безопасные лимиты |
| `feature/visual-embodiment` | Avatar/voice, выражение внутреннего состояния в действии и речи | Реальная синхронизация audio, lip motion, эмоции и interruptions на целевой машине |
| `feature/experiments` | Воспроизводимость, типизация, benchmarks, CI и измерение обучаемости | Exact-head CI, фиксированные seeds/manifest, независимый holdout и baseline comparison |
| `planning/master-audit-roadmap` | Архитектурное владение, зависимости, source provenance и release gates | Метрики обновляются из реальных runs и hashes, а не из предположения о готовности |
| `integration` | Совместная проверяемая сборка категорийных PR | PR принимаются по совместимому diff, порядку зависимостей и exact-head evidence |
| `main` + Release ZIP | Публикация воспроизводимой сборки и контрольной суммы | Не менять обходным путём; выпускать после прохождения release gates |

Эти названия — организационные границы, а не доказательство того, что всё уже объединено в один runtime. Категорийные ветки содержат разошедшиеся по времени реализации. Поэтому один и тот же концепт может иметь две реализации и два различных контракта.

## 3. Текущие интеграционные находки

### 3.1 Доказательная идентичность — частичная реализация

На `feature/feedback` появились `EvidenceEventIdentity.ts`, повторное использование identity helper в `OutcomeVerificationService`, передача decision identity в embodied action result и защита `RealityEvidenceLedger` от повторной записи того же payload и от конфликтующего повторного использования ID. Это хороший reliability-переход: повтор доставки не должен становиться новым независимым наблюдением.

На срезе WorkPass489 кодовая дубликация helper устранена: `feature/feedback` и `feature/perception` теперь содержат byte-identical `EvidenceEventIdentity.ts`. Perception's public `realityEvidenceEventId(originEventId, role, discriminator)` delegates to the shared `createRealityEvidenceEventId`, preserving the historic `nk1-reality:<role>:<48-hex>` encoding for persisted rows. Feedback's decision-bound outcome key remains a separate semantic ID: it must stay stable for the same decision so a changed result becomes a quarantined payload conflict. These are intentionally different identity types, not competing hash implementations. WorkPass497 now extends the shared projection identity into P23\`s `CausalExperienceStream`: grounded outcomes and unverified external imports have distinct domain roles, and restore reconstructs a deterministic ID for legacy rows. The remaining gap is the full verified receipt → RealityEvidenceLedger → MemoryOS2/P65 → P23 propagation with retry/conflict/restore tests at every boundary.

Состояние: **часть реализована на отдельных ветках; end-to-end bridge не доказан**.

### 3.2 P65: ключ составного свидетельства

В `feature/memory` compound key для пары lineage/evidence переключён с двусмысленной конкатенации вида `a:b:c` на сериализованную пару. Это предотвращает коллизии вида `("a:b","c")` и `("a","b:c")`. Добавлен регрессионный сценарий. Этот подход стоит сохранить, проверить на точном head и использовать как принцип для других составных ключей в NK1.

### 3.3 Семантическая проверка TypeScript

В `feature/experiments` обновлена схема runtime typecheck: вместо опоры на слабые локальные shim-декларации добавлена явная Node type dependency в runtime package/lockfile; semantic TypeScript check исключает `src/node-shims.d.ts`, а скрипт предпочитает доступный канонический compiler с fallback только если компилятор недоступен.

Результат — **исправлена конфигурация запуска проверки**, но успешный компиляционный результат нельзя заявлять, пока актуальный workflow на последнем commit не завершил семантический typecheck. После устранения каскада от неполных shim могут проявиться реальные ошибки типов; их нужно исправлять по группам, не отключая строгую проверку.

### 3.4 Наблюдаемые ошибки CI и типовые источники дрейфа

Предыдущие проверки обнаружили реальные ошибки, а не только jobs без runner:

- `CognitiveEventFabric.ts` на `feature/feedback` содержит дублирующиеся реализации `verifyOperationalCycle(stageIds)` — это совместимый только случайно конфликт, который мешает TypeScript-компиляции. Нужна одна реализация с явно объединённым контрактом и соответствующими тестами.
- `WorkPass287-unified-cycle-contract.mjs` ожидает, что пустой восстановленный цикл сообщает только `action` как отсутствующий этап, хотя контракт runtime перечисляет все обязательные отсутствующие этапы. Вероятная корректная фиксация — исправить ожидание теста под контракт, если проверка кода подтвердит это, а не ослаблять runtime.
- В feedback-коде ранее обнаруживался некорректный порядок диапазона в regex-классе управляющих символов; такие проверки лучше выполнять через явную проверку code point или корректный literal regex.
- Контракт `minIndependent01` должен иметь ясный default и runtime-валидацию, чтобы optional field не мог превратиться в `undefined` при оценке внешнего подтверждения.
- В `P23LearningEngine` замечено расхождение имени поля `usageGapMs` с ожидаемым `gapMs`; это кандидат на типобезопасную точечную правку после проверки текущего HEAD.
- `MultiSourceLearningMechanisms` в одном из вариантов импортирует `ReplaySelectionOptions` не из того модуля; на ветке learning контракт уже вынесен в `ReplaySelectionPolicy`. Нужно сверять ветки по файлам и истории, а не механически копировать весь файл.

Эти пункты образуют первоочередной список для следующего кодового прохода. Перед каждым исправлением следует проверить current head/blob SHA, чтобы не переписать более свежее исправление, уже находящееся в ветке.

## 4. Оценка готовности

Проценты — **инженерная triage-оценка**, не измерение интеллекта, сознания или готовности к эксплуатации. Они должны меняться только при наличии commit/run/benchmark/release evidence.

| Направление | Оценка на этом срезе | Что требуется для повышения |
|---|---:|---|
| Архитектурный охват организма | 65% | Подтверждение единого runtime цикла и связи всех основных owners |
| Сквозная доказательная цепочка | 45% | Одна identity API от action/outcome до P65/P23 + replay/restore tests |
| Память и provenance | 69% | Отдельный held-out recall/precision benchmark и проверка независимых lineages |
| Самообучение и lifecycle навыков | 62/100 по качественной инженерной оценке | Независимые validation/holdout, реальный learning gain и regression safety |
| Автономная инициатива | 48% | Budgeted heartbeat, устойчивость после рестарта, rate limit и объяснимая причина инициативы |
| Личность и эмоции | 51% | Долгоживущая согласованность SelfModel/affect с реальными решениями |
| Голос/аватар | 46% | Измеренный real-device E2E и interruption recovery |
| Release readiness | 44/100 | Exact-head CI, production build/migrations, browser/device E2E, soak, license review и актуальный Release ZIP |

Невыполнение метрик не означает, что соответствующего кода нет. Оно означает, что у нас нет достаточного подтверждения для заявления о готовности.

## 5. Приоритетный порядок следующих проходов

1. **H4: выбрать и объединить контракт event/receipt identity.** Сверить версии feedback/perception; зафиксировать общий helper и API, сохранить старые snapshots, не допустить двойного подсчёта evidence.
2. **Закрыть compile blockers малыми пачками.** Удалить duplicate implementation, исправить несоответствие теста контракту после подтверждения, очистить regex/optional defaults/imports и P23 field mismatch. После каждой пачки — commit + changelog + статус CI на exact SHA.
3. **Связать identity через владельцев.** Протащить original decision/execution/receipt ID через independent verifier → RealityEvidenceLedger → MemoryOS2/P65 → P23. Добавить tests на retries, changed payload, out-of-order evidence, restart/restore и hostile snapshots.
4. **Проверить обучение, а не количество кандидатов.** Сравнить baseline с candidate на validation/holdout, multiple fixed seeds; запретить promotion при деградации, утечке holdout, слабой независимости источников или невалидном evidence.
5. **Свести категорийные PR по зависимостям.** Сначала shared schemas/evidence identity, затем memory/perception, затем P23 learning/feedback, потом personality/emotions/embodiment, далее experiments and integration. Не мержить большие конфликтующие ветки одним непрозрачным коммитом.
6. **Release gates.** Только после успешной совместной CI, production build+migrations, actual browser/voice/avatar E2E, soak, source/license review и release manifest — собрать и hash-verify свежий ZIP. Пока бинарный asset не заменён и его hash не проверен, релиз считается не обновлённым.

## 6. Правила честного статуса

Для каждого прохода вести раздельно: **код закоммичен**, **тест добавлен**, **тест реально пройден на текущем SHA**, **PR смержен**, **изменение попало в Release ZIP**. Один статус не подразумевает другой. Не называть функциональность автономностью только потому, что есть scheduler; не называть доказательством независимое свидетельство без проверки независимости; не называть поведенческий имитатор доказанным сознанием.

## 7. Проверяемые точки входа

- [Репозиторий NK1](https://github.com/ailtron1ss-rgb/NK1)
- [Feature feedback: evidence identity helper](https://github.com/ailtron1ss-rgb/NK1/blob/feature/feedback/runtime/neuro-kurisu/src/organism/system/EvidenceEventIdentity.ts)
- [Feature memory: P65 epistemic ledger](https://github.com/ailtron1ss-rgb/NK1/blob/feature/memory/runtime/neuro-kurisu/src/organism/memory/P65EpistemicLedger.ts)
- [Feature perception: reality evidence ledger](https://github.com/ailtron1ss-rgb/NK1/blob/feature/perception/runtime/neuro-kurisu/src/organism/system/RealityEvidenceLedger.ts)
- [Feature experiments: runtime typecheck script](https://github.com/ailtron1ss-rgb/NK1/blob/feature/experiments/runtime/neuro-kurisu/scripts/typecheck-runtime.mjs)
- [Hexis adaptation notes on learning branch](https://github.com/ailtron1ss-rgb/NK1/blob/feature/learning/docs/UPSTREAM_HEXIS_ADAPTATION.md)
