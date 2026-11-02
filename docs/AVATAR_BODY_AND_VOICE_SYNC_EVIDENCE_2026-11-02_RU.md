# NK1 — доказательный аудит тела, аватара и голосовой синхронизации

**Дата снимка:** 2026-11-02  
**Source baseline:** `workpass70-source` @ `608435493b4af3b4a222d385f1b77d978d18583b`  
**Аспект:** Embodiment / Avatar / Voice / Motor synchronization  
**Статус:** source-level audit; browser/device E2E and acoustic measurements are not claimed.

---

## 0. Итог

В NK1 уже есть несколько реально существующих embodiment-путей, и их нельзя сводить к «аватар ещё не готов»:

1. **Live2D Kurisu** — настоящие Cubism model assets в canonical runtime public tree: `moc3`, model config, texture, physics, expressions, motions, CDI; отдельная mobile model config и уменьшенная 2048 texture.
2. **Original 2D** — независимый редактируемый SVG/React avatar stage с настройкой одежды, волос, глаз, акцента, позы и интенсивности движения. Это не Cubism rig.
3. **Procedural 3D** — геометрический fallback из Three.js primitive meshes; это страховочная сцена, не production character mesh.
4. **Pinned remote 3D GLB v5** — каталог содержит точную ревизию, размер и SHA-256 удалённого asset; UI получает его по HTTPS и проверяет content type, declared size, actual size и fingerprint до загрузки.
5. **User VRM/GLB** — upload, preflight, fingerprint, локальное сохранение в IndexedDB и адаптация VRM humanoid/expressions/motor frame.
6. **2.5D depth rig** — существуют контракт, валидация topology/transform, world-pose composition и renderer adapter. Однако `AvatarStage` ViewMode на этом source SHA не содержит самостоятельный `2.5d` mode. Следовательно, API/renderer substrate нельзя считать законченной 2.5D embodiment.

Самая крупная незакрытая граница — не отсутствие файлов или классов, а доказательство сквозного поведения на реальном устройстве: один канонический semantic/motor state должен без разрыва управлять каждым renderer; голосовой lip-sync должен быть привязан к реальному playback clock, а не к факту запуска процесса TTS.

---

## 1. Инвентарь существующего тела

### 1.1 Canonical Live2D model

Canonical files reside under:

`runtime/neuro-kurisu/public/live2d/Kurisu/`

Confirmed source-tree entries:
- `Kurisu.moc3` — 6,001,152 bytes;
- `Kurisu.4096/texture_00.png` — 8,236,235 bytes;
- `Kurisu.model3.json` — references the moc, 4096 texture, physics, CDI, motions, expressions, EyeBlink and LipSync groups;
- `Kurisu.physics3.json`, `Kurisu.cdi3.json`;
- expressions include blush, anger, sadness, fear, smile, surprise and arm-change variants;
- motions include an idle loop, head/body interaction and additional motion clips.

The mobile config `Kurisu.mobile/Kurisu-mobile.model3.json` reuses the canonical moc, physics, CDI, motion and expression references, but uses a derived 2048×2048 mobile texture. `PROVENANCE.json` records the source archive/path and calls the mobile texture derived-and-verified.

Viewer/runtime-related files also exist:
- `runtime/neuro-kurisu/public/live2d/viewer.html`;
- `runtime/neuro-kurisu/public/live2d/embodiment-intent.mjs`;
- `app/public/live2d/vendor/cubism4.min.js`;
- `app/public/live2d/vendor/live2dcubismcore.min.js`;
- `app/public/live2d/vendor/pixi.min.js`.

**What this proves:** the repository contains real Live2D/Cubism assets and a viewer stack, not merely a placeholder drawing.

**What it does not prove:** current browser rendering on all target devices, all expressions/motions being visually correct, full asset redistribution rights, or measured motor/audio synchronization.

The provenance JSON points to a historical source archive. It is useful technical lineage, but it is not a legal license grant. Preserve the original asset's own license/contract/creator notices and obtain an explicit redistribution decision before repackaging.

### 1.2 Original 2D renderer

