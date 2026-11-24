# PROJECT PROGRESS — BIG PASS 181

## Current macro status
**Macro maturity: 58.8%** — шкала специально сохранена сопоставимой с предыдущими проходами и не повышалась автоматически.

## Evidence metrics
- Strict VERIFIED functions: **300/2494 = 12.03%**
- Integration-only: **454**
- Unsafe to auto-run: **224**
- Unverified: **1516**
- Safe parameterized: **497/509 = 97.64% PASS**
- Canonical snapshot/restore closure: **196/196 = 100% PASS**
- Recent regression: **24/24 PASS**

## Progress by major domain
| Domain | VERIFIED | Unverified | Current judgement |
|---|---:|---:|---|
| memory | 31 | 138 | STRONG |
| emotion | 4 | 11 | PARTIAL |
| world | 46 | 269 | STRONG |
| self | 33 | 127 | STRONG |
| agency | 14 | 127 | PARTIAL |
| learning | 44 | 337 | STRONG |
| perception | 13 | 94 | PARTIAL |
| consciousness | 18 | 15 | PARTIAL |
| infrastructure | 97 | 398 | STRONG |

## Interpretation
Рост VERIFIED до 12% произошёл не из-за искусственного изменения статусов, а потому что один общий reproducible test реально вызвал и восстановил 196 canonical classes и затем был подключён к ledger. При этом это не даёт 12% «готового сознания»; это 12% строгих проверенных function contracts.
