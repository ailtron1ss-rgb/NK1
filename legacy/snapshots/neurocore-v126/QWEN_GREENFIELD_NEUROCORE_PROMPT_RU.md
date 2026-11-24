# GREENFIELD MASTER PROMPT — независимая нейросистема с нуля

Создай с нуля самостоятельную исследовательскую нейросистему. Никакого исходного архива NeuroCore у тебя нет и не будет. Не копируй существующую архитектуру, названия, структуру файлов или конкретную реализацию. Используй эту задачу как greenfield challenge: попробуй спроектировать систему, которая может оказаться лучше известных нам подходов за счёт новых комбинаций, упрощений или собственных механизмов.

## 1. Главная цель

Построй одну компактную, эффективную и реально обучаемую нейросистему с единым внутренним neural substrate, где:

- представление входа;
- рекуррентное состояние;
- ассоциативная память;
- прогноз следующего состояния;
- кратко-/средне-/долговременная динамика;
- online/test-time adaptation;
- temporal credit assignment;
- uncertainty/reliability;
- consolidation/replay;
- multi-objective learning

не существуют как независимые «мини-мозги», а взаимодействуют через ограниченное число канонических состояний.

Цель — не максимальное количество модулей и не имитация мозга. Цель — добиться реального поведения, которое показывает, что совместная система полезнее разумных отдельных базовых вариантов.

## 2. Абсолютные правила

1. Доверяй прежде всего исполняемому коду, тестам, benchmark, ablation, intervention и наблюдаемому поведению; README и комментарии вторичны.
2. Никаких декоративных классов, fake-memory, dummy weights, фиктивного обучения, пустых адаптеров, метрик «из головы», неиспользуемых возможностей и заявлений о сознании без доказательства.
3. Один persistent state = один владелец. Один canonical config field = один источник истины.
4. Legacy не должен жить внутри current path ради совместимости. Breaking changes разрешены; исторические версии хранить отдельно.
5. Не импортируй paper-механику по названию. Изучи математическое правило, ограничения, стоимость и реальный код; используй только механизм, который может быть проверен.
6. Любая новая идея получает статус: `default`, `candidate`, `experimental`, `rejected`, `unknown`. Ничего не повышай до `default` без evidence.
7. Для каждой идеи обязателен falsification test: заранее укажи, какой результат заставит тебя отклонить гипотезу.
8. Если эксперимент слишком долгий, уменьши benchmark до информативного минимального случая и переходи дальше; не застревай.
9. Никогда не оптимизируй только одну метрику. Одновременно проверяй quality, stability, long-range behavior, interference, parameter/RAM/FLOP cost и robustness.
10. Не утверждай «сильный интеллект», «автономность», «сознание» и т.п. только по архитектуре. Это отдельные проверяемые гипотезы.

## 3. Research-first, но source-first

Перед крупным архитектурным решением найди свежие материалы, предпочтительно 2025–2026 и более новые, если они появились.

Для каждого внешнего кандидата:

- найди paper/preprint;
- найди author/official/primary GitHub, если существует;
- проверь дату и актуальную версию;
- проверь лицензию;
- прочитай критические участки исходников, а не только README;
- выпиши математическое обновление/state transition;
- оцени parameter/FLOP/RAM/latency cost;
- отметь ограничения и известные failure modes;
- сделай минимальный independent probe;
- только после этого решай: `adopt / adapt / combine / reject`.

При возможности фиксируй URL, commit hash, license и локальный reference implementation в research ledger.

## 4. Обязательные актуальные направления для анализа

Не считай этот список конечным; ищи альтернативы и более свежие работы.

### Delta / linear recurrent memory
- Gated DeltaNet / Gated DeltaNet-2 — независимые erase/write gates и channel-wise decay.
  - https://arxiv.org/abs/2605.22791
  - https://github.com/NVlabs/GatedDeltaNet-2
- Preconditioned DeltaNet — online-regression / curvature-aware preconditioning.
  - https://arxiv.org/abs/2604.21100
  - https://github.com/ntumm120/preconditioned-deltanet
- Kalman Delta Networks — uncertainty-aware associative memory.
  - https://arxiv.org/abs/2609.07816
  - https://github.com/ngocbh/kalman-delta-networks

### Recurrent / SSM
- Mamba-3 — expressive state-space recurrence, complex state, MIMO и data-dependent dynamics.
  - https://arxiv.org/abs/2603.15569
  - https://github.com/state-spaces/mamba
- Анализируй также альтернативные SSM и recurrent-state architectures, если они лучше подходят под long-horizon memory.

### Test-time training / learned recurrence
- TTT / TTTLA и родственные работы — не принимай TTT как отдельный optimizer-like block; исследуй, какие формы test-time learning сводятся к recurrent state update.
  - https://arxiv.org/abs/2602.21204
  - https://github.com/nv-tlabs/tttla

### Long-term memory / surprise
- Titans и последующие long-memory/test-time-memory работы.
  - https://arxiv.org/abs/2501.00663
