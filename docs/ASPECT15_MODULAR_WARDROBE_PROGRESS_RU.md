# NK1 — Aspect 15: Modular wardrobe and interchangeable appearance

Date: 2026-10-30  
Repository: `ailtron1ss-rgb/NK1`  
Working base: `workpass70-source`  
Implementation branch: `work/nk1-wardrobe-modular-clothing-pass-2026-10-30`  
Existing engineering PR: [#412](https://github.com/ailtron1ss-rgb/NK1/pull/412)  
Historical engineering document: [Aspect 08 wardrobe plan](ASPECT08_MODULAR_WARDROBE_PLAN_RU.md)

> Aspect numbering note: the current user-facing plan names wardrobe as Aspect 15. The existing repository work was originally filed under Aspect 08; this document keeps the requested Aspect 15 identity without creating a second wardrobe implementation.

## Goal

Deliver real, independently selectable clothing and accessories for one NK1 identity across Live2D, depth-2D/2.5D and VRM/3D. Wardrobe must not own personality, emotion, motor state or body identity. A renderer can only claim clothing is active after it has verified the assets, attached them to the exact compatible body and acknowledged the result.

## Current state

**Conservative aspect estimate: 59/100.** This is an engineering estimate for the wardrobe aspect, not a whole-project score. It is not a device-verified or release-complete claim.

| Subsystem | Current status | Readiness |
|---|---|---:|
| Renderer-independent garment catalog | Implemented, explicit missing-asset states | 95% |
| Six outfit families | Catalog and context recommendation exist | 75% |
| Per-slot composition | Added `resolveWardrobeSelection`, conflict/dependency validation | 90% |
| Pack manifest and provenance declarations | Implemented; declared rights are not independently adjudicated | 95% |
| Byte/hash/whole-pack verification | Implemented with fail-closed behavior | 95% |
| Two-phase switch/acknowledgement | Implemented | 90% |
| VRM skinned garment adapter | Implemented with bone and bind-pose preflight | 85% |
| Multi-slot VRM application | Added in current pass; new CI pending | 80% |
| Uploaded VRM pack import UI | Local JSON bundle, rights self-attestation and per-asset selection | 75% |
| Procedural 3D garment silhouettes | Lab coat, casual top and hoodie | 60% |
| Actual production-ready garments | No verified rights-cleared pack | 0% |
| Live2D interchangeable garments | No verified Cubism drawable/part switch | 0% |
| 2.5D layered garments | No production source layers/masks/weights | 0% |
| Persistent outfit and pack restore | IndexedDB implementation keyed by exact body/rig; hash re-verification on restore. Real browser/device E2E remains open | 75% |
| Desktop/Android visual E2E | Not yet verified | 0% |

## What was added in the current code pass

1. **Stable base-body identity.** VRM rig discovery and the body fingerprint now ignore scene subtrees tagged as NK1 wardrobe items. A garment's own skeleton cannot change the avatar identity or become the target skeleton for the next garment.
2. **Multiple slots in one pack.** A verified pack can attach outerwear, footwear and accessories in a single switch, provided each requested slot is unique and each garment matches the target skeleton/bind pose.
3. **Commit-only replacement cleanup.** Replaced slot roots are removed and their geometry/material/texture resources are disposed only after all new parts attach and the renderer acknowledgement is accepted. Rollback preserves the old appearance.
4. **Independent selection.** A user can select only some VRM garments from a bundle. Unselected slots remain unchanged; the loader does not force a complete outfit replacement.
5. **Compositional domain API.** `resolveWardrobeSelection` validates slot collisions, duplicate IDs, unknown garments, dependencies, exclusions and verified renderer assets.
6. **Fail-closed untrusted input handling.** Non-string paths, malformed byte objects and crypto digest errors no longer become implicit valid assets.
7. **Regression tests.** Added tests for base identity stability, multi-slot application, replaced-root cleanup, per-slot stage selection, catalog composition and malformed input handling.

## Target architecture

- `WardrobeSystem`: catalog, outfit families, dependency/exclusion rules and context-only recommendations.
- `WardrobePackManifest`: creator/source/license/attribution, target body and rig version, renderer, slot, MIME, path, bytes and SHA-256.
- `prepareVerifiedWardrobeSwitch`: verifies complete pack payload and binds requested IDs to renderer/body/rig.
- `EmbodimentCoordinator`: owns the current body and forwards wardrobe operations to the selected renderer.
- `Live2DWardrobeAdapter`: only after Cubism drawable/part mapping is inspected and verified.
- `Depth2DWardrobeAdapter`: layer/mask/pivot/deformation contract.
- `VrmWardrobeAdapter`: skinned-mesh bone remapping, bind-pose gate and safe attachment.
- `wardrobePackStore.ts`: versioned IndexedDB store keyed by exact body/rig identity; stores only locally imported verified bundle bytes and selected renderer asset IDs, then re-verifies on restore.

## Mandatory asset rules

- No arbitrary remote resource URLs.
- No path traversal or undeclared bundle entries.
- Every asset has exact byte length and SHA-256.
- A hash proves byte identity, not legal rights.
- License and attribution evidence must be reviewed separately before redistribution.
- VRM garment skeletons must map uniquely to the active base avatar; ambiguous names or bind-pose mismatch fail closed.
- Each renderer must declare capabilities honestly. Live2D cannot claim independent limb/garment control unless the model actually exposes the necessary parts.
- A missing asset is a missing asset. Metadata, labels, sprites and full-body images are not interchangeable garment meshes.

## Work plan to 100%

### P0 — close the software foundation
- Merge only the canonical wardrobe and adapter implementation; avoid duplicate managers.
- Pass focused wardrobe tests, app typecheck and complete app test suite on the final branch HEAD.
- Run multi-slot success, duplicate-slot rejection, malformed asset, tamper, rollback and repeated replacement tests.
- Verify body fingerprint is invariant before and after applying any number of wardrobe items.

### P1 — create the first real 3D garment pack
- Select and freeze a canonical VRM body with a published target fingerprint and rig contract.
- Produce rights-cleared skinned GLBs for lab coat, casual top, bottom, shoes and signature accessory.
- Include materials/textures, compatible Humanoid bones, bind-pose data, pack manifest, provenance and checksums.
- Validate each item and the full outfit on a reviewed pose suite.
- Add a reproducible authoring/export validator.

### P2 — persistence and user experience
- Store selected pack and per-slot outfit locally with schema version and migration.
- Store bytes only in bounded local storage; re-verify on restore.
- Handle missing/corrupt pack, model replacement, storage quota and rig mismatch.
- Preserve user-pinned selection; automatic recommendations remain opt-in and advisory until a user-authorized renderer commit succeeds.

### P3 — 2.5D and Live2D
- Author layered 2.5D clothing with masks, underdraw, pivots, deformation weights and occlusion validation.
- Inspect Kurisu moc3 with the licensed Cubism SDK/Editor for actual drawable/part controls.
- Implement only verified Live2D switches; if unavailable, report unsupported capability instead of simulating it with an expression or texture label.
- Plug both into the same switch/acknowledgement contract.

### P4 — production verification
- Desktop and Android visual E2E for each renderer.
- Validate clipping, deformation, physics, hair/accessory anchors and shader/material compatibility.
- Test switching one slot while preserving all others.
- Test repeated switching, rollback, restart and model changes.
- Measure memory, FPS, attachment latency and disposal of old meshes/materials.
- Complete provenance/license review and add asset manifest to Release.

## Definition of 100%

Aspect 15 is complete only when:

1. Real, rights-cleared modular garment assets exist for all renderers that are declared supported.
2. At least six usable outfit families can be composed from independent slots.
3. Dependency, exclusion, body and rig compatibility are enforced.
4. User selection, optional autonomous recommendation, persistence and rollback work.
5. Each renderer visibly applies and animates clothing on the actual model.
6. Garments deform correctly without unacceptable clipping across the acceptance pose suite.
7. Body identity and motor/emotional state survive garment and body changes.
8. Desktop and Android E2E pass on the exact release candidate SHA.
9. Asset provenance, license and SHA-256 evidence ship with the release.

A metadata-only catalog, procedural preview or passing unit suite alone cannot satisfy the 100% gate.

## Current evidence boundary

- Existing PR #412 has a dedicated wardrobe workflow. Its last verified checkpoint before the new commits reported **45 tests passed, 0 failed**.
- The new multi-slot/identity/cleanup and per-slot-selection changes have been pushed after that checkpoint. Their GitHub Actions result must be checked on the new HEAD before describing them as CI-verified.
- No actual production garment GLB pack, Live2D part switch, 2.5D garment art, persistent pack restore, visual E2E or refreshed Release ZIP is claimed.
- The branch is a draft candidate; it is not yet part of the canonical Release ZIP.

## Useful links

- [PR #412 — modular wardrobe](https://github.com/ailtron1ss-rgb/NK1/pull/412)
- [Working branch](https://github.com/ailtron1ss-rgb/NK1/tree/work/nk1-wardrobe-modular-clothing-pass-2026-10-30)
- [Existing detailed implementation log](ASPECT08_MODULAR_WARDROBE_PLAN_RU.md)


## Additional integration pass — persistence and stale task cancellation (2026-10-30)

- Added versioned IndexedDB storage in `wardrobePackStore.ts`, keyed by the exact base-body fingerprint and rig contract.
- Store is bounded to 128 MiB per pack, requires a prior explicit user rights self-attestation, and writes only a pack whose manifest and all payload bytes have passed SHA-256 verification.
- Restore checks stored schema, key, target body/rig, renderer scope, unique garment slots and all stored hashes before any VRM attachment. A saved outfit is not silently applied to a different model.
- After successful renderer commit, Avatar3DStage persists selected asset IDs and verified bundle bytes. When the same body is loaded again, it attempts a safe re-verified restore.
- Added a cancellation predicate to the asynchronous GLB loader. If the avatar is changed/reset while assets are parsing, prepared resources are disposed and no stale wardrobe is attached.
- Regression coverage added for body-specific keys, safe stored slot selection, cancellation before parsing and cancellation after parsing.

Boundary: this is implementation-level IndexedDB and cancellation wiring. Real browser quota/restart tests, Android validation, actual garment GLBs, and Live2D/2.5D adapters still need to pass before the aspect can be called complete.


### Latest verified checkpoint

- HEAD: `52ea82e3bf60f0524a32ad5bb2d5212b4d38b6dc`
- [NK1 modular wardrobe validation](https://github.com/ailtron1ss-rgb/NK1/actions/runs/41086075600): **62 passed / 0 failed / 0 skipped**
- The suite now covers per-slot selection, body/rig persistence validation, multi-slot VRM attachment, stable skeleton identity, stale-load cancellation and fail-closed asset verification.
- General NeuroCore regression was still in progress at the latest status check; it is not claimed as complete.
