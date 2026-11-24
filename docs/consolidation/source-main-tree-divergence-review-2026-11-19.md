# Source/main tree divergence review — 2026-11-19

## Scope and pinned inputs

This is a path/blob comparison of two exact Git tree snapshots, not a comparison of branch names that may move:

- `workpass70-source`: commit `7547f5287b84a7d9b7109c0e5fdbe20bf95c9e33`, tree `8ca26dac0e75fd61625c71b0d7dde5a04f9b70e2`.
- `main`: commit `9a789ee1af8fdaa3826dbc734d18e2fc00cde5bf`, tree `af90e1b89de62b0ae4d89ce0ae6946c68de0b586`.

The comparison uses recursive Git tree entries and Git blob SHA equality. It does not include the October 19 Release ZIP, whose bytes have not been obtained in this runtime.

## Tree comparison

| Measure | workpass70-source | main |
|---|---:|---:|
| Blob/file entries | 10,083 | 95 |
| Aggregate blob bytes | 278,824,359 | 3,313,864 |
| Shared paths | — | 49 |
| Same blob SHA among shared paths | — | 37 |
| Different blob SHA among shared paths | — | 12 |
| Paths only on this tree | 10,034 | 46 |

Interpretation: `main` is a small release/report/PR-862 snapshot and is not a mirror or complete replacement for the canonical working source. Do not merge `main` into `workpass70-source` as a whole, and do not replace source files with older main copies based on filename alone.

## Review of all 12 shared paths with different blobs

| Path | Source blob SHA | Main blob SHA | Result / disposition |
|---|---|---|---|
| `.github/workflows/publish-workpass70-hotfix.yml` | `8879cc1cdb5eab886c818a83ddd4e6da13017c36` | `5331e0ae7a07c091c02370fe1108de48f272672c` | Main adds `package-manager-cache: false` to pinned Node setup. Small explicit-cache behavior; preserve as a candidate workflow hardening delta, but no workflow edits made. |
| `.github/workflows/workpass71-validation.yml` | `ba9c48c3e8d581c2663bc5dcf428ae64edfb297c` | `8cf93a3513165e6750c30350efc1c2743d41cd1d` | Intentional role difference: main begins with a comment explaining it is mirrored on the default branch as the `workflow_run` anchor; main PR branch filter omits `main`, while source PR filter includes it. Source includes the additional P33 personhood-restore regression step. Preserve the main default-branch anchor role and the source-side P33 test; do not copy either whole workflow over the other. |
| `README.md` | `e6a23830ef6a8793e44de4c980da8b357c16bcc5` | `d5f408c174d680c437438d30553c86c02f1b3ef3` | Source is a 634-line engineering checkpoint; main is a 58-line release/report entry point. Different jobs, not duplicates. Retain both roles and reconcile links only. |
| `app/scripts/avatar-model-preflight.test.mjs` | `58f12a5bab000a8a98457b3660cc7416792581e5` | `dbf8a06936f2a180d25302b8bf8522571105d3a9` | Source has 35 additional regression lines, including permitted GLB BIN padding and rejection of multiple URI-less GLB buffers. Preserve source tests. |
| `app/src/components/avatar/avatarModelLimits.ts` | `6b1433ec12945c9b41ac1589390efec7a2708309` | `e141e5ff75c3b711f5b4e6eefa2bd3c824551d8b` | Source adds `MAX_AVATAR_BUFFERS = 32`; preserve source bounded-buffer limit. |
| `app/src/components/avatar/avatarModelPreflight.ts` | `81b9e78b5c1c5f93c34885afb0dbc89773229ff1` | `ebc436b8cbc6bd7573368126ca2d1fdd567830ee` | Source version is more defensive: bounds buffer enumeration, validates that the URI-less GLB buffer is the only one and at index zero, requires BIN chunk where needed and checks permitted padding/unused BIN layout. Preserve source implementation; no main-to-source replacement. |
| `app/src/components/avatar/motorFrameMapper.ts` | `09656301339df0afdb3eb5d6fbdb65bfc13a3bf8` | `630903f5d34427ad7ed15413130558329befbdb3` | Source is longer and includes plain-own-data snapshots, safe/finite numeric checks, rejected/expired phase handling, monotonic frame cursor checks and age bounds. Preserve source as the stronger validation candidate; run its focused tests before any later refactor. |
| `app/src/components/avatar/vrmRuntimeAdapter.ts` | `98baf29cd43acb1ae594ded073fcd38ff10f86ce` | `f5f499af602985bda08e4c33304ac0a0c856e53c` | Source includes a fuller normalized body rig (spine and limbs) plus body-channel/expression mapping absent from main. Preserve source. |
| `runtime/neuro-kurisu/src/organism/body/EmbodimentRuntime.ts` | `45c94e85892e1a330f02a60e4cb877730da07a85` | `7efa24cdd141c802af7924ee4e144b26eae54a32` | Source adds cached cognitive voice context, context snapshot, preview planner, and passes live needs/affect/continuity/grounding into voice planning. Main contains an older direct per-call planner path. Keep source's richer context flow; verify call sites/regressions before further changes. |
| `runtime/neuro-kurisu/src/organism/body/PerceptionRouter.ts` | `3b7337acdaf81fb20cda4362dcb22591f8a10fc7` | `2a94a7ce2328d793144839f926a7f10717e32a6f` | Source adds route allowlisting, own-data reads, safe counters and validation. Preserve source fail-closed router. |
| `runtime/neuro-kurisu/src/organism/cognition/UserModelEvidenceModel.ts` | `c0fa94c82fd288adec5b0b893d3de5041c9dee04` | `3e05115ebac1168490fa117552501664fbcf51ae` | Source is schema v2 with backwards-compatible v1 restore, bounded explicit-forget tombstones, deletion-watermark checks that prevent old replay resurrection, strict tombstone validation and evidence-ref preservation. Main is v1 and lacks forget tombstones. The old main `correctExplicit` fallback rewrites the caller ref as `correction:<ref>`; source retains the exact caller ref, covered by a source-side regression. Preserve source v2. |
| `runtime/neuro-kurisu/tests/user-model-evidence-model.mjs` | `281332c55e5b14cfc106af7199eb4bcf52c812e1` | `174775788a049fcdbf875e7fe574916f10f19617` | Source adds regressions for exact correction evidenceRef and for rebuilding replay protection from persisted claim evidence when the ledger is incomplete. Source tests are a strict superset in this comparison. Preserve them. |