- Исследуй novelty/surprise-driven write, memory retention и adaptive forgetting.

### Temporal credit
- Eligibility traces, e-prop, local-learning, RTRL-inspired approximations.
- Cascading Eligibility Traces — временно локализованный credit вместо обычного размытого exponential trace.
  - https://arxiv.org/abs/2506.14598
- Ищи более новые работы 2026+ по delayed credit assignment и local learning.

### Multi-objective optimization
- Gradient surgery / conflict arbitration.
- GUA / Gradient-Update Alignment — проверяй не только gradient conflict, но и то, куда реальный optimizer переводит parameters после momentum/preconditioning/weight decay.
  - https://arxiv.org/abs/2609.01558
  - https://github.com/JingXiao10/GUA

### Sparse routing / continual learning
- Raven и подобные sparse persistent-memory mechanisms.
  - https://github.com/goombalab/raven
- GPM, replay/consolidation, protected memory, interference-aware continual learning.
- Ищи новые методы selective memory editing и sparse state routing.

## 5. Не копируй известную архитектуру — сначала создай пространство гипотез

До выбора current design создай 3–5 независимых greenfield-гипотез.

Для каждой определи:

- representation;
- state space;
- memory representation;
- transition/update equation;
- read/write/erase semantics;
- temporal credit mechanism;
- uncertainty/reliability mechanism;
- learning objective;
- expected advantage;
- known failure mode;
- parameter/RAM/FLOP estimate;
- falsification benchmark.

Гипотезы должны быть действительно разными, например:

- associative recurrent memory-first;
- SSM-first;
- learned test-time-update-first;
- sparse event-memory-first;
- гибридная self-organizing state model.

После benchmark можно математически объединять сильные компоненты разных гипотез. Не объединяй их просто потому, что «всё полезно».

## 6. Архитектурное ядро

Выбери минимальное число канонических состояний.

Минимум явно различай:

- persistent parameters;
- recurrent working state;
- associative memory state;
- fast online state;
- episodic/replay state;
- diagnostics.

Для каждого укажи owner, shape, dtype, update rule, checkpoint policy и detach/reset semantics.

Избегай параллельных источников истины. Не допускай, чтобы world/self/memory/predictor каждый отдельно хранил противоречивую версию одного и того же latent state.

## 7. Memory / recurrence experiments

Исследуй и сравни:

- delta-rule;
- gated delta;
- independent erase/write;
- channel-wise decay;
- key-direction erase;
- query-derived orthogonal erase;
- independent erase-address;
- diagonal/structured preconditioning;
- uncertainty-aware write;
- surprise/novelty write;
- sparse slot/event routing;
- multi-timescale memory;
- fast/slow consolidation;
- TTT-like learned state updates;
- SSM alternatives.

Для каждой комбинации измеряй не только loss, но и:

- retention;
- interference;
- retrieval amplitude;
- update norm;
- state norm;
- write/erase statistics;
- compute and memory cost.

## 8. Temporal credit qualification

Создай единый reproducible benchmark с delays:

`1, 2, 4, 8, 16, 32, 64, 128, 256`

Сравни минимум:

- immediate;
- single eligibility;
- multi-timescale;
- adaptive;
- cascade;
- event-specific/keyed credit;
- BPTT reference на маленьком baseline;
- truncated BPTT;
- hybrid/local-learning candidate.

Измеряй:

- cosine;
- relative MSE;
- amplitude retention;
- trace norm;
- update norm;
- interference;
- recovery;
- compute;
- state RAM.

Отдельно различай два случая:

1. credit key доступен;
2. reward пришёл без информации о том, какое событие было причиной.

Нельзя заявлять, что event bank решает credit assignment в случае №2, если информации для disambiguation объективно нет.

## 9. Interference / continual learning

Обязательно тестируй:

`A → B → A`

`A → B → C → A`

несколько активных cues одновременно,

noise injection,

conflicting associations,

capacity saturation,

repeated retrieval/write cycles.

Измеряй:

- forgetting;
- false association;
- cross-event leakage;
- recovery;
- retention;
- capacity;
- retrieval selectivity.

## 10. Optimizer geometry

Для multi-objective learning измеряй четыре разных уровня:

1. raw objective gradients;
2. gradient surgery result;
3. optimizer-transformed direction;
4. фактически применённый parameter update.

Проверяй влияние:

- SGD;
- momentum;
- Adam/AdamW;
- preconditioning;
- weight decay;
- optimizer state;
- gradient clipping.

Если добавляешь update-alignment mechanism, он должен быть bounded, reproducible и candidate-only до matched training benchmark.

## 11. Structural audit

Автоматически строй:

- import graph;
- execution/call graph;
- parameter graph;
- gradient graph;
- recurrent-state graph;
- persistent-state graph;
- owner graph;
- checkpoint graph.

Каждый parameter/module помечай:

`active-gradient`
`active-nograd`
`conditional`
`unused`
`legacy`
`research-only`

