# OmeStro №32 — NeuroCore Neural JIT

Дата: 2026-11-17
Статус: **первая реализационная ступень, Shadow Mode; не готово к live inference**
Основа: `workpass70-source` SHA `1e83a011fc677ff20f2348570322bd562181d9ff`.

## Что добавлено

- `src/organism/learning/NeuralJitEngine.ts` — bounded runtime для приёма execution-grounded activation traces, разбиения по task fingerprint на train/holdout, построения rank-1 residual-кандидата и оценки на независимом holdout.
- `OrganismRuntime` владеет этим lifecycle и отдельным sidecar-файлом `${stateFile}.neural-jit.json`.
- Вход трассы требует одновременно точного, созданного `OutcomeVerificationService` external-postcondition receipt и host-owned `NeuralJitActivationCaptureVerifier`. Поддельные, скопированные или неправильно связанные receipts/captures отклоняются.
- Компилятор использует только train split; holdout task fingerprints исключаются из обучения. Gate требует минимум 12 train-трасс, 8 holdout-трасс, 8 независимых holdout-задач и 5 seed; критерии качества — не менее 5% относительного выигрыша по MSE и улучшение минимум на 80% holdout-примеров.
- Размер буфера трасс ограничен 1024; размерность входа — 256, выхода — 128. Исходные prompts и tool inputs не записываются в JIT sidecar; для привязки используется стабильный fingerprint.
- При восстановлении после рестарта кандидаты получают `quarantined`. Live inference жёстко отключён; fallback — базовый путь.

## Граница первой ступени

Текущий `LanguageOrgan` предоставляет общий `LanguageInvoker`, но в runtime не обнаружен унифицированный hook для чтения настоящих внутренних активаций локальной Transformer-модели и применения low-rank adapter. Поэтому эта ступень реализует сборочный/оценочный shadow-контур и интерфейс доверенного host-owned capture verifier, но **не** подключает JIT-кандидаты к генерации, не меняет веса и не заявляет об ускорении.

Следующая ступень: подключить verifier/capture provider непосредственно к выбранному local inference backend; подтвердить реальную provenance активаций; сохранить повторно проверяемые receipt-пакеты для восстановления трасс; провести baseline-vs-JIT benchmark на реальном holdout с latency, tokens/s, memory и quality regression; только затем рассматривать отдельный контролируемый activation gate с мгновенным rollback.

## Проверки

- `node --experimental-strip-types tests/neural-jit-engine.mjs`
- `node --experimental-strip-types tests/neural-jit-runtime-wiring.mjs`
- P23 learning execution evidence, signed shadow evidence, Hermes verified evidence binding, verified outcome ledger и promotion gate.
- `npm run typecheck` на текущем образе использует Node TypeScript strip-only fallback (671 файлов); семантический `tsc --noEmit` не был доступен.

Результаты синтетического fixture не являются измерением скорости или качества реальной LLM. PR остаётся Draft до отдельной проверки и интеграции с фактическим inference backend.
