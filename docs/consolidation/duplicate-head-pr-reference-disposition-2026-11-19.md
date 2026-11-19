# Duplicate HEAD groups — PR-reference disposition (2026-11-19)

This document joins the 12 exact duplicate-HEAD groups to the complete 942-record PR census. It is a reference disposition, not a deletion instruction. A shared HEAD means identical tip commit/tree, but branch names can still be referenced by open or historical PRs.

## Group-by-group disposition

| Shared HEAD | Branch refs | PR references found | Preliminary disposition |
|---|---|---|---|
| `1fa8d8b53608cb1f423e65e69d1795b486639538` | `cline/dkt6h4tp`, `feature/personality` | `feature/personality`: open PR #83 head, open PR #98 base; Cline alias has no PR head/base reference | Keep `feature/personality` while #83/#98 remain open. `cline/dkt6h4tp` is only an alias candidate after workflow/docs/dependency checks. |
| `4f2def8cd46e261092303e84a1a44c5ed901006e` | `cline/kr084pes`, `feature/memory` | `feature/memory`: open PR #82 head and open PRs #696/#118 base; historical closed bases #117/#104/#94; Cline alias has no PR reference | Keep `feature/memory`. Do not remove its Cline alias until all non-PR references are scanned. |
| `87e9d8ff5dfa957df00598ae711ddc3709af5164` | `feat/local-compose-dev-stack-2026-10-28`, `nk1-hexis-canonical-apply-2026-10-27` | `nk1-hexis-canonical-apply`: open PR #284 head; open PRs #285/#340/#343/#345 base; merged historical bases #337/#295. The `feat/local-compose...` ref has no PR head/base occurrence. | Keep `nk1-hexis-canonical-apply` while open dependents exist. The other name is an alias candidate only; the shared tree is a major Hexis/Mem0 donor and must be preserved. |
| `0284c04ecacb25b633316d1d9b66294e001bcd7d` | `feature/kurisu-2p5d-unified-core-20261026`, `workpass349-native-dataset-path-identity-2026-10-26` | `workpass349...`: open PR #192 head; feature alias has no PR reference. | Keep `workpass349...` while #192 is open. Compare the shared implementation and dependencies before alias cleanup. |
| `82ea7a8b7c9b036e65c8b056acedd1176952dd8f` | 81 refs (full names remain in `duplicate-head-groups-2026-11-19.md`) | Open bases: #109 uses `nk1-all-branches-merge-2026-10-23`; #131 uses `nk1-integration-workspace-2026-10-22`; #121/#112/#91/#86 use `rebuild`; #138/#124 use `workpass206-runtime-evaluator-wiring`. Most other names occur in historical PR head/base records. Four names have no PR reference: `feature/useful-functions`, `workpass73-audit-fixes`, `workpass94-avatar-voice-live2d-audit`, `workpass168-hermes-runtime-compound-skill-bridge-test`. | Current source is 986 commits ahead of this shared tip (0 behind), so the tip itself is already in source ancestry. Keep all refs used by open PRs. The four unreferenced names remain candidates only after tag/workflow/docs/external-reference checks. Preserve the PR history for all other refs. |
| `9aadfe299fbc3e6c648f8f14d42f99328c07ad92` | `fix/cognitive-memory-integration-2026-10-28`, `fix/memory-semantic-provider-failure-fallback-2026-10-27` | First name is head of closed-unmerged PR #319; second is head of merged PR #304; neither is used by an open PR. | Same commit/tree, but retain the shared code and both PR records. Compare its 144-path / 589-commit branch-side delta from the documented merge base against current source before selecting an alias to retire. |
| `0b014d8387f58eebcf5e0b4937fd8919068d331a` | `fix/workpass353-invalid-event-payload-2026-10-26`, `fix/workpass354-progress-evidence-contract-2026-10-26-r3` | First name is head of open PR #182; second has no PR head/base reference. | Keep the #182 head. The second is an alias candidate, but preserve the full shared tree and inspect workflow/docs/dependents first. |
| `ad564d1879028f00549be41ec5172a2f72e25897` | `work/aspect07-autonomy-liveness-2026-10-30`, `work/nk1-aspect12-true-3d-humanoid-foundation-2026-10-30` | Neither branch appears as a PR head or base in the census. | Current source is 645 commits ahead (0 behind); the shared commit is already in source ancestry. Ref cleanup is still gated on non-PR reference checks. |
| `d179446c48a2a99eae64cfa8681707a455d22b01` | `work/nk1-big-pass-current-source-unified-2026-10-30`, `work/nk1-depth-rig-scene-runtime-2026-10-30` | Neither branch appears as a PR head or base in the census. | Current source is 453 commits ahead (0 behind); the shared commit is already in source ancestry. Ref cleanup is still gated on non-PR reference checks. |
| `e6703adf2425563be1388dd7a67c16b4022c82e6` | `workpass353-active-event-envelope-integrity-2026-10-26`, `workpass353-active-event-envelope-integrity-r2-2026-10-26` | Both are heads of closed-unmerged PRs #168 and #171; neither is used by an open PR. | Exact same tip, but preserve code and both PR records. Prior audit found a 149-path / 421-commit branch-side delta from its merge base; inspect against source before any ref cleanup. |
| `83645a237e47e95668c9bab44c6743b9e9411345` | `workpass372-unified-cycle-ingress`, `workpass373-strict-cycle-state-schema` | `workpass372...`: open PR #209 head and open PR #213 base; `workpass373...` has no PR reference. | Keep `workpass372...` while #209/#213 remain open. The second name is an alias candidate only after non-PR references are scanned. |
| `10e2f68459b0e607de20640bed488dde9d3b830e` | `workpass84-final-2026-11-01`, `workpass84-strict-memory-restore-types-2026-11-01` | Heads of closed-unmerged PRs #505 and #502; neither is used by an open PR. | Shared tip contains a small but non-trivial 5-file / 11-commit delta from its merge base (including MemoryOS2 and a restore regression test). Keep the shared implementation as a donor until it is compared line-by-line with source and the October 19 ZIP. |

