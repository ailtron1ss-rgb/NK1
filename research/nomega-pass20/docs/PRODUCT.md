# Nullseed Product 66.0

## What you can run on Termux
```bash
python runtime/nullseed_cli.py status
python runtime/nullseed_cli.py smoke
python runtime/nullseed_cli.py invent   # slow, green metrics
python runtime/nullseed_cli.py bench    # not green
```

## What is product
| Layer | Status |
|-------|--------|
| Closed bench 0–35 | **36/36** regression |
| Harness wild1 | 8/8 with schemas |
| Meta invent wild3 | **~1/4** ceiling |
| Residual / Stack invent | **~1–2/4** ceiling |
| RuleDNA seed-prior | 4/4 **NOT invent** |

## Invent ceiling (honest)
Without hand priors, wild3 invent ≈ **1–2/4** on current ISA + search.
Further seed-prior scores are **not** progress.


## 67.0
- ROL/SHR7 labeled ISA
- invent_fast profile for Termux
- See INVENT_CEILING.md
