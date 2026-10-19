# V99 — Gradient Conflict Arbitration

## Цель
Проверить, мешают ли реальные objective-компоненты NeuroCore друг другу на общем shared substrate, и дать им механизм арбитража без нового parameter/memory owner.

## Реализация
Добавлен `GradientArbitrationConfig` + `GradientArbitrator`. Реализованы `pcgrad` и `conflict_weighted`; default остаётся выключенным. Арбитр работает только на ограниченном наборе общих параметров `state_to_hidden`/`cognitive_bridge`, после чего заменяет только их градиенты. Остальные параметры получают обычный текущий градиент.

## Почему сейчас candidate-only
На 3 seeds × 4 задачи текущего полного NeuroCore PCGrad обнаруживал конфликт примерно в 17.7% ordered pair checks на выбранном shared probe. Среднее время выросло примерно с 0.99 s до 1.11 s (+12.1%), а изменение cosine/continual score оказалось слишком малым, чтобы оправдать включение по умолчанию. Retention-anchored вариант дал сопоставимую картину (~1.10 s). Поэтому оба режима остаются candidate-only.

## Фактический benchmark
`evidence/v99_gradient_arbitration_benchmark.json` содержит 3 seed × 3 mode. Для полного current пути: baseline mean final cosine 0.03614, PCGrad 0.03574, anchor-project 0.03577; mean loss 3.60654 / 3.60530 / 3.60531. Эти числа не демонстрируют достаточного quality gain. Главная подтверждённая способность — реальный objective-gradient conflict с измеряемым conflict rate.

## Qualification
- Current suite: 55/55 PASS после добавления V99 tests.
- Structural verifier: PASS.
- Checkpoint round-trip: PASS.
- V98→V99 compatibility: PASS.
- Benchmark artifact: `evidence/v99_gradient_arbitration_benchmark.json`.

## Научная база
PCGrad проектает конфликтующий градиент на нормальную плоскость другого градиента. Новые работы 2026 года продолжают эту линию для continual learning / retention-prioritized gradient synthesis.

Статус: `CANDIDATE / NOT PROMOTED`.

## Next experiment
Поскольку conflict rate существует, следующий тест должен связывать его не с общей cosine-метрикой, а с retention/new-learning trade-off на длинном потоке. Кандидат SAGO-like synthesis — следующий вариант; default current пока не меняется.
