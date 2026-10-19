# P2852 — офлайн-консолидация, многомасштабная пластичность и функциональная абляция

## Цель

P2852 переводит непрерывное обучение из единственного режима `replay()` в управляемый режим с различением недавнего материала, старого материала и межконтекстного transfer/replay. Параллельно быстрые, средние и медленные коэффициенты пластичности теперь непосредственно масштабируют обучение.

## Научное основание

1. Chang et al., *Sleep microstructure organizes memory replay*, Nature 637 (2025). Работа показывает, что разные подсостояния NREM связаны с разной приоритетностью replay недавних и более старых воспоминаний. В P2852 это не копируется буквально: вводится инженерное разделение фаз `sleepRecent` и `sleepPrior`, ограниченное вычислительным бюджетом устройства.
   DOI: https://doi.org/10.1038/s41586-024-08340-w

2. Widloski & Foster, *Replay without sharp wave ripples in a spatial memory task*, Nature Communications (2025; correction 2026). Работа показывает, что replay и sharp-wave ripples могут быть различимыми, хотя скоординированными процессами. Поэтому P2852 не трактует `replay()` как биологическую имитацию одного конкретного механизма.
   DOI: https://doi.org/10.1038/s41467-025-65181-5

3. Meng et al., *Rethinking Transfer in Continual Learning: A Replay-Based Realisation* (2026). Работа формулирует transfer как измеримую цель и связывает пользу replay с совместимостью прошлых и текущих задач. Это использовано как основание для отдельного `transferMix01` и межконтекстного replay отбора.
   arXiv: https://arxiv.org/abs/2607.15587

4. *Timescales of learning in prefrontal cortex*, Nature Reviews Neuroscience (2025 issue / review). Обзор поддерживает рассмотрение обучения на нескольких временны́х масштабах. P2852 реализует инженерную трёхмасштабную регуляцию с быстрым, средним и медленным коэффициентами пластичности.
   DOI: https://doi.org/10.1038/s41583-024-00836-8

## Реализация

### 1. P2852OfflineConsolidationController

- `wake` — обычное обучение и replay;
- `quiet` — снижение интенсивности replay;
- `sleepRecent` — приоритет недавних следов;
- `sleepPrior` — приоритет старых следов при росте forgetting;
- `transfer` — повышение доли межконтекстного replay при выраженном task shift.

Контроллер имеет собственное persisted state и сохраняет статистики retention/interference/utility.

### 2. Multiscale plasticity

- `fastPlasticity01` реагирует на текущую ошибку и novelty;
- `mediumPlasticity01` реагирует на task shift и стабильность;
- `slowPlasticity01` изменяется медленно и зависит от долговременной стабильности.

Итоговый `multiScale` непосредственно умножает `baseLr`, а eligibility decay адаптируется под средний и медленный масштабы.

### 3. Functional ablation matrix

Добавлена матрица отключения пяти независимых каналов:

- sparse `edgeWeights`;
- `inputProjection`;
- `slowMemoryReadout`;
- `actionReadout`;
- `predictionReadout`.

Измеряются prediction drop, behavioral drop, latent drop и composite effect, после чего выполняется recovery.

## Benchmark P2852

Основной direct-neural benchmark:

- replay-enabled holdout error: `0.0577425888`;
- no-replay holdout error: `0.0584844962`;
- относительное улучшение: `0.0126855391` (~1.27%);
- replay evaluations: `144`;
- replay weight updates: `13824`;
- offline consolidation cycles: `48`;
- prior-memory replay samples: `78`;
- transfer replay samples: `7`;
- multiscale plasticity updates: `144`.

Функциональная ablation matrix показала наиболее заметные эффекты у input projection и sparse recurrent edge graph. Slow-memory readout в текущем тесте имеет слабое влияние; это зафиксировано как отдельный технический долг, а не скрыто под общей оценкой.

## Ограничения

Реализация является инженерной нейронной архитектурой. Эти механизмы не доказывают биологическую эквивалентность человеческому мозгу и не являются доказательством субъективного сознания.

### Дополнительное усиление P2852: функциональный slow-memory readout

В ходе финальной верификации P2852 абляционная матрица показала, что прежний `slowMemoryReadout` участвовал в live prediction, но слишком слабо. Поэтому без добавления новой подсистемы усилен существующий канал: его коэффициент влияния на prediction поднят с 1.4 до 1.8, а replay получил фазозависимое медленное обновление readout (`sleepPrior` > `sleepRecent` > `transfer` > `quiet` > `wake`). Это превращает offline-консолидацию в реальное обновление медленной памяти, а не только в выборку старых эпизодов.
