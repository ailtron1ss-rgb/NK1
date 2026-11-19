# Avatar / unified-brain PR cluster — source gap review (2026-11-18)

## Scope

Compared PR #848 head commit 3c0164405fda67bb46d62c06fe78741b0b10f830 with canonical working source workpass70-source at 7547f5287b84a7d9b7109c0e5fdbe20bf95c9e33. This is a focused review of paths changed by the candidate PR, not a complete audit of all PRs or the October ZIP.

PRs #848, #856 and #844 have the same 55 changed-file paths. Their common base is main commit 48dffbf4f5c9b5474c8baff61f40b8bf0c5828e8; this is not the current source branch.

## Findings by file

### Candidate paths already present in source

| File | source SHA | PR #848 SHA | Result |
|---|---|---|---|
| app/src/components/avatar/embodimentCoordinator.ts | 45fed2a19b3bf6929fdfd7dc76decaf11dab6c5d | same | Exact blob match |
| app/src/components/avatar/threeToonMaterials.ts | eec0045d6453d336901a5c704a82e07519a2f332 | same | Exact blob match |
| app/src/components/avatar/avatarModelStore.ts | 4079c68e4e02aea1f92103143802b776ba235834 | same | Exact blob match |

These are not new changes for workpass70-source.

### Existing source files where the PR candidate is older or weaker

**app/src/components/avatar/avatarModelPreflight.ts**
- Source: 214 lines, blob 81b9e78b5c1c5f93c34885afb0dbc89773229ff1.
- PR #848: 208 lines, blob ebc436b8cbc6bd7573368126ca2d1fdd567830ee.
- The source version has bounded buffer enumeration, validates the GLB URI-less buffer layout (only index 0), checks BIN chunk existence and exact padding constraints (0–3 bytes), and rejects unreferenced BIN chunks.
- The PR version contains simpler checks and lacks these source-side constraints. **Do not replace the source file with the PR version.**

**app/src/components/Avatar3DStage.tsx**
- Source: 164 lines / 30,099 chars, blob da2f1ccfbf6e9f864b24653394186e867d2736fb.
- PR #848: 119 lines / 27,110 chars, blob 93dfe734d88fa2efc3e87879910282cbe2f76b44.
- The source includes full-body channel application, GLB mouth morph resolution, abortable remote-avatar loading, cleanup of active downloads and more defensive remote model handling. The PR version has only a few lines absent from the source; the source has substantially more unique lines.
- The source already contains the stored-avatar workflow (loadStoredAvatarModel, saveAvatarModel, clearStoredAvatarModel), so the old PR's model-persistence UI is not a missing capability.
- **Do not replace the source component with the PR version.** Review only any genuinely unique UI or interaction fragments individually.

**app/src/components/avatar/vrmRuntimeAdapter.ts**
- Source: 324 lines, blob 98baf29cd43acb1ae594ded073fcd38ff10f86ce.
- PR #848: 222 lines, blob f5f499af602985bda08e4c33304ac0a0c856e53c.
- The PR candidate has no unique non-empty line when compared against the source line set; the source adds a full-body rig surface (including spine/limbs) and further normalized motor/expression support.
- **Keep the source version; do not replace it with the PR candidate.**

### Candidate files absent from the source branch

These files exist in PR #848, but their paths return 404 on workpass70-source:

| File | Size | Initial disposition |
|---|---:|---|
| app/src/components/avatar/KurisuAnime3DAvatar.ts | 312 lines / 10,764 chars | Standalone Three.js avatar class; preserve as a donor for selective reuse, not as a second active avatar |
| app/src/components/avatar/vrmLoaderAdapter.ts | 79 lines / 2,347 chars | Unreferenced cache helper; do not integrate as-is |
| runtime/neuro-kurisu/src/organism/brain/UnifiedBrainSystem.ts | 249 lines / 9,044 chars | Experimental standalone brain; do not wire as a second brain |
| runtime/neuro-kurisu/tests/unified-brain-contract.test.mjs | 80 lines / 3,616 chars | Test for that standalone implementation; not a runtime integration |

