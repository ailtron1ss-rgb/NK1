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

Role reports cannot certify themselves. They provide only canonical evidence IDs, claim keys and host-generated inference execution IDs. The trust port resolves those IDs against the host-owned Evidence Firewall and model-execution attestor.

The Evidence Firewall adapter accepts evidence only if the exact observation exists, belongs to the exact claim, the claim is promoted, the promotion receipt is valid, and the source is an eligible non-simulator source. Source identity and source-family grouping are derived from the canonical observation, not supplied by the model. The adapter reconstructs the firewall's source↔lineage connected components so syndicated copies across publisher domains count as one family.

Model provider, model identity and independence group come only from the host attestor. If no attestor is connected, model reports are unverified and the result is `needs-evidence`. Merely naming six roles or six model strings never establishes six independent minds.

## Deliberation protocol

- The output score is derived from canonical promoted evidence quality, reduced by mean declared uncertainty. Role vote counts do not increase score.
- Repeated citations are deduplicated by immutable evidence ID; one source family contributes only its strongest record.
- Risk gates are progressive: low risk needs 1 evidence family and 1 model family; medium needs 2 of each; high needs 3 of each.
- Skeptic review and auditor coverage must include every evidence reference used by the decision.
- Unresolved dissent, malformed reports, duplicate inference execution IDs, incomplete coverage, stale/unverified attestations and unpromoted evidence fail closed.
- Safety Guardian block is unconditional. An uncertain safety verdict cannot approve.
- This component only returns a deliberation result. It does not execute tools, grant permissions or bypass P69 Constitutional Arbiter / ActionGateway.

## Runtime wiring and dispatch

The composition root connects `GovernanceSubsystemRuntime.cognitiveParliament` to the research subsystem's canonical `EvidenceFirewallEngine` and `ProjectResearchSession`. The adapter attaches a title, bounded excerpt and source URL only when source key, lineage and content hash match the exact firewall observation. Arbitrary or unmatched page text is not sent to roles. It also exposes `cognitiveParliamentDispatcher` and accepts a role→executor registry through `OrganismSystemFabric`.

The dispatcher:
- rejects the entire evidence-reference set before any model call if even one supplied reference is unverified;
- fans out to exactly six role slots with a configurable hard concurrency cap (default 3), a global deadline (default 25 seconds), and a requested token budget divided equally across role calls (default 4096 total);
- propagates cancellation to adapters and still returns on deadline if an adapter ignores AbortSignal;
- accepts only bounded JSON role reports, rejects extra fields and invented evidence references, and never accepts model-supplied model/provider/execution identity;
- records each role's outcome (completed, unavailable, failed, invalid-output or timed-out) and deliberates only over successfully parsed reports.

`OpenAICompatibleLocalParliamentRoleExecutor` adapts the existing local OpenAI-compatible chat provider. It creates a host execution UUID and records configured provider/model/independence identity in `ParliamentModelAttestationRegistry`. It deliberately ignores provider/model names echoed in the model response. The host passes the registry to `OrganismSystemFabric` as `parliamentModelAttestationRegistry` and maps role-specific executors as `parliamentRoleExecutors`. Use distinct configured model independence groups for genuinely independent model substrates; six prompts to one model remain one model family and cannot satisfy higher-risk gates.

`GovernanceSubsystemRuntime.deliberateAndArbitrate()` is the integrated selection seam: only an `approved` parliamentary result for a candidate present in the P69 candidate set proceeds to P69. The method returns P69's final selection but does not execute anything. ActionGateway remains the sole side-effect boundary. Missing role executors or missing model attestors fail closed.

## Verification

Run from `runtime/neuro-kurisu`:

```sh
node --experimental-strip-types tests/cognitive-parliament.mjs
node --experimental-strip-types tests/cognitive-parliament-dispatcher.mjs
node scripts/typecheck-runtime.mjs
```

The focused regressions cover promoted Firewall evidence and source lineage, source-excerpt matching, rejection of mixed valid/forged evidence before any model call, concurrency and token budgets, deadlines, malformed role output, late-canceled host attestations, safety vetoes, role coverage, P69 selection and fail-closed defaults.

## Not yet claimed

The bounded role-dispatch mechanism and the Governance→P69 selection seam are implemented, but no live NK1 provider profiles have been configured and the dispatcher is not yet invoked automatically on every cognitive cycle. Production-grade multi-provider operation, durable deliberation persistence, production soak, measured decision-quality uplift and Release ZIP inclusion are not claimed by this slice.
