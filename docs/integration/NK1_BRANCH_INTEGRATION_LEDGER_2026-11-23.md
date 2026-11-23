# NK1 Branch Integration Ledger — 2026-11-23 (post-#1104)

## Baseline and safety boundary

- Canonical repository: `ailtron1ss-rgb/NK1`.
- Canonical source: `workpass70-source` at `4972c2d5228141ef9673be94fca243614d28d9d6`.
- `main` and the published Release ZIP were not modified by this integration pass.
- A source merge is not a Release ZIP update, target-device soak, independent holdout, or product-readiness claim.
- Original donor branch refs and commits are preserved unless explicitly stated otherwise. Closing a superseded PR does not delete its branch.

## Integration 01 — audit security, autonomous batches and cognitive wake routing

- PR #1103: https://github.com/ailtron1ss-rgb/NK1/pull/1103
- Integration branch: `aspect/combined-security-autonomy-cognition-20261123`.
- Merge SHA: `272b1dc8431121efc3d948e194b99b29afd2a275`.
- Exact-head GitHub Actions: **27/27 SUCCESS**.
- Donor PRs: #1093, #1094, #1096. All three were closed as superseded after merge; original branches remain intact.
- Scope:
  - Redact credential-like fields, bearer/API/JWT tokens and secret query values from ActionGateway diagnostic previews only; do not modify executor payloads or tool semantics. Focused regression covers accessors, cycles, oversized values and hostile object keys.
  - Add cooperative abort, bounded yielding and optional duration budgeting to sequential autonomous-cycle batches. A cycle closes its runtime state boundary before cancellation. Use portable timer yielding rather than undeclared `setImmediate`.
  - Route cognitive interrupt domains and wake-mask bits from final `dirtyDomains`, so safety-escalated Governance is included even when ordinary activation is false.
- Important repair evidence:
  - The #1093 donor redaction regex retained the secret suffix; the integrated sanitizer redacts the full token.
  - The #1094 donor used `setImmediate`, absent from the current runtime type declarations; the integrated code uses `setTimeout(resolve, 0)`.
  - A separate donor #1096 package-script addition was not copied; its test is invoked directly in the existing workflow to avoid a stale/large package manifest merge.
- No package.json or runtime schema replacement was required.

## Integration 02 — P34, Active Information Gain and HMX restart integrity

- PR #1104: https://github.com/ailtron1ss-rgb/NK1/pull/1104
- Integration branch: `aspect/combined-personhood-info-outcomes-20261123`.
- Merge SHA / current canonical source: `4972c2d5228141ef9673be94fca243614d28d9d6`.
- Exact-head GitHub Actions: **14/14 SUCCESS**.
- Donor PRs: #1097, #1098, #1085. All three were closed as superseded after merge; original branches remain intact.
- Scope:
  - P34: monotonic evidence event sequencing; restore validation and reconciliation of claim/goal/identity references against the bounded evidence ledger; deduplication of evidence references; canonical claim update instead of duplicate subject/predicate facts.
  - Active Information Gain: tie decision/outcome evidence to exact tick, action and hypothesis; reject malformed, duplicate, stale and mismatched evidence; defensive normalization on restore.
  - Exploration gate calibration: when successful outcomes drive action uncertainty toward zero, novelty and prediction error can still reopen an experiment. The threshold changed from 0.48 to 0.45; the independent resource gate `computeBudget > 0.24` and risk ceiling `risk < 0.82` remain unchanged. Focused regression checks that weak evidence does not trigger an experiment and strong evidence under safe resources does.
  - HMX: extend the actual file-backed server test to stop and restart against the same temporary `STATE_DIR`; verify accepted stage and canonical hypothesis restoration; verify sensitive text remains redacted; replay returns `inserted=0`, `replayed=1`, with no row-count increase.
- Integration method:
  - P34 and Active Information Gain changes reside in separate cognition modules; their checks were reconciled as distinct steps in the existing unified runtime workflow.
  - HMX test is a separate file already wired into the existing HMX workflow. Its pre-PR source version was byte-identical to the donor base, so copying the donor change did not overwrite a concurrent source edit.
  - No `package.json` modification was carried. Existing P34/Active Information scripts were reused; the focused attribution regression is invoked directly.
- The combined exact-head CI exposed a real Active Information weakness: after hundreds of successful outcomes, action uncertainty collapsed and the old evidence threshold prevented any further experiment. The threshold was calibrated without loosening risk or device-budget checks; weak/strong-signal tests and the 900-cycle closed-loop regression then passed.
- No new claim of physical durability, power-loss safety or full external Hexis interoperability is made; the HMX test proves same-process-file-backed server restart/replay on the CI path.

## Superseded donor PRs now closed

| Donor PR | Integrated in | State | Branch history |
|---|---|---|---|
| #1093 ActionGateway audit redaction | #1103 | Closed as superseded | Retained |
| #1094 autonomous-cycle batching | #1103 | Closed as superseded | Retained |
| #1096 cognitive wake routing | #1103 | Closed as superseded | Retained |
| #1097 P34 evidence lifecycle | #1104 | Closed as superseded | Retained |
| #1098 Active Information Gain outcome closure | #1104 | Closed as superseded | Retained |
| #1085 HMX restart idempotency test | #1104 | Closed as superseded | Retained |

## Current high-collision queue — do not merge blindly

