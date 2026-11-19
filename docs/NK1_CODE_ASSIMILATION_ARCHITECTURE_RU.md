# NK1 — Архитектура прямой ассимиляции внешнего кода

**Статус:** архитектурная спецификация / implementation plan; кодовый механизм ассимиляции этим документом не объявляется реализованным.  
**Основа:** `workpass70-source` на SHA `608435493b4af3b4a222d385f1b77d978d18583b`.  
**Рабочая ветка:** `aspect/code-assimilation-foundation-20261102`.  
**Назначение:** превратить внешние репозитории, библиотеки, алгоритмы, модели и программные модули в проверяемые кандидаты расширения NeuroCore, не позволяя непроверенному коду получать полномочия живого организма.

---

## 0. Решение

**Да, NK1 может научиться не только улучшать свои навыки и правила, но и ассимилировать реальные программные компоненты.** Это должно быть отдельным, типизированным продолжением существующей системы обучения, а не загрузкой чужого репозитория непосредственно в работающий процесс.

Правильная модель:

`Обнаружение → Изучение → Происхождение → Карантин → Анализ → Адаптация → Проверка → Shadow → Одобрение → Подключение → Наблюдение → Откат`

Внешний код сначала является *чужим материалом*, затем *кандидатом*, потом *изолированным исполняемым артефактом*, и только после подтверждения становится доступной NK1 возможностью. Сгенерированная моделью реализация, успешная компиляция или тесты, написанные самим донором, не являются достаточным доказательством качества.

Ключевой архитектурный принцип: **NK1 должен поглощать полезную функциональность, но не поглощать чужие полномочия, скрытые предположения и небезопасные механизмы управления.**

## 1. Что уже есть в NK1 и что именно нужно достроить

Инвентаризация source tree на указанном SHA показала:
- 9 946 файлов в дереве репозитория;
- 1 412 файлов тестов в `runtime/neuro-kurisu/tests/`;
- 1 842 npm scripts в runtime manifest;
- отдельные развитые домены cognition, learning, system, core, memory и world.

Это структурные размеры снимка репозитория, а не количество проверенных работающих возможностей.

### 1.1 Уже существующий фундамент обучения

В `runtime/neuro-kurisu/src/organism/learning/` уже существуют:
- `P23LearningEngine.ts` — replay, диагноз ошибок, формирование задач обучения и управляемый жизненный цикл ревизий навыков;
- `P23LocalModelSkillRevisionGenerator.ts` — генерация кандидата локальной моделью с ограничением размера и сохранением структуры исходного payload;
- `VersionedSkillCandidateStore.ts` — версии кандидатов, provenance, подписи одобрения, shadow-evidence, активация и откат;
- `SkillRevisionGate.ts`, `VerifiedSkillPromotion.ts`, `IndependentSkillCandidateEvaluator.ts` — независимая оценка и ограничения продвижения;
- `TrustedSkillShadowRunRegistry.ts`, `HermesVerifiedEvidenceBinding.ts`, `VerifiedOutcomeLedger.ts` — реестр shadow-прогонов, привязка доказательств и учёт исходов;
- P23/Hermes reflective lifecycle и отдельные regression suites.

Особенно важна существующая граница `generateAndStageReflectiveSkillRevision(...)`: генератор получает validation evidence, holdout остаётся скрытым; результат повторно оценивается независимым evaluator; новый payload получает fingerprint и revision provenance; активация вынесена в отдельный этап с shadow evidence и подписанным одобрением.

### 1.2 Чего не следует делать

Не надо:
1. Загружать TypeScript/Python исходники в поле skill payload и выдавать их за обычный навык.
2. Подменять `MemoryOS2`, `ActionGateway`, `OrganismRuntime` или другие канонические владельцы чужой реализацией.
3. Встраивать в процесс NK1 динамический импорт непроверенного кода.
4. Давать генератору доступа к CI secrets, GitHub token, ключам подписания, production storage или host filesystem.
5. Считать тесты из внешнего репозитория независимым подтверждением: донор мог тестировать не ту семантику или иметь слабые проверки.
6. Создавать второй универсальный planner, memory store, tool router или promotion authority.

P23 — доказанный архитектурный образец жизненного цикла кандидатов. Он не должен механически превращаться в хранилище произвольного исполняемого кода: у кода другие границы доверия, сборки, зависимостей и запуска.

## 2. Целевые уровни ассимиляции

