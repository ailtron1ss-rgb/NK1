# WorkPass293 — autonomous P23 repair revision loop (2026-10-22)

## Objective

Move the existing Hermes-inspired skill-repair pipeline from a manually callable entry point toward an opt-in, resource-gated background loop. Preserve one canonical P23 candidate lifecycle: a revision is only a staged candidate, never a live skill activation.

## Changes implemented

### 1. Background cycle joins the existing scheduler

`OrganismRuntime.RuntimeConfig.compoundRepairRevision.backgroundRevision` now supports explicit `enabled`, `initialDelayMs`, and `intervalMs`. Defaults when enabled are a five-minute initial delay and a fifteen-minute cadence; allowed interval range is 1 minute through 24 hours. It is not enabled by default.

Enabling the background loop requires `independentEvaluationConfigForRepair` at configuration time. No in-process fake evaluator, verifier, or safety scanner is silently substituted.

Each scheduled attempt is allowed only when the organism is awake, initialized, not stopping, has an eligible verified non-holdout repair, and has sufficient host/runtime resources:
- cognitive budget at least 0.70;
- battery greater than 0.20;
- RAM pressure below 0.82;
- thermal strain below 0.72;
- runtime performance pressure below 0.78.

A cycle selects at most one skill and enters the existing serialized runtime queue, then the current P23 revision/independent-evaluation/staging path. The round-robin cursor prevents the scheduler from always choosing the first skill.

### 2. External claims are a triage hint, not ground truth

WP292's bounded external-hypothesis queue is now consulted only to prioritize a skill ID that is already in the runtime's own eligible repair ledger. The hypothesis itself cannot create a repair row, qualify an ineligible row, authorize generation without ledger evidence, or grant a promotion.

This deliberately separates two lanes:
- **trusted cause/evidence:** actual verified non-holdout repair history, exact evidence digest, configured independent task execution, verifier and safety scan;
- **untrusted hypothesis:** a bounded suggestion that may change queue order only.

### 3. Duplicate generation is bounded and restart-visible

`P23CompoundRepairRevisionCoordinator` now:
- coalesces simultaneous calls for one skill;
- remembers completed source-evidence digests within bounded process-local caches;
- stores the exact SHA-256 digest of eligible repair evidence in `SkillRevisionProvenance.sourceEvidenceFingerprint`;
- checks existing versioned candidates for that same digest before invoking the expensive provider/generator;
- rechecks the evidence ledger after asynchronous input preparation to reject stale data;
- passes the digest into the runtime boundary, which recomputes it before the P23 engine may stage the candidate.

The candidate-store lineage field is non-authoritative by design. It records what initiated a revision; it is not signed promotion approval, verifier evidence or permission to activate.

### 4. P23's existing lifecycle is still the only activation authority

Fresh generated payloads are independently evaluated against validation and holdout tasks by the existing P23 path. The existing versioned candidate store still requires authenticated shadow observations and separate authenticated approval before promotion; rollback continues to require its own approval. The background loop does not call an activation method.

### 5. Regression coverage and CI

Added/extended:
- `tests/workpass293-autonomous-p23-revision.mjs`: schedule gates, no-evidence behavior, at-most-one selection per tick, hint prioritization constrained by the real repair ledger, disabled-mode behavior and static wiring contract;
- `tests/workpass172-compound-revision-coordinator.mjs`: repeated evidence, concurrent coalescing, stale-evidence failure and durable digest deduplication;
- `test:workpass293:p23-revision`: runs those scenarios plus WP292 evidence-lane regression;
- `.github/workflows/workpass293-autonomous-p23-revision.yml`: PR/path filtered Node 24 workflow.

The old P2700 loop regression now expects UnifiedLearningSubstrate state schema v4 after the provenance migration. The tests have been added or aligned, but **no local test/typecheck/CI pass is claimed** until the current branch head's run yields a successful result and actionable job logs.

## Source-project mechanisms adapted

- **Hermes Agent Self-Evolution** — trace-directed repair, candidate generation against fixed evaluation plans, bounded artifacts, independent validation/holdout, gates and reviewed promotion path. Source: https://github.com/NousResearch/hermes-agent-self-evolution and https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/PLAN.md
- **Letta memory & dreaming** — durable memory changes are separated from ephemeral context and consolidation remains reviewable; NK1 keeps MemoryOS2 as the sole canonical writable memory owner instead of introducing another memory database. Source: https://docs.letta.com/configuration/memory
- **Generative Agents** — a recurring loop of observation, reflection and planning is more useful than isolated response generation; NK1 connects that idea to its existing goals, causal records, memory and scheduler instead of importing a parallel agent runtime. Source: https://arxiv.org/abs/2304.03442

These patterns are borrowed at the mechanism level; this implementation is not a full upstream port and doesn't establish consciousness or reliable autonomy merely by existing.

## Explicitly incomplete

- The exact action-ticket / trace / tick / trusted postcondition receipt is not yet joined into the reduced-resolution micro-cycle. Until it is, the micro-cycle must remain neutral and unverified; caller-supplied success/reward must not recover credit.
- The independent hypothesis consumer currently uses hints for safe triage only. There is no automatic conversion of an external hypothesis into a trusted repair result.
- Whole-organism call-path activation is not proven by source-path presence or a green static-contract test.
- No clean-machine Docker Compose or end-to-end autonomous one-action-per-hour acceptance evidence was produced by this pass.

## Next fixed implementation targets

1. **WP294-A — action/evidence correlation:** carry exact action ticket, trace ID, tick and the already-authorized canonical postcondition receipt; mismatch, stale evidence or missing receipt remains unknown.
2. **WP294-B — one recurrent experience-to-memory path:** bind grounded records to the existing MemoryOS2 lifecycle while preserving source, temporal and causal links.
3. **WP294-C — end-to-end P23 closeout:** independent baseline/candidate/holdout, signed shadow observations, authenticated approval, promotion, and rollback exercised with the actual host-owned executables.
4. **WP294-D — autonomy continuity:** measurable endogenous-goal → resource arbitration → canonical action → observation → reflection/consolidation; prove clock behavior and restart continuity.
5. **WP294-E — embodiment identity link:** observe one persisted affect/self state feeding both avatar and voice; avoid duplicate emotion owners.
6. **WP294-F — operational readiness:** use the current Node 24 workflow to establish executable regression/typecheck evidence, then clean-machine startup/Compose gates.

## Progress ledger

- WP293 source implementation: **landed for the scoped P23 workstream** (background loop, resource gate, hint-bounded triage, evidence fingerprint lineage, idempotency/coalescing and CI/test wiring).
- WP293 validation: **unconfirmed** until a successful current-head run and step output are available.
- P23 repair → independent evaluation → candidate staging: **implemented as a gated path**; actual background execution is opt-in and depends on the application's host-owned independent evaluators and runtime config.
- Candidate promotion/activation: **not automated**; authenticated shadow evidence and separate approval remain required.
- Whole-organism readiness: **not assigned a misleading single percentage**. The remaining acceptance denominator spans causal action closure, memory consolidation, initiative continuity, embodiment, and clean installation; the next passes will measure those individually.
