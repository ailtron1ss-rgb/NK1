# NK1 Personality / SelfModel — engineering pass 01

**Date:** 2026-10-30  
**Base:** `workpass70-source` at `d8bdf7a14f30d540c1503a436ad993c8d7be8400`  
**Work branch:** `work/personality-selfmodel-evidence-closure-2026-10-30`

## Implemented

### P78 autobiographical evidence boundary

Updated `src/organism/developmental/P78AutobiographicalSelfContinuity.ts` so the autobiographical narrative no longer treats any numeric outcome as verified experience.

- Added optional provenance fields to events: `evidenceStatus`, `evidenceRef`, `authorship`, `episodeId`.
- Legacy event payloads remain accepted, but are conservatively classified as unverified/unknown.
- Only `verified-independent` events with a syntactically bound evidence reference contribute to verified-outcome continuity and turning-point creation.
- Self-authorship changes only when an explicit authorship classification is supplied; `self-initiated` and `self-selected` are distinguished from user-directed/system/unknown episodes.
- Added counters for verified outcomes, unverified outcomes and episodes with known authorship.
- Expanded the idempotency key to include mode, evidence status/reference, authorship and episode ID. This closes the prior case where a mode-only change was invisible to deduplication.
- Added bounded text normalization and finite input filtering at the autobiographical ingress.
- Changed initial continuity/narrative confidence to neutral priors rather than pre-asserting strong continuity before evidence exists.

## Why this matters

The autobiographical self should be a traceable narrative over episodes, not a confidence generator. Previously, arbitrary numeric outcomes could affect continuity and turning points without a provenance link; unknown authorship could be interpreted as agency. This pass makes those assumptions explicit and conservative while retaining backward compatibility for old snapshots and event producers.

## New regression test

`tests/p78-autobiographical-provenance.mjs` covers:
- legacy/unverified outcome handling;
- explicit verified evidence and authorship;
- turning-point admission;
- idempotent replay;
- mode-sensitive deduplication;
- snapshot restore and counter sanitization.

Run from `runtime/neuro-kurisu`:

```bash
node --experimental-strip-types tests/p78-autobiographical-provenance.mjs
npm run typecheck
```

These commands are documented as required checks; they have **not** been executed by this GitHub-only editing pass.

## Not yet claimed

- Runtime producers have not yet been migrated to supply the new provenance fields.
- P78 has not yet been proven wired to the canonical MemoryOS2 / CEF evidence lineage.
- No real-model, browser, Android or long-horizon identity test has been run.
- No Release ZIP has been rebuilt or updated.

## Next implementation slice

1. Trace every P78 producer and map its actual evidence origin.
2. Bind episode IDs to canonical CEF causal IDs and verified outcome receipts.
3. Connect SelfModel prediction/calibration and P2702 trait adaptation to the same evidence identity without introducing a second identity owner.
4. Add restart + contradictory-evidence + self-correction integration tests.
5. Run typecheck and targeted tests on the exact branch SHA before opening a promotion PR.

## Второй инженерный проход: интеграция владельцев состояния

### Единая схема владения

- SelfSubsystemRuntime теперь владеет P2702PersistentPersonalityDynamics и восстанавливает его из facets.advanced.p2702PersistentPersonality.
- SelfModelEngine остаётся единственным экземпляром у MemorySubsystemRuntime; отдельную копию в Self-подсистеме не создавали.
- OrganismSystemFabric создаёт PersonalitySelfModelBridge и соединяет три существующих владельца: P78 (автобиографическая память), P2702 (адаптивные черты/ценности) и SelfModel (предсказание/калибровка/agency).
- PersistenceProjectionCoordinator записывает P2702 в advanced identity projection, чтобы адаптивные черты не сбрасывались после перезапуска.
- Bridge не хранит копию состояния и не выбирает действие. preparePersonalityDecision возвращает сигналы для канонического селектора; recordPersonalityOutcome проводит результат через provenance gate прежде, чем высокоуровневые self-beliefs обновятся.

### Сквозной provenance gate и защита от replay

- В P78 добавлен ограниченный журнал processedEventKeys (до 512 ключей), сохраняемый в snapshot. Он блокирует повтор старого события даже после промежуточных эпизодов и восстановления runtime.
- P78 и bridge признают verified lane только для issuer namespaces world-transition: и external-verification:, а также требуют синтаксически ограниченный evidenceRef без пробелов; legacy и неизвестные issuer остаются unverified. Это allow-list и проверка формы, не криптографическая аутентификация receipt.
- Причина отказа не теряется: синтаксически оформленный, но неподдержанный issuer доходит до SelfModel как неподтверждённый доверенный источник и отклоняется его allow-list.
- Исправлена нормализация управляющих символов/пробелов и строгая проверка evidence reference на пробельные символы.

### Тестовый охват

tests/personality-selfmodel-bridge.mjs проверяет приём разрешённого receipt, отказ неизвестного namespace, единичное обучение P2702, недопуск duplicate replay до downstream learners, replay после рестарта и санитизацию испорченных snapshots.
tests/p78-autobiographical-provenance.mjs дополнен проверкой не соседнего replay после restore, эквивалентности whitespace-normalized событий и отказа evidence reference с пробелами.