Ассимиляция должна быть ступенчатой. Каждый уровень имеет собственные полномочия и отдельные release gates.

| Уровень | Что меняется | Пример | Режим продвижения |
|---|---|---|---|
| L0 — Knowledge | Знания, документация, исследовательские заметки | NK1 изучает алгоритм или API | Через provenance и верификацию источника |
| L1 — Skill | Инструкции, процедуры, сценарии, retrieval templates | Новый навык поиска ошибок | Существующий P23 lifecycle |
| L2 — Adapter | Изолированный адаптер, tool/provider/transport | Новый кодовый adapter к API | Build + contract tests + sandbox + shadow |
| L3 — Component | Самостоятельный модуль с ограниченным API | Новый retrieval reranker или perception module | Полные integration/evaluation/security gates |
| L4 — Core change | Изменение когнитивного цикла, памяти, runtime или модели полномочий | Замена планировщика или owner state | Независимая проверка и обязательное человеческое одобрение |
| L5 — Trust root | Политики, verifier, signing keys, evaluator, bootstrap, release publisher | Изменение механизма, решающего, что безопасно | Не автоматизировать самопродвижение; только контролируемая внешняя процедура |

L0/L1 можно развивать существенно автономнее. L2/L3 допустимо автоматизировать до создания PR и shadow candidate. L4 нельзя автоматически включать в основной runtime. L5 — корень доверия: он должен оставаться вне полномочий самоизменяющегося агента.

Это позволяет NK1 постоянно расширяться, не превращая каждую новую библиотеку в возможность полностью изменить собственный мозг.

## 3. Новая подсистема: Code Assimilation Layer

Целевые логические компоненты:

### 3.1 `CodeSourceIntake`

Принимает источник:
- Git repository + immutable commit SHA;
- release archive + SHA-256;
- package registry coordinate + exact version + integrity;
- paper/dataset/model artifact с отдельными provenance и license records;
- локально предоставленный пользователем архив.

Обязательные поля: canonical source URI, owner/publisher, immutable revision, retrieval time, source content hash, declared license, upstream notices, source lineage key. Ссылки на плавающие ветки `main`, `latest` и незакреплённые package versions не могут быть единственным идентификатором кандидата.

Для Git-репозитория сохранять commit SHA и tree SHA. Для ZIP/TAR — digest самого архива и digest распакованного дерева. Для пакета — registry, имя, версия, lockfile integrity и resolved dependency graph.

### 3.2 `SourceProvenanceLedger`

Связывает:
- исходный URL и владельца;
- точную ревизию;
- файлы и их хеши;
- license/NOTICE/COPYING records;
- upstream commit lineage;
- авторство/подписи/attestations при наличии;
- изменения, внесённые NK1;
- результирующие адаптеры и артефакты.

Система должна уметь ответить на вопрос: **какая именно внешняя реализация повлияла на конкретный компонент NK1, что было скопировано, что переписано, что изменено и кем/когда это было проверено?**

Неизвестное происхождение — самостоятельный статус, а не автоматически доверенный источник.

### 3.3 `CodeComponentManifest`

Каждый кандидат описывается типизированным manifest:

| Поле | Назначение |
|---|---|
| componentId / version | Стабильная идентичность компонента и его ревизии |
| sourceRevision | Immutable commit/tree/archive digest |
| capability | Какую конкретную возможность он добавляет |
| interfaceVersion | Версия контракта взаимодействия с NK1 |
| language / runtime | Язык, target runtime и ABI |
| dependencyLock | Точные прямые и транзитивные зависимости |
| licenseEvidence | Лицензия, NOTICE, ограничения использования |
| sbomFingerprint | Хеш SBOM |
| buildProvenance | Кто/где/из чего собрал артефакт |
| permissions | Минимальные capability, доступные компоненту |
| resourceBudget | CPU, RAM/VRAM, disk, latency, network |
| tests / evaluator | Список обязательных независимых проверок |
| rollbackTarget | Текущая версия и способ возврата |
| lifecycleStatus | Текущее состояние кандидата |

Manifest не должен принимать поля с произвольным исполняемым callback или ссылкой на изменяемый branch как доказательство происхождения.

### 3.4 `AssimilationPlanner`

Сопоставляет требуемую NK1 возможность с текущим graph зависимостей и capability registry. На каждый источник формирует решение:
- reuse existing component;
- wrap with adapter;
- port a small isolated algorithm;
- rewrite from specification;
- combine several compatible sources;
- reject / research-only.