## Main-only path inventory (46 files)

These paths are absent from the pinned `workpass70-source` tree. They are not automatically duplicates or safe to discard; each is classified as a donor, evidence, release/documentation asset, or separate workflow need.

### Visual assets and avatar candidates
- `app/public/sprites/kurisu/arms_crossed.png` — blob `6f1cc8b075327dcad51919a5d227120bd468fcf4`, 268,317 bytes.
- `app/public/sprites/kurisu/embarrassed.png` — blob `785cfafb9db647a4bf964d1323b488b7d665479a`, 243,433 bytes.
- `app/public/sprites/kurisu/neutral_front.png` — blob `cfb0299b54de52340f0af4f92b4435bd6a37a374`, 270,572 bytes.
- `app/public/sprites/kurisu/phone_look.png` — blob `ec2b15c2c692dba83e541aab3946cbcc3c64840f`, 240,023 bytes.
- `app/public/sprites/kurisu/shocked.png` — blob `656d70f264149aa16836e3f24de6d71c0eac1984`, 283,338 bytes.
- `app/public/sprites/kurisu/thinking_chin.png` — blob `0260c52532a5bbb5a52fc80c2bcc421d3d1de4e0`, 265,310 bytes.
- `app/public/sprites/kurisu/tired_rest.png` — blob `58b1627315aba8d001e6a143ebaefece1cad884f`, 258,340 bytes.
- `app/public/sprites/kurisu/whiteboard.png` — blob `a22e435e6a8ee60d4707645f61ded06290652963`, 250,029 bytes.
- `app/src/components/avatar/KurisuAnime3DAvatar.ts` — blob `98d661a99d052953520e7d6f45f6d7bbe4fcaae0`, 10,764 bytes; preserve as a donor candidate, not as a second active avatar runtime.
- `app/src/components/avatar/motorFrameStream.ts` — blob `acdd95946570ed97b03d9efe3e11c260826ecb82`, 11,029 bytes; requires caller/dependency mapping.
- `app/src/components/avatar/motorFrameVrm.ts` — blob `0a9ce0407d83728ac9d82a0a124f2e1b3afb5e0a`, 3,374 bytes; requires caller/dependency mapping.
- `app/src/components/avatar/vrmLoaderAdapter.ts` — blob `912a7b912f3ff889ea1ef9229566becd0b96be3e`, 2,347 bytes; do not integrate as-is until URL, byte, timeout, redirect and memory bounds are proven equivalent to the stronger current remote loader.

