# B298 — Closed-Loop Neural Personality Architecture

## Архитектурная схема

```text
WORLD / BODY / USER
       |
       v
observation + interoception
       |
       v
canonical recurrent state
       |
       +------------------------------+
       |                              |
       v                              v
world/self prediction            homeostatic pressure
       |                              |
       +--------------+---------------+
                      v
              candidate actions
                      |
                      v
              B296 neural nucleus
          (spikes + traces + plasticity)
                      |
                      v
               B297 fusion seam
                      |
            ownership checkpoints
                      |
                      v
            governance finalization
                      |
                      v
                  ACTION
                      |
                      v
            EMBODIED WORLD OUTCOME
                      |
            +---------+----------+
            |                    |
            v                    v
      causal learning       personality learning
            |                    |
            +---------+----------+
                      v
                memory/replay
                      |
                      v
                self / identity
                      |
                      +----> next cycle
```

## Принцип

Главный объект обучения — не отдельный модуль, а замкнутый causal organism loop.

Новый neural subsystem без `outcome -> weight update -> future behaviour` считается неприоритетным.

## Resource policy

На mobile:

- frequent: B296 readout/plasticity;
- medium: B293/B294;
- slower: B261-B264 heavy causal bridge;
- offline: replay, structural maintenance, consolidation.

Так мы не строим «катер из всех двигателей сразу» на телефоне.