`app/src/components/KurisuOriginalStage.tsx` is an independently authored SVG avatar. It consumes emotion, action, arousal, gaze, speaking and mouth pose. It includes three outfit modes (lab/casual/night), eye/hair/accent variants, pose selection, movement style and scale preferences.

The source comment explicitly distinguishes it from a Live2D `.moc3` model. It is an editable fallback/art-direction renderer, not a substitute for a fully rigged Cubism model.

### 1.3 3D renderer and models

`app/src/components/Avatar3DStage.tsx` builds a Three.js scene and creates a procedural character from primitives as a fallback. It also supports:
- generic `.glb` and `.vrm` files;
- maximum upload size 90 MiB;
- GLB container preflight;
- exact-byte fingerprinting;
- local persistence through IndexedDB;
- VRM loader plugin and normalized humanoid motor mapping;
- VRM expression frame and spring-bone update;
- generic GLB morph/arm fallback;
- animation clip selection by action;
- resource disposal when swapping/resetting a model.

The built-in catalog `app/src/components/avatar/avatarModelCatalog.ts` pins:

| Property | Value |
|---|---|
| id | `neuro-kurisu-hybrid-v5` |
| filename | `NeuroKurisu_3D_v5.glb` |
| revision | 5 |
| size | 2,035,768 bytes |
| SHA-256 | `4cc4c34a62f72122b34c1d896d42bf10eddcba6f10f66563e4fc5e213a37e743` |
| source label | Higgsfield 3D Jutsu project / revision 5 |

The binary is referenced by a CloudFront HTTPS URL in the catalog; it is not a `.glb`/`.vrm` blob in the source tree. The avatar loader requests it with credentials omitted and timeout, checks the expected content type, compares Content-Length when supplied, compares downloaded blob size and calculates SHA-256 before handing the asset to the model loader.

I also checked the configured endpoint through an external fetch: it returned HTTP 200 and `model/gltf-binary`. This only establishes that the URL was reachable and returned the expected MIME type at the time checked. The full binary was not independently downloaded and hashed in this audit; visual appearance and actual licensing rights are not independently verified. The catalog's source label is provenance metadata, not proof of a commercial license or redistribution permission.

**Implication:** NK1 has a remote pinned 3D asset path, but cannot yet claim a fully self-contained release package containing this model unless the actual Release ZIP is checked. A runtime dependency on a remote CDN is also a distinct availability/offline risk.

### 1.4 2.5D depth rig

Files:
- `app/src/components/avatar/depthRig.ts`;
- `app/src/components/avatar/depthRigRendererAdapter.ts`.

The rig contract includes semantic nodes, parent hierarchy, pivots, depth order, rest transforms, gestures and bounded pose resolution. The validator detects malformed IDs, duplicate IDs, non-finite transforms, invalid pivots, missing parents, cycles, and invalid root counts. The renderer adapter maps the computed affine pose to renderer layer objects.

The source comment is explicit: this contract does not turn a flat PNG/SVG into a rig. Production artwork still needs separate depth layers, hidden-area paint, masks, pivots, occlusion and calibration.

The current UI type is:

`type ViewMode = "live2d" | "legacy" | "original" | "3d"`

There is no explicit `2.5d` mode in `AvatarStage.tsx` at the audited source SHA. Therefore:
- depth-rig data/pose foundation: present;
- renderer adapter foundation: present;
- authored production layered puppet: not evidenced;
- standalone selectable 2.5D body and fully verified runtime switch: not completed.

---

## 2. Brain-to-body signal path

The intended contract is:

`OrganismState / semantic body state → EmbodimentIntentV1 → renderer-specific adapter → body output → observed acknowledgement/evidence`

For this to be one body rather than several visualizations, every renderer must consume the same bounded semantic intent:
- emotion and affect intensity;
- action and action phase;
- head/gaze intent;
- upper/lower limb motor intent;
- torso posture and balance;
- breath/idle rhythm;
- expression and viseme;
- speech lifecycle and interruption;
- body mode/revision;
- timestamps, event identity and correlation.

The key architectural rule is one upstream motor intent owner, with renderer-specific kinematic adapters. Live2D parameter values, VRM bones, GLB morphs and 2.5D layer transforms should be projections of one semantic motor frame, not independent emotion and action systems with subtly different timing.

### 2.1 Current shared signals

