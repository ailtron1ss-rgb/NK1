# Active Roadmap — 35.6.16 / B364

## Главный статус
B364 продолжает единый SCS-DIT spine после B363. Brick 5 predictive planning остаётся functional-host verified; следующий слой — реальное sensorimotor embodiment без подмены Android host-probe симуляцией.

## Что закрыто B364
1. 100-cycle full-pulse mobile-profile endurance: PASS.
2. 1000 operational-cycle long-horizon persistence с restart на 100/500: PASS.
3. P39 lifeTicks и P54 evidence cycles теперь считают каждый operational tick, включая micro-cycle.
4. Emergency checkpoint после endBatch действительно физически записывается и переживает restart.
5. Body homeostasis causal selection: nominal explore → critical rest, candidate L1 0.718368, rest lift 0.252293.
6. Host/device evidence boundary: node-host не может стать REAL_DEVICE_VERIFIED без live Termux Android evidence.
7. EmbodiedActionExecutor: выбранное действие получает отдельный body execution gate. Нет live capability → `unavailable`, а не fake success.
8. `rest` вызывает реальный embodied state transition; результат сохраняется и переживает restart.

## Доказательные результаты
- B364 long horizon: 1000/1000 ticks, P39=1000, P54=1000, planningUpdates=6, identity continuity 0.93836, state file 2.75 MB, p95 177.59 ms, 960 micro-cycles + 40 pulses.
- B364 cadence-100: 100/100, P39=100, P54=100, 12 planning updates, average 28.00 ms, p95 157.85 ms.
- B364 emergency checkpoint: checkpoint=1, restoredTick=1.
- B364 sensorimotor reality gate: PASS; host explore remains `unavailable`, rest is executed and persisted.

## Что остаётся OPEN
- Physical Android/Termux verification: OPEN.
- Full sensor→action→world/device→outcome→learning causal loop на реальном Android: OPEN.
- Реальный camera/microphone action outcome as learning evidence: OPEN until physical device evidence.
- B362/B363 predictive selection performance replication remains historical performance gate where applicable; no claim is upgraded merely by this release.
- Phenomenal consciousness: UNKNOWN.

## Следующий крупный шаг
B365 — довести sensorimotor loop до causal learning contract: device observation must alter body state, selected action must trigger real device capability, real outcome must return as external/device evidence, and only then may that outcome update predictive/personality learning. Physical Android remains a hard evidence gate.
