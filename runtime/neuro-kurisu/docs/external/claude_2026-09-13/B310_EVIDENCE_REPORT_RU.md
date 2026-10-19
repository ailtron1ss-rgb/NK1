# B310 Evidence Report
Дата: 13.09.2026

## Core B310 evidence
| Проверка | Результат |
|---|---:|
| Typecheck | PASS |
| Source credit positive | 0.899399 |
| Source credit negative | 0.117082 |
| Policy effective weight neutral | 0.761472 |
| Policy effective weight trained | 1.000000 |
| Whole-organism baseline | explore 11 / verify 13 |
| Whole-organism trained | explore 11 / verify 13 |
| Natural L1 distribution shift | 0 |
| Candidate-surface first-cycle L1 shift | 0.008500 |
| Policy lesion distribution | wait 24/24 |
| Policy lesion L1 | 48 |
| Live feedback source-credit updates | 1 |
| Migration | PASS |

## Neural regression
B298: 36 learning updates, 5616 synaptic updates, 71 learned transitions, 3 dreams, restore PASS.

B306: 14/16 autonomous decisions causally influenced; influence 0.875; causal success 0.92857.

B304: 128 ticks; 52 full; 76 micro; 8112 B296 synaptic updates; holdout novelty 1.0; transfer 0.660958.

B302: 96 ticks; 30 full; 66 micro; 4680 B296 synaptic updates; 8 autonomous full; behaviorShift 1.0 in its existing benchmark.

## Interpretation
B310 proves three stronger claims than B309:
1. source credit is evidence-weighted rather than presence-weighted;
2. final recorded decision surface is now truthful;
3. policy lesion can change whole-organism action distribution.

It does NOT prove that natural policy learning automatically changes action frequency in every context. The controlled baseline/trained distribution remained identical in this scenario.
