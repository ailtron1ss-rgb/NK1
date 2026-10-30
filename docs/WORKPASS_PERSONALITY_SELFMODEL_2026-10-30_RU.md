# NK1 Personality / SelfModel — engineering pass 01

**Date:** 2026-10-30  
**Base:** `workpass70-source` at `d8bdf7a14f30d540c1503a436ad993c8d7be8400`  
**Work branch:** `work/personality-selfmodel-evidence-closure-2026-10-30`

## Implemented

### P78 autobiographical evidence boundary

Updated `src/organism/developmental/P78AutobiographicalSelfContinuity.ts` so the autobiographical narrative no longer treats any numeric outcome as verified experience.

- Added optional provenance fields to events: `evidenceStatus`, `evidenceRef`, `authorship`, `episodeId`.
- Legacy event payloads remain accepted, but are conservatively classified as unverified/unknown.
- Only `verified-independent` events whose `evidenceReceiptId` is an exact RuntimeEvidenceBus `outcome` ID, whose tick matches the event, and whose `evidenceRef` equals `external-verification:${evidenceReceiptId}` contribute to verified continuity and turning-point creation.
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

- Initial checkpoint only: the first P78 producers had not yet been migrated. The later runtime pass now forwards the exact RuntimeEvidenceBus outcome ID from `OrganismRuntime` through `LearningProvenance` and `OrganismCore` into P78; a complete inventory of every legacy/non-Core producer remains pending.
- P78 is now bound to the exact RuntimeEvidenceBus outcome event ID. Independent attestation against the canonical CEF ledger/provider receipt remains pending; exact event-ID equality is not a cryptographic signature.
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
- P78 verified lane теперь принимает только пару `evidenceReceiptId=reb:<tick>:<sequence>:outcome` и `evidenceRef=external-verification:<тот же ID>`, с совпадающим tick и явным `verified-independent`. Legacy, simulation, неизвестные issuer, чужой tick и несовпадающие ID остаются unverified. Это проверка идентичности runtime-события, но не криптографическая аттестация CEF/provider.
- P78, bridge, SelfModel и P2702 независимо проверяют точную привязку receipt ID/tick/reference перед повышением автобиографических убеждений, стабильных ценностей, доверия и autobiographicalStrength. Поведенческие привычки получают только ограниченное evidence-weighted обучение без такого receipt.
- Исправлена нормализация управляющих символов/пробелов и строгая проверка evidence reference на пробельные символы.

### Тестовый охват

tests/personality-selfmodel-bridge.mjs проверяет приём разрешённого receipt, отказ неизвестного namespace, единичное обучение P2702, недопуск duplicate replay до downstream learners, replay после рестарта и санитизацию испорченных snapshots.
tests/p78-autobiographical-provenance.mjs дополнен проверкой не соседнего replay после restore, эквивалентности whitespace-normalized событий и отказа evidence reference с пробелами.

## Степень готовности и оставшиеся блокеры

Историческая отметка первого integration pass; она superseded пятым проходом ниже. Текущий bridge подключён к candidate-scoring и общему `OrganismCore.feedback` path. Остающийся пробел — проверка immutable receipt против канонического CEF/provider ledger, а не отсутствие Core callsite.

RuntimeEvidenceBus ID проверяется на точное совпадение между runtime, P78, bridge, P2702 и SelfModel, но не подписывается и не сверяется с каноническим CEF/provider receipt ledger. До promotion остаются обязательными typecheck и целевые тесты exact HEAD, restart/contradiction E2E и CI на синхронизированной базе.

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

- Историческая отметка раннего этапа; superseded пятым проходом: decision-time и feedback-time вызовы bridge размещены в `OrganismCore`.
- Exact RuntimeEvidenceBus outcome ID теперь передаётся по runtime → Core → P78/bridge/P2702/SelfModel. Следующее усиление — проверка ID и provider evidence по каноническому CEF/OutcomeCognitionFabric revision ledger; текущее совпадение ID не заменяет подпись/attestation.
- GitHub Actions должны завершиться на последнем HEAD; промежуточные запуски во время последовательных коммитов отменялись, один промежуточный WorkPass79 запуск упал на unrelated шаге client-disconnect/local-inference. Его нельзя считать результатом проверки последнего HEAD.

## Четвёртый проход: жизненный цикл отношений и полная долговечность P2702

