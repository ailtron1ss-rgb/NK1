# WorkPass73 — Active Information Gain decision attribution

**Base:** `9008a8982a5173304456bee2c604bd0bc8665964`  
**Branch:** `aspect/active-information-gain-decision-attribution-20261124`

## Reproduced integration risk

`ActiveInformationGainController` owns a live `pendingDecision` and updates its `selectedHypothesis` on every `beforeDecision`. `NeuralExperienceBranch` separately mirrors the controller into `state.activeInformationGain` only at snapshot boundaries. Its `afterOutcome` previously read `hypothesisId` from that mirror. After decision A has completed and been snapshotted, a restored branch can choose decision B with a different external sensor query; until the next snapshot, the mirror still carries A. The controller then accepts B's action/tick but rejects its hypothesis attribution because the supplied A ID does not match B's pending hypothesis.

## Minimal correction

- Add an optional, read-only Active Information Gain decision receipt to `NeuralExperienceToken`: `{ tick, selectedAction, selectedHypothesis }`.
- Capture the exact local `infoGain` result from the same `beforeDecision` call when the token is created.
- In `afterOutcome`, pass the hypothesis from that token only when its tick matches the outcome. Do not read the snapshot mirror for attribution.
- Preserve the controller's current validation of pending tick, executed action, finite outcome, duplicate and late outcomes. No new controller map or second ledger is introduced; the runtime remains single-flight.
- Old snapshots without the optional receipt remain structurally compatible; `undefined` hypothesis leaves the controller's own current pending decision and exact tick/action gates authoritative.

## Regression

`active-information-gain-neural-attribution-workpass73.mjs` exercises a real NeuralExperienceBranch with two completed decisions: first `camera`, snapshot/restore, then `motion`. The regression requires the second verified outcome to increment the `motion` hypothesis evidence exactly once, preserving the previous `camera` evidence. The workflow proves the test fails on the test-only commit and passes after the token-bound receipt fix, then reruns the existing standalone P2675 information controller / 1800-cycle and NeuralExperienceBranch / 900-cycle suites plus the B2522 600-cycle branch integration and runtime syntax/typecheck.

## Scope

No changes to Release assets, `main` or `workpass70-source`. This closes the attribution transport bug only; it does not claim full long-horizon goal continuity or prototype completion.