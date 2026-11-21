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


## Post-merge refresh — 2026-11-20 automation pass 2

### Archive inspector integration (parallel merge; this pass supplied the final prefix-mapping fix)

- Existing PR [#1043](https://github.com/ailtron1ss-rgb/NK1/pull/1043) was created on the earlier parallel branch `consolidation/release-archive-inspector-portability-20261120`. This pass added the two commits `d3026d864d1f048c2ecfc3d79776b2c96798b23c` (inspector fix) and `7de628b833f49ff7d7ad5cd9262288a6cdf010dd` (regressions). It detects file/file and file/directory collisions that arise **after** auto-prefix stripping and Unicode NFC + case-fold normalization.
- Exact PR head `7de628b833f49ff7d7ad5cd9262288a6cdf010dd`: archive-inspector suite **20/20 PASS**; all four returned PR workflows SUCCESS. Release Inspection run [44763049963](https://github.com/ailtron1ss-rgb/NK1/actions/runs/44763049963) uploaded artifact [14641777656](https://github.com/ailtron1ss-rgb/NK1/actions/runs/44763049963/artifacts/14641777656).
- Both published ZIPs were downloaded by Actions and independently checked against GitHub release digest and byte-size metadata. Stable `Neuro`: SHA-256 `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`, 135,290,615 bytes, 9,346 files, 9,112 identical / 213 changed / 21 archive-only / 1,088 source-only. Hotfix prerelease: SHA-256 `9effadfcf0d402b462dd9cf2fd5b5793742039c9260db80578be830952bf52eb`, 136,354,713 bytes, 9,349 files, 9,119 identical / 209 changed / 21 archive-only / 1,085 source-only. Both integrity reports: zero raw ZIP path collisions, zero post-prefix collisions, zero inspector errors. This is **not** source parity: 21 archive-only Live2D model/texture/expression/motion/provenance files and the changed/source-only sets still require explicit reconciliation; do not delete or overwrite them.
- Observed parallel-session merge: PR #1043 merged as `b04f471eb588b63a40d8ac86d5004696cb084d5b`, with current source `eb568e3f71539bbcadcd6402c98626911ed8e72e` as first parent. This merge is not attributed to this automation pass. Verified that current source contains the exact inspector blob `58a832c93887e11330a34a1cd54efeedae7e14cd` and test blob `cf63e5177fc5fbdcd8ce72f268a199aeba4a9a33`. The donor branch remains at `6f925bb42fc020b8194f20d05bcf5f63eb6f6774` with a documentation-only commit after the merged head; it was not deleted.

### Complete branch / PR census — 2026-11-20

- Canonical source at this snapshot: `workpass70-source` @ `2aa061348ba7e9e5acb9b955706b42068eccf1d0`; `main` @ `06e01cdd0a8e60ed70991f22e842887f544d1ebf`.
- Full branch API pagination: pages 1–10 returned 100 each, page 11 returned 39, page 12 was empty. **1,039 branch refs; 1,023 unique HEAD SHAs; 16 excess names; 1 shared-HEAD group.** The sole shared group is the same 17 names at `82ea7a8b7c9b036e65c8b056acedd1176952dd8f`; no new shared-HEAD family appeared.
- Compared with the prior full live census 1,037 / 1,021 / 16: **+2 refs / +2 unique HEADs / 0 alias change**. Compared with the 19-Nov full name→SHA manifest: **88 new names / 86 absent names / 10 changed HEADs**. The three additional new names since the previous full live census are `integrate/embodied-postcondition-receipts-20261120`, `integrate/prototype-startup-health-gates-20261120`, and `integrate/self-state-restore-integrity-20261120`. These ref changes may be from parallel chats or external actions; do not attribute them to this pass.
- PR counts, separate from branch refs: **292 open / 421 merged / 320 closed unmerged**. Since the preceding census: open −4, merged +6, closed-unmerged unchanged; only #1043's merge is specifically identified above, and the other changes are unattributed.
- Current source check-runs: **9/9 SUCCESS, 0 failures, 0 pending**.
- **Merged by this pass: 0; PRs closed as superseded by this pass: 0; branch refs deleted by this pass: 0.** No source branch or Release ZIP was changed by this pass; #1043's integration was performed by the parallel session.
- Retirement remains blocked by incomplete per-ref joins against all historical PR heads/bases, tags/releases, workflow filters, rulesets/protection, deployments, docs and external consumers. The connected GitHub tools expose no branch-ref deletion operation. Keep all donor refs intact.


## Complete live census and selective integration — 2026-11-21

### Branch / PR inventory

- Complete GitHub REST branch pagination: pages 1–10 returned 100 refs each; page 11 returned 53; page 12 was empty.
- **1,053 branch refs; 1035 unique HEAD commits; 3 exact duplicate-tip groups; 18 excess refs; 0 protected refs.**
- Compared with the preceding complete live census (2026-11-20: 1,039 refs / 1,023 unique HEADs / 16 excess aliases): **+14 refs, +12 unique HEADs, +2 excess aliases**. Do not attribute the net changes to this run except the PR branch noted below.
- Full name→HEAD SHA→protection manifest: [branch-census-2026-11-21-live.jsonl](branch-census-2026-11-21-live.jsonl), 1,053 rows. Census was taken after PR #1058 merged, with source at `31acbe30b6901236ab818687ce62b41fc40992e1`.
- Open PRs: **275** (100 + 100 + 75 across complete pagination). Previous complete census: 292; net −17. This run merged one PR (#1058); the remaining net change is not attributed here.

### Exact duplicate-tip families

1. `f9621bf3e4411ce17bc809922a5f90126001f4fd` — tree `7711398fa119a30218f44f2d2049cbe985a1d20b`: `aspect/consequence-ecology-20261117`, `integrate/consequence-calibration-lineage-followup-20261120`.
2. `68a03799ca0c9f18e4c6e19399ed8018e0215e60` — tree `513c63b24385ce4dedc793200052e3f29b84bf78`: `aspect/world-forge-integrated-20261117`, `integrate/worldforge-to-sharedfuture-after-calibration-20261120`.
3. `82ea7a8b7c9b036e65c8b056acedd1176952dd8f` — tree `4525cefe9efccd05c897846b1c806b783feb3002`: 17 refs — `nk1-all-branches-merge-2026-10-23`, `nk1-integration-workspace-2026-10-22`, `rebuild`, `workpass79-cognitive-rebuild`, `workpass116-seed-clustered-learning-eval`, `workpass117-verified-replay-admission`, `workpass118-multi-source-learning-integration`, `workpass119-skill-retrieval-feedback-curriculum`, `workpass120-verified-skill-revision-gate`, `workpass121-ledger-bound-promotion-proposals`, `workpass122-promotion-gate-coverage-hardening`, `workpass123-authenticated-skill-lifecycle`, `workpass124-learning-evidence-hardening`, `workpass135-durable-shadow-run-registry`, `workpass203-independent-candidate-evaluator`, `workpass206-runtime-evaluator-wiring`, `workpass313-actions-history-audit`.

All three families are exact same-commit groups (not merely similar file contents); all refs in these groups are unprotected. Exhaustive open-PR head/base joins found four active base dependencies: #109 uses `nk1-all-branches-merge-2026-10-23`; #91 and #86 use `rebuild`; #124 uses `workpass206-runtime-evaluator-wiring`. No duplicate-family ref is an open PR head. Therefore **zero refs are cleared for deletion yet**: historical closed/merged PR references, tags, workflow/docs references, downstream ancestry and external consumers still require a complete join. Keep the three active base refs until those PRs are retargeted or closed.

### Selective integration completed in this run

- PR [#1058](https://github.com/ailtron1ss-rgb/NK1/pull/1058), `consolidation/undo-first-intelligence-current-source-20261121` @ `638cd286702917aca7fcdb4aa3eefb87d0670d86`, was selectively ported from historical Draft PR #910 onto the exact current source `886d05b09056575f4275b662c74849e9eabc7d24`.
- Exact-head CI: **30/30 completed SUCCESS**; PR had no reviews or inline comments; mergeable/clean; source base was current; no unresolved conflicts.
- Merged by this run using squash: **`31acbe30b6901236ab818687ce62b41fc40992e1`**. Merge result tree `523e524227b4cdfd5b044c14bc0233fb7e40e17f` is byte-identical at Git tree level to the reviewed PR head tree. Source now points to this merge before this census documentation update.
- 8 files, +1,616 / −20: canonical ActionGateway Undo-First preparation/receipt/reconciliation contracts; create-only private workspace adapter with path/symlink checks, no-overwrite hard-link creation, fsync, SHA-256 readback and durable manual recovery artifact; OrganismRuntime registration only for FileStateStore; FileStateStore re-export; 2 regression suites; workflow; technical contract documentation. Memory-only stores do not receive filesystem write capability. The adapter explicitly does **not** claim automatic deletion/rollback; manual recovery is required because portable Node filesystem APIs cannot atomically unlink only an unchanged content hash.
- Provenance: donor PR #910 remains open Draft, head `d3d13029d840ed89ec76920ad4ba7937baf5e10f`, 46 commits behind its old base. Its full branch was not merged. Exact blob equality was found for `runtime/neuro-kurisu/tests/undo-first-action-gateway.mjs` (blob `dbc74540d16880a8d28f74f2ff7a21be8e38c696`). Donor tree `1b84d2ceec15febb337d5347e1d063c0fca92a77` differs from the merged tree; the other overlapping files were adapted (different blob SHAs), including moving old Core-constructor wiring to the OrganismRuntime/FileStateStore boundary and adding 12 lines of filesystem hardening/integration coverage. Keep #910 and its branch until the complete donor-to-port line-level disposition and all historical references are recorded.
- The merged head branch still exists. Its tree exactly equals the squash merge tree and it has no open PR head/base reference; it is a cleanup candidate after historical-reference scanning, not deleted.

### Release boundary

- Latest published Release remains tag `Neuro`, published `2026-10-19T14:21:35Z`, asset `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`, 135,290,615 bytes, GitHub metadata digest `sha256:c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`.
- `main` remains `06e01cdd0a8e60ed70991f22e842887f544d1ebf`. This run changed `workpass70-source` only; the Release ZIP and `main` were not modified. No source/release byte-parity claim is made.

### Cleanup / tool limitation

- Exact duplicate refs: 18 excess aliases across three families. Four open-PR base dependencies span three refs; 14 other refs in the large family and the two smaller families still require historical PR/tag/workflow/docs/dependent-branch scans. The merged #1058 head is an additional exact-tree cleanup candidate.
- **Fully safe deletion candidates: 0** until those remaining references are cleared. The connected GitHub actions expose branch listing and ref updates but no branch-ref deletion operation; no branch was deleted or force-updated.
- This run: **1 new real PR merge; 0 branch deletions; 0 Release ZIP changes.**
