# V90 — Отчёт neurality pass

## Цель

Увеличить реальную способность recurrent core хранить и восстанавливать эпизодическую информацию, не создавая второй memory owner и не продолжая VXX inheritance chain.

## Реализация

`src/neurocore/current/neural_spine.py` реализует единый recurrent state:

```text
features
  ├─ q/k/v
  ├─ erase gate
  ├─ write gate
  ├─ sparse router
  └─ online key-energy preconditioner
          ↓
  recurrent associative state
          ↓
  read → hidden → next_latent / memory_context
```

### Почему это не декорация

- router непосредственно управляет тем, какие строки state получают физическое обновление;
- preconditioner непосредственно масштабирует delta update;
- erase и write непосредственно меняют state update;
- state участвует в `next_latent`, который входит в существующий end-to-end loss;
- полный модельный шаг даёт ненулевые градиенты большинству параметров новой spine.

## Research mapping

### Gated DeltaNet-2
NVIDIA описывает разделение channel-wise erase и write, channel-wise decay и delta-rule update; paper reports the strongest effect from the erase gate in its ablations. NeuroCore использует ту же архитектурную мотивацию, но свою компактную формулу и своё state shape.

Источник: https://research.nvidia.com/publication/2026-05_gated-deltanet-2-decoupling-erase-and-write-linear-attention
Официальный код: https://github.com/NVlabs/GatedDeltaNet-2

### Raven
Raven рассматривает fixed memory slots и input-dependent sparse updates как способ уменьшить interference dense recurrent writes и сохранить long-range recall. В NeuroCore эта идея сведена к top-k editing строк компактного recurrent matrix-state.

Источник: https://arxiv.org/abs/2607.25357
Reference ecosystem: https://github.com/fla-org/flash-linear-attention

### Preconditioned DeltaNet
Работа формулирует delta recurrences как online least-squares/test-time regression и показывает преимущества curvature-aware preconditioning; NeuroCore использует только компактную diagonal inverse-RMS approximation, поэтому claim ограничен и не эквивалентен полному PGDN.

Источник: https://arxiv.org/abs/2604.21100
Reference ecosystem: https://github.com/fla-org/flash-linear-attention

## Qualification protocol

Задача специально создана так, чтобы mapping key→value менялся в каждом эпизоде. Поэтому модель не может решить тест простым memorization глобального соответствия. Каждая последовательность содержит четыре записи, два distractor tokens и финальный query. Оценивается cosine между восстановленным value и истинным value и top-1 по one-hot value.

5 seeds, 240 optimizer steps на seed:

| Metric | V82 | V90 |
|---|---:|---:|
| cosine mean | 0.3871 | **0.4650** |
| cosine SD | 0.0261 | 0.0815 |
| top-1 mean | 0.1958 | **0.3255** |
| top-1 SD | 0.0426 | 0.1441 |
| training micro-time | 2.441 s | 3.275 s |

## Интерпретация

V90 показывает существенный положительный локальный сигнал recall. Разброс между seeds вырос, поэтому следующий gate должен проверить устойчивость эффекта на более длинных streams и внешних continual-learning benchmarks.

Latency penalty пока реальный: V90 примерно на 34% дороже в этом CPU microbenchmark. Это принимается как цена за capability gain, но Pass 93 должен искать способ снять накладные расходы без потери recall.

## Статус

**IMPLEMENTED + OBSERVED BENEFIT, NOT YET GENERALLY PROVEN.**


## Migration qualification

Реальный V89-style checkpoint, сохранённый старым `RuntimeStateStoreCurrent` форматом, успешно загружен
в V90: 2158 tensor entries перенесены, 32 legacy recurrent-spine tensor entries намеренно пропущены,
optimizer moments сброшены из-за изменившейся группы параметров. Таким образом, старая recurrent семантика
не подмешивается в V90, но остальная совместимая модельная/тренировочная информация сохраняется.
