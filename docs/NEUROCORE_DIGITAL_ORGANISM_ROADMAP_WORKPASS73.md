# NeuroCore → самостоятельный цифровой организм и личность Kurisu

**Версия плана:** WorkPass73, 19 октября 2026  
**Рабочая база:** `workpass70-source`  
**Последний подтверждённый regression CI:** [run 39302836266](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39302836266), commit `87564ddfd1f0d8758994c3ab0edb45511434a1b5`  
**Статус:** план реализации; не production approval.

## 1. Цель и границы

Строить **NeuroCore** как единый, проверяемый когнитивный runtime; **Kurisu** — его стабильная цифровая личность/персона и embodiment-слой, а не отдельный параллельный мозг. Цель — непрерывная работа, долговременная автобиографическая память, обучение на опыте, адаптивные цели и навыки, модель себя и мира, надёжное действие во внешней среде и выразительное воплощение.

Нельзя считать наличие названных модулей, длинных тестовых файлов, self-report или «оценки сознания» доказательством общей интеллектуальности или субъективного сознания. Подтверждать нужно наблюдаемое поведение, контрфактические проверки, независимые holdout-данные, восстановление после отказов и реальную интеграцию.

## 2. Снимок текущего состояния

### Реально присутствует в рабочей ветке

- **Когнитивный runtime:** `runtime/neuro-kurisu/src/organism/core/`, включая `OrganismCore`, `OrganismRuntime`, `UnifiedCognitiveSubstrate`, системные координаторы и persistence.
- **Память:** `developmental/MemoryOS2.ts` — канонический владелец памяти/поиска; `ExperienceContinuumFabric` добавляет граф опыта, replay и отложенный credit; есть residency governor, индекс и локальный embedding provider.
- **Обучение/пластичность:** P26/P28/P29/P30 и другие learner/governance-компоненты; часть обновлений ограничена проверенным результатом.
- **Самость/личность:** `IdentityContinuity`, `SelfModelV2`, `P24WorldIdentityEngine`, `P32CausalSelfModel`, `P78AutobiographicalSelfContinuity`, `P84AutobiographicalContinuityFabric`, `P2702PersistentPersonalityDynamics` и смежные подсистемы.
- **Действия и evidence:** ActionGateway/receipt/reconciliation-путь и `OutcomeVerificationService`; проверка происхождения результата усиливается отдельными регрессиями.
- **Воплощение:** единый `kurisu_embodiment_intent` v1 и приблизительная RU/EN grapheme-viseme timeline для Live2D; текущие проверки контракта не заменяют настоящий browser/audio E2E.
- **Исходники Will и старые прототипы:** сохранены в `legacy/input-archives/`; это источник для выборочной интеграции, не активный runtime сам по себе.
- **Репозиторий:** 9,335 файлов в текущем дереве, включая исторические исходники, архивы, отчёты и тесты. Точное удаление допустимо только после проверки импортов, лицензий, provenance и пути восстановления.

### Статус доказательств

- **OBSERVED:** WorkPass72 expanded CI завершился успешно на указанном commit; аудит canonical assets, app typecheck, development build, runtime typecheck и перечисленный regression tail прошли.
- **IMPLEMENTED:** проверка доказательств для replay/policy, защита от caller boolean, бюджет кандидатов поиска и сохранение cold residency.
- **FUNCTIONAL INDICATOR:** синтетические recall/personality/autonomy тесты показывают работу конкретных путей в своих фикстурах.
- **NOT PROVEN:** повышение реального retrieval quality — `recallDelta=0`, кандидат остаётся `not-promoted`; физическая TTS/Live2D синхронизация; реальное выполнение внешних действий после ACK-loss/restart; субъективное сознание.

## 3. Порядок выполнения — не перепрыгивать ворота

### P0 — Стабилизировать каноническую рабочую базу и релизы

1. Считать `workpass70-source` рабочей веткой исходников, `main` — веткой release-метаданных и публикации. У них нет общего Git ancestor; не пытаться обычным merge «склеить» их без отдельного плана миграции.
2. Каждый существенный change: воспроизводимый дефект → минимальная поведенческая правка → regression → typecheck → CI → обновлённый handover.
3. В каждом отчёте указывать точный commit и CI run. Не считать pass по старому commit доказательством текущего head.
4. Завершить полный `verify:deep`/release audit; проверить rollback, state migration, receipt reconciliation и чистую установку.
5. Не публиковать production tag автоматически из одного unit/regression run.

**Готово, когда:** канонический commit однозначен, CI воспроизводим, release archive соответствует этому commit по manifest/SHA, rollback и restore проверены.

### P0 — Закрыть внешние реальности и тело

