# P41 — Native Perception Foundation & Temporal Semantic World

## Практический эффект шага
P41 добавляет настоящий локальный signal-processing слой для audio и image данных: RMS, zero-crossing, спектральные полосы, brightness/contrast/edge density/saturation, визуальное изменение, bounded temporal history и native perception cues. Эти данные реально входят в sensorium, semantic intelligence и action ranking, а состояние сохраняется между checkpoint/restart. Это **не** утверждение о human-level vision/audio understanding.

## Что сделано
- bounded local audio analysis без тяжёлых ML-зависимостей;
- bounded local image analysis по RGB или feature-vector input;
- temporal comparison предыдущего audio/image состояния;
- native cue provenance (`native-signal`);
- sensorium ingestion и cross-modal binding;
- native perception action bias для verify/explore/rest/respond/reflect/defer;
- persisted native perception state;
- серверные API для чтения и ingest;
- real integration/restart path;
- performance-oriented hot path без полного криптографического hash на каждый sample;
- capability registry `core.native_perception`.

## Честная граница
P41 не содержит полноценного neural vision encoder, ASR или semantic audio model. Native cues — объективно вычисленные признаки сигнала и локальные классификационные эвристики. Настоящее семантическое понимание требует подключаемого perception backend и внешней верификации.

## Почему это реальное улучшение
1. Сырые аудиосэмплы впервые преобразуются в измеряемые признаки внутри runtime.
2. RGB-пиксели могут проходить локальный анализ без внешнего сервиса.
3. Изменение изображения и акустической активности становится наблюдаемым событием.
4. Результаты реально влияют на последующее decision ranking.
5. State persistence позволяет этим сигналам участвовать в долговременном обучении.

## Ограничения телефона
Нативный анализ ограничен по объёму входа, истории и сложности вычислений. На среднем телефоне тяжёлый расход по-прежнему ожидается от LLM и будущих внешних/neural perception backends, а не от этого слоя.


## Расширение P41: temporal perception model
Добавлена bounded online transition model для текущих perceptual states. Она учит переходы между наблюдаемыми состояниями, измеряет surprise и prediction accuracy и реально влияет на action bias. Это статистическая temporal model, а не claimed consciousness.
