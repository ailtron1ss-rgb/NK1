# OmeStro №32 — NeuroCore Neural JIT

Дата обновления: 2026-11-18
Статус: **интегрированная Shadow Mode ступень; live inference и изменение весов выключены**
Основа PR: `workpass70-source` SHA `1e83a011fc677ff20f2348570322bd562181d9ff`.

## Реализовано

- `NeuralJitEngine` принимает bounded activation captures только при одновременной проверке точного process-local `OutcomeVerificationService` receipt и host-owned verifier.
- `OrganismRuntime` связывает локальную языковую генерацию с точным `decisionId`, удерживает opaque capture handle только в памяти (лимит 128, TTL 10 минут, максимум 16 KiB) и удаляет его из пользовательского ответа.
- `OrganismRuntime` декорирует единый Core-owned outcome finalizer: сначала штатный Core finalizer выполняет свою обработку, затем JIT-слой повторно проверяет тот же persisted selected-decision trace и process-local external-postcondition receipt с полным совпадением tool/input/execution ID/decision ID. Для keyed execution используется только внутренний Gateway attestation после исходной проверки; если durable ledger клонировал receipt, Runtime переиздаёт отдельный JIT-only receipt собственным `OutcomeVerificationService`. Канонический Gateway receipt не меняется. Replays, policy/availability blocks и невалидированные действия не обучают JIT.
- Для локального `llama.cpp` добавлен явный opt-in `NEURO_NEURAL_JIT_CAPTURE_ADAPTER_MODULE`. Модуль должен экспортировать `createNeuralJitLocalCaptureAdapter()` и методы `captureLocalInference`, `bindVerifiedOutcome`, `verifyCapture`. Без этого модуля stock OpenAI-compatible chat provider не объявляет внутренние активации и JIT capture остаётся выключенным.
- Host adapter получает `evaluateCandidateShadow(candidateId, inputFeatures)`: он может посчитать residual кандидата в отдельной shadow-ветви. Callback явно возвращает `appliedToInference:false`; базовый путь остаётся fallback.
- Добавлены read-only diagnostics и защищённые API endpoints:
  - `GET /api/organism/learning/neural-jit`
  - `POST /api/organism/learning/neural-jit/compile`
  - `POST /api/organism/learning/neural-jit/evaluate`
  Ручная отправка activation traces через API не разрешена.
- Сбор трасс ограничен 1024 записями в памяти процесса; входная размерность — 256, выходная — 128. Train/holdout разбиение выполняется по task fingerprint; holdout не попадает в компилятор.
- Rank-1 residual-кандидат компилируется детерминированно из `modelFingerprint + taskFamily + trainingEvidenceFingerprint`; повторная компиляция тех же доказательств заменяет, а не дублирует candidate. Коэффициенты residual за пределами ±64 отклоняются.
- Gate требует минимум 12 уникальных train-задач, 8 независимых holdout-задач, 8 holdout-трасс и 5 seed; не менее 5% relative MSE gain и улучшение не менее 80% holdout-примеров.
- Persisted кандидаты после рестарта остаются `quarantined`; повреждённые fingerprints, ID, размерности, train provenance и коэффициенты отклоняются. Opaque capture handles и raw prompts в JIT sidecar не записываются.
- JIT изменения сериализованы отдельной очередью; проверены параллельные keyed и unkeyed ActionGateway execution receipts. Ошибки shadow capture/обучения не могут отменить уже подтверждённое внешнее действие.
- Перед асинхронным host-verifier Engine снимает изолированный snapshot точного action binding и всех полей activation capture; после await обучение использует только этот immutable snapshot. Это закрывает TOCTOU-гонку, при которой mutable capture или вложенный tool input могли измениться после проверки.
- Векторы активаций принимаются только как плотные plain numeric arrays с data descriptors; sparse arrays, getters/accessors, символы и дополнительные свойства отклоняются без чтения getter.
- Защита от повторного обучения переживает рестарт: bounded sidecar сохраняет только SHA-256 fingerprints observation/capture identity (до 4096 каждого типа), никогда не raw IDs, activations или prompts; восстановление фильтрует malformed/duplicate hashes и ограничивает входной массив.
- Host verifier ограничен дедлайном (по умолчанию 1 s, диапазон 10 ms–10 s); timeout вызывает `AbortSignal` и закрывает admission с `activation-capture-verification-timeout`.
- `bindVerifiedOutcome` исполняется вне общей очереди JIT mutation, имеет отдельный 250 ms deadline и cancellation signal. Зависший локальный адаптер не должен задерживать возврат уже подтверждённого ActionGateway-действия; pending handle потребляется до первого `await`, поэтому не может быть повторно привязан параллельным finalizer.
- Replay fingerprint capture привязан к source identity `captureId + taskFingerprint + modelFingerprint`, а не к последующему execution/decision envelope. Повторное использование той же активации под новым действием блокируется.
- Runtime не заменяет уже сохранённый pending handle повторным capture для того же `decisionId`; на `Runtime.stop()` дожидается финального JIT sidecar flush и очищает все оставшиеся process-local opaque handles.
- Activation capture отклоняется по TTL 10 минут до и после async host-verifier, поэтому задержка проверки не расширяет временное окно доверия.
- Runtime type shim объявляет точную сигнатуру `randomBytes(size): Buffer`; это устраняет найденный Actions TS2305 для `node:crypto`.
- Core regression workflow постоянно запускает `neural-jit-engine.mjs`, `neural-jit-runtime-wiring.mjs` и `neural-jit-runtime-bridge.mjs`, а HTTP fake-provider regression остаётся отдельным интеграционным шагом.
- Dedicated Neural JIT workflow устанавливает pinned TypeScript из `app/package-lock.json` перед runtime typecheck; semantic `tsc --noEmit` теперь является обязательной частью этого узкого gate, а не только Node strip-only syntax fallback.
- Дополнительно создан отдельный `.github/workflows/neural-jit-validation.yml`: самостоятельный PR gate с runtime typecheck и четырьмя проверками engine / wiring / verified ActionGateway bridge / local-language HTTP fake provider.