The current UI has:
- emotion/action/energy/cognitive load/uncertainty/curiosity/goal-pressure inputs to 3D stage;
- semantic embodiment switch projection and handoff;
- motor intent adapter;
- common speech/viseme timeline utilities;
- browser speech lifecycle events;
- native speech provider event transport via SSE;
- renderer-specific Live2D, original 2D and 3D pathways.

This is meaningful integration work. It is not yet proof that all motor channels are identical in meaning, sign, scale, range, units and temporal interpolation across all renderers.

### 2.2 Required canonical MotorFrame

Before further renderer-specific features, freeze a versioned cross-renderer motor contract. Minimum fields should be explicitly dimensional and bounded:

| Group | Required contract |
|---|---|
| Identity | `interactionId`, `bodyRevision`, `tickId`, `sequence`, `occurredAtMonotonicMs` |
| Head | yaw, pitch, roll, gaze target and confidence |
| Torso | lean, yaw, posture and breath |
| Limbs | semantic joint/group intent, target range and confidence |
| Affect | label plus valence/arousal/dominance/intensity; no uncontrolled raw model values |
| Face | expression weights and blink state |
| Speech | utterance ID, provider ID, playback phase, audio-clock position and viseme |
| Validity | data freshness, source, cancellation, deadline and channel support |

A renderer declares its capabilities and reports which channels it actually applied. “Accepted input”, “parameter readback”, “animation applied”, “frame rendered”, and “physically observed” must remain distinct evidence classes.

---

## 3. Voice and lip-sync: the exact gap

### 3.1 Browser speech

`app/src/components/avatar/embodimentTimeline.ts` and `AvatarStage.tsx` provide:
- speech lifecycle events with identity and monotonic timestamps;
- character-index and boundary-based viseme anchors;
- a monotonic browser audio clock with high-water behavior;
- viseme timeline sampling;
- cancellation that closes the mouth and stops the browser speech session;
- lifecycle validation to reject duplicate/stale/reordered events.

This is the strongest currently available lip-sync path because it can follow the browser speech provider's elapsed-time and word-boundary information. It still needs perceptual testing and measured drift on actual devices, especially under background/foreground transitions, audio buffering, speech cancellation and renderer changes.

### 3.2 Native Termux TTS

Runtime components include:
- `EmbodimentRuntime`;
- `AndroidEmbodimentBridge`;
- `NativeSpeechEventChannel`;
- `NativeSpeechHostRouter`;
- `native-speech-sse.mjs`;
- browser-side native speech event adapter.

The native telemetry distinguishes command requested, process spawned, process exited, process error and interruption request. The event contract explicitly uses `playbackVerified=false`.

That distinction is correct and must not be weakened:
- process spawn is not audio start;
- process exit is not audible playback completion;
- interrupt request is not proof that sound stopped;
- process telemetry is not a phoneme or viseme clock.

Without an Android TTS progress callback, audio-output observer or loopback-based clock, using native process events to drive lips would create a false synchronization signal.

### 3.3 Missing voice subsystem gates

1. Provider arbitration: browser speech and native TTS must never speak the same utterance simultaneously unless explicit mixing is supported.
2. Real playback state: obtain a trustworthy start/progress/end/interruption source.
3. Clock calibration: map audio output position to renderer monotonic frame time.
4. Phoneme/viseme mapping: use provider text boundary data or phoneme timestamps; do not infer playback from text length alone when accurate synthesis timing is available.
5. Late-event suppression: old utterance events cannot move the current mouth.
6. Interruption consistency: audio cancellation, UI lifecycle, viseme closure, receipts and next utterance must converge.
7. Android/Termux E2E: measure real device drift and interruptions, not only synthetic clock regressions.

---

## 4. Priority gaps

