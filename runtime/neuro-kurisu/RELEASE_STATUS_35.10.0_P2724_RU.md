# Historical release: Neuro-Kurisu 35.10.0 / P2724 — Release Status

## Статус

**P2724 — большой интеграционный проход завершён по коду, тестовой инфраструктуре и research-record.**

Цель прохода: связать lifelong plasticity с автономным context switching, selective replay, shallow world-model planning, counterfactual learning, sparse structural plasticity и mobile resource control.

## Фактическая доля работы прохода

- Новый/изменённый production-код: **~82%**
- Тесты, ablation и endurance: **~11%**
- Research/docs/release evidence: **~7%**

## Что выполнено

1. Новый `P2724AutonomousContinualFabric` — DONE
2. Context prototypes + context allocation — DONE
3. Online boundary/change-point signal — DONE
4. Interference matrix — DONE
5. Shallow world-model lookahead — DONE
6. Counterfactual action estimates — DONE
7. Compact selective replay — DONE
8. Replay реально воздействует на neural readouts — DONE
9. Sparse structural wake/prune/rewire — DONE
10. Mobile budget + residency controller — DONE
11. Persistence/restore — DONE
12. Experimental-layer ablation — DONE
13. 188-outcome continual battery + continuous-path integration — DONE
14. 1500-cycle / 750-outcome mobile endurance + restart — DONE
15. P2708/P2716 regression battery — PASS
16. Release schema/version/manifests + final audit pass — DONE

## Текущие оценки инженерной зрелости

Это оценки полноты реализации, а не проценты сознания.

| Компонент | Оценка /100 |
|---|---:|
| Neural substrate | 75 |
| Online plasticity | 81 |
| Delayed credit | 80 |
| Continual learning | 75 |
| Selective replay | 72 |
| World model / planning | 83 |
| Counterfactual / causal learning | 79 |
| Personality continuity | 74 |
| Global workspace | 64 |
| Autonomy | 67 |
| Continuous cognition | 78 |
| Self-model | 70 |
| Embodiment | 60 |
| Persistence | 82 |
| Mobile efficiency | 62 |
| Experimental infrastructure | 89 |

**Сводная инженерная зрелость: ~75/100.**

## Что осталось слабым

1. Physical Android evidence всё ещё не подтверждена host-only тестами.
2. World-model всё ещё shallow residual/reward model, а не полноценный latent simulator.
3. Counterfactual model не имеет полноценной external intervention graph.
4. Context detection heuristics; требуется learned/non-parametric context allocation.
5. Replay quality ещё надо сравнить с random replay/no replay/context-only replay на независимой батарее.
6. Для claims о consciousness нужны отдельные theory-linked ablations; текущий release этого не утверждает.

## Следующий крупный проход

A→B→C→A / interleaved / sparse delayed reward / noisy verification / distribution shift + 1000–2000 cycles + adaptive context allocator + latent world-model planning + replay mixture optimization + stronger structural rewiring + Android/Termux device evidence.
