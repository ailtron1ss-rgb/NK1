# Experiment Results — P2575–P2586

## Dream/No-Dream ablation

2400+ transition cycles.

Dream:
- 171 rehearsal cycles
- 413 dream updates
- protected action skill = 0.5075
- retention = 0.6131
- last dream quality = 0.7097
- conflict count = 581
- negative transfer = 0.1393

Plain:
- 0 dream updates
- protected action skill = 0.5000
- retention = 0.5000
- conflict count = 580
- negative transfer = 0.1399

Измеренный retention delta: +0.1131 в этом контролируемом benchmark.

## Neural integration

768 neural cycles:
- 48 dream rehearsal cycles
- 178 dream updates
- skill retention vector: [0.658, 0.520, 0.542, 0.604, 0.545, 0.596, 0.601]
- conflict count = 13
- negative transfer = 0.0515
- causal sensitivity = 0.1310
- transfer = 0.9058
- foresight quality = 0.8816

## Performance

12000 planner cycles:
- ~0.367 s
- ~32699 cycles/s
- 3000 dream updates
- 750 rehearsal cycles
- 256 causal traces

## Interpretation

Результат поддерживает гипотезу, что bounded dream rehearsal способен защищать policy/action memory при длинной новой нагрузке. Это не доказательство универсального anti-forgetting и тем более не доказательство сознания. Нужен следующий holdout на новых задачах и независимых seed.
