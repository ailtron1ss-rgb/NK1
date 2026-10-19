# P2704 — Reality Durability + Contentful Workspace + Mobile Stability/Plasticity

## Цель

Этот проход не добавляет декоративные классы. Он усиливает уже существующий причинный контур организма в трёх местах:

1. **Durability boundary** — остановка процесса теперь является настоящей границей сохранности: `stop()` дожидается очереди, выполняет финальный durable checkpoint ядра и сохраняет состояние мира.
2. **Contentful global broadcast** — P2703/P2704 workspace передаёт в policy не косвенный сигнал, зависящий от имени source, а взвешенное содержимое `actionBias` реально выбранной коалиции.
3. **Stability/plasticity separation** — порог нейронов адаптируется сильнее у пластичных элементов и слабее у уже стабилизировавшихся, как отдельный мобильный эксперимент.

## Что доказано тестами

- `test:restart`: PASS после исправления самого теста (он ранее вызывал async `stop()` без `await`, из-за чего каталог временных файлов удалялся до завершения flush). Код `stop()` одновременно усилен настоящим финальным flush.
- `test:p2703:global-workspace`: PASS, включая причинный тест, что изменение action-content выбранных кандидатов меняет workspace policy bias.
- `test:p2701:neural-temporal-substrate`: PASS после нового локального правила stability/plasticity.

## Важное ограничение

Длинный 80-cycle autonomy stress в текущем окружении остаётся слишком тяжёлым и может упираться в память/GC. Это **не считается PASS**. Вместо скрытия проблемы она зафиксирована как отдельный performance/memory gap для следующего прохода.

## Архитектурное изменение workspace

Раньше `actionBias()` использовал веса выбора и производную от длины имени source. Это не было достаточным доказательством, что broadcast-содержание влияет на действие.

Теперь:

`candidate.actionBias → coalition weights → broadcastActionBias → workspace.actionBias(action) → neural branch policy → cross-layer arbiter`

Это позволяет делать ablation: заменить содержание кандидата, оставить остальные условия максимально постоянными и проверить изменение policy signal.

## Mobile stability/plasticity experiment

Используется существующая `plasticity[]` как локальный маркер готовности к изменению. Стабильные элементы получают меньший threshold drift; пластичные — больший. Это экспериментальный механизм, а не утверждение биологической идентичности.

## Следующий обязательный этап

1. Разобрать memory/GC hotspot после ~35–45 циклов.
2. Перенести causal experience token в единый canonical ledger с одним ID на цикл.
3. Свести replay + eligibility + workspace broadcast в единый credit-assignment path.
4. Провести factorial ablation: baseline / workspace / stability-plasticity / eligibility / replay / combinations.
5. Только после этого оценивать прирост поведения.