| PR | Area | Shared surfaces | Next safe action |
|---|---|---|---|
| #1102 | Cognitive resource wake routing + integration ledger | CognitiveFrame/workflow/package + docs | Runtime feature is already in #1103. Preserve the useful ledger evidence in this refreshed document, then close #1102 as superseded; do not replay its package/workflow/runtime diff. |
| #1095 | Cognitive health supervision | `OrganismRuntime.ts`, `package.json`, workflow | Inspect service ownership, call timing, restore and health-degradation semantics; port only after runtime lifecycle map. |
| #1101 | Risk-aware recovery runtime wiring | `OrganismRuntime.ts`, `UnifiedCognitiveCycle.ts`, tests | Map decision/outcome ordering and recovery side effects; compare with cooperative cycle changes from #1103 before porting. |
| #1099 | NMCN advisor bridge | `OrganismRuntime.ts`, server, package, sidecar and new adapters | Keep opt-in and advisory; verify no duplicate memory/action authority, process lifecycle, network timeout or persistence path. |
| #1084 | Project map and analysis tracker | docs, README, AGENTS and census snapshots | Salvage dated project-map/cycle/census artifacts; do not import stale root checkpoint blocks as current. |

## Current repository census — 2026-11-23 (live snapshot at base 5384111)

- Canonical source: `workpass70-source` @ `5384111285f0f9c46ce452aeca633e47baab3289` (post-PR #1106).
- At the time of this snapshot, before creating the temporary resource-routing integration branch: **1,100 refs**, **1,082 unique tip SHAs**, **3 exact duplicate-tip groups**, and **18 excess aliases**.
- Open PRs at this snapshot: **274** (208 Draft, 66 Ready).
- Duplicate group 1: `f9621bf3e4411ce17bc809922a5f90126001f4fd` — `aspect/consequence-ecology-20261117` and `integrate/consequence-calibration-lineage-followup-20261120`.
- Duplicate group 2: `68a03799ca0c9f18e4c6e19399ed8018e0215e60` — `aspect/world-forge-integrated-20261117` and `integrate/worldforge-to-sharedfuture-after-calibration-20261120`.
- Duplicate group 3: `82ea7a8b7c9b036e65c8b056acedd1176952dd8f` — 17 legacy refs: `nk1-all-branches-merge-2026-10-23`, `nk1-integration-workspace-2026-10-22`, `rebuild`, `workpass79-cognitive-rebuild`, `workpass116-seed-clustered-learning-eval`, `workpass117-verified-replay-admission`, `workpass118-multi-source-learning-integration`, `workpass119-skill-retrieval-feedback-curriculum`, `workpass120-verified-skill-revision-gate`, `workpass121-ledger-bound-skill-revision-proposals`, `workpass122-promotion-gate-coverage-hardening`, `workpass123-authenticated-skill-lifecycle`, `workpass124-learning-evidence-hardening`, `workpass135-durable-shadow-run-registry`, `workpass203-independent-candidate-evaluator`, `workpass206-runtime-evaluator-wiring`, `workpass313-actions-history-audit`.
- Current open PRs use four names from the legacy duplicate group as base refs; preserve `nk1-all-branches-merge-2026-10-23` (PR #109), `rebuild` (PRs #91 and #86), and `workpass206-runtime-evaluator-wiring` (PR #124). Keep `workpass79-cognitive-rebuild` as the canonical legacy ref. Keep `aspect/consequence-ecology-20261117` and `aspect/world-forge-integrated-20261117` as canonical refs for their newer duplicate groups.
- Fifteen aliases are potential cleanup candidates after a fresh recheck: 13 legacy refs (all except the four names above), plus `integrate/consequence-calibration-lineage-followup-20261120` and `integrate/worldforge-to-sharedfuture-after-calibration-20261120`. These refs all point to commits retained by another branch. None of the 18 duplicate aliases is an open-PR head; do not remove open-PR base refs.
- All enumerated branch refs had `protected=false`; this is not a substitute for checking repository rulesets. Recheck the source SHA, all refs, and open-PR head/base references immediately before any deletion.
- No branch deletion was performed. The GitHub connector has no delete-ref action; the default browser profile has no recorded signed-in sites. Actual cleanup requires an authenticated GitHub browser session or an equivalent authorized delete-ref capability.

## PR #1107 unique contribution to port

- PR #1107's unique source contribution is the standalone `test:cognitive-frame-resource-routing` package command. The regression test file is already present in the source tree, and runtime behavior was integrated by PR #1103.
- The command is being carried forward additively with its changelog note. Do not replay PR #1107's older ledger; the richer #1106 ledger is authoritative.

## File-size and repository constraints

- Repository size reported by GitHub: **149,326 KiB** (~145.8 MiB).
- One tracked source-tree file was at least 10 MiB: `legacy/input-archives/grok-workspace.zip`, **51.78 MiB**. It is above the 50 MiB warning threshold, below the 100 MiB hard limit for ordinary Git files.
- No other tracked file at least 10 MiB was found in the inspected recursive tree. The archive remains untouched; branch refs share Git objects rather than creating a separate full archive copy per branch.
- No file-size restriction blocked #1103 or #1104. No Release ZIP or `main` mutation occurred.

## Conflict-resolution protocol

1. Re-read source SHA immediately before each integration.
2. Compare exact donor heads and file surfaces to the live source, not just PR labels or mergeable flags.
3. Group only donors with independent ownership surfaces; keep shared paths such as `OrganismRuntime.ts`, `UnifiedCognitiveCycle.ts`, `MemoryFabric.ts`, `package.json` and shared workflows under explicit conflict review.
4. Avoid copying whole manifests or workflows when a focused direct test invocation or semantic insertion is sufficient.
5. Exact-head CI failure blocks merge. Inspect the failing job, repair the actual contract, and rerun all exact-head checks.
6. Preserve donor refs until integration is verified. After verified supersession, close duplicate PRs; delete branch refs only after reference/ancestry checks and explicit authorization.
7. For each integration, record donor list, exact base/head, changed paths, check counts, merge SHA and post-merge source SHA.
8. Source integration is not Release publication or product readiness.

