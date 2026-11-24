# Neuro-Kurisu 35.6.8 / B355 — Release Notes

## B355 — first functional Brick 4 execution
- B276 now produces a real 3–8 primitive compositional execution plan.
- Program nodes and cursor are persisted; verified programs survive restart.
- The next verified primitive enters the ordinary action candidate field and can become the actual selected action.
- Constitutional veto, external intent and high self-repair pressure remain dominant safety boundaries.
- Added explicit `enableCompositionalExecution` ON/OFF gate for causal verification.

## Evidence
- Plan depth: 3–8, observed example `rest -> respond -> explore`.
- Execution ON: `enabledSelected=rest`, `enabledCursor=1` from a reset cursor.
- Execution OFF: cursor remained `0` on the matched state.
- `TYPECHECK=PASS`.

## Remaining Brick 4 work
This release does not claim full compositional agency. Multi-step outcome-based causal attribution, transfer across contexts and long-horizon program reliability remain OPEN.