### Architecture / motor-control donors (review separately)
- `runtime/neuro-kurisu/src/organism/body/MotorRigProfileBootstrap.ts` — blob `49240511c58687e9fcc74bbf0844e8f89c33985c`, 3,384 bytes.
- `runtime/neuro-kurisu/src/organism/body/OrganismMotorRuntime.ts` — blob `342dcd4dc0c3b5f3697e4f369a5904804bdc57a4`, 13,144 bytes.
- `runtime/neuro-kurisu/src/organism/brain/UnifiedBrainSystem.ts` — blob `bca23d13010aad5e61495ccdf987c05840d5a4ca`, 12,502 bytes; treat as a prototype, not a second production brain. Require OrganismBus/OrganismState wiring, bounded stores, real planner/observer contracts and behavior tests before any port.
- `runtime/neuro-kurisu/src/organism/system/EmbodiedMotorController.ts` — blob `c3ef3bc53d64685f63cf526675f45ba82ff382cf`, 16,487 bytes.
- `runtime/neuro-kurisu/src/organism/system/MotorGoalArbiter.ts` — blob `1351508fb14e9e76460137472981ceba11bca2f2`, 13,950 bytes.
- `runtime/neuro-kurisu/src/organism/system/SkeletalKinematics3D.ts` — blob `5901ef0ea65c432f9a80a02defed875869b2c852`, 8,870 bytes.
- `runtime/neuro-kurisu/src/organism/system/SkeletalMultiEffectorIK3D.ts` — blob `236ca7a65b4c572e8d9057af38a3c0f3ef808ac5`, 7,124 bytes.
- `runtime/neuro-kurisu/src/organism/system/SkeletalPoseIK3D.ts` — blob `0b28cdd978da0b0c644b84b07ac4115ba49acaf2`, 7,042 bytes.
- `runtime/neuro-kurisu/tests/embodied-motor-controller.mjs` — blob `d49a5f9645229ce299bec6bf2757d5b0a5ce4dbf`, 13,790 bytes.
- `runtime/neuro-kurisu/tests/skeletal-kinematics-3d.mjs` — blob `f9c3457f94ef98e5943925792aa9754c56ff17ad`, 2,455 bytes.
- `runtime/neuro-kurisu/tests/unified-brain-contract.test.mjs` — blob `f11f4e2fa02ce7791c24d2b6d5c65e9dcdf4d37f`, 4,484 bytes.

These files are a priority donor cluster for the embodiment / motor-coupling aspect. Their absence from the working source tree is not proof the capabilities are absent: compare class contracts and imports with existing motor/embodiment implementations before porting. No code from this cluster has been copied in this pass.

### Documentation, verification and visual evidence
- `docs/NK1_COMPLETE_MASTER_PLAN_16_PHASES_RU.md` — blob `dc8f3d2d9ccfddd2057689445a79777eabf099ab`, 32,659 bytes.
- `docs/NK1_COMPREHENSIVE_SYSTEM_ANALYSIS_2026-10-31_RU.md` — blob `236fefaf7e739e5432b34469bbdc4d90d4b7005a`, 17,004 bytes.
- `docs/NK1_ECOSYSTEM_ANALYSIS_AND_ADAPTATION_RU.md` — blob `12af53936f7ee193cfbccdfbbf2b647694419087`, 10,595 bytes.
- `docs/NK1_FINAL_MASTER_PLAN_2026-10-30_RU.md` — blob `55b1ff08c020cbcb89588e2c9bcfb5a9e83c53f3`, 40,829 bytes.
- `docs/NK1_KURISU_EMBODIMENT_SPECIFICATION_RU.md` — blob `015174cd3eb76c9327e6279dd35a964681d110ca`, 7,730 bytes.
- `docs/NK1_MULTI_PASS_ADVANCEMENT_PLAN_2026-11-06_RU.md` — blob `f0ec9a79821a28cd51c7abbf06aa405a57c3efb1`, 11,462 bytes.
- `docs/NK1_STRATEGIC_DEVELOPMENT_ROADMAP_RU.md` — blob `c5253297e559298f1787f7927b83c34c088909e2`, 12,753 bytes.
- `docs/NK1_UNIFIED_BRAIN_ARCHITECTURE_2026-11-03_RU.md` — blob `0c95865c5287b95c49b9de515139a92256e6ae87`, 19,048 bytes.
- `docs/NK1_UNIFIED_BRAIN_ARCHITECTURE_RU.md` — blob `d041b9bcacc906a2ead060e36d29c89439ba9b87`, 19,836 bytes.
- `docs/PROJECT_PROGRESS_TRACKER_2026-10-26_RU.md` — blob `d558346d5e1244f7c1cca97923d0f16d11ed42ad`, 24,968 bytes.
- `docs/PROJECT_PROGRESS_TRACKER_2026-10-30_RU.md` — blob `0e50c1a8d2a59cdc9b1fc69ec1801d224e3e0f3b`, 10,902 bytes.
- `docs/PROJECT_PROGRESS_TRACKER_2026-11-01_RU.md` — blob `17263d390bd9718e39572d30a6995b138fceefae`, 10,663 bytes.
- `docs/PROJECT_PROGRESS_TRACKER_2026-11-03_RU.md` — blob `fc4d0c33dc4358287664f93dca64cbb1b0e1208b`, 8,090 bytes.
- `docs/PROJECT_PROGRESS_TRACKER_2026-11-06_RU.md` — blob `ee63e7ec4a939e5abfebc65949e55eeb7246567c`, 10,700 bytes.
- `docs/PROJECT_PROGRESS_TRACKER_2026-11-11_RU.md` — blob `a942097640e5e9c32d88fd99b1f24b42f755048d`, 6,041 bytes.
- `docs/RELEASE_PIPELINE_CHANGELOG_RU.md` — blob `f166d26da976ebc3d3cbf27ba9ecc25840c409d7`, 749 bytes.
- `docs/WORKPASS613_RELEASE_WORKFLOW_CACHE_FIX_RU.md` — blob `baa3fc90939295900c96bf7ddf46719dd7d634cc`, 1,736 bytes.
- `docs/kurisu_3d_avatar_screenshot.png` — blob `ffc8ba0ed048a1e6f034415ff201a1e0714366bf`, 343,823 bytes.
- `kurisu_3d_avatar_render.png` — blob `c700c97dbd154b1b29f54b7a44eb7d9e13446bee`, 142,592 bytes.
- `scripts/verify-master-plan-completeness.sh` — blob `48cb4f382d9ba72f35d43d4c2bb16966fd5e7fda`, 3,155 bytes.
- `scripts/verify-organism-readiness.sh` — blob `c19a76563838e9553127fc1edf1ea7df49e918f7`, 2,499 bytes.
- `scripts/verify-release-reproducibility.sh` — blob `1c128379423b23a1e7bf9585772b3d2ca831c6a2`, 2,173 bytes.
- `test_avatar.html` — blob `b575e6540bf954d712cb6f66e7a25574a79f92c3`, 23,707 bytes.

