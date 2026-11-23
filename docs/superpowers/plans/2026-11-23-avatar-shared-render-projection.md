# Shared Avatar Render Projection Implementation Plan

> **For agentic workers:** Use this plan task-by-task. Every production behavior follows TDD: write a failing behavioral test, run it and verify the expected failure, implement the minimum behavior, then rerun the same test and the owning test suite.

**Goal:** Make Live2D, Original 2D and 3D render the same canonical motor/affect/speech decision while preserving their real, renderer-specific capabilities.

**Architecture:** A pure avatarRenderProjection module computes one renderer-neutral projection from the Organism snapshot and active browser speech state. A separate adapter maps its motor result to VRM normalized bones; the React stage passes the same result to every renderer.

**Tech Stack:** TypeScript, React 19, Node test runner, Three.js / @pixiv/three-vrm, existing EmbodimentIntentV1 contract.

**Spec:** docs/superpowers/specs/2026-11-23-avatar-shared-render-projection-design.md

## Global Constraints

- Base branch: workpass70-source; baseline SHA 54f9ec7c1ea81b71d0f0cf6d8c3e6395c4f96441.
- Work only on aspect/avatar-shared-render-projection-20261123; do not update workpass70-source.
- Keep AvatarRenderProjection pure; do not mutate OrganismSnapshot, trigger TTS, or create browser globals.
- Browser speech is the only mouth-animation authority in this UI. Native Termux events currently have playbackVerified=false.
- 2.5D remains unavailable without production layered art. The 3D model remains preview until visual, device and rights acceptance.
- Preserve raw OrganismSnapshot.lastOption for GLB animation clip selection; semantic motor action is a separate vocabulary.
- Do not weaken existing assertions or change the Live2D v1 protocol.

## Review Focus

- Late/stale SpeechSynthesis callbacks after cancellation must not reopen the mouth.
- A new assistant turn while a previous utterance is active must not leave the previous session's motion token or mouth in place.
- An unknown/missing renderer channel must not be advertised as applied.
- Inactive browser speech plus native process telemetry must not become a speaking/mouth-open state.
- Semantic action labels (inspect, explain, comfort) must not replace raw organism actions for VRM clip selection.

---

### Task 1: Pure shared render projection

**Files:**
- Create: app/src/components/avatar/avatarRenderProjection.ts
- Create: app/scripts/avatar-render-projection.test.mjs
- Modify: app/package.json only if a focused test script is useful; the existing script runner also discovers *.test.mjs.

**Interfaces:**
- Consumes: OrganismSnapshot, MouthPose, SpeechPhase, planAvatarMotorIntent.
- Produces:
  - AvatarRenderProjectionInput with snapshot, thinking, speaking, hasFreshTurn, turnText, speechPhase, speechEventId, audioClockId, audioTimeMs, clockSource, mouthPose, voiceEmphasis.
  - AvatarRenderProjection with action, motorPlan, expression, expressionIntensity, gaze, speech, speaking, mouthPose, voiceEmphasis.
  - buildAvatarRenderProjection(input): AvatarRenderProjection.

- [ ] **Step 1: Write tests** for canonical emotion/action planning, shared gaze plus valence offset, bounded gaze, confirmed speaking mouth, terminal-phase mouth closure, and malformed clock/IDs.
- [ ] **Step 2: Run RED** using node --experimental-strip-types --test app/scripts/avatar-render-projection.test.mjs; expected: the projection tests fail on the stub's missing fields/incorrect mouth decision, not on imports or setup.
- [ ] **Step 3: Implement** the pure projection with one call to planAvatarMotorIntent, existing EXPRESSION_TEXT values, a single gaze-by-action table, and a closed-mouth fail-safe.
- [ ] **Step 4: Run GREEN** using the identical focused command; expected: all projection assertions pass.
- [ ] **Step 5: Commit** feat(avatar): add shared render projection.

### Task 2: Renderer-specific motor adapters

**Files:**
- Create: app/src/components/avatar/rendererMotorAdapters.ts
- Create: app/scripts/renderer-motor-adapters.test.mjs
- Modify: app/src/components/avatar/vrmRuntimeAdapter.ts
- Modify: app/scripts/vrm-runtime-adapter.test.mjs

**Interfaces:**
- Consumes: AvatarMotorIntentPlan and bounded affect/runtime context.
- Produces: resolveVrmArmIntent(plan, frame): { leftArmIntent: number; rightArmIntent: number }.
- Extends VrmNormalizedMotorFrame with optional headTilt?: number without breaking current callers.

