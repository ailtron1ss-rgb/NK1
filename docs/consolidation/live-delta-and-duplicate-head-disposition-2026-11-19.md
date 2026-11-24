# Live repository census delta and duplicate-HEAD disposition — 2026-11-19

## Purpose and evidence boundary

This addendum updates the 2026-11-18 census in this PR using fresh paginated GitHub API reads on 2026-11-19. It is an inventory and triage record, not authorization to delete anything. During this period, PRs #950, #951 and #952 were merged into the canonical source by their own integration paths; those merges are explicitly reconciled below. This audit branch did not itself modify production source.

Canonical working source is `workpass70-source` at `aa2b385153ddc316eadf61f87e2c0803d7d59d98`. `main` remains a separate release/report line at `9a789ee1af8fdaa3826dbc734d18e2fc00cde5bf`. The historical source tree used for the original 12-path comparison remains pinned to `7547f528...`; this is not the live branch tip.

## Fresh live census

| Measure | 2026-11-18 register | Live 2026-11-19 |
|---|---:|---:|
| Branch refs | 1,033 | **1,039** |
| Unique branch HEAD SHAs | 942 | **948** |
| Exact duplicate-HEAD groups | 12 | **12** |
| Excess refs inside duplicate-HEAD groups | 91 | **91** |
| PR records | 937 | **943** |
| Open PRs | 414 | **413** |
| Merged PRs | 310 | **313** |
| Closed without merge | 213 | **217** |
| Open Draft PRs | — | **283** |
| Distinct PR head refs | 921 | **927** |
| Distinct open PR head refs | 413 | **412** |

Branch pagination is 100 × 10 pages plus 39 on page 11. Pull-request pagination is 100 × 9 pages plus 43 on page 10. Compared with the Nov 18 snapshot, six additional branch refs have accumulated; the live branch prefix counts are 230 under `aspect/` and 2 under `consolidation/`.

Among currently open PRs, **206 target `workpass70-source` and 65 target `main`**; the remaining **142** target intermediate integration/aspect branches. This is why merging all open PRs directly into one branch would be unsafe.

### PR-state reconciliation, 2026-11-19 live snapshot

A fresh read of all ten live PR pages (100 × 9 plus 43 on page 10; 943 unique PR numbers) found **413 open, 313 merged, and 217 closed without merge**. Of the open PRs, **283 are Draft**. There are 927 distinct head refs overall and 412 distinct head refs among open PRs.

Relevant state transitions after the Nov 18 register:
- #845, #849, #850 and #851 were closed without merge; these are duplicate master-plan candidates described below.
- #950 merged at 05:08:41Z as commit `0a3e4c4e51d7c2ec154a87cc0912e4a1cd6752e0`. It preserves eight Kurisu sprite PNGs and four render/screenshot evidence assets; 13 files, no runtime code.
- #952 merged at 05:05:40Z as commit `9742b5a82966e11ba9c913074615b2420736bcee`. It preserves the N.E.K.O. manifest policy and branch provenance; two documentation files, no runtime code.
- #951 merged at 05:14:52Z as commit `aa2b385153ddc316eadf61f87e2c0803d7d59d98`. All eight changed paths were compared against the resulting `workpass70-source` tree and matched byte-for-byte by Git blob SHA. The exact source commit has 19/19 GitHub check-runs SUCCESS. The closed PR is therefore not a duplicate source of new content; its branch ref remains a separate cleanup candidate.
- #953 remains an open Draft predecessor, based on the older `9742b5...` source head.
- #954 is the rebased open Draft replacement, based exactly on current source `aa2b385...`; its 22-file diff is 22 commits ahead and zero behind. Its exact-head CI is still running at the time of this snapshot and must pass before #953 can be closed as superseded.

This reconciles the live PR counts without rewriting the historical Nov 18 register.

## Exact duplicate HEAD families: what the identical SHA does and does not prove

The 12 groups account for 103 branch names but only 12 commit objects. The 91 excess refs are duplicate pointers, not 91 independently different trees. However, identical tips do not automatically mean that the branch history or its PR relationships can be discarded.

### Old tips already contained in the current source ancestry

