# NK1 cross-branch integration inventory (2026-10-22)

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