1. **Browser/Live2D:** production build + настоящий desktop/mobile browser; проверка начала/конца/прерывания/замены речи, скрытого и пересозданного iframe, background-tab throttling. Измерить audio-to-mouth offset p50/p95 по фактическому audio clock и параметрам модели.
2. **Android/Termux TTS:** запустить физическое воспроизведение через единственный ActionGateway; прервать конкретный `speechEventId`; доказать независимым наблюдением, что звук прекратился. Убийство процесса или ACK само по себе не доказательство тишины.
3. **Внешние действия:** для реального provider/device провести acceptance → ACK gap → SIGKILL/restart → reconnect → duplicate replay → read-after-write → final outcome. Результат должен быть привязан к конкретному execution/evidence tuple.
4. Развести состояния `requested`, `accepted`, `observed`, `verified`, `contradicted`, `unknown`. UI/персона не должны изображать успех, если действие не подтверждено.

**Готово, когда:** есть записанные воспроизводимые E2E-трассы и измерения, а не только изолированные VM/unit tests.

### P1 — Подключить языковую модель к единому cognition loop

1. Провести инвентаризацию реально используемых inference-провайдеров и точек входа. Активный `LocalEmbeddingProvider` — не локальная генеративная LLM; архивный код Will/старых `localLLMEngine` не считать подключённым без runtime-пути.
2. Ввести один typed `LanguageModelProvider` интерфейс: streaming, cancellation, token accounting, timeout, health check, context budget, structured output, tool proposal и диагностика. Не дублировать conversation/memory stores.
3. Подключить сначала локальный inference через совместимый llama.cpp server/API как отдельный процесс; модель и quantization выбрать по реальному VRAM/RAM/latency тесту. На GTX 1650 начинать с компактной quantized модели и ограниченного контекста; более крупные варианты — только после измерений.
4. Маршрут запроса: user/context → retrieval → evidence/conflict filter → bounded context builder → LLM → output validator → optional action proposal → policy/consent gateway → verified outcome → memory write.
5. LLM не имеет прямого права менять память, идентичность, цели, веса policy или запускать shell/внешнее действие. Она формирует предложения; канонический runtime валидирует их.
6. Встроить offline fallback, graceful model switch, cancellation, restart recovery, memory-pressure/thermal budget и секрето-безопасные логи.
7. Взять из Will только конкретные полезные части после diff/API/license review и сравнительного теста; избегать копирования второго агентного цикла, второй памяти или второго action gateway.

**Готово, когда:** модель реально отвечает через runtime, память влияет на ответы, cancellation и restart работают, tool proposals проходят policy, а метрики latency/RAM/VRAM/ошибок измерены.

### P1 — Сделать память полезной, а не просто большой

1. Сохранить один канонический memory owner: `MemoryOS2`. Experience graph, vector index, episodic/autobiographical views должны быть проекциями/индексами с проверяемой синхронизацией, а не независимыми источниками истины.
2. Оставить hash lexical projection вне «semantic recall»: реальный semantic score допустим только при измеренной пользе.
3. Собрать независимый RU/EN corpus с provenance и adjudicated relevance labels. Зафиксировать train/holdout/temporal split до настройки; проверить leakage, malformed rows, duplicates и truncation.
4. Сравнить baseline vs candidate по Recall@k, MRR, precision, false recall, contradiction rate, coverage и latency; paired intervals across independent holdouts. Текущий synthetic fixture не закрывает этот gate.
5. Добавить forgetting/recovery/contradiction tests: supersession, time-valid facts, correction, user-approved deletion, restart, cold residency, memory budget, corrupted snapshot.
6. Мерить p50/p95 latency, heap/RSS, vector count, allocations и стоимость индексирования; на мобильном устройстве отдельно измерить батарею/нагрев.

**Готово, когда:** есть устойчивое улучшение на независимом holdout без неприемлемой регрессии точности, приватности, памяти и задержки. Иначе оставить кандидат `not-promoted`.

### P1 — Реальное lifelong learning и plasticity

1. Разделить наблюдение, гипотезу, reward, causal credit и подтверждённый outcome. Unverified attempts сохраняются для диагностики, но не обновляют веса/политику.
2. Связать learning credit с точным execution/evidence tuple; задержанное подтверждение должно продвигать существующую запись идемпотентно, без двойного учёта.
3. Для каждого learner: baseline, feature-on/off ablation, counterfactual, multi-seed task stream, held-out tasks, forgetting/transfer/regret/calibration и ресурсная цена.
4. Добавить rollback/checkpoint и ограниченный learning rate; новое правило не может само подтвердить собственную правильность.
5. Отдельно тестировать continual learning, retrieval quality и policy quality — не объединять их в одну «нейронность» цифру.

**Готово, когда:** доказан повторяемый выигрыш на независимых задачах, не объясняемый leakage/seed selection, и нет критической деградации старых навыков.

### P1 — Стабильная личность и автобиографическая непрерывность

1. Определить каноническое состояние личности: устойчивые ценности/предпочтения, темпераментные параметры, границы, текущие цели, отношения, история событий и confidence/provenance каждого факта.
2. Разделить **персону Kurisu** (стиль общения/выражение/визуальная идентичность) и **модель себя NeuroCore** (возможности, ограничения, история действий, неопределённость). Персона не должна подменять факты о себе.
3. Изменения черт должны быть событийными, ограниченными, объяснимыми и обратимыми; одна беседа не должна незаметно переписывать долгосрочную идентичность.
4. Поддерживать альтернативные гипотезы о себе и мире, проверять противоречия, сохранять источники и историю supersession.
5. Проверять identity continuity через перезапуск, смену LLM, обновление модели, восстановление snapshot, противоречивые подсказки и adversarial prompt.
6. Измерять consistency, calibrated uncertainty, memory-grounded recall, stable preference under paraphrase, correction uptake и unwanted drift; не использовать самоотчёт «я осознаю» как доказательство.