- SHA `82ea7a8b7c9b036e65c8b056acedd1176952dd8f`: 81 branch names share this exact tip. Comparing it to the live `workpass70-source` shows it remains an ancestor; the source has advanced by 986 commits. This group contributes no branch-only commits beyond the current source history.
- SHA `ad564d1879028f00549be41ec5172a2f72e25897`: `work/aspect07-autonomy-liveness-2026-10-30` and `work/nk1-aspect12-true-3d-humanoid-foundation-2026-10-30` share a tip that is already an ancestor of source (source is 645 commits ahead). Neither name appeared as a PR head/base in the current PR census.
- SHA `d179446c48a2a99eae64cfa8681707a455d22b01`: `work/nk1-big-pass-current-source-unified-2026-10-30` and `work/nk1-depth-rig-scene-runtime-2026-10-30` share a tip already ancestral to source (source is 453 commits ahead). Neither name appeared as a PR head/base in the current PR census.

These are the strongest branch-ref cleanup candidates by commit ancestry, but no ref was deleted: before deletion the external references, tags, Actions usage, repository links and PR timeline dependencies still need a final check. In the 81-ref family, four refs have no PR head/base occurrence in the census: `feature/useful-functions`, `workpass73-audit-fixes`, `workpass94-avatar-voice-live2d-audit`, and `workpass168-hermes-runtime-compound-skill-bridge-test`. Other names in the family are referenced historically; four names are bases for currently open PRs and must be retained while those PRs remain open:

- `nk1-all-branches-merge-2026-10-23` — PR #109.
- `nk1-integration-workspace-2026-10-22` — PR #131.
- `rebuild` — PRs #121, #112, #91 and #86.
- `workpass206-runtime-evaluator-wiring` — PRs #138 and #124.

The remaining 77 names in this family are represented in historical PR head/base relationships. A closed PR does not erase that history; preserve the PR record and validate all references before ref cleanup.

#### Four unreferenced refs: secondary safety checks

