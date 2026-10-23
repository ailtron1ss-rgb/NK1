# NK1 cross-branch integration inventory (2026-10-22)

## Follow-up — semantic conflict repairs (2026-10-23)

- Reconciled three meaningful source/target divergences instead of copying a branch file wholesale: restored P26's 18-feature named migration; restored and expanded micro-cycle finite-input normalization; replaced Core's duplicated autonomous executor-outcome list with shared `wasToolExecutorEntered` semantics.
- Causal replay is now both connected to P23 production replay and indexed via a first-write-wins trace → experience map; existing adaptive multi-signal selection remains the final batch selector.
- Safe avatar persistence is used by both `LegacySpriteDeck` and `AvatarStage`, with static regression coverage for both components.
- The test aggregate includes the recovered true-learning suite and targeted wiring tests. No runtime-test pass is asserted until Actions allocates a runner and executes steps.

---


## Follow-up — avatar persistence integration (2026-10-23)

- `LegacySpriteDeck` and `AvatarStage` now use the restored `safeLocalStorage.ts` adapter for optional outfit, viewer-mode and voice preferences. A single blocked local-storage write returns `false` rather than aborting the settings effect.
- Extended the adapter regression test to cover both React components. The same root regression aggregate already invokes it, so no duplicate CI workflow step is needed.

---


## Follow-up — production wiring (2026-10-23)

- The restored `CognitiveCycleBoundary` is now called by `OrganismRuntime.stepInternal` directly after `environment.toOrganismObservation()`; a regression script checks import, call placement and runtime input guards.
- The restored `CausalReplaySampler` now runs inside `P23LearningEngine.replayPending` using state/outcome features. Its bounded diverse candidate pool feeds the existing adaptive `selectReplayBatch` final selector rather than replacing that more expressive policy. A regression script checks the production call path and feature vector construction.
- Both wiring regressions are registered in `runtime/neuro-kurisu/package.json` and included in `test:rebuild-recovered`. CI execution remains blocked before runner startup; static wiring/manifest checks are not represented as test passes.

---


## Follow-up — recovered file paths and test wiring (2026-10-23)

- Source trees audited: `rebuild`, `workpass94-avatar-voice-live2d-audit`, and `workpass318-repair-evidence-lineage`.
- Restored 31 non-conflicting paths that were not present in the integration tree: 27 from `rebuild`, two avatar/voice audit artifacts, and two WorkPass318 evidence/finite-input artifacts. Existing files were retained from the integration tree instead of overwriting them with branch snapshots.
- Wired runtime regression commands for cognitive-cycle boundary, causal replay selection/benchmark, feature schema migration, holdout provenance, sequential learning benchmark, replay policy sweep, restored action receipts, finalizer boundary, autonomous planner routing, project reconciliation, and finite-microcycle inputs. Added app test commands for safe avatar storage and Live2D expression cache.
- The integration branch's tree is now the merge result; the merge commit has parents for the verified-learning, Hermes/cognitive-rebuild, rebuild, avatar/voice-audit, runtime-evaluator, multiscale-plan, and WorkPass318 evidence-lineage histories. This is history + non-conflicting file recovery, not a claim that every divergent implementation was semantically identical.
- CI wiring is in place; execution remains blocked before the GitHub runner starts. Do not mark the recovered tests passed until jobs have real steps/results.

---


This inventory records concrete source-history evidence gathered while preparing the integration. It is intentionally not labelled a completed code merge.

## Source refs and observed CHANGELOG state