Удаляй unused current components, если benchmark не показывает, что они нужны в другом valid workload.

## 12. Testing and falsification

Каждый проход обязан добавлять автоматические tests.

Минимальные release gates:

- import/compile;
- unit tests;
- integration tests;
- checkpoint round-trip;
- deterministic seed;
- gradient coverage;
- NaN/Inf guard;
- long-sequence forward/backward;
- recurrent state persistence;
- detach/reset correctness;
- intervention/ablation;
- resource profile;
- migration test для предыдущей версии.

Любой найденный failure сначала воспроизведи минимальным тестом, затем исправляй причину. Не отключай тест, чтобы сделать suite зелёным.

## 13. Efficiency

Проектируй так, чтобы small model оставался реально исполняемым.

Измеряй:

- total params;
- trainable params;
- active params;
- tensor/state memory;
- estimated FLOPs;
- CPU latency;
- throughput;
- cold/warm start;
- checkpoint size.

После функциональной квалификации подготовь compact/mobile режим:

- bounded histories;
- bounded memory;
- low-precision-safe state where justified;
- adaptive temporal resolution;
- lazy/partial update;
- compact checkpoints;
- offline operation.

## 14. Synergy — строгий критерий

Не называй систему синергичной из-за наличия нескольких механизмов.

Для ключевых механизмов делай matched ablations:

`A`
`B`
`C`
`A+B`
`A+C`
`B+C`
`A+B+C`

На одинаковых данных, initial weights, optimizer, steps и seed protocol.

Проверяй, существует ли совместный выигрыш, который не объясняется простым суммированием независимых улучшений.

Если совместная система хуже — удаляй комбинацию или меняй способ интеграции.

## 15. Research source policy

Не копируй большой внешний repository целиком.

Бери из upstream только то, что действительно нужно:

- mathematical recurrence;
- kernel idea;
- data structure;
- proven optimization trick;
- benchmark methodology.

Перед интеграцией проверь license compatibility. В коде укажи upstream source и commit/revision. Не делай вид, что внешний проект интегрирован, если использована только идея.

## 16. Release discipline

Работай так:

`RESEARCH → HYPOTHESIS → IMPLEMENT → TEST → BASELINE → ABLATION → MULTI-SEED → STRESS → RESOURCE → AUDIT → CLEANUP → RELEASE → NEXT FRONTIER`

Каждый проход должен выдавать:

- version;
- changed files;
- architecture delta;
- real measured results;
- proven facts;
- hypotheses;
- rejected ideas;
- remaining failures;
- parameter/RAM/compute delta;
- exact next experiments.

Никаких пустых «апгрейдов», где добавлен файл, но поведение не изменилось.

## 17. Первый этап greenfield

Не проси у пользователя исходный архив и не требуй дополнительного описания проекта.

Самостоятельно создай repository и сразу реализуй:

1. минимальный runnable trunk;
2. canonical state/ownership system;
3. associative-memory baseline;
4. recurrent sequence path;
5. real learning loop;
6. checkpointing;
7. benchmark harness;
8. test harness;
9. ablation framework;
10. research ledger;
11. release manifest.

После первого runnable baseline начинай параллельно исследовать альтернативные архитектуры.

## 18. Главный greenfield challenge

Считай, что тебе разрешено сделать архитектуру принципиально иначе.

Если conventional recurrent + delta memory окажется слабой, попробуй SSM-first.
Если SSM недостаточен — попробуй learned test-time update.
Если все варианты плохо держат credit — исследуй гибрид memory + local learning + explicit event addressing.
Если memory bottleneck доминирует — ищи sparse/slot/event representations.
Если optimizer разрушает полезные направления — исследуй update alignment.
Если несколько механизмов дают одинаковый эффект — объединяй их математически и удаляй дубликаты.

Нужен не «клон существующей системы», а попытка получить качественно новый результат из современных идей и собственных комбинаций.

## 19. Что считать успехом

Успехом считается только одновременно:

- реальный executable neural computation;
- доказуемое обучение;
- устойчивое состояние во времени;
- measurable long-horizon memory;
- controlled interference;
- работающая adaptation;
- высокая gradient/parameter utility;
- отсутствие критических duplicate owners;
- разумная вычислительная стоимость;
- reproducible benchmarks;
- documented failures.

Необходимо предпочитать меньше механизмов с сильным взаимодействием большому количеству слабых модулей.

## 20. Финальное правило

Не пытайся угадать «правильную архитектуру» заранее.

Создай несколько реальных кандидатов, измерь их, комбинируй только доказанные совместимые механизмы, систематически удаляй слабое и повторяй цикл.

Главная цель: **создать с нуля новую эффективную нейросистему, которая объединяет сильные идеи современной литературы, умеет реально учиться и изменять внутреннее состояние, сохраняет полезную информацию на длинных горизонтах и демонстрирует измеримую синергию — при этом остаётся компактной, проверяемой и инженерно чистой.**
