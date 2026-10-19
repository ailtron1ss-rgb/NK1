# V94 — Neural Regulation / Regeneration

## Цель
Добавить в NeuroCore совершенно другой слой нейронности, не связанный с очередным recurrent backend: управление жизненным циклом нейронов и медленная гомеостатическая регулировка активности.

## Реализовано
- `NeuralLifecycleController`: реальная online-статистика activity/contribution/silence, maturity, replacement credit и частичное rejuvenation.
- Статистика принадлежит `UnifiedAssociativeSpine`; отдельного дубликата состояния нет.
- После rejuvenation сбрасываются соответствующие Adam/AdamW state slices.
- `homeostatic_log_gain`: bounded non-gradient per-unit gain, меняющийся медленнее градиентного обучения.
- Состояние сериализуется один раз через model spine buffers.
- Current default остаётся отключённым для lifecycle/homeostasis: механизм не промотирован без достаточного causal benchmark evidence.

## Научная основа
Dohare et al. показали потерю пластичности при продолжительном continual learning и эффект регулярного переинициализирования малополезных unit-ов. SNR предлагает reset при доказательстве фактической потери firing-rate. CCBP 2026 развивает идею в непрерывные частичные reset-ы. Эти работы используются как design reference, а не как доказательство поведения NeuroCore.

## Qualification
Короткий парный тест дал лишь очень малый положительный сигнал, а длинный seed-2 показал отрицательное изменение среднего cosine. Поэтому promotion отклонён.

- short 2-seed comparable lifecycle: +0.112% mean cosine
- seed-0 short combined homeostasis+lifecycle: +0.291%
- seed-2 long lifecycle: -1.712%
- наблюдаемое число rejuvenations: 1 в каждом lifecycle-run

Следующий тест должен использовать стандартный continual-learning protocol с длинным потоком distribution shifts, late-task plasticity probe и forgetting, прежде чем менять default current.

## Статус
**IMPLEMENTED / CANDIDATE / NOT PROMOTED**


## Engineering gate

- `pytest tests/current`: **21/21 PASS**
- current verifier: **PASS**
- `compileall`: **PASS**
- one canonical recurrent owner; no duplicate state keys.

## Обновление research frontier (25.09.2026)

Свежая работа LLA 2026 по AdaLin предлагает адаптивно вводить линейность на уровне отдельных нейронов на основе gradient flow; это альтернативный путь поддержания пластичности без периодических reset. Работа LLA 2026 по selective weight reinitialization показывает, что для небольших сетей и сетей с normalization переинициализация отдельных весов может быть предпочтительнее переинициализации целых units. Эти идеи назначены кандидатами для следующего прохода и пока не входят в current.