- [ ] **Step 1: Write tests** for rest/listen neutral pose, explain/reflect/comfort/inspect/respond mappings, affect modifiers, asleep damping and out-of-range values; add a normalized-bone head-roll test.
- [ ] **Step 2: Run RED** with the two focused Node test commands; expected: exported adapter is missing and the head-tilt assertion fails because the adapter ignores the field.
- [ ] **Step 3: Implement** deterministic bounded mapping and add shared head tilt to VRM roll; retain legacy fallback when headTilt is absent.
- [ ] **Step 4: Run GREEN** with both identical commands; expected: new tests and existing normalized motor tests pass.
- [ ] **Step 5: Commit** feat(avatar): adapt shared motor intent to VRM.

### Task 3: Wire the single projection through every UI renderer

**Files:**
- Modify: app/src/components/AvatarStage.tsx
- Modify: app/src/components/KurisuOriginalStage.tsx
- Modify: app/src/components/Avatar3DStage.tsx
- Modify: app/scripts/embodiment-timeline.test.mjs
- Modify: app/scripts/avatar-motor-intent.test.mjs or create a focused UI-projection integration test.

**Interfaces:**
- AvatarStage creates one projection from the current snapshot, active browser speech session, mouth sample, and existing motion channels.
- KurisuOriginalStage consumes a required motorPlan: AvatarMotorIntentPlan; it must not independently call planAvatarMotorIntent when mounted from the main stage.
- Avatar3DStage consumes the same motorPlan, projection gaze and projection mouth/speaking state. It keeps action: ActionKind separately for existing clip selection.

- [ ] **Step 1: Write a failing integration test** proving the Original 2D stage is supplied the shared plan and 3D arm/head mapping receives that same plan, while raw organism action remains the clip-selection input.
- [ ] **Step 2: Run RED** with the focused renderer integration test; expected: current stage recomputes Original 2D intent and 3D does not receive a motor plan.
- [ ] **Step 3: Implement** one projection in AvatarStage; use it for Live2D v1, Original 2D and 3D. Remove duplicated gaze planning and Original 2D planner invocation. Keep body-channel arbitration separate and additive.
- [ ] **Step 4: Run GREEN** with the focused renderer integration test and owning test commands:
  - node --experimental-strip-types --test app/scripts/avatar-render-projection.test.mjs app/scripts/renderer-motor-adapters.test.mjs
  - node --experimental-strip-types --test app/scripts/embodiment-timeline.test.mjs app/scripts/avatar-motor-intent.test.mjs app/scripts/vrm-runtime-adapter.test.mjs
- [ ] **Step 5: Commit** feat(avatar): share one motor projection across renderers.

### Task 4: Integration verification and evidence

**Files:**
- Modify: docs/consolidation/visual-evidence/AVATAR_SHARED_RENDER_PROJECTION_2026-11-23.md
- No workflow configuration changes unless an existing workflow demonstrably omits the new tests.

**Interfaces:**
- Consumes: Tasks 1–3 and existing embodiment-switch, Original 2D coupling, normalized VRM motor, model preflight and core regression workflows.
- Produces: one evidence note stating exact PR-head SHA, CI checks, applied behaviors, and deferred physical visual/audio gates.

- [ ] **Step 1: Write the acceptance checklist**: same motor decision, same gaze, one mouth authority, closed-mouth terminal phases, renderer capability limits, raw action clip selection.
- [ ] **Step 2: Run exact-head GitHub Actions** and inspect app script regression, app typecheck, development build, runtime typecheck, body-switch, Live2D, Original 2D, normalized VRM, clean startup and dependency checks.
- [ ] **Step 3: Record** only confirmed outputs. State that browser/Android visual/audio acceptance is still open if the environment cannot render/sound the models.
- [ ] **Step 4: Commit** docs(avatar): record shared projection acceptance.

## Completion contract

- Primary UI computes one motor plan per render projection and passes the same immutable result to all three animated renderers.
- Original 2D no longer computes a second plan when used under AvatarStage.
- 3D uses the same semantic motor decision for head/arm intent while preserving raw action for model clip selection.
- Live2D continues to use the existing v1 message contract and exact cancellation/source checks.
- Projection and adapter tests, full app script suite, typechecks and bundle build pass on exact PR head.
- PR remains Draft until human-facing browser/Android visual and audio acceptance can be performed. No Release ZIP update in this slice.