## Усиление evidence gate — 2026-11-18

- **Holdout теперь одноразовый.** После окончательной оценки расходуются все task fingerprints, использованные в этой оценке. В следующей версии кандидата те же canonical task fingerprints исключаются независимо от model revision или task-family alias — повторный просмотр одной тестовой задачи больше не повышает шанс пройти gate.
- **Окончательные оценки immutable.** Для кандидата со статусом `eligible` или `rejected` повторный вызов evaluate возвращает зафиксированный результат и его исходный holdout-набор. Новые train-данные создают новую детерминированную версию кандидата, а не перепроверяют старую версию на тех же тестовых задачах.
- **Компиляция идемпотентна.** Повторная компиляция неизменного training evidence возвращает уже существующий candidate, не сбрасывая его evaluation/status.
- **Защита сохраняется после рестарта.** Sidecar хранит только SHA-256 ключи из canonical task fingerprints (лимит 8192); restore фильтрует некорректные/дублирующиеся значения и восстанавливает spent-set. Сырые task IDs, prompts и activation vectors не сохраняются.
- **Restore quarantine не обходится holdout-only данными.** Persisted candidate остаётся `quarantined`; вызов evaluate возвращает `candidate-quarantined-after-restore` и не меняет статус. Для повторной допускаемой оценки надо собрать новые train captures и получить новый candidate из текущего процесса.
- Добавлены regression assertions: immutable first evaluation after later data arrival; disjoint holdout-task sets across candidate versions; spent-evidence persistence; persisted candidate cannot escape quarantine; corrupted candidates are still rejected.
- Кодовые коммиты этой ступени: `3a41b156e49ef7bd4510f878057a80f4620bcbbc` и `972e358bddcef9c363236b72579a314c4c8f9026`; тестовые коммиты: `c5ce1208f34f45a8528871ce1c4e1389db02c9d6`, `8bd37e348f4b767602dbe75e0898ab8338df4366`, `cf2dbb42b2f1a803be2ebe9f4770a22ea22b31c4`.
- **Текущая проверка:** после этих коммитов GitHub не вернул новых Actions runs; local checkout недоступен в этой сессии. Поэтому перечисленные выше пять green runs относятся к `33365436`, а новые holdout/quarantine regressions пока считаются добавленными, но не подтверждёнными исполнением. Не объявлять текущий HEAD зелёным до нового запуска CI.

## Host adapter contract

Модуль на стороне локального model host должен получать настоящие активации из instrumented model runtime, а не синтезировать их из текста, количества токенов или latency. Он реализует:

1. `captureLocalInference({ traceContext, request, response, evaluateCandidateShadow })` — создаёт краткоживущий opaque handle на активации конкретного `decisionId`.
2. `bindVerifiedOutcome(pendingCapture, context)` — связывает этот handle с проверенным action receipt и возвращает bounded `NeuralJitActivationCapture`, включая task/model fingerprints, seed, input features и target residual.
3. `verifyCapture(capture, expected)` — проверяет подпись/host-private provenance и полную привязку к tool/input/execution/decision.