| Source branch | CHANGELOG blob SHA | Length (characters) | Evidence |
|---|---|---:|---|
| workpass70-source | fd7c86b4296711376cf2d67e084a75d04b667cf7 | 259957 | Includes WorkPass248 entry dated 2026-10-22; host-owned evaluation adapter binds executor response runId to the exact supervised invocation ID. Test/typecheck/CI explicitly unverified at that head. |
| workpass79-cognitive-rebuild | a47123c40a6eb0d3f90efa79d2c0b9e9d4460a9b | 157035 | Contains older cognitive/learning experiment-plan and retention evaluation work, including process-kill reset/retention protocol ideas and explicit limitations around execution and verifier-backed outcomes. |
| workpass86-prioritized-replay | e7cba691604a6b3085f31a2708b1fdefaac655da | 118663 | Contains newer runtime release-owner metadata (35.88.0 / schema 225), speech ambiguity handling, gateway recovery tests and explicit outstanding Android/audio/browser E2E limitations. |
| workpass88-avalanche-forgetting-metrics | e7cba691604a6b3085f31a2708b1fdefaac655da | 118663 | The sampled CHANGELOG blob is byte-identical by Git blob SHA to workpass86's sampled CHANGELOG. Treat these branches as likely sharing this file snapshot, not as two independent CHANGELOG contributions. |

## Integration decisions

1. Keep `workpass70-source` as the initial code baseline because it is the active source line for the recent WorkPass319–325 changes already made in this project history.
2. Do not overwrite newer files with older snapshots merely because a branch name has a larger WorkPass number.
3. The WorkPass79 snapshot's CHANGELOG is substantially shorter and ends at older work than the sampled WorkPass70 snapshot; importing its entire CHANGELOG would erase later history. Port only code/tests that are demonstrably absent and compatible.
4. WorkPass86 and WorkPass88 have the same sampled CHANGELOG blob SHA. Avoid duplicate import of the same content; inspect actual source/test diffs before deciding whether their code changes differ.
5. Preserve explicit validation caveats from source history. A changelog claim that a test passed in a different snapshot does not prove the integrated head passes.
6. Keep all source branches unchanged and stage integrations on `nk1-integration-workspace-2026-10-22`.

## Still required before claiming a code merge

- Inspect the changed paths and actual file contents in each source branch.
- Port non-overlapping source/test changes into the integration branch; reconcile overlapping files semantically.
- Run the relevant targeted tests and CI on the resulting head.
- Build the release ZIP from that exact validated head and verify its contents/hash before publishing.

## Current status

Evidence-based branch inventory committed. No source code from the listed branches has been merged by this inventory alone; release ZIP unchanged.


## Expanded comparison against workpass70-source

A direct GitHub compare against `main` had previously reported no common ancestor for the selected branch pairs. A more useful comparison against the actual working source ref, `workpass70-source`, establishes that most of these branches **do share ancestry with that source** and can be integrated by examining their real diffs rather than treating them as unrelated histories.

| Branch | Compare result vs workpass70-source | Commits ahead | Changed paths |
|---|---|---:|---:|
| workpass71-learning-eval-paired-seeds | diverged | 56 | 17 |
| workpass71-learning-integrity | diverged | 32 | 10 |
| workpass73-audit-fixes | diverged | 1 | 1 |
| workpass79-cognitive-rebuild | diverged | 379 | 84 |
| workpass79-learning-input-integrity | diverged | 48 | 19 |
| workpass86-prioritized-replay | diverged | 65 | 24 |
| workpass87-cleanrl-eval-protocol | diverged | 74 | 28 |
| workpass88-avalanche-forgetting-metrics | diverged | 78 | 31 |

All rows above reported a merge base in the GitHub comparison response. This supersedes the overly broad conclusion that all these histories lack a common ancestor: that observation applied to comparison with `main`, not to comparison with `workpass70-source`.

## File-level triage findings