| Priority | Gap | Why it matters | Evidence needed |
|---|---|---|---|
| P0 | One versioned cross-renderer MotorFrame contract | Prevent semantic drift between body modes | Contract parity tests for every renderer |
| P0 | Native speech real playback clock | Correct lip-sync depends on actual audio | Device playback callback/loopback trace |
| P0 | Avatar asset provenance/license | The canonical body must be legally and operationally distributable | Asset-by-asset license and origin decision |
| P1 | 2.5D authored artwork and UI mode | Depth rig code without layers is not a usable body | Layered art, masks, pivot/occlusion tests, mode toggle |
| P1 | Remote GLB reliability/offline behavior | CDN outage should not silently remove the intended body | Download/hash/cache/restore E2E and bundled-release check |
| P1 | VRM calibration | Generic rig support does not equal correct Kurisu proportions/poses | Model-specific rig calibration profile |
| P1 | Browser/WebGL lifecycle | Load/replace/reset/reload may leak GPU resources or lose state | Real browser E2E, renderer.info and soak |
| P1 | Cross-body switching | Transition must be transactional and not reset cognitive intent | Body switch/restart/failure rollback evidence |
| P2 | Outfit/hair/cloth physics | Visual identity and expressive quality need authored asset work | Asset pipeline and motion evaluation |
| P2 | Personality-to-expression calibration | Emotion state must shape expression naturally, not map labels mechanically | Blind rated interaction scenarios |
| P2 | Mobile performance and thermal policy | 4096 texture and 3D scene may be expensive on mobile | p50/p95 FPS, RAM, GPU, thermal/battery measurements |

---

## 5. Recommended implementation sequence

### E0 — Freeze the body interface
- Define a versioned MotorFrame and speech-clock envelope.
- Specify units, coordinate conventions, clamp ranges and interpolation rules.
- Add schema validation and migration policy.
- Build a renderer capability registry.
- Create parity tests: identical semantic state must lead to equivalent intent across Live2D, original 2D, VRM/GLB and future depth-rig.

### E1 — Close the audio truth boundary
- Add a provider arbiter for browser/native speech.
- Add a native playback observer/progress adapter.
- Carry utteranceId/audioClockId/sequence through runtime, SSE, host router and renderer.
- Use one monotonic clock abstraction with calibrated audio offsets.
- Keep process telemetry separate from playback evidence.
- Add late/duplicate/reordered/interrupt/restart/failure regressions.

### E2 — Validate Live2D in actual browser
- Test model3 paths, relative texture/moc/physics/expressions/motions, mobile manifest and asset hydration.
- Check every expression and motion resolves without 404.
- Verify viewer-ready handshake and intent replay after iframe remount.
- Confirm that UI acknowledgements remain partial unless visual output is independently verified.
- Run browser screenshot/video review, then a sustained renderer and context-loss soak.

### E3 — Finish 2.5D as a real body mode
- Author layered Kurisu art with hidden-area paint, correct masks, occlusion and attachment slots.
- Add a model/rig manifest with per-layer source hash and license evidence.
- Add calibration for normalized coordinates, pivots and depth ordering.
- Wire a distinct `2.5d` option into the avatar UI and transactional body-switch coordinator.
- Reuse the canonical motor intent; do not create a separate 2.5D emotion engine.
- Verify full-screen/mobile and resize transitions.

### E4 — Harden remote GLB and VRM lifecycle
- Make remote asset metadata and cache state visible in diagnostics.
- Verify exact bytes against pinned digest before parsing every fresh download.
- Cache only verified assets; maintain previous known-good model if a new one fails.
- Test CORS/content-type/timeout/short response/incorrect size/wrong SHA.
- Perform model replacement, repeated reset, restart and WebGL context-loss tests.
- Build per-model VRM calibration profiles for proportions, rest pose, joint mapping, expressions and locomotion.
- Inspect whether the remote GLB is allowed to be redistributed; only bundle it once rights and Release policy are clear.

### E5 — End-to-end organism embodiment
- Drive one deterministic cognitive scenario through perception → appraisal → goal/action → motor intent → renderer → speech → playback evidence → expression/mouth → action result.
- Repeat for 2D, Live2D, 2.5D and 3D.
- Include emotion conflict, high uncertainty, silence, rest, external interruption, resource pressure, provider failure and restart.
- Track identity continuity: body changes must not reset personality, memory, current goal or pending interaction.