Ключевой вопрос: **какой конкретный дефицит NK1 устраняет этот код?** Если компонент дублирует существующего owner, увеличивает сложность или не может пройти независимую оценку, он не ассимилируется.

### 3.5 `QuarantineBuilder` и `SandboxRunner`

Всё, что пришло извне, рассматривается как враждебный ввод, включая README, конфигурацию, тесты, комментарии, package lifecycle scripts и подсказки внутри исходников.

Нужны:
- ephemeral isolated workspace, не имеющий доступа к основному checkout;
- read-only snapshot базовой ревизии и отдельный writable overlay;
- no secrets, no credential mounts, no production database;
- network egress deny-by-default, allowlist только для конкретных package registries или test endpoints;
- CPU/RAM/disk/process/time limits;
- запрет привилегированных контейнеров и host Docker socket;
- запрет изменения CI policy, governance hooks, MCP/tool config и файлов trust root;
- очистка окружения после выполнения и сохранение только подписанных/хешированных результатов.

Один только Docker не считается достаточной границей, если agent получает host mounts, секреты, широкую сеть или привилегированные права. Для реально недоверенного кода предпочтительна microVM/WASM или другой механизм усиленной изоляции.

### 3.6 `ComponentContractAdapter`

Связывает внешний компонент с текущей архитектурой NK1 через стабильные порты. Внешний компонент не получает прямого доступа к внутренним объектам `OrganismState`, памяти, ActionGateway и другим mutable owners.

Внешние интерфейсы должны использовать versioned DTO и явные envelopes:
- interactionId, eventId, causationId;
- schemaVersion и componentVersion;
- source/provenance/confidence;
- deadline/cancellation;
- privacyClass;
- resource budget;
- resultStatus и evidenceRefs.

Адаптер нормализует ошибки, таймауты, отмену, idempotency и события жизненного цикла. Для долгоживущих интеграций нужны capability-scoped permissions и обратная совместимость.

## 4. Жизненный цикл `CodeComponentCandidate`

Статусы:

`discovered → researched → quarantined → provenance-checked → analyzed → adapted → built → tested → shadow → staged → approved → active`

Альтернативные терминальные/контрольные статусы:
- `research-only`;
- `rejected`;
- `blocked-license`;
- `blocked-security`;
- `blocked-contract`;
- `blocked-regression`;
- `rolled-back`;
- `superseded`.

Нельзя перепрыгивать через состояния. Каждый переход пишет immutable event с actor, timestamp, exact input/output fingerprint, verifier identity и reason. Restore валидирует историю и не восстанавливает статус active только по текстовому полю в snapshot.

### 4.1 Intake и происхождение

1. Получить конкретный immutable источник.
2. Проверить canonical identity, размер архива, типы файлов, traversal paths, symlink policy, nested archives и архивные bomb лимиты.
3. Сохранить digest исходника и распакованного дерева.
4. Получить все license/NOTICE/COPYING и происхождение зависимостей.
5. Разрешить зависимости только в pinned lockfile и сформировать SBOM.
6. Проверить уязвимости и supply-chain metadata.
7. Оставить неизвестные или юридически неразрешённые элементы в research-only.

Наличие `LICENSE` в репозитории не означает, что лицензия покрывает все assets, model files, bundled datasets, vendored code и trademarks.

### 4.2 Техническая пригодность

1. Сопоставить API, runtime, ABI и поддерживаемые платформы.
2. Построить dependency/call graph.
3. Найти параллельных владельцев в NK1 и исключить двойное состояние.
4. Измерить базовую функциональность и стоимость.
5. Выбрать адаптер, порт или переписывание.
6. Зафиксировать конкретную гипотезу улучшения до генерации патча.

### 4.3 Сборка и независимая проверка

Проверки делятся на независимые слои:

| Проверка | Что должна доказать |
|---|---|
| Static/type analysis | Корректная структура, типы и опасные конструкции |
| Build reproducibility | Точная воспроизводимая сборка |
| Contract tests | Соблюдение API/ABI и семантики NK1 |
| Security tests | Запрет выхода из sandbox, секретов, лишних прав и опасных side effects |
| Regression tests | Все защищённые ранее сценарии продолжают работать |
| Differential tests | Изменение результата объяснимо и корректно |
| Independent capability evaluation | Новая возможность действительно решает исходную задачу |
| Performance/soak | Latency, RAM, CPU, ошибки, утечки и recovery в целевой среде |
| Provenance/license review | Источник и права на использование/распространение подтверждены |

