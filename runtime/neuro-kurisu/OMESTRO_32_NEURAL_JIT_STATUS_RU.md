# OmeStro №32 — NeuroCore Neural JIT

Дата: 2026-11-17
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
- Activation capture отклоняется по TTL 10 минут до и после async host-verifier, поэтому задержка проверки не расширяет временное окно доверия.
- Runtime type shim объявляет точную сигнатуру `randomBytes(size): Buffer`; это устраняет найденный Actions TS2305 для `node:crypto`.
- Core regression workflow постоянно запускает `neural-jit-engine.mjs`, `neural-jit-runtime-wiring.mjs` и `neural-jit-runtime-bridge.mjs`, а HTTP fake-provider regression остаётся отдельным интеграционным шагом.

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
- Commit `a3728a4d6e23ff28d9f53cf785ff65b3b2c4508d` добавил три dedicated Neural JIT regression tests в основной `workpass71-validation.yml`. После последующих изменений replay/TTL актуальная ветка получила новый head `cc2df1009d28d3d787a1d7973c1774f0d060d4ad`; свежие Actions для него должны считаться незавершёнными до появления результатов.
- Доступ к текущему checkout для непосредственного локального запуска тестов отсутствовал; изменения внесены в feature branch через GitHub и проходят удалённую проверку. Поэтому нельзя заявлять, что новые тесты на последнем head уже прошли или что выполнен локальный red-green цикл.
- Базовый ранее известный дефект `tests/p22-chat-routing.mjs` (cognitive-proposal expectation) был воспроизведён до этой серии изменений на исходном baseline; если он встретится в широком regression run, его следует классифицировать отдельно, а не скрывать.
- Реальные Transformer activations, paired baseline-vs-shadow benchmarks, tokens/s, latency, RAM/VRAM и влияние на качество не измерялись: instrumented local model host adapter в окружении не настроен. Никакого ускорения LLM не заявляется; live inference остаётся выключенным.
- Метаданные опубликованного Release: tag `Neuro`, asset `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`, опубликован 2026-10-19, 135,290,615 bytes, SHA-256 `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`. Бинарный ZIP не удалось скачать/проверить в этой сессии; Release не изменялся.
- PR остаётся **Draft / open**. Нет merge в `workpass70-source` и нет публикации нового Release ZIP.