### E6 — Device and release acceptance
- Desktop browser/WebGL E2E.
- Android browser WebGL E2E.
- Termux native voice E2E and measured playback drift.
- 24-hour mixed avatar/voice soak with no unbounded memory/GPU growth.
- Reproducible Release build including required licensed assets; asset manifest and hashes in SBOM/provenance.
- Clean install, offline/degraded operation, update and rollback.
- No release claim until the exact Release ZIP contains the verified source/assets and its digest is independently checked.

---

## 6. Acceptance criteria

These are target gates, not current results:

- Renderer parity: 100% of required MotorFrame fields either applied or explicitly reported unsupported; no silent channel drops.
- Stale event protection: no prior utterance/body revision can overwrite current state.
- Browser and native lip-sync: measured p95 audio-to-viseme alignment target ≤80 ms, after defining how audio position is independently observed.
- Interruption: p95 confirmed output stop target ≤200 ms; this must measure sound output, not merely process termination.
- Body switching: no lost current intent, no double renderer output and successful rollback after failed target initialization.
- Model integrity: 100% of built-in/user models pass strict preflight and exact fingerprint verification before scene mutation.
- Resource lifecycle: repeated load/swap/reset/context-loss soak shows no monotonic GPU/heap growth beyond declared bounds.
- Licensing: every bundled character/model/texture/motion/voice asset has explicit provenance and redistribution decision.
- Device acceptance: exact device/model/browser/OS/runtime versions and test logs attached.

A target does not become a measured score because a test constant was added. Actual measurements and test traces must be recorded.

---

## 7. Current truth table

| Capability | Status on source baseline |
|---|---|
| Canonical Live2D model files | PRESENT in source tree |
| Mobile Live2D texture variant | PRESENT; provenance marks derived-and-verified |
| Original editable SVG avatar | PRESENT |
| Procedural 3D body | PRESENT as fallback |
| Remote pinned GLB v5 catalog | PRESENT; endpoint reachable at audit time |
| Independent binary download and SHA re-verification in this audit | NOT PERFORMED |
| User VRM/GLB upload and preflight | PRESENT in source |
| VRM normalized humanoid/expressions update path | PRESENT in source |
| 2.5D depth-rig contract and renderer adapter | PRESENT |
| Distinct 2.5D selectable ViewMode | NOT PRESENT in audited `AvatarStage` union |
| Browser speech viseme timeline and monotonic clock | PRESENT in source |
| Native Termux process-event telemetry | PRESENT |
| Native verified playback clock | NOT EVIDENCED |
| Real Android acoustic lip-sync measurement | NOT EVIDENCED |
| Full browser/WebGL and device soak | NOT EVIDENCED in this audit |
| Complete asset redistribution approval | NOT ESTABLISHED by source metadata |

---

## 8. Relevant source files

- `app/src/components/AvatarStage.tsx`
- `app/src/components/Avatar3DStage.tsx`
- `app/src/components/KurisuOriginalStage.tsx`
- `app/src/components/avatar/avatarModelCatalog.ts`
- `app/src/components/avatar/avatarModelPreflight.ts`
- `app/src/components/avatar/avatarModelFingerprint.ts`
- `app/src/components/avatar/avatarModelStore.ts`
- `app/src/components/avatar/embodimentTimeline.ts`
- `app/src/components/avatar/embodimentCoordinator.ts`
- `app/src/components/avatar/embodimentSwitch.ts`
- `app/src/components/avatar/depthRig.ts`
- `app/src/components/avatar/depthRigRendererAdapter.ts`
- `runtime/neuro-kurisu/src/organism/body/EmbodimentRuntime.ts`
- `runtime/neuro-kurisu/src/organism/body/VoiceEmbodiment.ts`
- `runtime/neuro-kurisu/src/organism/body/NativeSpeechEventChannel.ts`
- `runtime/neuro-kurisu/src/organism/body/NativeSpeechHostRouter.ts`
- `runtime/neuro-kurisu/src/organism/core/EmbodimentSubsystemRuntime.ts`
- `runtime/neuro-kurisu/public/live2d/PROVENANCE.json`
- `runtime/neuro-kurisu/docs/WORKPASS630_NATIVE_SPEECH_UI_TRANSPORT_RU.md`

**No implementation change is claimed by this audit document.** It establishes the next source-backed integration gates and protects the project from confusing file presence, interface readiness, visual rendering, acoustic playback and release approval.