## Степень готовности и оставшиеся блокеры

Реализована композиционная интеграция владельцев и persistence path, но пока не заявляется, что основной OrganismCore уже вызывает bridge на каждом фактическом цикле. Ветка предоставляет явные методы через OrganismSystemFabric; следующий этап — найти точный outcome-finalization callsite, связать его с фактическим CEF/causal receipt, а preparePersonalityDecision — с уже существующим этапом формирования candidate scores, не создавая второго selector.

Реальные CEF receipts всё ещё не проверяются cryptographically/against canonical ledger на уровне bridge; namespace allow-list — временная дополнительная защита, а не доказательство подписи. До promotion обязательны typecheck, целевые тесты на точном SHA, restart/contradiction E2E и подтверждение фактического вызова из runtime cycle.

## Третий проход: семантическое обучение личности и защита восстановления

- Исправлена ошибка индексного связывания: раньше исход действия мог изменять черту по совпадающему индексу массива, например respond попадал в sarcasm. Теперь P2702 связывает действие с именованными адаптивными чертами: respond → warmth/directness; explore → playfulness; verify → composure/guardedness; rest → composure; reflect → guardedness; wait → composure/guardedness; defer → composure/directness. Инварианты (например, scientificRigor и truthfulness) этим путём не переписываются.
- P2702 теперь медленно калибрует вектор self-beliefs только на verified lane и только при наличии компактного identityVector; оценки неопределённости сохраняются отдельно. В beforeDecision сравнивается весь доступный вектор, а не только нулевая координата.
- PersonalitySelfModelBridge возвращает объединённый ограниченный actionBias из P2702 и SelfModel (диапазон [-0.10, 0.10]); решение по-прежнему принимает существующий канонический селектор.
- CognitiveSubsystemRegistry проксирует preparePersonalityDecision и recordPersonalityOutcome, когда построен поверх OrganismSystemFabric. Это делает bridge доступным через уже существующую поверхность реестра, но не доказывает, что основной цикл уже вызывает его автоматически.
- SelfModel.learnGoalOutcome защищён от NaN/Infinity в reward и goal alignment.
- P78 restore теперь сбрасывает невалидные/небезопасные счётчики, ограничивает narrative summary и observation key, нормализует сохранённые главы и сохраняет bounded replay ledger.

### Дополнительные регрессии

- Проверяется, что respond обучает warmth/directness, а не sarcasm по совпадению индекса.
- Проверяется, что только независимое подтверждение с разрешённым namespace меняет self-beliefs; неподдержанный namespace не двигает autobiographical belief vector.
- Проверяются конечность результатов при NaN/Infinity и безопасное восстановление P78 snapshots.
- Проверяются объединённые actionBias и их ограниченный диапазон.

### Текущие границы доказанности

- Реальный callsite основного outcome-finalization в OrganismCore остаётся не подтверждённым: большой файл не удалось прочитать через используемый GitHub API-путь. Поэтому bridge API доступен через SystemFabric и CognitiveSubsystemRegistry, но автоматическое участие каждого runtime tick ещё не заявлено.
- Разрешённые namespace-предикаты в bridge являются временным issuer allow-list, а не подписью CEF/receipt. Для полноценного доказательства нужна передача immutable receipt ID и проверка по реальному RuntimeEvidenceBus / RealityLearningGate / ExternalPostconditionVerifier на callsite.
- GitHub Actions должны завершиться на последнем HEAD; промежуточные запуски во время последовательных коммитов отменялись, один промежуточный WorkPass79 запуск упал на unrelated шаге client-disconnect/local-inference. Его нельзя считать результатом проверки последнего HEAD.

## Четвёртый проход: жизненный цикл отношений и полная долговечность P2702

- P2702 теперь сохраняется не только при полной identity materialization, но и в hot persistence projection рядом с P78. Это закрывает путь, при котором быстрое сохранение могло обновить автобиографию, но оставить адаптивные черты на более старом snapshot.
- Обновление relationship trust ограничено 32 ключами, идентификаторы нормализуются NFKC и ограничиваются по длине/control characters; зарезервированные prototype-ключи отклоняются.
- Identity vector теперь сравнивается по всем валидным координатам без сдвига индексов при пропущенном/NaN измерении. В обновлении self-beliefs некорректная координата пропускается, а не превращается в нейтральное наблюдение.
- Добавлены регрессии на bounded relationship map, prototype key rejection и сохранение координат identity vector при пропущенной размерности.

На последнем проверяемом этапе изменённые владельцы состояния по-прежнему остаются единственными: P78 — SelfSubsystemRuntime, P2702 — SelfSubsystemRuntime, SelfModel — MemorySubsystemRuntime. Обе ветви persistence projection теперь включают P2702. Это закрывает разрыв между runtime snapshot и durable projection, но ещё не доказывает правильность фактического outcome-finalization callsite.