- P2702 теперь сохраняется не только при полной identity materialization, но и в hot persistence projection рядом с P78. Это закрывает путь, при котором быстрое сохранение могло обновить автобиографию, но оставить адаптивные черты на более старом snapshot.
- Обновление relationship trust ограничено 32 ключами, идентификаторы нормализуются NFKC и ограничиваются по длине/control characters; зарезервированные prototype-ключи отклоняются.
- Identity vector теперь сравнивается по всем валидным координатам без сдвига индексов при пропущенном/NaN измерении. В обновлении self-beliefs некорректная координата пропускается, а не превращается в нейтральное наблюдение.
- Добавлены регрессии на bounded relationship map, prototype key rejection и сохранение координат identity vector при пропущенной размерности.

На последнем проверяемом этапе изменённые владельцы состояния по-прежнему остаются единственными: P78 — SelfSubsystemRuntime, P2702 — SelfSubsystemRuntime, SelfModel — MemorySubsystemRuntime. Обе ветви persistence projection теперь включают P2702. Это закрывает разрыв между runtime snapshot и durable projection, но ещё не доказывает правильность фактического outcome-finalization callsite.

## Пятый проход: включение в фактический decision → action → feedback цикл

- ОрганизмRuntime теперь передаёт в Core ID именно того outcome-event, который он только что опубликовал в RuntimeEvidenceBus. LearningProvenance расширен необязательным evidenceReceiptId; для simulation этот ID не передаётся.
- OrganismCore очищает receipt ID, формируя нормализованный learning context, и на фактическом feedback path после P31–P34 вызывает OrganismSystemFabric.recordPersonalityOutcome. Bridge принимает событие P78, отсекает replay и только после этого обновляет P2702 и единственный SelfModel.
- Высокий автобиографический verified-lane теперь требует одновременно: external source, наличие фактического RuntimeEvidenceBus outcome event ID, verified01 ≥ 0.85, independent01 ≥ 0.80, evidence01 ≥ 0.72, consequence01 ≥ 0.70 и identityUpdateScale01 ≥ 0.45. Всё остальное остаётся observed/unverified и не создаёт verified turning point/self-belief update.
- В candidate scoring канонического OrganismCore один раз на decision подготавливается PersonalitySelfModelBridge; его ограниченный actionBias добавляется небольшим коэффициентом в spine-only и full scoring. Финальный выбор остаётся в прежнем candidate arbitration/selector, отдельный personality selector не создаётся.
- Добавлен статический regression guard personality-selfmodel-runtime-wiring.mjs: он защищает связь RuntimeEvidenceBus → LearningProvenance → OrganismCore candidate scoring/feedback → Fabric bridge → persistence projection от случайного отключения.

Это закрывает ранее не подтверждённый разрыв «мост доступен, но не вызывается из основного цикла»: сейчас вызов установлен прямо в общем OrganismCore.feedback path, а decision bias — до построения candidate scores. При этом receipt ID подтверждает происхождение события в runtime evidence bus и проходит сильные числовые пороги RealityLearningGate, но не является криптографической подписью физического результата; CEF ledger attestation и независимая проверка provider receipt остаются отдельным повышающим доверие этапом.

## Шестой проход: явные размерности self-beliefs и стойкость unified self-state

- P2702 получил схему имён восьми self-belief осей: continuity, coherence, agency, reality-grounding, stability, goal-continuity, memory-continuity, authorship-continuity. Теперь compact identity vector в мосте документированно соответствует координатам, а не является безымянным массивом.
- P80UnifiedSelfState получил полноценную санитизацию restore: допустимые режимы и действия, конечные bounded metrics/counters, ограниченные историю действий и текстовое основание, безопасный fallback на старые/повреждённые snapshots.
- P80 update нормализует вход tick/action/mode и все основные скаляры, ограничивает счётчики, не допускает неизвестные режимы/действия в текущую историю. Исправлен знак reality-gap в coherence: рост разрыва с реальностью не должен искусственно повышать внутреннюю согласованность.
- Добавлен регрессионный тест на corrupted P80 snapshot и некорректный runtime input.

### Реальный runtime callsite

В OrganismCore установлен decision-time вызов personality bridge перед построением candidate scoring; небольшая ограниченная добавка actionBias входит и в spine-only score, и в полный rawUtility. На feedback-time вызов recordPersonalityOutcome расположен в ветке реального выбранного действия после P31–P34 и получает именно тот evidence event ID, который OrganismRuntime передал из RuntimeEvidenceBus.