The live branch objects report `protected=false` for all four unreferenced names, and all four point to the same ancestor SHA `82ea7a8b7c9b036e65c8b056acedd1176952dd8f`. The current tag list contains only `Neuro` and `workpass70-hotfix1-2026-10-19`; neither tag points to this SHA. A branch-filtered Actions query returned:
- `feature/useful-functions`: 0 workflow runs.
- `workpass73-audit-fixes`: one historical failed WorkPass287-288 cognitive-contract run (#39910421546, 2026-10-23).
- `workpass94-avatar-voice-live2d-audit`: one historical failed WorkPass287-288 cognitive-contract run (#39910502386, 2026-10-23).
- `workpass168-hermes-runtime-compound-skill-bridge-test`: one historical failed WorkPass287-288 cognitive-contract run (#39910638918, 2026-10-23).

The old Actions run records are evidence to retain, not evidence of a unique branch tree. Together with the exact-ancestor and PR-reference checks, these four are **high-confidence branch-ref cleanup candidates**. They are not marked deletion-approved here: the workflow-run history, any external automation not visible through the repository APIs, and the ability to recreate refs from the recorded SHA still need explicit final sign-off. No branch-ref deletion was performed.

### Same-tip aliases whose shared commit still has material not proven present in source

For these families, the paired names point to the same commit, so the two refs do not represent two different code versions. The commit itself, however, has a substantial branch-only history relative to its merge base. The canonical name below is only a retention preference based on current PR relationships, not a merge decision.

| Shared HEAD SHA | Paired branch names | Branch-side compare from merge base | PR relationship / disposition |
|---|---|---:|---|
| `1fa8d8b53608cb1f423e65e69d1795b486639538` | `cline/dkt6h4tp`, `feature/personality` | 30 files; 72 commits | Keep `feature/personality`: open PR #83 uses it as head and #98 uses it as base. The Cline name is an unreferenced alias candidate, not a separate implementation. |
| `4f2def8cd46e261092303e84a1a44c5ed901006e` | `cline/kr084pes`, `feature/memory` | 61 files; 189 commits | Keep `feature/memory`: open PRs #696, #118 and #82 use it as a base; older PRs #117, #104 and #94 also reference it. The Cline name is an unreferenced alias candidate. |
| `87e9d8ff5dfa957df00598ae711ddc3709af5164` | `feat/local-compose-dev-stack-2026-10-28`, `nk1-hexis-canonical-apply-2026-10-27` | 163 files; 499 commits | Keep `nk1-hexis-canonical-apply`: it is used by multiple open downstream PRs, including #345, #343, #340 and #285. The `feat/local-compose...` name is not in the PR head/base census, but the shared tree is a major donor and must not be discarded. It contains Hexis/Mem0 integration, workflows, docs, dependencies and a large legacy source archive. |
| `0284c04ecacb25b633316d1d9b66294e001bcd7d` | `feature/kurisu-2p5d-unified-core-20261026`, `workpass349-native-dataset-path-identity-2026-10-26` | 183 files; 320 commits | Keep `workpass349-native-dataset-path-identity`: open PR #192 uses it as head. The feature name is an unreferenced alias candidate; retain the shared code/history. |
| `9aadfe299fbc3e6c648f8f14d42f99328c07ad92` | `fix/cognitive-memory-integration-2026-10-28`, `fix/memory-semantic-provider-failure-fallback-2026-10-27` | 144 files; 589 commits | PR #304 merged into an intermediate Hexis/Mem0 base; #319 closed without merge. No current open PR uses these names. Preserve as a donor until its unique memory and integration changes are reconciled against source and downstream branches. |
| `0b014d8387f58eebcf5e0b4937fd8919068d331a` | `fix/workpass353-invalid-event-payload-2026-10-26`, `fix/workpass354-progress-evidence-contract-2026-10-26-r3` | 159 files; 419 commits | Keep `fix/workpass353-invalid-event-payload`: open PR #182 uses it as head. The `workpass354...` name is an unreferenced alias candidate, not a second tree. |
| `10e2f68459b0e607de20640bed488dde9d3b830e` | `workpass84-final-2026-11-01`, `workpass84-strict-memory-restore-types-2026-11-01` | 5 files; 11 commits | PRs #505 and #502 closed without merge. The small unique diff includes `MemoryOS2.ts`, a restore-shape regression test, a plan and a spec; preserve it for line-level reconciliation, not deletion by branch size. |
| `e6703adf2425563be1388dd7a67c16b4022c82e6` | `workpass353-active-event-envelope-integrity-2026-10-26`, `workpass353-active-event-envelope-integrity-r2-2026-10-26` | 149 files; 421 commits | PRs #168 and #171 closed without merge. Preserve the shared candidate until its event-fabric and evidence changes are checked against source and other integration branches. |
| `83645a237e47e95668c9bab44c6743b9e9411345` | `workpass372-unified-cycle-ingress`, `workpass373-strict-cycle-state-schema` | 184 files; 286 commits | Keep `workpass372-unified-cycle-ingress`: open PR #209 uses it as head and #213 uses it as base. The `workpass373...` name is an unreferenced alias candidate, but the shared work must be preserved. |

The file/commit counts above describe the compare from the relevant shared merge base to the duplicate tip. They are not claims that every listed line is absent from every other branch; overlap against current source, intermediate bases, merged PRs and the Oct 19 archive remains to be resolved by path/blob/patch inspection.

## Other confirmed duplicate PR clusters

The exact resulting-tree clusters documented in the Nov 18 register remain open and target `main`, based on the same `main` SHA `48dffbf4f5c9b5474c8baff61f40b8bf0c5828e8`:

- #845 / #849 / #857 — identical tree `1bbd25f24f33372f3458c67ecec4b014553054d9`; same four changed paths.
- #850 / #858 — identical tree `323b16360994f6d9df9f58264176bbda435f7517`.
- #851 / #859 — identical tree `7ca0bccd2c51a2b16a3bcdf7ca21ef000429664e`.

These are exact duplicate outcomes, not independent implementation candidates. Retain one canonical review candidate per cluster only after checking comments, workflow evidence and references; do not merge them into `workpass70-source` merely because their titles are similar.

Avatar/unified-brain PRs #848, #856 and #844 are a different case: they share many paths and eight sprite blobs, but several code/docs/demo/render files differ. The existing `avatar-cluster-source-gap-analysis-2026-11-18.md` describes source implementations that are already stronger than some candidates. Review those PRs per file; do not select a whole PR by recency.

PR #950 is now merged into `workpass70-source` as asset-only preservation: eight Kurisu sprite PNGs and four render/screenshot evidence variants, copied as unchanged Git blobs with source SHA provenance. Runtime code is unchanged and the sprites are not yet connected to UI. The asset files are preserved; UI wiring and licensing/provenance review remain separate.

## Target long-lived branch taxonomy

The 13-domain target is retained as the direction for consolidation, not as permission to rewrite branch history:

1. Core organism runtime and canonical cognitive cycle.
2. Memory, persistence, temporal/episodic/semantic retrieval and forgetting.
3. Learning, replay, evaluation-driven adaptation and neuroplasticity.
4. Motivation, goals, planning, initiative and governed autonomy.
5. Affect, personality, identity, UserModel and social cognition.
6. Embodiment, avatar, Live2D/2D/2.5D/3D, rigging and visual assets.
7. Voice, ASR, TTS, turn-taking and speech/avatar synchronization.
8. Tools, adapters, plugins, MCP and external integrations.
9. Security, consent, trust, evidence provenance and policy gates.
10. Datasets, benchmark harnesses, evaluation protocols and readiness measurement.
11. Platform, runtime packaging, dependencies, mobile, Docker and infrastructure.
12. UI, application surfaces, interaction and user experience.
13. Documentation, research intake, source assimilation and architecture maps.

Long-lived aspect branches should be few and durable. Small task branches should be temporary children of one domain branch and return through reviewed PRs. Avoid stacking unrelated domains on a single overloaded integration branch.

## Oct 19 baseline — still a blocking parity gate

The primary release archive remains `Neuro_Kurisu_WORKPASS70_2026-10-19.zip` (135,290,615 bytes; SHA-256 `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`). The later hotfix ZIP is a separate prerelease artifact (136,354,713 bytes; SHA-256 `9effadfcf0d402b462dd9cf2fd5b5793742039c9260db80578be830952bf52eb`) and is explicitly not production-approved in its release notes.

The archive bytes were not available to this execution environment for extraction. GitHub compare from tag `Neuro` to `workpass70-source` returns “No common ancestor”. Therefore no file-level or byte-level ZIP/source parity claim is made. The ZIP remains an explicit gate: obtain the exact asset bytes, verify the published SHA-256, extract without modifying files, create a per-path SHA-256 manifest, and compare candidate/source/archive files three ways before deciding which implementation wins.

## Actions taken and not taken

- Re-read all live branch pages and all pull-request pages on 2026-11-19.
- Rechecked all 12 duplicate HEAD groups against the current working source or their shared merge bases; established which duplicate refs are old ancestors and which shared commits still contain substantial donor histories.
- Reconciled duplicate refs with PR head/base relationships, including open and historical PRs.
- Preserved the original census and added this dated delta rather than silently rewriting its Nov 18 timestamp.
- The canonical source advanced to `aa2b385...` through PR integrations #950, #951 and #952; the exact #951 source commit has 19/19 check-runs SUCCESS.
- No branch was deleted or force-updated by this audit. #951 is merged and closed; #950 and #952 are merged; #953 remains Draft while rebased #954 is tested.
- Two new working aspect PRs are being maintained separately: #951's content is already present in source; #954 is the rebased HMX candidate. No release ZIP was changed.
- No claim of Oct 19 archive parity or completed per-line audit of all 1,039 branch refs is made.

## Next review sequence

1. Obtain and verify the Oct 19 ZIP bytes; extract to an immutable read-only baseline and generate a SHA-256 manifest.
2. Traverse every branch not covered by exact-tip deduplication: compare merge base, ancestry, tree SHA, changed paths, blob SHA, complete patches, PR head/base relationships, and the ZIP manifest.
3. Process high-overlap clusters by domain, starting with Hexis/memory, cognitive runtime/event-fabric, personality/autonomy, avatar/embodiment, and the chained WorkPass branches.
4. For each candidate file, record source SHA, branch SHA, archive SHA, semantic difference, dependency/config/workflow references, tests and destination aspect branch. Port only missing useful deltas; never overwrite a stronger source implementation with an older branch copy.
5. Run focused tests plus full affected-path regressions on the final aspect PR head. Preserve provenance and historical PRs.
6. Only then propose branch-ref cleanup. Delete a ref only after proving its tree/history is represented, all open PR and base/head relationships are resolved, and all tags/CI/external links that matter are accounted for.