## Confirmed ancestry checks

Fresh GitHub compare calls on 2026-11-19 returned:

- `82ea7a8...` → `workpass70-source`: 986 ahead / 0 behind.
- `ad564d1...` → `workpass70-source`: 645 ahead / 0 behind.
- `d179446...` → `workpass70-source`: 453 ahead / 0 behind.

These results establish that those three shared tips are ancestors of the current source. They do not make branch references disposable while PR, tag, workflow, ruleset, deployment, documentation, or external references remain.

## Cleanup gates for any alias

A ref can be proposed for removal only after all of the following are attached to its per-ref ledger row:

1. exact current branch SHA and retained commit/tree provenance;
2. exhaustive PR head/base scan for open, merged and closed PRs;
3. downstream branch ancestry/dependency scan;
4. tag and release reference scan;
5. workflow and repository-documentation reference scan;
6. branch protection/ruleset and deployment/environment reference scan;
7. confirmation that the canonical ref is retained and the unique implementation is present in the intended source/aspect branch;
8. verification that no unreviewed unique files, modes, symlinks, submodule/LFS pointers, assets or dependency/configuration rows are lost.

## Result

- All 12 exact duplicate-HEAD groups are linked to the PR census.
- Open PR dependencies are identified for every affected group.
- Three old shared tips are confirmed ancestors of current source.
- No branch ref is deleted or force-updated by this review.


## Live refresh after PR #954 — 2026-11-19

The earlier table is the disposition of the earlier 12-group snapshot. On the latest current listing, the only remaining exact duplicate group is SHA `82ea7a8b7c9b036e65c8b056acedd1176952dd8f` with 17 refs. Current open PR base dependencies are:

- `nk1-all-branches-merge-2026-10-23`: open PR #109.
- `nk1-integration-workspace-2026-10-22`: open PR #131.
- `rebuild`: open PRs #121, #112, #91, #86.
- `workpass206-runtime-evaluator-wiring`: open PRs #138, #124.

The other 13 names are not bases of open PRs in the current 943-record census, but several remain heads/bases in historical merged or closed PR records. The full 17-ref ledger is in `live-branch-consolidation-delta-2026-11-19-after-pr954.md`. Keep the active base refs until the eight dependent PRs are reviewed and safely retargeted or otherwise resolved. Do not use equal SHA alone as permission to delete.

Current state: 963 branch refs, 947 unique HEADs, one duplicate-head group, 16 excess refs. The earlier 1,038 / 12 / 91 values above are the preceding snapshot, not current values.
