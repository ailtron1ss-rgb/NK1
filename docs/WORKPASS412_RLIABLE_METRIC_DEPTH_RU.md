# WorkPass412 — углубление диагностики обучения по RLiable

Дата: 23 октября 2026 года. Категория: `feature/learning`.

## Что было недостаточно

WorkPass406 показывал task-balanced IQM и парную вероятность улучшения. Они полезны, но два кандидата с одинаковым IQM могут иметь разную типичную успешность, а близость к потолку шкалы остаётся неочевидной. Поэтому расширяем описание распределения, не вводя новый gate.

## Upstream: прочитанный исходный файл

Напрямую прочитан [`google-research/rliable/rliable/metrics.py`](https://github.com/google-research/rliable/blob/master/rliable/metrics.py), Git blob SHA `dc206a180c822eaf3bc8524a63b127aeb1e60fe7`. В файле описаны `aggregate_mean`, `aggregate_median`, `aggregate_optimality_gap`, `aggregate_iqm` и `probability_of_improvement`. Header указывает Apache-2.0 license. NK1 не копирует код этого файла и не добавляет SciPy/NumPy/Python зависимостей; переносится идея дополнительных описательных агрегатов.

## Что добавлено в NK1

`LearningRobustMetrics.ts` теперь для task success, skill quality и trajectory quality вычисляет:

- **Task-balanced IQM** и delta — устойчивое центральное агрегирование task-level means, с равным весом задачи.
- **Task-balanced median** и delta — медиану средних по задачам; она показывает типичный результат менее чувствительно к крайним задачам.
- **Task-balanced optimality gap** и delta — расстояние до фиксированного верхнего потолка score=1: `1 - mean(task means)`. Отрицательная delta означает движение к потолку. Это task-balanced адаптация, а не побайтовая реализация RLiable's pooled matrix estimator.
- **Paired probability of improvement** — остаётся отдельной парной метрикой для matching task/trial: победа=1, ничья=0.5, проигрыш=0; сначала усреднение в каждой задаче, затем равный вес задач.

Все поля доступны через существующую `learningRobustDiagnostics` в P23 candidate-evaluation result. Нет нового decision path: `diagnosticOnly: true` сохраняется, а fitness, confidence, safety, evidence binding и approval gate не меняются.

## Регрессии

В `tests/workpass406-learning-robust-metrics.mjs` добавлены точные проверки медианы и gap/delta для трёх измерений, значения при score=1, равные нулю gap, и сохраняющаяся инвариантность результата к перестановке входных строк. Этот файл уже подключён к `npm run test:p23:learning` и P26 Learning Validation; package/workflow дополнительно проверяются новейшим workflow-to-script audit.

## Почему это важно для цифрового организма

Система развития должна различать устойчивый общий результат, типичную задачу, близость к потолку и вероятность попарного улучшения. Эти четыре сигнала дают более богатую диагностическую обратную связь для последующего curriculum/repair анализа, но один диагностический отчёт не доказывает обучение или сознание и не заменяет независимый multi-seed benchmark.

## Ограничения и статус

- Задействованы только scores, уже проверенные как конечные числа в диапазоне [0,1], и уже согласованные baseline/candidate trial pairs.
- Median/IQM/gap считаются по средним каждой задачи, поэтому задачи с большим количеством повторов не получают больший вес.
- Не строятся новые confidence intervals: неопределённость продолжает оцениваться существующим paired-seed confidence gate, а WorkPass412 остаётся diagnostic-only.
- Изменения source/test внесены в `feature/learning`, но exact-HEAD test/typecheck не заявлены как PASS: latest hosted jobs всё ещё завершаются `failure`, а API не отдаёт step logs.
- `main` и Release ZIP не изменены.

## Следующие шаги

1. Получить реальные шаги CI и выполнить test/typecheck на точном HEAD.
2. Прогнать метрики на заранее определённом, versioned наборе task families и независимых seed; сохранять baseline/candidate summary и стоимость.
3. Использовать агрегаты для приоритизации следующих экспериментов, но никогда не разрешать ими promotion.


## WorkPass415 — reduce aggregation cost without changing metric values

The matched rows are now grouped by `taskId` once into a reusable map. Previously each dimension scanned every trial row once per task with `rows.filter(...)`, making the grouping phase O(tasks × trials) for each score dimension. The shared grouping pass is O(trials), and each dimension then reads only its task's rows, giving O(trials) aggregation work per dimension after grouping. Ordering, task weights and metric formulas are unchanged. The existing row-order-invariance regression remains a contract for this refactor; exact-HEAD runtime execution is still not confirmed.
