# [NK1][WorkPass627] VRMA sidecar motion library and blended organism control

**Дата:** 30 октября 2026 г.  
**Рабочая ветка:** feature/embodiment-model-hardening-2026-10-29  
**Связанный PR:** [#392](https://github.com/ailtron1ss-rgb/NK1/pull/392)  
**Статус:** implementation + dedicated tests + CI gate committed; exact-head verification still required. Release ZIP unchanged.

## Цель

WorkPass625 подключил Pixiv VRM runtime, но до этого персонаж мог использовать только встроенные в саму VRM/GLB анимации. Реальные наборы движений часто поставляются отдельно как VRMA (.vrma), и один и тот же motion asset должен применяться к разным humanoid VRM-моделям.

WorkPass627 добавляет sidecar VRMA pipeline и не требует копировать анимации внутрь каждой модели.

## 1. Official VRMA loader

Pinned dependency: @pixiv/three-vrm-animation 3.5.5 (MIT), same version as @pixiv/three-vrm. The lockfile includes npm registry integrity metadata and the runtime's peer dependency is compatible with the repository's Three.js 0.180.0.

The shared GLTFLoader registers both official plugins:
- VRMLoaderPlugin for VRM 0.x / VRM 1.0;
- VRMAnimationLoaderPlugin for VRMC_vrm_animation.

The separate .vrma picker calls the same NK1 bounded self-contained GLB preflight before GLTFLoader parsing. Network-backed buffer/image URI references remain disallowed. A sidecar is limited to 90 MiB and at most 20 animation entries per file.

Each decoded VRMAnimation is compiled against the currently loaded VRM using createVRMAnimationClip(animation, vrm). This lets the official library resolve normalized humanoid tracks, facial expression tracks, and LookAt track binding names against that exact avatar rather than assuming raw skeleton node names.

## 2. One character, many action clips

The runtime keeps model clips and VRMA clips separately:
- modelClips: animations embedded in the character asset;
- vrmaClips: compiled sidecar clips;
- vrmaDefaultClip: fallback if no semantic action alias matches;
- clips: combined inspection/selection list.

Action-based selection prefers a VRMA clip whose name maps to the organism action (respond, explore, verify, reflect, rest, wait), then an embedded model clip, then the imported VRMA default. Naming the file or its animation entries with these action words gives deterministic selection. The VRMA can be reused with another VRM because the official clip compiler resolves normalized avatar bones at import time. The selector deliberately does not use an idle clip as an early fallback for a sidecar source: an unrelated VRMA idle must never mask a matching embedded model action. Idle fallback is considered only after exact action matches in both sources and the explicit sidecar default.

A dedicated AnimationMixer now exists for every successfully loaded VRM, including characters with zero embedded animations. This fixes the previous silent failure mode where a sidecar clip could be parsed but there was no mixer to play it.

## 3. Smooth transitions

The 3D motion motor no longer calls stopAllAction on every action change. transitionClip fades the previous action out while fading the next one in, clamps the time scale, and tracks the active action by clip identity. This reduces abrupt pose jumps during action/emotion changes.

Replacing a character or resetting the stage still stops the old mixer and invalidates any in-flight VRMA parse. The VRMA sidecar parser also checks the active runtime token before attaching a clip, so a late result from a previous avatar cannot mutate the new avatar.

## 4. Preserve VRMA-authored face and gaze channels

A VRMA may contain:
- humanoid bone tracks;
- preset/custom expression tracks;
- an optional LookAt quaternion track.

NK1 extracts the expression keys from each VRMAnimation before compiling the clip. While a VRMA clip owns a key, the static organism-expression adapter does not repeatedly set that same key. Other expressions remain driven by organism emotion, valence/arousal, blink, and gaze signals. While NK1 is actively speaking, its grapheme-timeline vowel visemes (aa/ih/ou/ee/oh) temporarily take priority over VRMA-authored mouth tracks; when speech ends, VRMA mouth animation resumes. This preserves the actual spoken phrase without discarding the rest of the authored facial motion. A short transition guard keeps outgoing/incoming animated expression keys reserved during cross-fade.

For a clip containing lookAtTrack, the runtime creates VRMLookAtQuaternionProxy on the VRM scene and disables the procedural lookAt target for that active clip. When no LookAt track is active, gazeX/gazeY continues to drive the ordinary VRM LookAt target. This avoids two writers fighting over the same yaw/pitch channel.

## 5. Persistence and database migration

The existing avatar IndexedDB was version 1 with an active-model object store. It is now version 2 and adds an independent active-animation object store:
- model replacement updates only the model record;
- uploaded VRMA updates only the animation record;
- loading a saved VRM restores the saved VRMA sidecar and recompiles it against the newly loaded character;
- reset clears both records.

The migration creates the new object store only when it does not already exist; it preserves the existing active-model store and its saved Blob. Separate model/animation size constants and safe filename normalization remain in place. IndexedDB failure does not block the in-memory import; the UI reports that persistence was unavailable.

## 6. Regression and CI

New suite: app/scripts/avatar-vrma-animation.test.mjs  
Command: npm --prefix app run test:avatar-vrma-animation

It covers package/lockfile alignment, dual plugin registration, sidecar preflight before parser invocation, 20-clip cap, use of createVRMAnimationClip with the active VRM, mixer existence without embedded clips, semantic action selection, LookAt proxy, separate IndexedDB store migration/restore/reset, stale-load cancellation, and cross-fade wiring.

The suite is included in .github/workflows/embodiment-quality-gates.yml.

## 7. Limitations / release gates

- No bundled motion library is shipped yet; users import their own licensed .vrma files.
- No visual evidence has yet been captured from a known reference VRMA file showing arm/hip/body, expressions, and LookAt all working together.
- The current semantic mapping is filename/name based; no UI clip browser or user-authored action-tag manifest is included.
- VRMA clips currently use the existing action state and do not expose per-clip priority/weight/loop mode settings.
- Audio phoneme timing remains a separate browser/Live2D system; this pass does not claim acoustic lip-sync from VRMA.
- Android GPU/FPS, persistent memory pressure and long device soak remain unverified.
- Original layered 2.5D rig, full user-selectable Kurisu model, and final Release ZIP refresh remain open.

## Official upstream implementation references

- Pixiv VRMA loader example: https://github.com/pixiv/three-vrm/blob/dev/packages/three-vrm-animation/examples/loader-plugin.html
- VRMAnimationLoaderPlugin API: https://pixiv.github.io/three-vrm/docs/classes/three-vrm-animation.VRMAnimationLoaderPlugin.html
- createVRMAnimationClip API: https://pixiv.github.io/three-vrm/docs/functions/three-vrm-animation.createVRMAnimationClip.html
- VRMAnimation source shape: https://github.com/pixiv/three-vrm/blob/release/packages/three-vrm-animation/src/VRMAnimation.ts
- LookAt quaternion proxy source: https://github.com/pixiv/three-vrm/blob/release/packages/three-vrm-animation/src/VRMLookAtQuaternionProxy.ts