The plan/progress files are historical source material and should not all be pasted into the source tree as simultaneous competing master plans. Select a single current canonical plan after content reconciliation; preserve prior editions with clear historical labels or an archive index. The three verification scripts should be examined for overlap/coverage before choosing canonical scripts. The two PNG render assets are distinct evidence, not duplicates.

## Follow-up review of the merged PR #862 motor donor

PR #862's description implies the 3D motor stack was integrated, but the static import closure does not substantiate a complete runtime port:
- `OrganismMotorRuntime.ts` imports `../system/MotorFrameChannel.ts` and `../system/MotorRigProfile.ts`.
- `MotorRigProfileBootstrap.ts` imports `../system/MotorRigProfile.ts`.
- Both exact repository paths return 404 in the pinned #862 merge tree (`9a789ee1af8fdaa3826dbc734d18e2fc00cde5bf`) and in pinned `workpass70-source` (`7547f5287b84a7d9b7109c0e5fdbe20bf95c9e33`).

The #862 PR head `6202661ad1dcfa37d314765b45e6d63852053e2d` returned no PR-triggered Actions runs and no combined commit status entries from GitHub. This is missing verification evidence, not proof every individual donor algorithm is incorrect. Accordingly, do not port the motor runtime composition as-is. The isolated quaternion FK/DLS, multi-effector and pose-IK math modules have a separate donor intake in PR #951 with explicit tests; that intake is intentionally not wired to production organism execution.

## Consolidation decisions from this comparison

1. Keep `workpass70-source` as the production source base; no whole-tree merge from `main`.
2. Keep the 37 identical shared blobs as already identical; do not create pointless cherry-picks for them.
3. Preserve the current source versions of all 12 shared-but-different paths unless later tests and a semantic review demonstrate a missing capability.
4. Preserve the main-only asset and motor-control donor cluster for a separate domain-specific review; do not discard it because the files are currently absent from source.
5. Keep release/report role in `main` distinct from the full source role in `workpass70-source`.
6. Keep the Oct 19 release ZIP as a separate, immutable future comparison baseline. Its actual contents still require extraction and path-by-path SHA-256 comparison once the exact asset bytes are available.

## Verification boundary

- This review fetched and compared complete UTF-8 source contents for all 12 differing shared paths, and recursive tree entries for both pinned commits.
- Git blob SHA equality is exact for identical paths; line-by-line semantic conclusions above are limited to the inspected source content and should be followed by focused test runs before any code edit.
- No production source file was changed, merged or deleted by this review.
- No test suite was executed in a local clone.
- No branch was deleted, no PR was merged or closed.
- The October 19 ZIP was not extracted or compared byte-for-byte.
