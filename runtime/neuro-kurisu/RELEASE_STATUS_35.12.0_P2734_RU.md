# Neuro-Kurisu 35.12.0 / P2734 — Release Status

Дата: 2026-09-20

## Статус

**P2734 — большой интеграционный проход завершён по production code, ablation, regression, persistence и release audits.**

## Доля работы прохода

- production code: **~82%**
- tests / ablations / endurance: **~12%**
- research / docs / release evidence: **~6%**

## План → факт

1. Fast/meta learner — DONE
2. Adaptive meta warm-up — DONE
3. Automatic context allocation/boundary detection — DONE
4. Per-action/context calibration — DONE
5. Counterfactual regret — DONE
6. Adaptive replay controller — DONE
7. Actual meta-controlled replay integration — DONE
8. Replay feedback loop — DONE
9. Consolidation of selected replay episodes — DONE
10. Mobile/resource budget integration — DONE
11. Snapshot/restore + ablation — DONE
12. 320-outcome P2734 factorial/ablation — PASS
13. P2726/P2724/P2720 regression chain — PASS
14. Smoke/typecheck — PASS
15. Full release/audit chain — PASS

## Current key evidence

- P2734: 320 outcomes, 6 contexts, 32 switches, replay feedback 320, entropy 1.0, consolidations 613, calibration 0.7742.
- P2726: 240 outcomes, replayUsed 493, depth 2 planning, restart PASS.
- P2724 mobile: 1500 cycles / 750 outcomes, max host heap growth 27.0 MB, end growth 37.6 MB, restart PASS.
- P2720: sparse=.2032, protected=.2701, delay confidence=.9857.

## Current engineering completeness estimates

- Neural substrate: **77/100**
- Online plasticity: **83/100**
- Delayed credit: **81/100**
- Continual learning: **81/100**
- Selective replay: **82/100**
- World model / planning: **86/100**
- Counterfactual / causal learning: **81/100**
- Personality continuity: **75/100**
- Global workspace: **64/100**
- Autonomy: **70/100**
- Continuous cognition: **80/100**
- Self-model: **71/100**
- Embodiment: **61/100**
- Persistence: **85/100**
- Mobile efficiency: **65/100**
- Experimental infrastructure: **93/100**

**Сводная инженерная зрелость: ~79/100.** Это оценка состояния реализации, а не вероятность/процент сознания.

## Open gaps

- independent replay factorial;
- A→B→C→A / interleaved / sparse-delayed / noisy verification / distribution shift;
- false-boundary vs missed-boundary sweep;
- physical Termux/Android thermal and memory evidence;
- richer intervention-capable latent world model;
- deeper identity/agency/embodiment integration.

## Resource-pressure finding during combined release chain

Раздельно `test:smoke` и `test:p2724:mobile` проходят. Полная последовательная цепочка при одном long-lived shell периодически упирается в resource pressure и timeout на следующем heavy process. Это не засчитано как PASS combined-suite.

RSS comparison for `test:smoke`:
- P2726 baseline: ~599,772 KB max RSS (~586 MB decimal / ~572 MiB)
- P2734: ~632,528 KB max RSS (~633 MB decimal)
- delta: ~32.8 MB / ~5.5%

Это показывает, что значительная часть memory floor существовала до P2734; nevertheless mobile efficiency remains an explicit debt, especially because the target is a medium Android phone.
