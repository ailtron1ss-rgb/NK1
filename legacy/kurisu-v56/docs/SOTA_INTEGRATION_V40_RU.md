# Neuro-Kurisu v4.0 — SOTA integration notes (2025–2026)

## Что реально интегрировано

### Nested Learning / Continuum Memory
Google Research описывает Nested Learning как систему вложенных задач оптимизации и memory modules с разными частотами обновления; Hope — proof-of-concept self-modifying recurrent architecture. В приложении реализована **mobile approximation**: `ContinuumMemory` с рабочей, эпизодической, семантической и identity-полосами, каждая с отдельной retention/update логикой. Это не реализация Hope и не обучение весов LLM на телефоне.

### Titans / test-time memory
Идея neural long-term memory из Titans используется концептуально: память оценивается по семантическому совпадению, давности, эмоциональной значимости и частоте доступа. Реализовано поверх существующего lightweight embedding + local storage.

### MiRU
MiRU — опубликованный вариант GRU для continual learning, сокращающий число параметров примерно в 2.88 раза и показывающий ускорение в экспериментах. В `MiRUState` используется только принцип дешёвого recurrent state для управляющих сигналов; это **не обученная MiRU-нейросеть**.

### ALAS
ALAS предлагает модульный pipeline для curriculum/retrieval, distillation и SFT/DPO. На Android реализована практичная часть: сбор lessons, quality score, approval, replay и экспорт SFT JSONL. Тихого fine-tuning foundation model на устройстве нет.

## Что НЕ было притворно реализовано

- DeltaStack: в доступных результатах поиска не найден надёжный первичный источник именно для описанной в исходном промпте архитектуры; поэтому `ContinuumMemory` называет свой stack «DeltaStack-inspired», а не выдаёт его за официальную реализацию.
- Squat quantization: не найден надёжный первичный источник, подтверждающий именно заявленные 2.37x для указанного метода; в коде нет фиктивного benchmark.
- RCLA: не найден надёжный первичный источник для заявленных 1.61x/13.4%; в коде нет фиктивной интеграции.
- MobileLLM-Pro: модель существует и имеет int4 checkpoints, но её официальный card указывает английский как язык и FAIR NC license. Кроме того, текущий browser runtime ожидает совместимые ONNX/Transformers.js артефакты, поэтому MobileLLM-Pro не включён как рабочий default.
- MiniLingua-1B: модель существует, но опубликованный Instruct checkpoint не является готовым browser ONNX runtime artifact и его языковой набор не включает русский. Поэтому она не заменяет Qwen3 в local-browser режиме.

## Почему Qwen3 0.6B выбран для 6 GB+ Android

Qwen3-0.6B поддерживает 100+ языков и подходит для multilingual instruction following. Для русского локального fallback это практичнее англоязычного SmolLM2. На 4 GB устройствах default остаётся более лёгкий SmolLM2 360M; на 6 GB+ можно выбрать Qwen3 0.6B. Пользователь всё равно может вручную выбрать модель.

## Sleep / Dreaming

Sleep cycle выполняет memory consolidation, associative pathway consolidation и теперь lightweight dream rehearsal. Dreaming создаёт replay examples, но **не утверждает, что модель обучилась**. Это намеренно: on-device gradient training foundation model был бы слишком тяжёлым для целевого телефона.

## Безопасность self-evolution

Кодовые изменения остаются proposal → sandbox/test → explicit approval → rollback. Runtime learning может менять состояние личности и памяти, но не произвольно исполнять скачанный код.

## Ограничения Android Web

Web-приложение не имеет стандартного API для точного CPU temperature. Поэтому нельзя честно реализовать условие «>45°C» по одному браузерному JS API. Runtime использует доступные battery/visibility/device-memory signals и conservative budgets; точную температуру можно добавить только через нативный Android bridge/plugin.
