# N.E.K.O. Smart Turn semantic endpoint для NK1

## Назначение и граница ответственности

Smart Turn отвечает на отдельный вопрос: **похожа ли текущая пауза на конец мысли по аудиосигналу?**

- Silero VAD оценивает локальную речевую активность.
- NekoSpeechAdmissionGate сохраняет sample-scoped evidence для акустического кандидата.
- Smart Turn анализирует просодию и контекст последнего аудио, классифицируя паузу как complete или incomplete.
- ASR provider остаётся владельцем финального транскрипта.
- NK1 остаётся владельцем когнитивного хода, памяти, identity и действий.

Smart Turn не финализирует транскрипт, не останавливает микрофон, не обрезает аудио и не разрешает отправку ответа. Результат — advisory evidence, а не управляющая команда.

## Модель и provenance из архива N.E.K.O.

Архивный manifest фиксирует следующий артефакт:

| Поле | Значение |
|---|---|
| Модель | Pipecat Smart Turn v3.2 CPU |
| Upstream revision | f766f81d3cfdf7737ac64aad813d91bbfd56bf93 |
| Имя файла | smart-turn-v3.2-cpu.onnx |
| SHA-256 | 2bb026316b14a660486a75b1733cd3fbab8c2fd0314dc9af7be49f8cca967e4f |
| Лицензия | BSD-2-Clause |
| Input | input_features: float32[1, 80, 800] |
| Output | probability: float32[1, 1] |

Модельный файл в NK1 этим PR не добавляется и автоматически не скачивается. Host provider отвечает за asset acquisition, проверку SHA-256 и лицензии, ONNX session, преобразование PCM в feature tensor, left-padding/trim контекста и CPU inference. В manifest N.E.K.O. output probability уже является sigmoid probability; повторно применять sigmoid нельзя.

Перед distribution модели binary provider обязан включить требуемый upstream BSD-2-Clause notice и выполнить собственную проверку происхождения артефакта.

## Provider contract

ASR provider может опционально передать smartTurnProvider:

- modelId и modelVersion — проверяемые идентификаторы выбранной модели;
- isAvailable() — текущее состояние host-side runtime;
- evaluate(request) — получает mono PCM16 little-endian, 16 кГц, до 8 секунд, session/generation/activity identity и AbortSignal; возвращает plain object только с probability01 в диапазоне [0, 1].

Во время captureFinal() provider получает три capture-scoped callback:

- pushSmartTurnAudioFrame({ sampleRateHz, pcm16 });
- observeSpeechActivity('speech-started' | 'speech-resumed' | 'candidate-pause');
- evaluateSemanticEndpoint().

В отсутствие Smart Turn provider callback возвращает null, а ASR работает штатно. Ошибка, недоступность или некорректная вероятность модели не отклоняет валидный ASR transcript.

## Coordinator invariants

- Ring buffer ограничен 8 секундами; вход — только mono PCM16 16 кГц.
- Минимальная длительность контекста перед inference — 200 мс.
- В одну секунду входного callback нельзя передать больше 16 000 samples.
- Default decision threshold — 0.5; он остаётся параметром конфигурации, а не production truth.
- Inference сериализован одной очередью; более новый запрос supersedes предыдущий, не запуская конкурентную модельную сессию.
- speech-resumed, reset и close инкрементируют activity/generation identity и инвалидируют in-flight результаты. Старый inference не может стать результатом нового речевого эпизода.
- Закрытие capture fences все callback; поздние PCM frames и evaluation после финального ответа не меняют evidence.
- Варианты complete и incomplete — классификация паузы, не подтверждение окончания пользовательского хода.

## Verification and promotion boundary

Фокусные тесты проверяют:
- порог complete/incomplete и требование candidate-pause;
- 16 kHz PCM16 контракт, ограничение кадра и 8-секундный ring buffer;
- отсутствие inference при коротком аудио или недоступной модели;
- malformed probability, provider error и fail-open для ASR;
- speech-resume fencing, request supersession и сериализацию inference;
- generation reset/close и late callback fencing;
- доставку Smart Turn evidence через EmbodimentRuntime в cognitive multimodal evidence.

Production promotion запрещена до проверки реального зафиксированного ONNX asset, reference feature parity, русско- и англоязычного holdout, пауз внутри предложений, filler / hesitant speech, false-complete и false-incomplete, прерывания/возобновления и целевого Android/Termux latency soak.

**На текущем этапе NK1 реализует coordinator и provider boundary. Реальный Smart Turn ONNX inference, asset distribution и calibrated production endpointing ещё не подключены.**
