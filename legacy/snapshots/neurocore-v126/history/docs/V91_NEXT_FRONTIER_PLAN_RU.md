# V91 → next frontier

## PASS 93 — external continual-learning qualification

Сначала внешний/стандартный evaluation harness и собственные long-stream задачи.

Обязательные метрики:

- average accuracy / quality;
- final quality;
- forgetting;
- forward/backward transfer;
- adaptation speed;
- recovery after perturbation;
- long-horizon recall;
- compute/RAM.

## PASS 93 — recurrent tournament

Сравнить под matched budget:

- current V91;
- GDN-2-inspired;
- preconditioned delta variants;
- Raven-style routing variants;
- compact Mamba-3-style SSM.

Не интегрировать кандидата только по одному synthetic score.

## PASS 94 — current-engine flattening

Текущее `NeuroCoreCurrent` уже не является VXX subclass, но его compatibility backend всё ещё основан на
V88. Следующий структурный шаг — вынести необходимые owners из V88 в explicit current owners, оставив V88
только для migration/compatibility.

## PASS 95 — mobile qualification

Batch=1 streaming profile на целевом Android-устройстве:

latency, RAM, allocations, GC, sustained run, checkpoint/restart, thermal degradation.
