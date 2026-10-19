# Neuro-Kurisu 35.6.34 — cumulative progress after B450

## Инженерный прогресс
| Область | Выполнение | Оценка |
|---|---:|---:|
| Runtime integrity | 98% | 9.5/10 |
| Canonical neural decision spine | 88% | 8.4/10 |
| Causal learning | 90% | 8.8/10 |
| Autobiographical memory | 88% | 8.5/10 |
| Self-model / identity continuity | 80% | 7.8/10 |
| Values | 85% | 8.3/10 |
| Goal ecology | 86% | 8.3/10 |
| Predictive world modelling | 79% | 7.6/10 |
| Motivation / homeostasis | 73% | 7.0/10 |
| Personality development | 82% | 7.9/10 |
| Neural substrate integration | 81% | 7.8/10 |
| Meta-cognitive strategy routing | 72% | 7.0/10 |
| Adaptive compute | 78% | 7.5/10 |
| Causal verification | 96% | 9.5/10 |
| Mobile/Termux readiness | 81% | 7.1/10 |
| React/Vite observability UI | 10% | 1.0/10 |

## Overall engineering maturity
**≈ 81/100**.

Это не процент человеческого сознания, биологической эквивалентности мозга или доказанной phenomenal consciousness. Эти утверждения текущими тестами не подтверждаются.

## Verified current results
- B382 causal knockout ≈ 0.36654; restart delta 0.
- B383 context separation ≈ 0.45953; history knockout ≈ 0.46000; restart delta 0.
- B384 history knockout/causal delta ≈ 0.01619.
- B391–B400 aggregate knockout ≈ 0.97977; holdout 0.73; integrity 1.
- B421–B450 synthetic associative-memory benchmark: 14.29% baseline → 100% adaptive (+85.71 pp).
- B421–B450 OrganismCore integration: 17 decisions, 10 updates, restart persistence PASS, lesion ≈ 0.01568.

## Ограничение
Большой `organism-smoke` остаётся проверенным отдельно; в объединённом длинном command chain он ранее упирался в timeout, поэтому это не объявляется единым aggregate PASS. Отдельный `test:smoke` прошёл за ~29 s.