Донорские тесты можно запускать, но они не заменяют внешние contract tests и hidden NK1 evaluation. LLM-as-a-judge используется только как вспомогательный сигнал, а не финальная authority для активации.

### 4.4 Shadow и promotion

Shadow candidate выполняется без права менять canonical state или производить внешние side effects. Он получает тот же вход, что и текущий компонент, а результаты сравниваются по заранее определённой метрике.

Promotion разрешается только когда:
- все обязательные тесты прошли на exact candidate fingerprint;
- independent evaluator подтверждает улучшение относительно baseline;
- нет критических regressions и превышения budget;
- provenance, license и SBOM complete;
- permission set не превышает одобренный контракт;
- active version и candidate version связаны compare-and-swap;
- есть подписанный approval для соответствующего уровня риска;
- rollback target проверен и доступен.

Для L2/L3 можно автоматизировать подготовку promotion request. Активация в production — отдельная операция, не побочный эффект генерации кандидата.

## 5. Как связать с P23, Hermes и Hexis

### 5.1 P23 — не заменить, а расширить границы

Существующие P23 интерфейсы ориентированы на reflective skill payload и его evidence lifecycle. Сохраняем их для L1.

Для L2/L3 нужен отдельный `CodeComponentCandidateStore`, но повторно используем доказавшие полезность идеи:
- immutable candidate version;
- exact payload fingerprint;
- revision provenance;
- independent evaluator;
- verified shadow observation;
- signed promotion/rollback approval;
- durable lifecycle journal;
- restore integrity и CAS activation.

Переиспользовать можно общие trust-boundary, evidence-envelope и evaluator-паттерны. Нельзя смешивать source code и обычные skills в одном необязательном JSON поле или в одном namespace без строгой типизации.

### 5.2 Hermes и reflective learning

Hermes-подобный цикл должен находить повторяющуюся неудачу, формировать план изменения, собирать evidence и генерировать небольшой candidate patch. Он не должен сам выбирать себя независимым судьёй.

GEPA/DSPy можно применять к генерации адаптеров, инструкций и процедур на validation данных. Итоговый код всё равно проверяется отдельным deterministic build/contract harness.

### 5.3 Hexis / MemFS / continuity

Из Hexis полезны:
- provenance и lineage фактов;
- обратимая история изменений;
- source-aware correction;
- энерго/бюджетная очередь обучения;
- review queue для новых убеждений/навыков.

Кодовый candidate, его результат и причина принятия становятся эпизодом развития NK1. Но Hexis не создаёт второй runtime brain и не получает финальную власть над identity, memory или action policy.

## 6. Архитектура данных и событий

Минимальные типизированные сущности:

- `CodeSourceArtifact`: immutable origin and artifact digests;
- `CodeComponentManifest`: declared capability, interface, dependencies, license, SBOM and permissions;
- `AssimilationHypothesis`: failure/gap, predicted gain, falsifier, metrics;
- `CodePatchCandidate`: exact diff, base SHA, output tree SHA, payload fingerprint;
- `BuildAttestation`: builder identity, environment, inputs, output digests;
- `ComponentAssessment`: test matrix, evaluator identity, metrics, confidence and blocked reasons;
- `ShadowObservation`: exact input, candidate/baseline result references and verified outcome;
- `PromotionApproval`: signed approval bound to component, version, permissions and target environment;
- `RollbackReceipt`: restored version, reason and verification evidence.

Lifecycle event envelope:
`schemaVersion, eventId, componentId, candidateId, sourceRevision, baseRuntimeSha, candidateFingerprint, occurredAt, actor, transition, evidenceRefs, reasonCodes, riskClass`.

Ключи идентичности должны включать исходную ревизию, а не только название пакета. Идемпотентность предотвращает повторное поглощение одного и того же источника при повторном поиске, а новый source digest создаёт новую ревизию lineage.

## 7. Интеграция в единый когнитивный цикл

Ассимиляция должна быть частью внутренней деятельности организма, но не должна выполнять каждую стадию при каждом tick.

Предлагаемый маршрут:

1. **Perceive:** зафиксировать дефицит способности или повторяющуюся ошибку.
2. **Appraise:** оценить значимость, confidence, urgency, privacy, risk и resource cost.
3. **Plan:** сформулировать гипотезу и определить минимальный внешний компонент.
4. **Explore:** найти источники и сравнить их происхождение, качество, API, license и стоимость.
5. **Assimilate:** построить адаптер/кандидат в quarantine.
6. **Verify:** отдельная независимая оценка и тесты.
7. **Shadow:** проверить на реальных входах без side effects.
8. **Consolidate:** сохранить решение, evidence и причинную связь в памяти.
9. **Reflect:** обновить SelfModel о собственных возможностях и ограничениях только на основании подтверждённого результата.

Каждая фаза может ответить `defer` или `reject`. Самообучение не означает, что нужно непрерывно импортировать библиотеки. Система должна выбирать полезные изменения по value-of-information / expected utility и бюджету.

## 8. Важные ограничения и защита от самоповреждения

Threat model должен включать:
- prompt injection в README, issue, code comments и web pages;
- typosquatting, dependency confusion и compromised maintainer;
- malicious package install scripts;
- poisoned tests и hidden network behavior;
- exfiltration через DNS/HTTP и логи;
- archive path traversal, symlink escape, decompression bombs;
- test harness tampering и benchmark leakage;
- model-generated code that weakens its own tests or permission checks;
- restore/snapshot poisoning;
- confused-deputy через расширенные MCP/tool permissions;
- irreversible migrations и destructive actions.

Неподвижными trust anchors должны оставаться: независимый verifier, signing identity, release publisher policy, required CI workflows и protected branch rules. Самоизменяющийся runtime не может переписать собственную процедуру оценки и затем объявить себя прошедшим проверку.

Критические изменения требуют двух независимых ролей: автор кандидата и verifier/approver. Один LLM не должен одновременно генерировать, оценивать и разрешать свой код.

## 9. Метрики ассимиляции

Считать нужно не число импортированных репозиториев, файлов или строк, а ценность и риск.

| Метрика | Что измерять |
|---|---|
| Capability gain | Δ task success на независимых задачах |
| Generalization | Перенос на неизвестные задачи/источники/контексты |
| Regression cost | Доля ухудшенных защищённых семейств |
| Integration cost | Количество адаптеров, конфликтов и ручных обходов |
| Reliability | Failure, crash, restart and rollback success |
| Security | Sandbox escapes = 0; unauthorized side effects = 0 |
| Performance | p50/p95 latency, CPU, RAM/VRAM, disk and battery |
| Provenance completeness | 100% активных компонентов имеют точную lineage |
| License readiness | 100% активных компонентов имеют явное правовое решение |
| Maintenance debt | Обновления, уязвимости и owner для каждого активного компонента |
| Time-to-capability | Время от зафиксированного дефицита до проверенной возможности |
| Rollback time | Время и успешность возврата к предыдущей версии |

Для promotion целевой порог — положительное улучшение по pre-registered primary metric, не худшее качество на protected regression families и отсутствие критических security/license gaps. Статистический gate определяется видом задачи и числом независимых групп/seed; нельзя автоматически переносить пороги P23 reflective skill на любой software component.

## 10. Поэтапный план реализации

| Фаза | Работа | Выход | Gate |
|---|---|---|---|
| A0 | Source/PR baseline, owner map, trust-root inventory | immutable architecture baseline | Нет неподтверждённых owners |
| A1 | Contracts и manifest | типизированные CodeSource / Candidate / Assessment | schema + adversarial tests |
| A2 | Provenance, license, SBOM, vulnerability intake | source evidence bundle | missing provenance → research-only |
| A3 | Quarantine/sandbox and resource governor | isolated build/test runner | no secrets, egress denied, limits enforced |
| A4 | Adapter SDK + component registry | versioned capability adapters | contract tests pass |
| A5 | Independent evaluator + hidden regression harness | baseline/candidate comparison | holdout isolation verified |
| A6 | Shadow execution + signed promotion | staged component lifecycle | verified receipt and approval |
| A7 | Rollback/restart recovery + observability | reversible production activation | crash/rollback drill |
| A8 | Cognitive-loop wiring | self-identified capability gaps drive assimilation | traceable Perceive→Reflect cycle |
| A9 | Controlled open-ended evolution | bounded continuous component discovery/repair | long soak and cost/security gates |

### Разделение аспектных веток

Не смешивать все изменения в одной ветке:

