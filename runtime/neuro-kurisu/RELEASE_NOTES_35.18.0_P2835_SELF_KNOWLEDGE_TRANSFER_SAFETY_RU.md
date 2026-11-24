# Neuro/Kurisu 35.18.0 — P2835

## Production

- P2820 SelfKnowledgeCoresetBridge.
- Context-conditioned slow self-teacher.
- Teacher confidence/calibration.
- Self-distillation of action readout.
- 96-slot adaptive coreset and compaction.
- TransferSafetySynergy controller.
- Task/context signature compatibility.
- Positive/negative transfer tracking.
- Transfer-aware replay gate.
- Bounded orthogonal safety gate for synaptic learning.
- Experience tokens now carry `contextId` for provenance-aware replay.
- Persistence/restart for both new layers.

## Evidence

- P2820 synergy matrix: PASS, 28 runs.
- P2835 transfer-safety battery: PASS, 8 runs in the shortened matched battery.
- P2835 hot-path smoke: PASS.
- Typecheck: PASS.
- Static release gates run separately from heavy runtime batteries.

## Important validation note

Heavy cross-release runtime suites are intentionally executed in separate processes. Combined long-lived Node runs can accumulate resource pressure and timeout even when individual tests pass. Such timeouts are not counted as PASS.
