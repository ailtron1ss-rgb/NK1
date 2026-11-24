# B401–B420 Research Olympics

## Эксперимент

Synthetic hidden-rule benchmark:

- training cycles: **360**;
- holdout cases: **180**;
- тестовые labels не использовались для изменения weights;
- сравнивались base policy, ensemble и каждый эксперт отдельно.

## Результаты

| Система | Holdout accuracy |
|---|---:|
| Base | **18.33%** |
| Surprise-memory | **81.67%** |
| Continuum-memory | **60.56%** |
| State-space | **62.22%** |
| Latent-predictor | **7.78%** |
| Counterfactual | **26.67%** |
| Goal-value | **23.33%** |
| Population-code | **22.78%** |
| Adaptive ensemble | **79.44%** |

Ensemble versus base: **+61.11 percentage points**.

В этом конкретном synthetic benchmark лучший одиночный эксперт оказался немного лучше ensemble: 81.67% против 79.44%. Это важный результат: ensemble не следует автоматически считать лучше любого отдельного алгоритма. Его ценность — в адаптивности к изменяющейся среде и в возможности переключать вклад экспертов.

## Runtime diagnostic

Основной 240-cycle adaptive ensemble test:

- decisions: **240**;
- updates: **240**;
- prototypes: **104**;
- retrievals: **480**;
- bestVariant: **state-space**;
- ensemble diversity: **0.272**;
- uncertainty: **0.665**;
- memory lesion: **0.00770**;
- controller lesion: **0.03495**;
- restart: **PASS**.

Full-organism mobile integration test:

- decisions: **14**;
- updates: **14**;
- prototypes: **7**;
- ensemble diversity: **0.242**;
- restart persistence: **PASS**.

## Интерпретация

Эксперимент подтверждает, что объединение нескольких исследовательских механизмов может дать большой прирост относительно слабого synthetic base. Но он не даёт основания переносить +61.11 pp на реальные задачи или человеческое поведение.

Следующий обязательный этап — real/unseen-world benchmark, где hidden target не задаётся искусственным правилом внутри теста.


## Mobile runtime profile

На 12-cycle full OrganismCore benchmark с `performanceProfile=mobile`:

- observe mean: **251.1 ms**; max: **376.1 ms**
- feedback mean: **241.8 ms**; max: **283.4 ms**
- B401 research decisions: **9/12** благодаря adaptive compute budget

Эти значения измерены на текущем Linux host, поэтому они не являются прямым Android-замером.
