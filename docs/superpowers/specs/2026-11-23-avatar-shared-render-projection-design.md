# Shared Avatar Render Projection — design

**Date:** 23 November 2026  
**Status:** implementation proposal  
**Branch:** aspect/avatar-shared-render-projection-20261123  
**Baseline:** workpass70-source at 54f9ec7c1ea81b71d0f0cf6d8c3e6395c4f96441

## Intent

NeuroCore has one organism state, but the avatar frontends currently translate that state independently. Live2D computes a motor plan while publishing its versioned speech/expression intent; Original 2D computes the same motor plan again inside KurisuOriginalStage; 3D still creates a separate arm-pose table from raw organism actions and derives its head roll independently. Small differences in timing, gaze, expression and action interpretation can therefore make the same Kurisu feel like three loosely related characters.

Build one pure app-side projection for each React avatar snapshot. It consumes the canonical OrganismSnapshot, the current browser speech lifecycle and mouth sample, and the existing motion-arbiter channels. It calls planAvatarMotorIntent exactly once and publishes a renderer-neutral semantic result. Live2D, Original 2D and 3D adapt that result to the capabilities they actually have.

## Goals

- One deterministic motor-plan result per avatar render snapshot, reused by every visual body.
- One gaze calculation, including the same valence offset, for all modes.
- One explicit speech lifecycle and one mouth-pose decision. A mouth may animate only while browser speech is actively confirmed by the UI SpeechSynthesis lifecycle and current voiceStatus.
- The same motor decision drives Live2D supported motion group, Original 2D authored pose and 3D normalized humanoid arm/head intent.
- Preserve renderer-specific behavior: Live2D Cubism remains parameter/motion-driven, Original 2D remains an SVG concept rig, and 3D keeps existing GLB clip selection plus supported VRM normalized-bone mapping.
- Keep motion-arbiter secondary channels additive where the renderer maps them.
- Preserve honest partial acknowledgement and speech playback evidence. A Termux process event with playbackVerified=false is telemetry only, not a mouth clock.

## Non-goals

- No new consciousness, personality or autonomous-action claims.
- No new 2.5D mode or fabricated layered artwork.
- No automatic v5-to-v7 model promotion, GLB bundling or license inference.
- No acoustic phoneme extraction or claim of sub-80 ms lip-sync accuracy.
- No direct change to runtime EmbodimentRuntime composition or backend voice routes: this slice establishes the shared contract in the primary React avatar path first.
- No change to the organism's canonical action, memory, affect or persistence state.

## Approaches considered

1. **Pure shared render projection in the primary UI (recommended).** A small module derives the motor plan, expression, gaze and speech/mouth projection once; all renderers consume it. This removes duplicated decisions with low coupling and focused tests.
2. Route every renderer through runtime AvatarBrainAffectBridge and EmbodimentRuntime immediately. This would be a broader architectural rewrite; Analysis 0.9 does not establish that route as the current main React render loop, so wiring it now would require inventing additional transport and lifecycle behavior.
3. Keep each renderer's local motor planner and tune the results. This leaves the root cause — multiple decision owners — in place.

## Proposed interfaces

Create app/src/components/avatar/avatarRenderProjection.ts:

- AvatarRenderProjectionInput: snapshot, thinking, browser-confirmed speaking, fresh-turn flag/text, speech phase and IDs, monotonic audio time/clock source, mouth sample and voice emphasis.
- AvatarRenderProjection: raw organism action, shared AvatarMotorIntentPlan, mapped expression and intensity, bounded gaze, explicit speech identity/phase/clock, speaking, mouth pose, voice emphasis.
- buildAvatarRenderProjection(input): AvatarRenderProjection. This is a pure, deterministic projection. It does not mutate the snapshot or start/cancel audio.

Create app/src/components/avatar/rendererMotorAdapters.ts:

- resolveVrmArmIntent(plan, frame): deterministic normalized left/right arm intent from the shared motor plan and bounded affect modifiers. Return neutral values for rest/listen and clamp outputs. It does not perform IK or claim joints absent from the model.

Extend VrmNormalizedMotorFrame with optional headTilt. The VRM adapter combines this with its existing normalized gaze/affect orientation and clamps it to the existing motor range. Existing callers remain valid.

## Renderer behavior

- **Live2D:** construct existing EmbodimentIntentV1 from the projection; keep version sequencing, exact speech cancellation identity, viewer message source checks and partial parameter readback. No new message protocol.
- **Original 2D:** receive the already computed motor plan rather than calling planAvatarMotorIntent again. Continue to render its own authored SVG pose and channel offsets.
- **3D:** receive the same plan and gaze/mouth state. Use the plan's semantic action to drive VRM arm intent and head tilt. Keep the original OrganismSnapshot.lastOption for existing animation-clip selection; do not confuse semantic motor action names with GLB clip names.
- **Legacy sprites:** keep its available static/sprite behavior; do not claim skeletal channels it does not expose.

## Error and lifecycle policy

- Terminal or non-speaking phases (idle, starting, ended, cancelled, unknown) produce the closed-mouth pose.
- An open mouth sample is accepted only when the speech phase is speaking and the UI has confirmed active browser speech.
- Missing/invalid IDs do not invent a speech session. Preserve the validated v1 Live2D envelope rules.
- Invalid numeric values are clamped or mapped to a neutral state, never propagated as non-finite transforms.
- Renderer capabilities remain the boundary: a semantic plan can ask for a gesture, but an adapter may only apply mapped channels.

## Verification

- Unit tests with real emptySnapshot() fixtures for projection, expression, gaze, shared motor plan, mouth closure, and malformed/reconnect inputs.
- VRM adapter tests proving shared head tilt and arm intents are clamped and applied to normalized bones.
- Existing Original 2D channel, Live2D viewer, speech lifecycle, VRM, model preflight and 3D-stage tests remain intact.
- GitHub Actions on the exact PR head must pass app scripts, app typecheck, bundle build, runtime typecheck, renderer-switch contract, Original 2D coupling, normalized VRM motor, model preflight and clean startup.
- Browser visual acceptance of real hosted GLB/VRM and Android/Termux audio/render soak remain separate gates. This source-side integration does not close them.
