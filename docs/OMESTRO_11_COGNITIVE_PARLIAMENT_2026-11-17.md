# OmeStro #11 — Cognitive Parliament

**Status:** deterministic deliberation primitive added and owned by `GovernanceSubsystemRuntime`; automatic task-pipeline invocation and live multi-provider orchestration remain pending.

## Contract

Six required roles submit structured reports: researcher, planner, skeptic, executor, safety guardian and auditor. Each report separates facts, assumptions, objections, uncertainty, recommendation, evidence and model/provider provenance.

The governance subsystem exposes a stateless `cognitiveParliament` coordinator. The parliament does not call models itself: a caller must collect role reports through bounded adapters and pass them to `CognitiveParliament.deliberate()`. This keeps provider selection, latency and token budgets outside the deterministic decision core.

## Decision protocol

- No majority-vote shortcut: evidence quality and risk-adjusted thresholds determine approval.
- Evidence must be observed and carry source ID, source family, claim and bounded confidence/relevance/falsifiability values.
- Only the strongest evidence item from each source family contributes to the evidence-quality mean; repeated citations cannot manufacture confidence.
- High-risk actions require at least two source families and two distinct model fingerprints.
- Missing required roles, incomplete provenance, unresolved skeptic objections or auditor objections produce `needs-evidence`.
- A safety-guardian block or declared safety violation produces an unconditional `blocked` result.
- Shared model substrates are reported explicitly; role labels do not imply independent intelligence.
- This component proposes a decision only. Existing P69 constitutional arbitration and ActionGateway remain authoritative execution boundaries.

## Verification

Run:

```sh
node --experimental-strip-types runtime/neuro-kurisu/tests/cognitive-parliament.mjs
```

The regression covers governance ownership, approval, safety veto, missing roles, provenance failure, correlated models, unresolved dissent and unobserved hypotheses.

## Not yet claimed

Automatic invocation from the autonomous task/action path, live provider/model independence, performance uplift, production soak or Release ZIP inclusion are not claimed by this slice.