## Седьмой проход: независимые receipt gates, динамика ценностей и измеримая личность

### Точное происхождение эпизода

- P78 verified ingress требует event-owned `evidenceReceiptId` вида `reb:<tick>:<sequence>:outcome`, совпадения tick и точного `evidenceRef=external-verification:<тот же ID>`, а также числовых порогов verified ≥ 0.85, independent ≥ 0.80, evidence ≥ 0.72, consequence ≥ 0.70 и identityUpdateScale ≥ 0.45. Receipt ID включён в replay/event signature как immutable episode identity; изменённый payload с тем же ID не создаёт новый эпизод. Observation batch сериализуется структурно через JSON, без неоднозначных текстовых разделителей.
- `PersonalitySelfModelBridge` повторно сверяет caller receipt с event-owned receipt ID, форматом, kind и tick и передаёт в downstream learners те же числовые показатели. SelfModel независимо проверяет receipt/reference/tick и каждый quality threshold, включая identityUpdateScale ≥ 0.45, непосредственно перед identity/agency write.
- P2702 `afterOutcome` получил внутренний receipt gate: stable values, relationship trust, self-beliefs и autobiographicalStrength меняются только при точной receipt/reference/tick паре и одновременно сильных показателях verified/evidence/independence/consequence плюс identityUpdateScale ≥ 0.45. Прямой вызов P2702 с искусственными `verified=1` и `evidence=1` без receipt либо с низким identityUpdateScale не повышает эти высокоуровневые состояния.
- Поведенческие привычки остаются обучаемыми по ослабленному evidence-weighted сигналу; это позволяет использовать симуляцию и неполную обратную связь для ограниченного обучения, но не превращать её в доказательство собственной идентичности или доверия к человеку.

### Семантические ценности и напряжения характера

- P2702 восстанавливает инварианты, адаптивные черты и ценности по canonical semantic names из кода, а не по snapshot array position. Relationship trust при restore нормализуется NFKC, фильтруется по control characters/reserved prototype keys и ограничивается 32 идентификаторами.
- Пять напряжений из KurisuCanonProfile стали живыми состояниями: truth ↔ relationship comfort; autonomy ↔ cooperation; skepticism ↔ curiosity; composure ↔ vulnerability; science ↔ privacy. Они влияют на небольшие action priors для verify/reflect/respond, не создавая отдельного selector.
- P2702 action priors теперь учитывают значения truth/science/curiosity, earned relationship trust, privacy и loyalty. Это ограниченное влияние на существующую оценку кандидатов, не самостоятельный выбор действия.
- Измеряемый `drift01` рассчитывается по отклонению адаптивных черт/ценностей от canonical initialization prior; `autobiographicalStrength01` растёт только от подтверждённых независимых эпизодов.
- `diagnostics()` выдаёт именованные invariants, traits, values, tensions, relationshipTrust, selfBeliefs/selfUncertainty, stability, drift и autobiographicalStrength.

### Усиленные регрессии и сохранение

- Тесты проверяют обход P2702 напрямую без receipt, несовпадающий event/caller receipt, wrong tick, unknown issuer, недостаточное качество evidence и низкий identityUpdateScale на P78/SelfModel/P2702, immutable receipt replay с изменённым payload, восстановление canonical trait mapping, NFKC-дубликаты и опасные relationship keys, доказательную изоляцию stable values/trust/self-beliefs, value-sensitive/relationship-sensitive action bias и named tension/self-belief diagnostics.
- PersistenceProjectionCoordinator содержит по одной записи P2702 в identity materialization и hot sync. Дублирующая запись, появлявшаяся во время предыдущей правки, удалена.
- CI продолжает запускать `npm run test:personality`; новый exact HEAD пока не имеет подтверждённого Actions результата. Поэтому тесты не объявляются прошедшими.

### Ограничения после этого прохода

- RuntimeEvidenceBus event ID детерминирован и проверяется на точное равенство; он не подписан. Нужна независимая проверка против canonical CEF/OutcomeCognitionFabric/provider revision ledger, включая late receipt, supersession и conflicting provider evidence.
- Нужны exact HEAD typecheck + `test:personality`, restart/contradiction E2E и paired-seed self-prediction calibration holdout. Текущая ветка по-прежнему diverged от актуальной базы; merge/rebase и Release ZIP refresh не выполнялись.
