# P2841 Progress

## Реализовано

- postcondition classification — DONE
- external consequence -> grounded world — DONE
- runtime integration — DONE
- holdout readiness — DONE
- grounded-world persistence across restart — DONE
- exact shadow-divergence provenance — DONE
- conservative trial-coverage gating — DONE
- migration 209 -> 210 — DONE
- regression verification — DONE

## В процессе

- independent physical actuator effect verification — requires hardware
- long-horizon causal calibration across multiple device environments
- persistent active-perception cost optimization
- richer visual grounding from camera evidence

## Статус

P2841 software phase: complete for current repository scope.

Проверка holdout: после 1 verified trial readiness ≈ 0.162; после 6 matched verified trials ≈ 0.974. Это специально сделано так, чтобы качество одного события не могло компенсировать отсутствие повторных наблюдений.
Hardware phase: pending actual Android/Termux device evidence.
