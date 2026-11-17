# OmeStro #11 — Cognitive Parliament

**Status:** implemented as an isolated deterministic deliberation primitive; runtime wiring and real multi-model operation remain pending.

## Contract

Six required roles submit structured reports: researcher, planner, skeptic, executor, safety guardian and auditor. Each report separates facts, assumptions, objections, uncertainty, recommendation, evidence and model/provider provenance.

The parliament does not call models itself. A caller must collect reports through bounded adapters and pass them to `CognitiveParliament.deliberate()`. This keeps provider selection, latency and token budgets outside the deterministic decision core.

## Decision protocol

- No majority-vote shortcut: evidence quality and risk-adjusted thresholds determine approval.
- Evidence must be observed and carry source ID, source family, claim and bounded confidence/relevance/falsifiability values.
- Only the strongest evidence item from each source family contributes to the evidence-quality mean; duplicate citations cannot manufacture confidence.
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

The test covers approval, safety veto, missing roles, provenance failure, correlated models, unresolved dissent and unobserved hypotheses.

## Not yet claimed

No autonomous multi-model runtime wiring, provider independence, performance uplift, production soak or release inclusion is claimed by this isolated slice.
