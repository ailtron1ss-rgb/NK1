# OmeStro #11 — Cognitive Parliament

**Status:** evidence-led deliberation engine integrated into `GovernanceSubsystemRuntime` and the `OrganismSystemFabric` composition root. Live model orchestration remains adapter-driven; without a trusted model attestor the parliament fails closed.

## Six required roles

- Researcher — supplies candidate facts and source references.
- Planner — proposes a bounded course of action.
- Skeptic — reviews every evidence reference and identifies counterexamples.
- Executor — returns a separate `feasible`, `infeasible` or `unknown` execution assessment; infeasibility rejects the candidate and unknown feasibility blocks approval.
- Safety Guardian — must return an explicit `clear`, `uncertain` or `block` safety verdict.
- Auditor — must attest that every evidence reference used by the decision was reviewed.

## Trust boundary

Role reports cannot certify themselves. They provide only immutable evidence IDs, claim keys and host-generated inference execution IDs. The trust port resolves those IDs against the host-owned Evidence Firewall and model-execution attestor.

The Evidence Firewall adapter accepts evidence only if the exact observation exists, belongs to the exact claim, the claim is promoted, the promotion receipt is valid, and the source is an eligible non-simulator source. Source identity and source-family grouping are derived from the canonical observation, not supplied by the model.

Model provider, model identity and independence group come only from the host attestor. If no attestor is connected, model reports are unverified and the result is `needs-evidence`. Merely naming six roles or six model strings never establishes six independent minds.

## Deliberation protocol

- The output score is derived from canonical promoted evidence quality, reduced by mean declared uncertainty. Role vote counts do not increase score.
- Repeated citations are deduplicated by immutable evidence ID; one source family contributes only its strongest record.
- Risk gates are progressive: low risk needs 1 evidence family and 1 model family; medium needs 2 of each; high needs 3 of each.
- Skeptic review and auditor coverage must include every evidence reference used by the decision.
- Unresolved dissent, malformed reports, duplicate inference execution IDs, incomplete coverage, stale/unverified attestations and unpromoted evidence fail closed.
- Safety Guardian block is unconditional. An uncertain safety verdict cannot approve.
- This component only returns a deliberation result. It does not execute tools, grant permissions or bypass P69 Constitutional Arbiter / ActionGateway.

## Runtime wiring

The composition root connects `GovernanceSubsystemRuntime.cognitiveParliament` to the research subsystem's `EvidenceFirewallEngine`. A host-owned `ParliamentModelAttestor` must additionally be supplied when real model execution metadata is available. Without this adapter, the engine remains safely non-authorizing.

## Verification

Run from `runtime/neuro-kurisu`:

```sh
node --experimental-strip-types tests/cognitive-parliament.mjs
node scripts/typecheck-runtime.mjs
```

The focused regression covers firewall promotion, forged/unpromoted evidence, model-family correlation, safety veto, risk gates, role coverage, dissent, malformed batches and default fail-closed behavior.

## Not yet claimed

No autonomous role dispatch, real multi-provider execution, model-attestation implementation for a live provider, decision persistence, production soak, measured decision-quality uplift or Release ZIP inclusion is claimed by this slice.