- Learning evaluation branch adds paired holdout evaluation, bounded experience replay, continual-learning history and replay-strategy comparisons, with tests and workflow updates. Several sampled files already have identical blob SHAs in the integration workspace, so these are not missing changes to re-copy.
- Learning-integrity branch changes the live `OrganismCore.ts`, `CausalExperienceStream.ts`, `SkillAcquisitionBenchmark.ts`, and adds a split-integrity test. These overlapping runtime files require semantic review before porting.
- Cognitive-rebuild branch reports 84 changed paths, including new replay, verified-outcome, promotion-gate and continual-learning-metrics workflows. It is the largest candidate source and should be triaged by subsystem, not merged as a blind snapshot.
- Learning-input-integrity, prioritized-replay, CleanRL and Avalanche branches progressively add research intake records, vendor notices/licenses, replay code and evaluation workflows. Several documentation files are already identical in the integration workspace.
- The current workspace's `ContinualReplayBuffer.ts` blob differs from the sampled workpass79 source blob; the workspace version is longer. Do not replace it with the shorter branch snapshot without a method-level diff.

## Safe merge execution policy

The current GitHub connector exposes file-level reads/writes and commit/tree primitives but does not expose a confirmed bulk cherry-pick operation in the discovered tool set. Therefore integration must be performed as a sequence of explicit file-level changes or via a reviewed pull request; do not label a source branch merged solely because its name is listed here.

## Follow-up verification — learning-integrity overlap (2026-10-23)

- Enumerated the full `runtime/neuro-kurisu/src/organism/learning/` directory in both `workpass71-learning-integrity` and this integration workspace. The source branch has **no learning-module filenames missing from the workspace**; the workspace has 46 additional learning modules not present in that older branch snapshot.
- Compared `CausalExperienceStream.ts` at source level. The integration version contains additional safeguards absent from the older source snapshot: control-character rejection before ID trimming, bounded task IDs, validated action allowlist, observed-state validation, bounded runtime policy vectors, and a learning/consolidation lane restricted to state-grounded runtime outcomes.
- Decision: **do not overwrite** the integration version with the older branch version. This would remove security and evidence-integrity constraints. The learning-integrity branch remains a semantic reference for the overlapping core/controller/benchmark files; any further port must be a method-level merge, not a file replacement.
- This follow-up is a comparison result, not a claim that the source branch has been merged or that tests passed. The release ZIP remains untouched.

## Follow-up verification — cognitive-rebuild, Hermes gate, multi-source and verified revision branches (2026-10-23)

A recursive Git tree comparison was run against the integration head `351a60e54e9954e2ff28c8788da491d8afa80f26`, checking source/test/workflow/vendor paths in these source refs:

- `workpass79-cognitive-rebuild`
- `workpass93-hermes-reflective-learning-gate`
- `workpass118-multi-source-learning-integration`
- `workpass120-verified-skill-revision-gate`
- `workpass88-avalanche-forgetting-metrics`

**Result: zero source/test/workflow/vendor paths from those snapshots are missing by pathname in the integration tree.** This confirms that copying their unique filenames again would be redundant. It does not mean the Git branch histories have been merged, nor does pathname parity prove that every source-branch implementation is byte-identical or behaviorally equivalent.

### Overlapping implementation rule

- The integration head's `P23LearningEngine.ts` is substantially longer than the WorkPass120 snapshot and already imports the SkillLearnBench adapter, verified-promotion proposal checks, independent-evaluation/shadow-evidence bindings and reflection/retrieval curriculum mechanisms. Preserve this newer integrated implementation rather than replacing it with the older branch file.
- `SkillRevisionGate.ts` and its test exist in the integration tree. The integration test includes additional rejection/holdout assertions compared with the sampled WorkPass120 version; keep the stronger target test.
- These checks indicate that the main remaining merge work is **semantic reconciliation of overlapping implementations and validation**, not copying whole source trees. For each overlap, compare function behavior, call sites, trust boundaries and tests before changing the target.

### Honest status boundary

- **Verified:** all relevant paths checked above exist in the integration tree; sampled integration implementations contain additions beyond older source snapshots.
- **Not verified:** complete behavioral equivalence across every branch; test suite success; successful hosted CI execution; release archive parity.
- **Not done:** no GitHub Release ZIP was downloaded, rebuilt or replaced by this pass. The release asset remains unverified and must not be described as updated.

