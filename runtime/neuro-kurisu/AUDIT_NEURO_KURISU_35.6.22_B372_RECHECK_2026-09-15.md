# Neuro-Kurisu 35.6.22 / B372 — Forensic Recheck

## 1. What was found
The canonical neural owner remains B365. No second neural decision owner was introduced.

B371 had two important remaining issues:
1. physical consequence learning was not separately gated at the canonical neural substrate;
2. one runtime evidence record could label host fallback as `device-observation`.

A release-contract gap was also found: the B371 performance test existed but was not registered as an npm script.

## 2. What was corrected
- B365 state migrated from internal version 3 to 4 with backward-compatible defaults.
- Added `realityActionLearning` to B365 persistent neural state.
- Added `learnEmbodiedConsequence(...)` to canonical B365.
- Verified physical learning requires fresh independent Android proof and exact `android-termux` source.
- Unverified/host evidence is recorded but cannot mutate neural readouts.
- Runtime evidence ledger now distinguishes `derived` host fallback from `device-observation`.
- Registered B371 performance command and B372 causal test command.
- Release version/state schema advanced to 35.6.22 / 128.
- CURRENT documentation pointers updated; historical documents retained.
- README synapse count corrected to the actual current B365 count (1,188 active synapses).

## 3. Causal evidence
SHAM:
- 16 unverified samples
- 0 neural action-readout mutation
- 16 rejected

ON:
- 32 verified physical samples
- 1,152 neural update operations
- 32 verified updates
- policy mutation across B365 action readout = 0.65119347 total absolute delta
- future policy L1 divergence = 0.08993791

## 4. Persistence
The complete `realityActionLearning` state survives snapshot/restore exactly in the test.

## 5. Runtime reality boundary
Host runtime produced:
- no physical `device-resource-sample` record;
- a `host-resource-sample-derived` record;
- a rejected unverified physical-learning attempt.

## 6. Regression
PASS:
- typecheck
- B365 causal neural selection
- B371 active perception
- B371 performance
- B372 reality gate
- restart persistence
- core ownership
- architecture audit
- source hygiene
- executable syntax
- forensic audit
- full project audit
- source-of-truth release verification
- release contract
- archive manifest and integrity

The legacy organism smoke test prints `CLEAN_ORGANISM_SMOKE=PASS` in this environment but does not terminate cleanly after completion under the tool runner timeout. Because this is not a causal feature PASS and the process lifecycle is not fully resolved here, it is **not counted as a clean release criterion**.

## 7. Physical Android status
No physical Android device was available to certify. Any `android-termux` causal test is a controlled fixture and is not evidence that the user's phone has been measured.

Physical Android readiness therefore remains low.

## 8. Consciousness
Functional consciousness: UNKNOWN.
Phenomenal consciousness: UNKNOWN.

## 9. Verdict
B372 is a real architectural improvement with causal evidence and no fake Android promotion. It is not a claim of full artificial personhood, consciousness, or physical-device certification.
