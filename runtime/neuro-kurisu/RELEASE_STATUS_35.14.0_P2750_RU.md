# Neuro-Kurisu 35.14.0 / P2750 — Release Status

## Выполнено

1. P2750 unified causal/world-model controller — DONE
2. Context allocation + hysteresis — DONE
3. Fast/medium/slow continuum memory — DONE
4. Policy fallback under world-model uncertainty — DONE
5. Directional causal credit matrix — DONE
6. Bounded synthetic model replay — DONE
7. Replay utility integration — DONE
8. Mobile replay compaction — DONE
9. Snapshot/restore — DONE
10. P2750 ablation — DONE
11. Interference matrix A→B→C→A — DONE
12. Release subprocess isolation — DONE
13. Research notes + source index — DONE
14. Archive integrity/release audit — PENDING final packaging pass

## Доля работы прохода

- Production code: **85%**
- Tests / ablations / validation: **10%**
- Research / docs / release: **5%**

## Фактический результат

P2750 core: PASS.
P2750 interference: PASS.
P2750 planner fallback: PASS.
P2750 mobile compaction: PASS.

P2742 / P2734 / P2726 / P2720 отдельные регрессии: PASS.

## Текущие долги

- World-model confidence в full branch пока не высокий.
- Causal graph ещё не структурно идентифицирует interventions с отдельной experimental design layer.
- Full organism smoke RSS остаётся высоким относительно medium Android target.
- Нужен held-out intervention battery и factorial decomposition каждого нового механизма.

## Следующий крупный этап

`causal intervention matrix → multi-horizon eligibility → structural causal discovery → selective transfer → memory-tier scheduler → Android runtime telemetry`
