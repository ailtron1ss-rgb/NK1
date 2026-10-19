# B309 Evidence Report
Дата: 13.09.2026

## Functional evidence
- Typecheck: PASS
- B309 arbitration consolidation: PASS
- B309 migration: PASS
- B308 temporal policy regression: PASS
- B307 verified policy regression: PASS
- B306 autonomous causal regression: PASS
- B305 critical-path regression: PASS
- B297 executive fusion regression: PASS
- B298 closed-loop neural regression: PASS

## B309 key measurements
- executive sources: 11 (policy added as canonical source)
- redundant pair examples: personality|policy, agency|policy, personality|self, agency|self, policy|self
- peak measured repeated-pair redundancy in unit experiment: 0.3268
- consolidationEvents in unit experiment: 98
- lastDeduplicatedContribution01: 0.01979
- sourceConsolidation01: 0.39761
- policy effective weight before lesion: 0.68329
- policy effective weight after lesion: 0

## Live core
- full cycles: 16
- policy source is present in executive fusion
- policy source weight in final live snapshot: 0.72
- policy source signal is persisted
- restart: PASS

## Important interpretation
B309 proves a causal path from policy source to executive arbitration. It does NOT yet prove that the entire organism changes its final action distribution after policy learning, because many other branches remain active and can dominate the final chooser.

## Verification debt
Current semantic audit:
- total functions: 3754
- VERIFIED: 38
- INTEGRATION_ONLY: 853
- UNSAFE_TO_AUTO_RUN: 260
- UNVERIFIED: 2603
- verifiedRate01: 0.0101
- evidenceCoverage01: 0.0669

## Neural control evidence
B298 remains the anchor:
- 36/36 learning updates
- 5616 synaptic updates
- 71 learned world transitions
- 3 dreams
- lesion effect
- restore learningUpdates=36
