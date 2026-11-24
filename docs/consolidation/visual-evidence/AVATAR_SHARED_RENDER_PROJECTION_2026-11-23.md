# Avatar shared render projection — integration evidence

**Date:** 23 November 2026  
**Repository:** `ailtron1ss-rgb/NK1`  
**Pull request:** [#1150 — Unify brain projection and fail-safe 3D embodiment](https://github.com/ailtron1ss-rgb/NK1/pull/1150)  
**Branch:** `aspect/avatar-shared-render-projection-20261123`  
**Verified head:** `ddb837972571819954ec839c82651893c65d3bc4`  
**Base:** `workpass70-source` at `54f9ec7c1ea81b71d0f0cf6d8c3e6395c4f96441`

## Result

**15/15 GitHub checks passed.**

All 15 exact-head check runs completed with `success`; there were no failed or pending checks at the time of this record.

The core regression workflow completed the app-script suite, app TypeScript check, development bundle build and runtime TypeScript check. Its remaining memory, cognition, local-LLM, governed-tool and speech-gateway regression steps also completed successfully.

Specialized passing workflows included:

- normalized VRM motor and expression, including actual `three-vrm` normalized humanoid transfer;
- Original 2D cognitive motor coupling;
- renderer-neutral body-switch and UI handoff contract;
- avatar cognitive-affect motor coupling and Avatar Brain Bridge;
- GLB/VRM model preflight;
- Original 2D asset/art contract;
- module dependency and layer boundaries;
- clean install/build/start smoke;
- local-language resilience and deterministic embodied interaction.

## What is now connected

### One canonical projection

`AvatarStage` calls `buildAvatarRenderProjection` once per render snapshot. It projects the canonical `OrganismSnapshot` and current browser speech lifecycle into a single motor, expression, gaze and speech/mouth frame.

- Live2D receives the projection through the existing versioned v1 intent envelope.
- Original 2D receives the same `AvatarMotorIntentPlan`; its second call to `planAvatarMotorIntent` was removed.
- 3D receives the same plan for semantic body lean, head tilt and normalized arm intent.
- Raw `OrganismSnapshot.lastOption` remains separate and continues to select existing GLB animation clips.
- Speech mouth motion is gated by active browser-confirmed speech. Terminal lifecycle phases close the mouth. Invalid IDs and non-finite samples fail closed.
- The VRM adapter bounds the shared motor output and retains compatibility for legacy callers that do not provide `headTilt`.

### 3D visual fail-safe included in this same PR

The previous PR #1148 changes were carried into this branch, so the combined patch does not reintroduce the procedural placeholder.

- The rough procedural fixture is hidden at startup, on reset and when a model has not passed load/preflight.
- It is not animated per-frame while hidden.
- Empty/loading/error states provide retry, local VRM/GLB import and return-to-Live2D paths.
- VRM resources are disposed through `VRMUtils.deepDispose`.
- The default pinned v5 GLB is correctly represented as external `gltf / remote / productionReady:false`; the selector labels 3D as preview.

## Explicit remaining acceptance gates

This CI evidence does **not** prove that the external v5/v7 models have been visually compared in a live browser renderer. Nor does it prove real Android/Termux performance or acoustic lip-sync accuracy.

Still required before treating the embodiment as fully production-ready:

1. Render the actual v5 and v7 files in the browser and compare full-body proportions, face, clothing, textures, expressions, morphs and animation clips.
2. Perform a real Android/Termux device soak, including frame rate, memory/resource cleanup, mode switching and verified audio-playback timestamps.
3. Complete provenance and redistribution-rights review for externally hosted model assets.
4. Produce the real layered Kurisu art pack, overlap paint, pivots and occlusion evidence before enabling a production 2.5D renderer.

The shared projection is an integrated source-side prototype contract; it is not a consciousness claim, a full acoustic phoneme lip-sync system, nor proof that every renderer exposes identical capabilities.

## Release and branch safety

- `workpass70-source` was not modified by this work.
- The current PR remains Draft pending the visual/device/rights acceptance gates.
- No Release ZIP was changed or published.
- The latest published Release ZIP was not downloaded and byte-compared against this source branch during this execution; no release-parity claim is made.
