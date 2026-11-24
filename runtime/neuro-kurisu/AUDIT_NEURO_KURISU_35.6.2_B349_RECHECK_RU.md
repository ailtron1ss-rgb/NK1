# Neuro-Kurisu 35.6.2 — независимая перепроверка после B349

## 1. Текущее состояние организма

Проект представляет собой большую исполняемую когнитивно-нейронную систему с persistent state, memory, world model, self model, agency, personality/development, causal learning, spiking substrate и Android/Termux-oriented runtime.

Важно различать три уровня утверждений:

- **исполняется** — код действительно запускается;
- **обучается** — состояние реально меняется после outcomes;
- **доказано как причинно необходимое для организма** — изменение/отключение компонента меняет конечное поведение на контролируемом holdout.

Архив хорошо покрывает первые два уровня. Третий покрыт значительно хуже.

## 2. Что было хорошо в исходном B348

- B269 действительно имел spike dynamics, synaptic plasticity, homeostasis и structural pruning/growth.
- B293 действительно обучал recurrent predictive weights.
- B296 действительно имел event-driven neural readout и plasticity.
- B297 действительно агрегировал источники и tracked reliability/redundancy.
- B299 связывал outcomes с personality development.
- state persistence уже была зрелой для большого исследовательского проекта.

## 3. Главные проблемы, подтверждённые перепроверкой

### 3.1 Разделение нейронных механизмов

Нейронные ветви существовали, но их causal ownership был распределён между несколькими coordinator/readout системами. Из-за этого наличие neuron-like computation не гарантировало существенное изменение будущего поведения.

### 3.2 Старый B269 lesion test

Старый тест выключал случайные синаптические связи и измерял только firing rate. Это недостаточно для вывода о необходимости нейронов и иногда давало нулевой causal drop.

После этого прохода lesion стал structural simulation на уровне нейронов: выбираются активно участвующие нейроны, отключаются их входящие/исходящие связи, обнуляются динамические состояния, и затем сравнивается firing trajectory.

Новый B269 structural lesion test показал на одном реальном обученном snapshot:

- lesioned neurons = 16/48 при fraction 0.35;
- active synapses 213 → 59;
- removed synapses = 154;
- baseline firing ≈ 0.1042;
- lesioned firing ≈ 0.0911;
- causal drop ≈ 0.0781.

Это уже более честный structural experiment, но всё ещё не поведенческий доказательный тест всего организма.

### 3.3 B349 исправляет архитектурный разрыв, но ещё не весь behavioral gap

B349 объединяет:

`B269 → B289 → B293 → B294 → B296 → B297 → outcome`

и сохраняет temporal eligibility и learned action weights.

## 4. Проверка, реально ли работает B349

Изолированный тест:

- 79 learning updates;
- verify bias: 0.0574 → 0.3841;
- snapshot/restore exact state equality — PASS.

Core integration:

- 3 mobile-profile Core observations — PASS;
- B349 state persisted — PASS;
- restored cycles = 3 — PASS.

## 5. Integrity

После обновления:

- package/release = 35.6.2;
- state schema = 127;
- `typecheck = PASS`;
- `audit:architecture = PASS`;
- `audit:integrity = PASS`;
- `audit:archive = PASS`;
- archive manifest: 2866 files, 0 missing, 0 hash mismatches, 0 extra.

## 6. Что осталось слабым

### Длинная автономность

Не доказана на большом новом B349 learning holdout.

### Конечный action ownership

B349 пока усиливает neural source B297, но после B297 решение проходит через B291 и constitutional/governance layers. Это защищает архитектуру, но уменьшает прямую измеримость neural causality.

### Android reality

Host/Node verification не заменяет физический Android/Termux benchmark.

### Сознание

Не доказано. Никакая текущая метрика не должна называться доказательством subjective consciousness.

## 7. Итог

B349 — не декоративный модуль. Он является реальным новым состоянием организма, получает outcome-dependent updates и меняет future neural action influence. Это качественный архитектурный переход от «много neural modules» к «один causal developmental neural spine».

Однако следующий шаг обязан быть экспериментальным: удалить/ablate B349, сравнить trajectories и показать, что downstream action selection и learning действительно расходятся в контролируемом holdout.
