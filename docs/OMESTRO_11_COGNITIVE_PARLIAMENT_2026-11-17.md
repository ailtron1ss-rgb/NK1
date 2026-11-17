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
- stops before inference if there are no verified references (`evidence-unavailable`), and rejects the entire evidence-reference set before any model call if even one supplied reference is unverified (`evidence-rejected`);
- fans out to exactly six role slots with a configurable hard concurrency cap (default 3), a global deadline (default 25 seconds), and a requested generation/output-token ceiling divided equally across role calls (default 4096 total; prompt/input tokens are outside this ceiling);
- propagates cancellation to adapters and still returns on deadline if an adapter ignores AbortSignal;
- accepts only bounded JSON role reports, rejects extra fields and invented evidence references, and never accepts model-supplied model/provider/execution identity;
- records each role's outcome (completed, unavailable, failed, invalid-output or timed-out) and deliberates only over successfully parsed reports.

`OpenAICompatibleLocalParliamentRoleExecutor` adapts the existing local OpenAI-compatible chat provider. It creates a host execution UUID and records configured provider/model/independence identity in `ParliamentModelAttestationRegistry`. It deliberately ignores provider/model names echoed in the model response. The host passes the registry to `OrganismSystemFabric` as `parliamentModelAttestationRegistry` and maps role-specific executors as `parliamentRoleExecutors`. Use distinct configured model independence groups for genuinely independent model substrates; six prompts to one model remain one model family and cannot satisfy higher-risk gates.

`GovernanceSubsystemRuntime.deliberateAndArbitrate()` is the selection seam: only an `approved` parliamentary result for the exact candidate proceeds to P69. P69 receives that candidate plus only the low-risk escape actions `rest`, `wait` and `defer`; other unreviewed candidates are removed from this post-Parliament candidate set. `deliberateCycleCandidate()` applies a safe P69 fallback if Parliament blocks, times out or has no evidence, but only after the entire candidate set has passed unique/non-empty ID validation and the target candidate is present exactly once. Malformed/ambiguous candidate sets are rejected before fallback; they cannot hide duplicate identities behind a safe-looking row. If a valid set has no safe fallback, it returns no selected candidate.

The full `OrganismCore.observe()` path now has an optional runtime gate. Configure `OrganismConfig.enableCognitiveParliament=true` with all six role executors and either `parliamentModelAttestor` or `parliamentModelAttestationRegistry`. When a complete executor map and trusted attestor/registry are injected, the gate auto-enables unless explicitly disabled. Defaults: review user-input cycles and every 8th autonomous cycle; 25-second deadline; concurrency 3; 4096 requested output tokens; 32,000 input characters per role. These limits are configurable through `cognitiveParliamentEveryCycles`, `cognitiveParliamentTimeoutMs`, `cognitiveParliamentMaxConcurrent`, `cognitiveParliamentMaxTotalTokens` and `cognitiveParliamentMaxInputChars` (8,000–96,000 characters). The dispatcher preserves all verified evidence IDs and provenance. If even the minimum provenance set cannot fit, it returns `input-budget-exceeded` before any model call. Excerpts are reduced before evidence identity/provenance; evidence IDs are never silently dropped to fit a prompt.

The core creates evidence references only from exact observations in the active promoted `ProjectResearchSession` that still match the canonical `EvidenceFirewall` claim, content hash, source and lineage. Unpromoted, stale, forged or unrelated records cannot be included. A blocked Parliament gate does not fall through to P64 argmax, developmental diversity, quorum repair, B312 handoff or B276 program commitment. Those late selection overlays are disabled for the gated cycle; P69's reviewed candidate or protective fallback remains the selected intent. The reduced `spineOnly` research/ablation path remains separately isolated and does not invoke this async gate.

The latest sanitized cycle receipt is checkpointed under `system.cognitiveParliamentLastDecision`: tick, candidate ID, risk, gate/decision statuses, score, verified/unverified evidence counts, role outcomes, P69 choice and bounded reasons. It does not persist source excerpts or raw prompts. ActionGateway remains the only side-effect boundary; the Parliament never executes tools or grants permissions.

For local providers, `createLocalParliamentRoleExecutors()` builds the six role adapters from host-provided profiles and one shared `ParliamentModelAttestationRegistry`. Supply each profile with its own provider/model/independence identity. Reusing one independence group across all six roles is allowed but counts as one model family; high-risk approval requires three independent model families. No provider credentials or model profiles are hard-coded into NK1.

## Verification

Run from `runtime/neuro-kurisu`:

```sh
node --experimental-strip-types tests/cognitive-parliament.mjs
node --experimental-strip-types tests/cognitive-parliament-dispatcher.mjs
node scripts/typecheck-runtime.mjs
```

The focused regressions cover promoted Firewall evidence and source lineage, source-excerpt matching, rejection of mixed valid/forged evidence before any model call, concurrency and input/output budgets, deadlines, malformed role output, late-canceled host attestations, safety vetoes, role coverage, local provider-profile construction, P69 candidate snapshot isolation, rejection of unreviewed alternatives, ambiguous-candidate rejection, protective fallback, no-safe-candidate behavior, full OrganismCore.observe provider/evidence wiring, and persistence/restore of the last cycle receipt.

## Not yet claimed

The optional full-cycle gate and sanitized last-decision checkpoint are now wired. The repository still contains no live provider profiles or credentials, so a deployment must supply six host-configured role executors and a trusted attestor/registry before the gate can approve. Without promoted evidence or complete model attestations, the gate deliberately falls back only to P69 protective actions or no selection. The separate spineOnly ablation path is not gated. Production soak, measured decision-quality uplift, long-horizon deliberation history and Release ZIP inclusion are not claimed by this slice.
