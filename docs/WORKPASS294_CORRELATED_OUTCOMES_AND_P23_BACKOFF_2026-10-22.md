# WorkPass294 — correlated external outcomes and resource-bounded self-evolution (2026-10-22)

## 1. Why this pass exists

WP292 separated external reports from grounded causal records; WP293 connected repair evidence to an opt-in scheduler. The next weak point was lineage: a result could look verified without proving that it belonged to the exact tool request and the exact autonomous decision whose policy/memory should receive credit. P23 also needed to avoid retrying an unchanged failing repair forever, and its scheduler needed enough observability to show why it is or is not working.

## 2. Decision-bound outcome verification

### Process-local verification authority

`OutcomeVerificationService` now exposes `isTrustedDecisionLinkedExternalPostcondition`. It accepts only the exact verifier-minted object retained in the service's process-local `WeakMap`. It requires all four dimensions to match:
- canonical tool ID;
- entire normalized JSON input;
- gateway execution ID;
- host-owned decision ID.

Copied or restored result JSON has no verifier authority. Missing, overlong, control-bearing or mismatched correlation IDs fail closed. Correlation identifiers are rejected instead of silently truncated, so two different decisions cannot alias through normalization.

### The canonical runtime join

`ActionGateway` passes host-owned execution/decision IDs into the verifier, then evaluates the exact object before it is copied for finalization. It forwards an *ephemeral* correlation verdict through its internal finalizer context; the verdict itself is not persisted as authorization.

`OrganismCore.finalizeToolOutcome` then requires that verdict (or the still-live verifier object for the unkeyed path) **and** a persisted selected decision trace whose ID matches the gateway decision ID and whose pre-action tick matches the trace tick. Only after this join is satisfied does an external observation receive that decision ID when ingested into the external-observer/temporal path. If independent world observations are valid but their decision binding cannot be proved, they may still be recorded as observations; they do not earn causal/temporal credit for a claimed action.

This strengthens attribution; it does not give the reduced-resolution micro-cycle access to a receipt it does not possess. Micro-cycle reward remains neutral (0.5) and `verified01=false` until a specific recent outcome ticket can be joined safely.

## 3. Bounded retry/backoff for P23

`P23CompoundRepairRevisionCoordinator` now applies exponential backoff to generation/evaluation failures for the **exact eligible evidence digest**:
- first retry cooldown: 30 minutes;
- exponential growth, capped at 24 hours and 12 attempts;
- a new set of eligible repair evidence has a different digest and bypasses the old cooldown immediately;
- a successful staged candidate clears the failure state;
- diagnostics store only the evidence digest, attempt count and category, not raw error payloads or secrets; maps are bounded.

Existing concurrent coalescing and persistent candidate lineage remain active. This prevents repeated generation cost for a known failing input while allowing genuinely new verified failures to resume learning promptly.

## 4. Scheduler observability

The P23 background scheduler now records its decision reason (not ready, no eligible evidence, resource gated, ready), attempts, successful staging, deduplication, backoff skips, failures, last skill/status/candidate and the bounded retry diagnostics. These counters are runtime telemetry, **not** evidence of quality, autonomous competence or verified learning. They are exposed via `compoundRepairRevisionDiagnostics()` and included in the longitudinal and persistence metrics projections.

The scheduler remains explicitly opt-in. It is gated on a real eligible runtime repair record and host resources; it invokes the existing serialized runtime queue and host-owned independent evaluator. A staged candidate is not activated. Authenticated shadow outcome, separate approval and rollback authority remain necessary.

## 5. Regressions added

- `tests/workpass294-correlated-postcondition.mjs`: exact object, ticket, tool, complete-input, copied-object, malformed-ID, and Core runtime-join wiring regressions.
- `tests/workpass172-compound-revision-coordinator.mjs`: repeated/durable deduplication, concurrency coalescing, evidence-specific cooldown and fresh-evidence bypass.
- `tests/workpass293-autonomous-p23-revision.mjs`: resource gates, bounded-hint triage, per-cycle limit and diagnostics.
- `test:workpass294:correlated-postcondition` and Node 24 workflow `.github/workflows/workpass294-correlated-postcondition.yml`; its workflow includes runtime `typecheck` before the test.

### Validation status

The GitHub Actions runs for WP292, WP293 and WP294 on commit `3558af1eb06712103a6a03435a238e06cc116933` report `failure`, with jobs starting and completing in the same second, runner ID 0, and empty step arrays. The connector does not expose logs for these early failures, so it is **not established whether any test or typecheck command started**. No green validation is claimed. Investigate runner/workflow startup first, then act on code-level failures once logs exist. The current code should be treated as implemented but not yet validated.

## 6. Research mechanisms used

- Hermes Self-Evolution: evidence-directed repair proposals, independent evaluation, holdout/regression gates and explicit staging/promotion boundaries. Upstream reference: https://github.com/NousResearch/hermes-agent-self-evolution
- Letta memory/dreaming: durable state ownership and reviewable consolidation; NK1 keeps MemoryOS2 as sole canonical writable memory authority instead of adding a parallel memory database. Reference: https://docs.letta.com/configuration/memory
- Generative Agents: iterative observation, reflection and planning; adapted into NK1's existing goal, experience, memory and cycle owners rather than adding a separate agent framework. Paper: https://arxiv.org/abs/2304.03442

These are mechanism-level adaptations; the pass neither imports those full runtimes nor proves subjective consciousness.

## 7. Next implementation passes

1. **WP295 — action-ticket correlation into the micro-cycle:** retain one process-local, bounded latest verified outcome candidate correlated to a real trace. Consume it at most once; exact trace, selected action, decision ID, tick and postcondition must match. Any mismatch, stale receipt, missing ticket or restart is unknown and stays neutral.
2. **WP296 — canonical memory closure:** connect only grounded records to existing MemoryOS2 lifecycle/consolidation, preserve source/time/action links and avoid a second writable memory owner.
3. **WP297 — exercised P23 lifecycle:** run the host-owned independent executable on baseline/candidate validation and holdout, sign shadow receipts, request separate approval, promote, and test rollback. Keep live activation off by default.
4. **WP298 — initiative continuity:** instrument endogenous goal → resource arbitration → one canonical action → outcome observation → reflection/memory, including scheduler/restart metrics. Distinguish scheduled initiative from a successfully executed, observed initiative.
5. **WP299 — embodiment & delivery:** ensure one persisted affect/self state is used by avatar and voice, then prove clean-machine Node 24 / Docker Compose start-up and the specified acceptance gates.

## Readiness boundary

WP294 closes a meaningful provenance/coordinator gap, not the complete organism. The remaining master acceptance criteria—end-to-end initiative frequency, canonical memory consolidation, embodiment synchronization, P23 live evaluator/promotion/rollback, and clean installation—still need execution evidence. No whole-project completion percentage is invented here.
