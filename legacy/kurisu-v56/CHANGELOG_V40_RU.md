# Kurisu Neuro v4.0 — изменения

- Добавлена Continuum Memory с четырьмя частотами обновления.
- Добавлен DeltaStack-inspired hierarchical delta buffer без ложного заявления о точной реализации не подтверждённой архитектуры.
- Добавлен MiRU-inspired lightweight recurrent control state.
- Добавлен ALAS-inspired lesson/replay/SFT-export pipeline с ручным approval.
- Sleep cycle расширен dream rehearsal.
- Память получила дополнительное continuum consolidation.
- Локальная модель по умолчанию выбирается с учётом RAM: 4 GB → SmolLM2 360M, 6 GB+ → Qwen3 0.6B.
- Увеличены облачные output budgets до 2048 токенов; искусственного ограничения длины ответа на уровне личности нет.
- Добавлена документация по проверенным 2025–2026 исследованиям и по тому, что намеренно не реализовано из-за отсутствия надёжных источников/совместимых runtime-артефактов.
- Сохранён Android-safe принцип: никаких `onnxruntime-node` в npm, одна локальная модель за раз, conservative WASM threads.
