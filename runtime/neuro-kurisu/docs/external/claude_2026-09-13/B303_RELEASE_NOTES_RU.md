# B303 Release Notes
Дата: 13.09.2026

## Добавлено
- B303HoldoutGeneralizationLedger
- holdout/recovery phases
- bounded context fingerprints
- unseen-context novelty metric
- holdout coherence metric
- recovery stability metric
- B303 migration coverage
- 80-tick holdout/recovery evidence test

## Оптимизация
Первоначальная версия сериализовала B303 на каждом feedback и делала длинный тест слишком дорогим. Persistence пересмотрено: B303 сохраняется на phase/checkpoint boundaries и при verified outcomes, а полный snapshot всегда синхронизирует актуальное состояние.

## Почему это лучше
B303 остаётся observability/evidence layer и не становится вторым personality engine.