- `aspect/code-assimilation-contracts` — типы, manifest, validation;
- `aspect/code-provenance-sbom` — source lineage, licenses, SBOM, vulnerabilities;
- `aspect/code-sandbox-runner` — isolation, process/VM, resource budgets;
- `aspect/code-adapter-registry` — ports, adapters, activation;
- `aspect/code-independent-eval` — contract/differential/holdout evaluation;
- `aspect/code-shadow-promotion` — receipts, signed approval, rollback;
- `aspect/code-cognitive-integration` — связь с OrganismRuntime и P23.

Ветки создаются от одного актуального source SHA или ребейзятся последовательно; нельзя сливать разветвлённые истории `main` в source line. Каждый PR — отдельный измеримый аспект с tests, CHANGELOG и точным evidence report. Не удалять старые ветки до проверки содержимого и lineage.

## 11. Первые конкретные тесты

До первого реального импорта в production candidate lifecycle должны существовать:

1. Нельзя импортировать источник без immutable SHA/digest.
2. Archive traversal, symlink escape и zip bomb отклоняются.
3. Package lifecycle script не выполняется вне sandbox.
4. Кандидат не читает secrets и host config.
5. Sandbox не имеет произвольного network egress.
6. Кандидат не может менять trusted CI policy, verifier или signing key.
7. Поддельный SBOM/attestation не проходит verify.
8. Несовпадение tree digest блокирует build provenance.
9. Тесты донора не дают independent evaluator authority.
10. Patch не может удалять protected tests или снижать security gates.
11. Candidate не активируется при незаполненном license decision.
12. Candidate не активируется без независимого положительного результата.
13. Повторная регистрация source revision идемпотентна.
14. Повреждённый persisted lifecycle snapshot не восстанавливает candidate как active.
15. Ошибка activation не приводит к частичной замене active registry.
16. Откат восстанавливает exact previous component version и проверяет её health.
17. После restart не происходит повторного запуска внешнего side effect.
18. Component over-budget отключается без повреждения основного runtime.

## 12. Привязанные к NK1 ограничения текущего baseline

На source SHA `608435493b4af3b4a222d385f1b77d978d18583b`:
- P23 skill lifecycle уже существует; code assimilation должен быть отдельным typed lifecycle.
- `ResearchSourceLineage` предоставляет базовую идентификацию источников, но его собственное описание ограничивает near-duplicate detection lexical/content identity; этого недостаточно для доказательства авторства или лицензии.
- `ActionGateway` остаётся единственным шлюзом внешних side effects.
- `MemoryOS2`/MemoryFabric остаются canonical memory owners.
- `OrganismRuntime` остаётся точкой композиции жизненного цикла.
- Текущий source checkpoint и опубликованный Release расходятся: последний Release/Hotfix опубликован 19 октября 2026 года; этот проектный план не утверждает, что текущий source уже попал в ZIP.
- Release license manifest имеет статус `pending`; root project `NOASSERTION`, runtime `LicenseRef-NK1-Private-All-Rights-Reserved`, redistributionApproved=false. Это отдельный blocker для повторного распространения, не мешающий изучать идеи, но запрещающий автоматически считать архивы/код/активы разрешёнными к публикации.

## 13. Критерий успеха

Ассимиляция считается работающей не тогда, когда NK1 скачивает репозиторий или пишет новый файл, а когда он может:

1. Сам обнаружить измеримый пробел в своих возможностях.
2. Обосновать, почему внешний источник лучше текущего решения.
3. Зафиксировать точную lineage и права.
4. Извлечь только нужную функциональность и адаптировать её к существующим owners.
5. Скомпилировать и выполнить кандидат в изоляции.
6. Независимо доказать улучшение и отсутствие критической регрессии.
7. Подключить кандидат с ограниченными полномочиями и откатом.
8. Позже обнаружить регрессию, безопасно вернуть предыдущую версию и объяснить причину.

Только такой механизм является **реальной ассимиляцией программной способности**, а не автоматическим копированием чужого кода.

## 14. Внешние стандарты и исследовательская база для реализации

