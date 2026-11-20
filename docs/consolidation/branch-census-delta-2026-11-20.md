# NK1 branch / PR census delta — 2026-11-20

## Last fully paginated snapshot

The complete GitHub API pagination performed before opening PR #1031 returned:

- **1,032 branch refs**
- **1,016 unique HEAD SHAs**
- **1 exact duplicate-tip family** with 17 refs
- **16 excess aliases**
- **306 open PRs**: 155 based on `workpass70-source`, 151 on other refs
- **72 distinct open-PR base refs**, 306 distinct head refs

The 17-ref family remains at `82ea7a8b7c9b036e65c8b056acedd1176952dd8f`; its full names are in [the 19-Nov live census](consolidation/branch-census-2026-11-19.md) and the later [20-Nov execution log](consolidation/branch-consolidation-execution-log-2026-11-19.md).

## Known delta after that snapshot

- PR [#1031](https://github.com/ailtron1ss-rgb/NK1/pull/1031) added one new branch ref: `fix/neurosymbolic-concept-restore-integrity-20261120`.
- PR #1031 targeted `workpass70-source` at `960a2d540ef952486a0271a0e5332caec601b36a` and is now merged as `950989fe0081e3760471d44beb6e95bb9e0bc82b`.
- PR #1032 adds the second known ref. After #1031 merged and #1032 remained open, the derived known minimum is **1,034 refs / 1,018 unique HEADs / 307 open PRs**. This is a derived delta, not a claim that a second full pagination was completed; concurrent external changes remain possible.
- PR #1031 was squash-merged. No branch was deleted or force-updated.

## Current source

- `workpass70-source` runtime baseline after #1031: `950989fe0081e3760471d44beb6e95bb9e0bc82b` (before the documentation-only update in #1032).
- `main`: `06e01cdd0a8e60ed70991f22e842887f544d1ebf`
- Exact source Actions for `960a2d540ef952486a0271a0e5332caec601b36a`: 11/11 SUCCESS.
- External/observed source integration: PR #868, bounded MeTTa concept export bridge, merge commit `960a2d540ef952486a0271a0e5332caec601b36a`. It serializes bounded facts only; no Hyperon execution worker is connected.

## Safety interpretation

Equal HEAD is not sufficient for branch deletion. Every alias still requires joins against open and closed PR heads/bases, tags, workflows, downstream branch ancestry, deployments, rulesets and external references. Keep the 17-ref family intact until a complete disposition ledger exists.


## Second known delta — PR #1032

- Documentation PR [#1032](https://github.com/ailtron1ss-rgb/NK1/pull/1032) uses `maintenance/nk1-live-checkpoint-2026-11-20` as the second new ref after the 1,032/1,016/306 full snapshot.
- Its prior exact head `dcdac4cebfedd451f89406ba0eec3357cb58179f` passed 5/5 Actions; this checkpoint refresh adds a new head that must be revalidated before merge.
- After #1031 merged, the known minimum was **1,034 branch refs / 1,018 unique HEADs / 307 open PRs**. This remains a delta, not a new complete pagination; no second full PR-base pagination was performed.
- PR #1031 final head `46d4179171ae16a2b9fb2876efc7db0a815eef03` passed all 8/8 exact-head Actions and was merged as `950989fe0081e3760471d44beb6e95bb9e0bc82b`.


## Complete live census refresh — 2026-11-20 (automation pass)

### Paginated branch refs

- Repository: `ailtron1ss-rgb/NK1`; canonical source `workpass70-source` @ `1df061ffa377c6ad94beacb1c5a113564baed5ae`.
- Complete pagination: 100 on page 1; 100 on page 2; 100 on page 3; 100 on page 4; 100 on page 5; 100 on page 6; 100 on page 7; 100 on page 8; 100 on page 9; 100 on page 10; 36 on page 11; the next page was empty.
- **Branch refs: 1036; unique HEAD SHAs: 1020; excess names over unique HEADs: 16; shared-HEAD groups: 1.**
- Latest saved full *aggregate* snapshot in this delta file: 1,032 refs / 1,016 unique HEADs / 16 excess names. Current net change: **+4 refs, +4 unique HEADs, 0 change in excess aliases**. That 1,032 snapshot has no complete name→SHA manifest, so exact name-level deltas below are compared with the latest saved full manifest, `branch-census-2026-11-19.json` (1,038 refs / 947 unique HEADs).
- Name-level comparison against that 19-Nov full manifest: **84 new names, 86 names absent, 10 HEADs changed**. These are observed differences only; parallel chats/external actions may have caused them. Do not attribute them to this run.

### Shared-HEAD group(s)

- SHA `82ea7a8b7c9b036e65c8b056acedd1176952dd8f` (17 refs): `nk1-all-branches-merge-2026-10-23`, `nk1-integration-workspace-2026-10-22`, `rebuild`, `workpass116-seed-clustered-learning-eval`, `workpass117-verified-replay-admission`, `workpass118-multi-source-learning-integration`, `workpass119-skill-retrieval-feedback-curriculum`, `workpass120-verified-skill-revision-gate`, `workpass121-ledger-bound-promotion-proposals`, `workpass122-promotion-gate-coverage-hardening`, `workpass123-authenticated-skill-lifecycle`, `workpass124-learning-evidence-hardening`, `workpass135-durable-shadow-run-registry`, `workpass203-independent-candidate-evaluator`, `workpass206-runtime-evaluator-wiring`, `workpass313-actions-history-audit`, `workpass79-cognitive-rebuild`

No new shared-HEAD group appeared relative to the 1,032 aggregate snapshot; the same 17-ref family remains. Equal HEAD is not retirement clearance.

### New branch names vs 19-Nov full manifest (84)

- `aspect/action-gateway-locale-neutral-risk-20261119`
- `aspect/affect-history-aggregate-reconciliation-20261119`
- `aspect/affect-restore-integrity-consolidated-20261119`
- `aspect/affect-snapshot-record-key-cap-20261119`
- `aspect/affect-transparent-proxy-restore-20261119`
- `aspect/b299-personality-consolidation-20261119`
- `aspect/b299-restore-integrity-source-20261119`
- `aspect/developmental-instance-groups-20261119`
- `aspect/hexis-accept-apply-20261119`
- `aspect/hexis-explicit-apply-consent-20261119`
- `aspect/hmx-import-text-redaction-20261119`
- `aspect/memory-and-retrieval`
- `aspect/memory-hmx-semantic-integrity-rebased-20261119`
- `aspect/module-boundary-contracts-current-source-20261119`
- `aspect/neko-asr-shadow-boundary-regressions-20261120`
- `aspect/p2702-proxy-restore-guard-20261119`
- `aspect/persistence-facet-defaults-20261119`
- `aspect/world-exact-ticket-source-20261119`
- `consolidation/2p5d-asset-preflight-current-20261120`
- `consolidation/action-gateway-locale-neutral-current-source-20261119`
- `consolidation/affect-restore-deep-tests-20261119`
- `consolidation/affect-restore-deep-tests-current-20261119`
- `consolidation/affect-restore-regression-20261119`
- `consolidation/affect-voice-appraisal-batch-20261119`
- `consolidation/avatar-2d3d-preview-ecosystem-current-20261120`
- `consolidation/avatar-animation-crossfade-current-source-20261120`
- `consolidation/avatar-brain-bridge-regressions-20261120`
- `consolidation/avatar-brain-renderer-20261119`
- `consolidation/avatar-brain-renderer-current-20261119`
- `consolidation/avatar-measured-motor-boundary-20261120`
- `consolidation/b299-restore-test-coverage-20261119`
- `consolidation/body-restore-integrity-20261120`
- `consolidation/body-restore-sanitization-current-source-20261120`
- `consolidation/body-state-restore-sanitization-current-source-20261120`
- `consolidation/code-assimilation-contracts-current-source-20261119`
- `consolidation/cognitive-bus-hostile-numeric-current-20261119`
- `consolidation/cognitive-spine-restore-integrity-current-source-20261120`
- `consolidation/cognitive-spine-runtime-integration-current-source-20261120`
- `consolidation/cognitive-spine-runtime-integration-current-source-v2-20261120`
- `consolidation/cognitive-spine-runtime-integration-current-source-v3-20261120`
- `consolidation/device-evidence-ledger-restore-20261120`
- `consolidation/elastic-neural-plasticity-current-source-20261120`
- `consolidation/embodiment-motor-honesty-current-20261120`
- `consolidation/grounded-spatial-memory-current-20261119`
- `consolidation/grounded-spatial-memory-current-20261119-v2`
- `consolidation/hexis-hmx-apply-consent-20261119`
- `consolidation/hexis-smoke-process-cleanup-current-source-20261119`
- `consolidation/import-scanner-real-fixture-regressions-current-source-20261120`
- `consolidation/inspect-acp-pin-20261119`
- `consolidation/interoceptive-boundary-current-20261119`
- `consolidation/interoceptive-boundary-current-20261119-v2`
- `consolidation/master-plan-10stage-checklist-current-20261120`
- `consolidation/master-plan-30phase-validator-current-20261120`
- `consolidation/memory-affect-reranker-20261119`
- `consolidation/memory-locale-neutral-20261119`
- `consolidation/memory-source-group-v2-20261119`
- `consolidation/memory-trusted-holdout-manifest-current-20261120`
- `consolidation/module-boundary-contracts-20261119`
- `consolidation/module-import-scanner-current-source-20261119`
- `consolidation/neko-asr-provider-current-source-20261119`
- `consolidation/neko-smart-turn-current-source-20261119`
- `consolidation/neko-speech-admission-current-source-20261119`
- `consolidation/neko-streaming-current-source-20261119`
- `consolidation/neko-streaming-current-source-20261119-v2`
- `consolidation/neko-streaming-current-source-implementation-20261119`
- `consolidation/neko-streaming-current-source-implementation-20261119-v2`
- `consolidation/neko-streaming-current-source-implementation-20261119-v3`
- `consolidation/neko-streaming-full-current-20261119`
- `consolidation/neko-streaming-full-current-20261119-r2`
- `consolidation/neural-prosthesis-layer-force-current-parent-20261120`
- `consolidation/neuroforge-coding-context-current-source-20261120`
- `consolidation/original-2d-cognitive-motor-20261120`
- `consolidation/runtime-test-duplicate-guard-current-source-20261120`
- `consolidation/spatial-observation-guards-20261119`
- `consolidation/strict-directory-fsync-current-source-20261120`
- `docs/archive-engineering-cycles-2026-11-10-to-15`
- `docs/branch-consolidation-status-20261120`
- `epistemic-contradiction`
- `fix/body-restore-proxy-array-boundary-20261120`
- `fix/neurosymbolic-concept-restore-integrity-20261120`
- `integrate/b299-restore-integrity-20261120`
- `integrate/neuroforge-donor-analysis-20261120`
- `maintenance/nk1-live-checkpoint-2026-11-20`
- `workpass-motor-trajectory-limits-3d`

### Names absent vs 19-Nov full manifest (86)

- `aspect/neko-operational-journal-durability-rebased-20261105`
- `aspect/open-loop-radar-20261117`
- `cline/dkt6h4tp`
- `cline/kr084pes`
- `docs/integrate-300-step-master-plan-20261028-12948961985853415667`
- `docs/integrate-300-step-master-plan-20261028-14265768481811509714`
- `docs/integrate-300-step-master-plan-796941104416622017`
- `docs/nk1-30phase-master-plan-2026-10-28-1510468532516920140`
- `feat/local-compose-dev-stack-2026-10-28`
- `feature/kurisu-2p5d-unified-core-20261026`
- `feature/useful-functions`
- `fix/live2d-frontend-readback-20261113`
- `fix/memory-semantic-provider-failure-fallback-2026-10-27`
- `fix/workpass354-progress-evidence-contract-2026-10-26-r3`
- `integrate-nk1-300-steps-master-plan-12649373106848930518`
- `jules-6082834100399646159-b6abd68c`
- `nk1-docs-master-plan-2026-10-28-12710405149625491296`
- `nk1-integrate-300-step-master-plan-2026-10-28-15177051593202193169`
- `work/nk1-aspect12-true-3d-humanoid-foundation-2026-10-30`
- `work/nk1-depth-rig-scene-runtime-2026-10-30`
- `workpass150-hermes-adapter-verified-lifecycle`
- `workpass151-hermes-p23-learning-diagnostics`
- `workpass152-hermes-evidence-binding`
- `workpass153-hermes-binding-scope-hardening`
- `workpass154-hermes-promotion-gate`
- `workpass155-hermes-directed-skill-evolution`
- `workpass156-hermes-revision-to-candidate`
- `workpass157-hermes-revision-generator-wiring`
- `workpass158-hermes-repair-observation-to-variant`
- `workpass159-hermes-repair-deduplication`
- `workpass160-hermes-repair-ledger-dedup`
- `workpass161-hermes-holdout-promotion-isolation`
- `workpass162-hermes-verified-nonholdout-evidence`
- `workpass163-hermes-evidence-state-migration`
- `workpass164-hermes-promotion-api-gate`
- `workpass165-hermes-holdout-neutral-confidence`
- `workpass166-hermes-compound-holdout-isolation`
- `workpass167-hermes-compound-execution-path`
- `workpass168-hermes-runtime-compound-skill-bridge`
- `workpass168-hermes-runtime-compound-skill-bridge-test`
- `workpass169-hermes-runtime-repair-observation-bridge`
- `workpass170-hermes-repair-loop-runtime-correction`
- `workpass171-hermes-repair-evidence-p23-bridge`
- `workpass172-hermes-compound-revision-orchestrator`
- `workpass194-cross-source-verified-replay-consolidation`
- `workpass195-cross-source-affective-goal-replay`
- `workpass197-cross-source-skill-transfer-safety`
- `workpass198-cross-source-evidence-balanced-learning`
- `workpass199-production-affective-goal-replay`
- `workpass200-correct-replay-novelty-signal`
- `workpass201-continuous-outcome-salience`
- `workpass202-verified-replay-count-bridge`
- `workpass286-multiscale-brain-system-plan`
- `workpass303-conflict-resolution-safe-additions`
- `workpass304-merge-cognitive-architecture-map`
- `workpass305-merge-microcycle-attribution`
- `workpass306-integrate-plan-contract-tests`
- `workpass307-integrate-regression-tests`
- `workpass308-integrate-organism-runtime-revision-loop`
- `workpass309-integrate-core-and-causal-evidence`
- `workpass310-integrate-p23-coordinator-learning-substrate`
- `workpass311-wire-regression-scripts`
- `workpass312-bound-reflective-candidate-payload`
- `workpass313-bind-decision-linked-outcomes`
- `workpass314-thread-decision-ticket-through-gateway`
- `workpass315-document-integrated-learning-passes`
- `workpass316-persist-source-evidence-fingerprint`
- `workpass317-expand-revision-coordinator-regressions`
- `workpass318-document-provenance-regressions`
- `workpass318-repair-evidence-lineage`
- `workpass326-ci-runtime-hardening`
- `workpass353-active-event-envelope-integrity-r2-2026-10-26`
- `workpass373-strict-cycle-state-schema`
- `workpass71-learning-eval-paired-seeds`
- `workpass73-audit-fixes`
- `workpass79-learning-input-integrity`
- `workpass84-strict-memory-restore-types-2026-11-01`
- `workpass86-prioritized-replay`
- `workpass87-cleanrl-eval-protocol`
- `workpass88-avalanche-forgetting-metrics`
- `workpass89-avalanche-transfer-metrics`
- `workpass90-river-adaptive-drift`
- `workpass91-river-page-hinkley`
- `workpass92-river-drift-benchmark`
- `workpass93-hermes-reflective-learning-gate`
- `workpass94-avatar-voice-live2d-audit`

### Branch HEAD changes vs 19-Nov full manifest (10)

- `aspect/memory-hmx-semantic-integrity-20261119`: `fbab11da4e07a09282b8cb043904a05a4f638663` → `879a883f59439c8bdab3e4d7d9b171d6d4659780`
- `aspect/neko-voice-perception-adapters-20261104`: `515ae2d4faae4110e126b554d3145a8f26b140d5` → `44b86aa9b615d518cac4dc5b9182fdb7c0593daa`
- `aspect/neural-prosthesis-transformer-residual-20261117`: `ad80723cb2dd551fb026a7a99678b93849167788` → `be410464ed0086c5155a4f3882e015974e084a51`
- `aspect/p25-monotonic-replay-anchor-20261118`: `db8a572b113561ec64578b0c3c547438a813f93c` → `9372c5e90dc2124f08251a14170283dba6ade020`
- `consolidation/nk1-branch-census-20261118`: `71f37a6ffdb8e0f632349e0c952dd1123d7b0efe` → `bb77f2a4adb9ad49175e913bc079e14295e53657`
- `main`: `9a789ee1af8fdaa3826dbc734d18e2fc00cde5bf` → `06e01cdd0a8e60ed70991f22e842887f544d1ebf`
- `workpass328-node24-runtime-pin`: `7a439fae76445fba2cad7d096f36d6068482a41e` → `ce58f6ecbd353a5e29cdcdbfc4987107a4d67d66`
- `workpass328-operational-sensor-boundary`: `1b921e9896b8525a919366fdecc25112ff37c071` → `672f692c18a35a5dea765ccb8ab502056eda3afd`
- `workpass328-universal-interpreter`: `e94404900c84217124a3f1bdccc48910429faff9` → `46fb8ac8fada7e89c184a651032e21571aae5093`
- `workpass70-source`: `aa2b385153ddc316eadf61f87e2c0803d7d59d98` → `1df061ffa377c6ad94beacb1c5a113564baed5ae`

### Pull-request census (separate from branch refs)

- **Open PRs: 295**
- **Merged PRs: 415**
- **Closed without merge: 320**
- Total PRs in these states: 1030.

This run closed **2 PRs as superseded**, without deleting their branches:
- [#1040](https://github.com/ailtron1ss-rgb/NK1/pull/1040) — exact same head `e19aaf9d58dc3bb8e34f0ee89e27569e337c6cc9` as merged [#901](https://github.com/ailtron1ss-rgb/NK1/pull/901); all five changed paths and all 1,113 added lines were already present in current source.
- [#1038](https://github.com/ailtron1ss-rgb/NK1/pull/1038) — exact same head `cb52c0a7d864010191386ca7059972741d1da29a` as merged [#971](https://github.com/ailtron1ss-rgb/NK1/pull/971).

**Merged by this run: 0. PRs closed as superseded by this run: 2. Branch refs deleted by this run: 0.** Parallel-session merges observed separately: #1001 (HMX explicit apply), #1011 (embodiment motor honesty), and #1041 (NeuroForge donor analysis); none are attributed to this run.

### Current-source checks and release boundary

- Current source commit check-runs: **27 total; 27 success; 0 failure; 0 pending**.
- Stable Release remains tag `Neuro`, asset `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`, 135,290,615 bytes, metadata SHA-256 `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`. The binary could not be materialized in this runtime; no extraction manifest or per-file source/release parity claim is made.
- Branch retirement remains blocked by incomplete per-ref historical PR head/base review, tags/releases, workflow filters, rulesets/protection, deployments, documentation and external-consumer clearance. The connected GitHub operations in this run do not expose a branch-ref deletion action. All remaining refs are preserved.


## Post-PR #1043 live census — 2026-11-20

A second complete pagination was performed after creating the release-inspector consolidation branch. Pages 1–10 returned 100 refs each, page 11 returned 37, and page 12 was empty.

- **Branch refs: 1,037; unique HEAD SHAs: 1,021; excess names: 16; shared-HEAD groups: 1.**
- Compared with the latest saved full aggregate snapshot (1,032 / 1,016 / 16): **+5 refs, +5 unique HEADs, no change in excess aliases**. One of these new refs is the branch created by this run for PR #1043; the other four are observed changes and are not attributed to this run.
- The only shared-HEAD group remains SHA `82ea7a8b7c9b036e65c8b056acedd1176952dd8f`, with the same 17 names listed above. No new shared-HEAD group appeared.
- Current PR census: **296 open / 415 merged / 320 closed unmerged**. This includes newly opened [PR #1043](https://github.com/ailtron1ss-rgb/NK1/pull/1043).
- Branch created by this run: `consolidation/release-archive-inspector-portability-20261120` @ `d4ac4f8dd4067e4c57f1151ced8a856daece4c2e`.
- PR #1043 is Draft and intentionally unmerged while exact-head tests and real published-archive inspection are investigated.
- **This run: merged 0 PRs; closed 2 superseded PRs (#1040 and #1038); deleted 0 branch refs.** Both superseded source branches remain intact.
- The first real archive-inspection attempt on PR #1043 head `f3b7e55dc218a7939485cb454e711730b0a8f02f` ran the inspector contract suite successfully, then failed on both published ZIPs. The second exact-head run identified the two case-folded directory collisions precisely: `runtime/neuro-kurisu/RESEARCH` vs `runtime/neuro-kurisu/research`, and `runtime/neuro-kurisu/RESEARCH/2026-09-20` vs `runtime/neuro-kurisu/research/2026-09-20`. The same two prefix collisions exist in current `workpass70-source`. The uppercase tree has 18 files, the lowercase tree contains separate subdirectories, and their relative file-name sets do not overlap; both must be preserved. The inspector now reports both original ZIP member names and source-tree path collisions.
- The report recorded 9,112 identical / 213 changed / 21 archive-only / 1,088 source-only files for Stable, and 9,119 / 209 / 21 / 1,085 respectively for Hotfix 1. The 21 archive-only files include the existing Live2D model, textures, expressions, motions and `PROVENANCE.json`; preserve them until provenance and source packaging are reconciled.
- No published release was changed. A passing ZIP integrity check would still not prove source parity; the 213/209 same-path differences and 1,088/1,085 source-only files remain release-reconciliation work.


## Follow-up automation pass — archive portability regression closure (2026-11-20)

This pass extended the existing PR #1043 branch; it did not create another branch or duplicate PR.

- Added post-prefix-mapping portable-path collision detection to `tools/release_archive_inspector.py`. This closes a gap where two raw ZIP paths could be distinct before root-folder stripping but collide by Unicode NFC + case-fold afterward. File/file and file/directory collisions now fail integrity rather than being reported as benign archive-only drift.
- Added two regressions to `tools/test_release_archive_inspector.py`: case-fold collision after auto-prefix mapping, and file/directory collision after auto-prefix mapping.
- Code commit: `d3026d864d1f048c2ecfc3d79776b2c96798b23c`; test commit / exact PR head: `7de628b833f49ff7d7ad5cd9262288a6cdf010dd`.
- Exact-head archive-inspector suite: **20/20 tests PASS**. All four returned PR-triggered workflows for the exact head completed SUCCESS: Release Archive Inspection run [44763049963](https://github.com/ailtron1ss-rgb/NK1/actions/runs/44763049963), UserModel explicit-forget [44763049900](https://github.com/ailtron1ss-rgb/NK1/actions/runs/44763049900), original 2D asset contract [44763049925](https://github.com/ailtron1ss-rgb/NK1/actions/runs/44763049925), and WorkPass79 cognitive runtime regression [44763050260](https://github.com/ailtron1ss-rgb/NK1/actions/runs/44763050260).
- Exact-head artifact [14641777656](https://github.com/ailtron1ss-rgb/NK1/actions/runs/44763049963/artifacts/14641777656) was downloaded and inspected. Stable `Neuro` ZIP: SHA-256 `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`, 135,290,615 bytes, 9,346 files, 9,112 identical / 213 changed / 21 archive-only / 1,088 source-only. Hotfix prerelease: SHA-256 `9effadfcf0d402b462dd9cf2fd5b5793742039c9260db80578be830952bf52eb`, 136,354,713 bytes, 9,349 files, 9,119 identical / 209 changed / 21 archive-only / 1,085 source-only. Both GitHub digests and byte sizes match; both reports have zero raw or post-prefix path collisions and no inspector errors. The 21 archive-only paths in each include Live2D model assets and `app/public/live2d/PROVENANCE.json`; preserve them pending provenance reconciliation. These are integrity passes, **not** source-parity passes.
- Current `workpass70-source` advanced from PR #1043's base `56249a753219fcc9d7f31cbdbd7d54c8b4ccb2f7` to `eb568e3f71539bbcadcd6402c98626911ed8e72e` through 32 commits. Compare shows the only path changed on the source side is `CHANGELOG.md`; the PR's three changed paths do not overlap. The PR branch remains 14 commits ahead of its merge base and 32 behind current source, so re-evaluate GitHub mergeability before integration.
- PR #1043 remains Draft. The connected GitHub account was denied the GraphQL permission to mark it ready for review; no draft-state bypass, merge, or alternate-account write was attempted. Keep the PR and donor branch intact until the repository owner can authorize the state transition.

### This automation pass — repository census and disposition

- Complete branch pagination: pages 1–10 returned 100 refs each, page 11 returned 37, page 12 was empty.
- **1,037 branch refs / 1,021 unique HEAD SHAs / 16 excess names / 1 shared-HEAD group.** The one 17-name group remains at `82ea7a8b7c9b036e65c8b056acedd1176952dd8f`; no branch was classified or deleted from equal HEAD alone.
- Compared with the latest saved aggregate census of 1,036 / 1,020 / 16: **+1 ref / +1 unique HEAD / 0 alias change**. Compared with the 19-Nov full name→SHA manifest: 85 new names, 86 absent names, and 10 changed HEADs; these are observed deltas and are not attributed to this pass. The 85th new name is the PR #1043 branch created by the earlier parallel session.
- PRs (separate from branch refs): **296 open / 415 merged / 320 closed unmerged**.
- **Merged by this pass: 0; PRs closed as superseded by this pass: 0; branches deleted by this pass: 0.** This pass added two commits to the pre-existing PR #1043 branch; branch creation and earlier #1043 work belong to a parallel session.
- Retirement remains blocked by incomplete per-ref joins against historical PR heads/bases, tags/releases, workflow filters, rulesets/protection, deployments, docs and external consumers. The connected GitHub tools also do not expose a branch-ref deletion operation.