Рекомендуется HMAC или подпись с ключом вне репозитория плюс проверка соответствия model/session/layer/version. Handle не должен включать raw prompt или секреты. После перезапуска capture handles должны считаться потерянными, пока host не сможет заново подтвердить происхождение.

## Граница реализации

Runtime и сервер теперь имеют реальный интеграционный путь для instrumented локальной модели. Но стандартный OpenAI-compatible `llama.cpp` endpoint сам по себе не отдаёт скрытые Transformer-активации, а в текущей среде нет установленного host adapter и запущенной локальной модели. Поэтому реальные captures, latency/tokens/s/memory benchmarks и shadow forward-pass на настоящем Transformer **не подтверждены**. Не заявляем ускорение и не включаем кандидаты в live generation.

Следующая ступень после подключения host adapter: получить реальные слойные captures; выполнить paired baseline-vs-shadow replay на независимом holdout; измерить latency, throughput, VRAM/RAM и качество; включить candidate shadow forward-pass на выбранном локальном backend. Любое live activation требует отдельного explicit gate, независимой проверки и instant rollback.

## Проверки и текущий статус

- В workflow `NK1 Action Gateway governance` на commit `1e05bf22cef0bdea5f6062d667ec6b93027b6937` все шаги прошли, включая `Runtime typecheck` и outcome / gateway regressions (run `44141962868`).
- В workflow `P26 Learning Validation` на том же commit все шаги прошли, включая `Typecheck runtime`, learning recovery, continual matrix, replay ablations и P23 evidence suite (run `44141963387`).
- Ранее эти же workflows блокировались из-за отсутствующей декларации `randomBytes`; причина исправлена в `src/node-shims.d.ts`.
- Commit `a3728a4d6e23ff28d9f53cf785ff65b3b2c4508d` добавил три dedicated Neural JIT regression tests в основной `workpass71-validation.yml`; commit `1fad131a35c855e1d57b8979f253fb5f062c9521` добавил проверку истечения TTL во время асинхронной host verification; `cc2df1009d28d3d787a1d7973c1774f0d060d4ad` добавил post-verifier TTL recheck. После этого отдельные CI workflow и status doc также были обновлены; выводы по тестам относятся только к конкретному head и не переносятся автоматически на последующие коммиты.
- На HEAD `ab75af47ab8c47bf82a2822e3c6861d818021f48` отдельный JIT workflow выполнил pinned semantic TypeScript check (`TYPECHECK=PASS mode=tsc compiler=app-lock`), Engine regression и Runtime wiring regression прошли. Bridge test выявил ошибку именно тестового host fixture: он возвращал один `captureId`/opaque handle для нескольких разных inference turns; новый replay guard закономерно отклонил последующие образцы. Fixture исправлен на генерацию уникального handle/capture ID для каждого inference, а отдельный test всё ещё проверяет отказ от повторного source capture.
- После исправления fixture пять повторно запущенных Actions на кодовом HEAD `3336543657fc81e89973d67a7b409255fe2ea652` завершились успешно: dedicated Neural JIT validation `44238438929` (semantic TypeScript check + Engine + Runtime wiring + verified ActionGateway bridge + HTTP fake provider), NeuroCore core regression `44238439030`, Unified organism runtime `44238438973`, Action Gateway governance `44238439027` и P26 Learning Validation `44238439124`. Все пять job имеют conclusion `success`; это подтверждает именно код на `33365436`, а не последующие holdout-hardening коммиты.
- На HEAD `ab75af47` Action Gateway governance (run `44238101555`) и P26 Learning Validation (run `44238101489`) завершились успешно. Unified organism и core regression на том же HEAD были отменены при последующем обновлении PR, а не завершились проверкой.
- Непосредственный локальный checkout в этой сессии отсутствовал; изменения внесены через GitHub API. Локальный red-green цикл не заявляется.
- Базовый ранее известный дефект `tests/p22-chat-routing.mjs` (cognitive-proposal expectation) был воспроизведён до этой серии изменений на исходном baseline; если он встретится в широком regression run, его следует классифицировать отдельно, а не скрывать.
- Реальные Transformer activations, paired baseline-vs-shadow benchmarks, tokens/s, latency, RAM/VRAM и влияние на качество не измерялись: instrumented local model host adapter в окружении не настроен. Никакого ускорения LLM не заявляется; live inference остаётся выключенным.
- Метаданные опубликованного Release: tag `Neuro`, asset `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`, опубликован 2026-10-19, 135,290,615 bytes, SHA-256 `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`. Бинарный ZIP не удалось скачать/проверить в этой сессии; Release не изменялся.
- PR остаётся **Draft / open**. Нет merge в `workpass70-source` и нет публикации нового Release ZIP.
