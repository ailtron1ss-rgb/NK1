# BIG PASS 172 — Emotion / Interoceptive Mind 2.0

Дата: 2026-09-10T03:53:48.094003
Версия: **35.6.1**

## Цель
Усилить существующий контур P66 interoception → emotion appraisal → feeling access → policy без создания дублей и доказать каузальное влияние внутреннего телесного состояния.

## Крупные изменения
- `EmotionAppraisalEngine` → state v2 с накопительным `interoception` и `outcomes`.
- Онлайн-прогноз/ошибка для energy/thermal/capacity/load.
- Regulation pressure, stability, recovery и prediction calibration.
- Исправлен реальный баг арифметического выражения valence вокруг `??`.
- Исправлен semantic mismatch в `inferFeeling`.
- Episode IDs больше не зависят от `Math.random()`.
- Action outcome calibration влияет на policy только после накопления evidence.
- `P66InteroceptiveHomeostasis` получил recovery debt и hysteresis.
- Core реально передаёт P66 телеметрию в emotion layer и сохраняет оба состояния.

## BIG PASS 172 evidence
- positive valence: **0.8810**
- stress label: **anxiety**
- feeling mismatch: **0.4880**
- rest bias: **0.03017**
- high body load mode: **recover**
- high body load pressure: **0.5944**
- recovery debt after recovery sequence: **0.04749**

### Stable vs stressed body, same cognitive task
- stable regulation: **0.1272**
- stressed regulation: **0.3040**
- stable mean stress: **0.4622**
- stressed mean stress: **0.7355**
- stable recovery debt: **0.0486**
- stressed recovery debt: **0.2235**
- restart persistence: **PASS**

## Function reality
- semantic inventory: **2471**
- VERIFIED: **18 (0.73%)**
- INTEGRATION_ONLY: **578**
- UNSAFE_TO_AUTO_RUN: **214**
- UNVERIFIED: **1661**
- parameterized probe: **478/509 PASS, failures=0**
- dormant unverified: список сохранён в `FUNCTION_REALITY_STATUS_172.json` (top candidates)
- critical unverified: список сохранён в `FUNCTION_REALITY_STATUS_172.json` (top candidates)

Функция не считается реализованной только из-за существования декларации.

## Regression
После изменений PASS: typecheck, 172, 171, 170, 169 cognitive/recovery, P66/P68, 166, 165 economy/longitudinal/knockout, smoke, restart, dedupe, concurrency, P24, P26, P28, P29, P30, P31, P31 lesion, P32, P33, P34, P35, P37, P41, public utilities, parameterized probe, semantic coverage, liveness, architecture, integrity, forensics, hygiene, release-source, lock, brain.

Aggregate `audit:big-pass-172` был запущен, но превысил sandbox runtime limit на длинной последовательности. Это **не** считается функциональным PASS или FAIL; все критические gates были выполнены отдельно и получили PASS.

## First analysis recheck
| Направление | Статус | Комментарий |
|---|---|---|
| Semantic Coverage Foundation | PARTIAL | 2471 declarations tracked; strict reality ledger exists, lifecycle closure remains. |
| Cognitive Event Fabric | DONE | Regression PASS. |
| Unified Cognitive Cycle | DONE | Regression PASS. |
| Memory Economy | DONE | Causal memory/value chain remains PASS. |
| Emotion / Feeling | IMPROVED / PARTIAL | Interoceptive affect prediction, regulation pressure, recovery debt, hysteresis and outcome calibration added; phenomenal feeling remains unproven. |
| Reality vs Simulation | DONE | Functional scope PASS; physical-device acceptance remains. |
| World Model | PARTIAL | Ensemble/calibration working; broader counterfactual and non-stationary validation remains. |
| Self Model / Identity | PARTIAL | Value→identity causal effect proven; long-horizon stability remains. |
| Agency / Autonomous Projects | PARTIAL | Core paths verified; full lifecycle remains. |
| Learning | PARTIAL | P26/P28/P29/P30 PASS; whole-system lifecycle verification incomplete. |
| Social Mind | PARTIAL | Dedicated compound causal battery pending. |
| Perception | PARTIAL | P35/P37/P41 PASS; device lifecycle pending. |
| Embodiment | PARTIAL | Interoceptive control deepened; physical Android bridge pending. |
| Consciousness research battery | PARTIAL / research-only | P31/P31-lesion PASS; no phenomenal claim. |
| Long-Horizon Life | PARTIAL | 7/30/90 day acceptance pending. |
| Android Production Runtime | NOT DONE | Physical acceptance pending. |
| Adversarial Organism Testing | PARTIAL | Existing negative controls; compound battery pending. |

**Macro maturity: 58.8%**. Это инженерная зрелость по крупным направлениям, а не процент сознания.

## Вывод
Главный результат 172 — emotion теперь зависит от реальной интероцептивной динамики и может менять регуляторную политику. Следующий bottleneck — не добавление декоративных подсистем, а закрытие большой очереди функций, для которых пока нет полного lifecycle evidence.