Reference scan of the PR's other changed files:
- KurisuAnime3DAvatar is referenced in documentation, not imported by another changed runtime file.
- fetchWithIndexedDBCache is not referenced by another changed file.
- UnifiedBrainSystem is referenced by its dedicated test and documentation, but not wired into a runtime module in the changed-file set.

The standalone brain is not yet an integration into the canonical OrganismBus / OrganismState cycle. Its cycle method mainly appends phase labels; visualFeatures, sourceTimestamp, and the filtered relevantMemories are not consumed downstream; the Plan and Observe phases do not implement a planner or observation update; currentBeliefs and episodicMemoryStore grow without an eviction bound; and the safety gate only suppresses the optional speech string while a motor intent is still returned. somaticBomaticRisk is misspelled, though the misspelling is internally consistent in this class. These are concrete reasons to treat the file as a prototype, not a production brain.

The IndexedDB helper has no explicit model-size limit, URL allow-list/private-host rejection, timeout, redirect restriction or streaming byte cap. The source branch already has a stronger remoteAvatarSource.ts (217 lines) with HTTPS validation, private/local address rejection, URL/extension checks, bounded 90 MB streaming, timeout and cancellation, credentials omitted, and redirects rejected. The PR helper must not replace or bypass that boundary.

## Unique visual assets to preserve

The following 8 sprite images are absent from workpass70-source, but share the same Git blob SHAs across the inspected PR heads #848/#856/#844:
- app/public/sprites/kurisu/arms_crossed.png
- app/public/sprites/kurisu/embarrassed.png
- app/public/sprites/kurisu/neutral_front.png
- app/public/sprites/kurisu/phone_look.png
- app/public/sprites/kurisu/shocked.png
- app/public/sprites/kurisu/thinking_chin.png
- app/public/sprites/kurisu/tired_rest.png
- app/public/sprites/kurisu/whiteboard.png

Their blob SHAs are respectively 6f1cc8b075327dcad51919a5d227120bd468fcf4, 785cfafb9db647a4bf964d1323b488b7d665479a, cfb0299b54de52340f0af4f92b4435bd6a37a374, ec2b15c2c692dba83e541aab3946cbcc3c64840f, 656d70f264149aa16836e3f24de6d71c0eac1984, 0260c52532a5bbb5a52fc80c2bcc421d3d1de4e0, 58b1627315aba8d001e6a143ebaefece1cad884f, a22e435e6a8ee60d4707645f61ded06290652963.

Two visual proof assets are also absent from source:
- docs/kurisu_3d_avatar_screenshot.png
- kurisu_3d_avatar_render.png

Their blob SHAs differ between candidate PRs, so preserve the variants instead of choosing one by branch age. PR #856 returns the same blob SHA for these two paths, and PR #844 also returns the same blob SHA for both; PR #848 has separate SHAs. The variants need visual review and a provenance/quality decision before deduplication.

## Recommended consolidation decision

1. Do not merge #848/#856/#844 as whole PRs into workpass70-source.
2. Keep the current source implementations of Avatar3DStage.tsx, avatarModelPreflight.ts, vrmRuntimeAdapter.ts, avatarModelStore.ts, remoteAvatarSource.ts, embodimentCoordinator.ts and threeToonMaterials.ts.
3. Preserve the eight sprite PNGs once in an aspect-specific embodiment integration branch. Preserve both render/screenshot variants with provenance metadata until reviewed.
4. Review KurisuAnime3DAvatar.ts only for isolated reusable mesh/material/pose logic; do not activate a parallel avatar runtime.
5. Treat UnifiedBrainSystem.ts as a prototype/reference. Port no code into production until it is redesigned around the canonical organism contracts, bounded stores, real planner/observer interfaces, and measurable tests.
6. Do not integrate the unbounded vrmLoaderAdapter.ts; the current source has a safer remote-loading boundary.

## Limitations

This is a focused source-gap review of PR #848 and selected common assets in the #848/#856/#844 cluster. It does not constitute a line-by-line audit of all 1,033 branches or every file in the October 19 ZIP. The archive bytes remain unavailable for extraction in this runtime.
