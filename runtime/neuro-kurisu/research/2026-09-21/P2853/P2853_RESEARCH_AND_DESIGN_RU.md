# P2853 — контекстная медленная память, selective transfer replay и независимый holdout

## Цель

P2853 продолжает P2852 без создания отдельного параллельного «мозга». Основные изменения направлены на то, чтобы существующая медленная память реально участвовала в контекстно-зависимой консолидации, а replay проверялся на перенос и независимую генерализацию.

## Что реализовано

### 1. Контекстная slow-memory консолидация

Добавлен `P2853SlowMemoryConsolidationController`.

Он хранит компактный банк из 8 контекстных прототипов по 16 чисел, отдельно ведёт visits/retrievals/agreement/stability и работает поверх существующего `slowMemory`, а не вместо него.

При принятии решения:

- вычисляется детерминированный slow-context id из входного нейросигнала и активного world-context;
- извлекается только достаточно совместимый прототип;
- влияние прототипа ограничено device budget и фазой `wake/quiet/sleepRecent/sleepPrior/transfer`;
- при несовместимости прототип фактически не вмешивается в live state.

После outcome существующий slow-memory trace обновляет прототип с bounded learning rate, зависящим от verified/error/stability и текущей консолидационной фазы.

Это инженерная контекстная ассоциативная память; это не заявление о биологической эквивалентности человеческой гиппокампально-кортикальной системы.

### 2. Selective transfer replay

Replay получил дополнительный compatibility gate: межконтекстный sample проходит в transfer replay только при совместимости его latent-cue с сохранённым slow-memory prototype или при прохождении существующего transfer-safety gate.

Отклонённые несовместимые межконтекстные candidates считаются отдельно (`replayTransferRejected`).

Это соответствует направлению современной continual-learning работы по transfer-selective replay: transfer должен быть условным, а не подразумеваться для любого старого sample. Meng et al. (2026) формулируют transfer-selective replay как механизм выбора replay samples по ожидаемой полезности и совместимости задач. Источник: https://arxiv.org/abs/2607.15587

### 3. Безопасность replay

Для каждого replay sample введён локальный retention-anchor probe по task-specific prediction readout. При заметном ухудшении anchor error после обновления изменения для данного sample откатываются.

Это bounded safety mechanism, а не отдельный learner.

### 4. Независимый holdout probe

Добавлен `evaluateHoldout()`.

Оценка выполняется на клонированном состоянии, поэтому evaluation не изменяет организм. Это устраняет методологическую ошибку предыдущих тестов, где `beforeDecision()` сам по себе менял eligibility/state.

### 5. A→B→C→A→D→A benchmark

Основной benchmark теперь содержит:

- A, B, C, A, D, A continual curriculum;
- отдельный D transfer comparison с replay и без replay;
- независимый H holdout;
- slow-memory ablation;
- persistence и non-mutating holdout проверки.

Последний прогон:

- D error with replay: `0.0349506`
- D error without replay: `0.0369401`
- forward-transfer gain: `0.0538575` (~5.4%)
- independent H error with replay: `0.0825946`
- independent H error without replay: `0.0780611`
- slow-memory ablation H error: `0.0822148`
- slow-memory delta: `-0.00462` relative, то есть ухудшение меньше 0.5%

Вывод: P2853 уже показывает измеримый forward-transfer эффект на D, но не демонстрирует универсального выигрыша на произвольном независимом H holdout. H поэтому не объявляется улучшенным.

## Научное основание

1. Meng et al., 2026 — `Rethinking Transfer in Continual Learning: A Replay-Based Realisation`: forward transfer зависит от совместимости прошлых и будущих задач и от отбора replay, а не является автоматическим свойством replay. https://arxiv.org/abs/2607.15587

2. Chang et al., Nature, 2025 — `Sleep microstructure organizes memory replay`: различные подсостояния сна по-разному связаны с replay недавно полученных и более старых воспоминаний. Это поддерживает инженерное разделение P2852/P2853 на recent/prior phases, но не копирует биологический механизм буквально. https://www.nature.com/articles/s41586-024-08340-w

3. `Sleep cycles process memories`, Nature Neuroscience, 2025: offline replay сопровождается преобразованием представлений, а не только их механическим копированием. Это мотивирует контекстные прототипы и медленную интеграцию в P2853. https://www.nature.com/articles/s41593-025-01996-1

4. `Online Continual Learning via Spiking Neural Networks with Sleep Enhanced Latent Replay`, arXiv, 2025: работа показывает инженерную ценность sleep-enhanced latent replay при edge/resource constraints и подчёркивает memory-efficiency trade-off. https://arxiv.org/abs/2507.02901

5. `Experience Replay Addresses Loss of Plasticity in Continual Learning`, arXiv, 2025: replay рассматривается как потенциальный механизм поддержания plasticity в continual learning. https://arxiv.org/abs/2503.20018

## Ограничения

- Forward transfer получен на искусственном synthetic curriculum, а не на реальном пользовательском/сенсорном потоке.
- Независимый H holdout в этом прогоне всё ещё показывает небольшой регресс относительно no-replay baseline.
- Slow-memory ablation почти нейтрален: канал уже активен, но пока не оказывает большого causal влияния.
- Mobile smoke остаётся инженерной V8 memory-budget проверкой; это не сертификация конкретного Android-телефона.
- Никакие результаты P2853 не доказывают субъективное сознание, sentience или биологическую эквивалентность мозгу человека.