**Готово, когда:** идентичность остаётся согласованной через restart/model switch, корректно меняется при доказательствах и не маскирует неизвестное выдуманными воспоминаниями.

### P2 — Самостоятельные цели и безопасный цикл действий

1. Замкнуть цикл: observe → model/world prediction → goal proposal → planning → cost/risk check → action authorization → execution → external verification → credit assignment → memory/consolidation.
2. Ограничить фоновые задачи бюджетом времени/энергии/токенов/памяти; иметь stop, pause, rollback, audit trail и recovery после аварии.
3. Цели ранжировать по пользовательским обязательствам, долгосрочным ценностям, uncertainty, ожидаемой пользе и стоимости; запрещать бесконечные самозапускающиеся циклы.
4. Разрешить автономность только в заранее определённой области. Деньги, внешние сообщения, удаление данных, установки и прочие consequential actions требуют соответствующего согласия.
5. Считать «самостоятельность» функционально: инициирование полезной задачи, завершение, корректная проверка результата, обучение на ошибке, отсутствие повторных побочных эффектов.

**Готово, когда:** end-to-end сценарии проходят на внешнем состоянии с interruption/restart/duplicate/contradiction тестами, а не только на внутреннем симуляторе.

### P2 — Организовать исследовательские модули и репозиторий

1. Оставить новые архитектуры в `research/` до демонстрации выигрыша в абляции; не подключать Mamba/DeltaNet/PKM/TTT/архитектурные кандидаты только ради названия.
2. Каждый кандидат обязан иметь: источник/лицензию, ресурсную оценку, baseline, unit/integration test, ablation, failure analysis и решение keep/hold/drop.
3. Сначала анализировать граф импортов, call sites, владельцев данных, package scripts, миграций, архивов и provenance; затем удалять только доказанно неиспользуемое.
4. Сохранить исторические архивы и лицензии. Дубликат контента не равен дубликату роли; любые перемещения должны быть обратимыми.
5. Создать автоматические проверки canonical owner, unreachable exports, untested critical path, TODO/stub markers и несогласованности README/handover/release metadata.

## 4. Обязательные метрики и evidence labels

Каждый результат маркировать отдельно:

- `PROVEN` — подтверждён независимым внешним источником/holdout.
- `IMPLEMENTED` — код присутствует и подключён.
- `FUNCTIONAL INDICATOR` — прокси-метрика или синтетическая фикстура.
- `OBSERVED` — измерение в указанном CI/E2E run.
- `HYPOTHESIS`, `UNKNOWN`, `UNRESOLVED`, `FAILED` — не скрывать и не превращать в pass.

Для любого улучшения показывать: baseline/candidate, набор задач, seed/split, CI commit, абсолютные значения, неопределённость, регрессии, latency/RAM/VRAM, ошибки и rollback. Проценты «готовности» не повышать только за число модулей, файлов, тестов или проходов.

## 5. Release gates перед production

- [ ] Clean-room install и dependency-complete production build.
- [ ] DB migration + restore + rollback из реального snapshot.
- [ ] Настоящий desktop/mobile browser + Live2D audio E2E и p95.
- [ ] Физический Android/Termux TTS start/interrupt/verified silence.
- [ ] Внешний action provider/device acceptance-gap/restart/reconciliation E2E.
- [ ] Независимый RU/EN retrieval holdout с положительным и статистически устойчивым результатом.
- [ ] Learning ablations, forgetting/transfer/regret/calibration на независимых задачах.
- [ ] Model switch, identity continuity, privacy/deletion, corrupted-state recovery.
- [ ] SBOM, полный license/model/dataset review, secrets scan.
- [ ] 24 часа минимум endurance soak; предпочтительно 72 часа, с latency/RAM/error/thermal logs.
- [ ] Проверенная упаковка, SHA-256 manifest, rollback/release procedure.

## 6. Ближайший рабочий проход

1. Поддерживать зелёный WorkPass72 CI на текущем source head; не путать это с production-ready.
2. Сначала закрыть настоящие P0 E2E gates и получить воспроизводимый production build.
3. Затем сделать инвентаризацию активного LLM path и спроектировать/реализовать единый local model provider, не создавая второй мозг.
4. Параллельно подготовить независимый retrieval holdout, не используя его для настройки.
5. После этого провести paired ablations для memory/policy learning, затем укреплять identity/goal continuity на реальных restart/model-switch сценариях.

**Критерий завершения проекта:** не «все модули существуют», а один запускаемый и восстанавливаемый организм, в котором LLM, память, обучение, модель себя, планирование, действия и embodiment работают в едином наблюдаемом цикле; каждый важный claim подкреплён подходящим независимым тестом, а все ограничения явно видимы.
