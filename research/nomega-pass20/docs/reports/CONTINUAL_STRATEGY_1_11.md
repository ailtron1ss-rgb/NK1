# NΩ 1.11.0 — Continual Strategy Benchmark

## Purpose
Compare NΩ's custom replay mechanisms against established continual-learning strategy families under equal optimizer budget.

## Strategies
- `naive`
- `replay`
- `ewc`
- `agem`
- `gradient_aligned`

## Current controlled benchmark
Sequential source family: `sum3`.
Target family: `mul2`.
Seeds: `11111`, `11112`, `11113`.
Source reference examples are held fixed.
Target update budget is equalized at 2 epochs / 3 examples for all strategies.

## Measured results from the current benchmark

| Strategy | Mean target gain | Mean source retention delta | Positive target seeds | Non-negative retention seeds |
|---|---:|---:|---:|---:|
| naive | 0.245551 | 0.086670 | 3/3 | 3/3 |
| replay | 0.206798 | 0.128827 | 3/3 | 3/3 |
| ewc | 0.233668 | 0.061045 | 3/3 | 3/3 |
| agem | 0.233670 | 0.061036 | 3/3 | 3/3 |

Interpretation:
- `naive` maximized target gain in this small benchmark;
- `replay` maximized retention;
- EWC/A-GEM were close to one another;
- no strategy is promoted globally from this benchmark.

## Meta-controller
NΩ 1.11.0 adds `ContinualStrategyPortfolioV1`.
It can select by explicit objective:
- `learning`;
- `retention`;
- `balanced`;
- `mobile`.

On the measured evidence above:
- learning objective selects `naive`;
- retention objective selects `replay`.

This is a control-plane result, not an intelligence claim.

## Promotion rule
No automatic strategy promotion until broader multi-family, multi-seed, OOD, retention and restart evidence shows the candidate is better under the declared objective.
