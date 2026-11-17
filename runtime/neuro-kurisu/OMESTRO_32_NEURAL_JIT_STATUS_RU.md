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

## Host adapter contract

Модуль на стороне локального model host должен получать настоящие активации из instrumented model runtime, а не синтезировать их из текста, количества токенов или latency. Он реализует:

1. `captureLocalInference({ traceContext, request, response, evaluateCandidateShadow })` — создаёт краткоживущий opaque handle на активации конкретного `decisionId`.
2. `bindVerifiedOutcome(pendingCapture, context)` — связывает этот handle с проверенным action receipt и возвращает bounded `NeuralJitActivationCapture`, включая task/model fingerprints, seed, input features и target residual.
3. `verifyCapture(capture, expected)` — проверяет подпись/host-private provenance и полную привязку к tool/input/execution/decision.

Рекомендуется HMAC или подпись с ключом вне репозитория плюс проверка соответствия model/session/layer/version. Handle не должен включать raw prompt или секреты. После перезапуска capture handles должны считаться потерянными, пока host не сможет заново подтвердить происхождение.

## Граница реализации

Runtime и сервер теперь имеют реальный интеграционный путь для instrumented локальной модели. Но стандартный OpenAI-compatible `llama.cpp` endpoint сам по себе не отдаёт скрытые Transformer-активации, а в текущей среде нет установленного host adapter и запущенной локальной модели. Поэтому реальные captures, latency/tokens/s/memory benchmarks и shadow forward-pass на настоящем Transformer **не подтверждены**. Не заявляем ускорение и не включаем кандидаты в live generation.

Следующая ступень после подключения host adapter: получить реальные слойные captures; выполнить paired baseline-vs-shadow replay на независимом holdout; измерить latency, throughput, VRAM/RAM и качество; включить candidate shadow forward-pass на выбранном локальном backend. Любое live activation требует отдельного explicit gate, независимой проверки и instant rollback.

## Проверки

- `node --experimental-strip-types tests/neural-jit-engine.mjs`
  Проверяет также асинхронную TOCTOU-гонку для capture и binding, отказ от getter/accessor и sparse vectors.
- `node --experimental-strip-types tests/neural-jit-runtime-wiring.mjs`
- `node --experimental-strip-types tests/neural-jit-runtime-bridge.mjs`
- `node --experimental-strip-types tests/server-language-http-fake-provider.mjs`
- P23 learning execution evidence, signed shadow evidence, Hermes verified evidence binding, verified outcome ledger и verified promotion gate.
- `npm run typecheck` использует Node strip-only fallback (672+ файлов); семантический `tsc --noEmit` недоступен в текущем образе.

Синтетические unit fixtures подтверждают алгоритм и связки, но не являются измерением производительности реальной LLM. Semantic npm run typecheck на текущем toolchain остаётся красным по 9 существующим Buffer<ArrayBufferLike> / Uint8Array<ArrayBuffer> конфликтам в AuthenticatedSkillPromotionApproval.ts, LearningProcessSupervisor.ts, VerifiedOutcomeArtifact.ts, VerifiedSkillShadowEvidence.ts и ExternalProjectResearchTool.ts; на точном base commit c1d0970 воспроизводятся те же 9 ошибки плюс 7 прежних narrowing-ошибок JIT finalizer, устранённых этой доработкой. PR остаётся Draft; Release ZIP не менялся.