Ссылки — отправные точки для адаптации и обязательной проверки актуальных версий перед кодированием:
- SLSA — provenance and build integrity: https://slsa.dev/
- in-toto — verifiable software supply-chain steps: https://in-toto.io/
- Sigstore — artifact signing and verification: https://docs.sigstore.dev/
- SPDX — license and component metadata: https://spdx.dev/
- CycloneDX — SBOM and component analysis: https://cyclonedx.org/
- OSV — vulnerability database/API: https://osv.dev/
- OpenSSF Scorecard — automated project security signals: https://scorecard.dev/
- NIST SSDF — secure software development practices: https://csrc.nist.gov/Projects/ssdf
- Self-Evolving Coding Agents survey (2026): https://arxiv.org/abs/2608.03392

Эти стандарты дополняют, но не заменяют NK1-specific trust boundaries и independent evaluation.

---

**Ограничение статуса:** этот документ задаёт архитектуру и фазы реализации. Он не утверждает, что Code Assimilation Layer, sandbox runner, SBOM pipeline или production promotion уже существуют. Следующий инженерный этап — реализовать A1 (contracts + manifest + state-machine tests), затем A2; sandbox должен появиться до запуска первого недоверенного внешнего build или test.


## 15. Реальный статус реализации на 2026-11-02

Статусы ниже относятся к отдельным aspect PR и их exact-head CI, а не к включению в канонический `workpass70-source` или опубликованный Release.

| Слой | Артефакт | Фактический статус | Evidence |
|---|---|---|---|
| Архитектурный дизайн | PR #655, этот документ | `IMPLEMENTED / DOCUMENTED`, `NOT MERGED` | [PR #655](https://github.com/ailtron1ss-rgb/NK1/pull/655) |
| A1 — immutable intake/contracts | `CodeAssimilationContracts.ts`, lifecycle state machine, adversarial tests и отдельный workflow | `IMPLEMENTED / TESTED`, `NOT MERGED` | PR #657 exact HEAD `09050535e2ad2445c63e90b77a7b83f505e9a1a3`; 12/12 checks success: [PR #657](https://github.com/ailtron1ss-rgb/NK1/pull/657) |
| A2 — signed evidence | `CodeAssimilationEvidence.ts`: Ed25519 evidence, issuer roles, exact source/material binding, scoped license decisions, deeply immutable receipts and candidate-bound permission checks | `IMPLEMENTED / TESTED`, `NOT MERGED` | PR #659 exact HEAD `36d2a23bb7040c0432da28d72a68ac93d4dcb943`; 3/3 checks success: [PR #659](https://github.com/ailtron1ss-rgb/NK1/pull/659) |
| A2 — runtime typecheck | Pinned app compiler + `runtime typecheck` в dedicated workflow | `TESTED` | PR #659 workflow `NK1 code assimilation signed evidence` завершился success |
| A2 — P23/Hermes compatibility | WorkPass110 continual-learning and verified-skill lifecycle regression | `TESTED` | PR #659 workflow `WorkPass110 continual learning metrics` завершился success |
| A3 — quarantine/sandbox | Isolated execution/build runner, secrets/network/resource boundary | `PLANNED / NOT IMPLEMENTED` | No runtime runner or sandbox is claimed |
| A4 — adapter SDK/registry | Component registration and canonical owner integration | `PLANNED / NOT IMPLEMENTED` | No component registry is claimed |
| A5 — independent code evaluation | Contract/differential/hidden holdout and security evaluation | `PLANNED / NOT IMPLEMENTED` | Current A2 verifier validates signed attestations; it does not independently run or assess code quality |
| A6–A9 — shadow, promotion, rollback and autonomous loop | Candidate execution, host approval, release, cognitive discovery and long-soak | `PLANNED / NOT IMPLEMENTED` | Skill promotion from P23 is not yet general code-component promotion |

**Important:** PR #659 is stacked on the A1 PR branch, whose base is the A1 exact-head SHA. PR #657 and PR #659 are both still open draft PRs and neither has been merged into `workpass70-source`. No code-assimilation feature is part of a published ZIP on the basis of these PRs. A1/A2 are tested development artifacts, not yet canonical production capability.

The A2 trust boundary is deliberately narrow: an Ed25519 signature establishes that a trusted key signed a particular source/evidence envelope. The authenticated license receipt is process-local, its nested permissions are deeply immutable, and every use check must supply the exact expected candidate fingerprint; a receipt for one component cannot authorize another. It does not prove that the SBOM scanner is correct, that a build is free of malware, or that a human license review is legally correct. Active production use still requires independent key management, signed attestations, SBOM generation, vulnerability evaluation, the A3 sandbox, independent A5 evaluation and the A6 approval gate.
