# B308 Evidence Report
Дата: 13.09.2026

## Основные результаты
| Evidence | Result |
|---|---:|
| Temporal policy test | PASS |
| Positive temporal verified value shift | +0.008163 |
| Negative temporal verified value shift | -0.008163 |
| Effective ranking after verified learning | explore > respond |
| Live full cycles | 24 |
| Live verified outcomes | 12 |
| Temporal credit updates | 24 |
| Verified temporal updates | 2 |
| Temporal rows | 6 |
| Restart preservation | PASS |
| Legacy migration | PASS |
| Typecheck | PASS |
| Architecture | PASS |
| Forensics | PASS, duplicate content 0 / duplicate names 0 |
| Hygiene | PASS, 0 errors / 0 warnings |
| Parameterized probes | 894 / 928, failures 0 |
| Semantic coverage | 38 VERIFIED / 3754 functions |
| Evidence coverage | 0.0669 |

## Plain-language meaning
The policy now learns from short action sequences instead of only the final action. If a checked outcome is good, the immediately preceding eligible step can be reinforced; if it is bad, that prior step can be suppressed.

## Important limitation
The full organism did not yet change its raw action distribution in the B308 smoke run. Other policy and cognitive sources remain stronger. The evidence is therefore about canonical policy ranking, not whole-organism behavioral takeover.
