# WorkPass71 — renderer capability manifest, motion library and arbiter-driven bodies

**Date:** 2026-11-03
**Branch:** `workpass70-source`
**Base SHA:** `608435493b4af3b4a222d385f1b77d978d18583b` (live `workpass70-source` at pass start)
**Plan:** [NK1 avatar/body/embodiment master plan](NK1_AVATAR_BODY_EMBODIMENT_MASTER_PLAN_RU_2026-11-03.md) §14
**Intake:** [RESEARCH_INTAKE_LEDGER.md](RESEARCH_INTAKE_LEDGER.md) — WorkPass71 entry

## Problem statements addressed

1. Each renderer mode carried its own hand-maintained capability table, so the UI could advertise a channel a renderer did not implement (silent drift between claim and rig).
2. There was no renderer-neutral motion vocabulary: gestures were hard-coded per stage, with no bounded blend, no safe interruption and no way to feed one motion decision into 2D and 3D at once.
3. The 3D VRM adapter drove only head/neck/upper arms; legs, elbows and spine had no channel path.
4. The Original 2D stage ignored motion channels entirely, so the same organism intent produced different motion on 2D and 3D.

## Implemented

- `app/src/components/avatar/rendererCapabilityManifest.ts` — versioned `RendererCapabilities`, `validateRendererCapabilities`, and a fail-closed `BodyRendererRegistry` that rejects an invalid or duplicate manifest instead of registering it.
- `app/src/components/avatar/rendererRegistryDefaults.ts` — canonical manifests for `live2d`, `original2d`, `legacy2d`, `three3d`; `createDefaultBodyRendererRegistry` is the single source of truth.
- `app/src/components/avatar/motionLibrary.ts` — 16 named `MotionProgram`s (idle, listen, think, explain, comfort, walk, turn, sit, stand, reach, point, wave, hold, …) with loop-seam validation, keyframe validation and bounded interpolation.
- `app/src/components/avatar/motionArbitration.ts` — intent→primary-program selection, bounded cross-fade (`MOTION_TRANSITION_MS`), an additive idle-breath overlay, energy-scaled amplitude and a layer cap; deterministic `defaultMotionArbitrationState`.
- `app/src/components/avatar/embodimentUiBridge.ts` — `capabilitiesForMode` now derives from the registry (no second table), and `projectSemanticBodyState` accepts clamped arbiter channels without letting them override derived channels.
- `app/src/components/avatar/vrmRuntimeAdapter.ts` — `resolveVrmFullBodyRig` and `applyVrmFullBodyChannels` map channels onto the normalized humanoid proxy (spine, elbows, hips, knees). Shoulders stay owned by the gaze/gesture controller so no bone is double-driven; the function reports only bones it wrote.
- `app/src/components/avatar/originalStageChannels.ts` — JSX-free `originalStageChannelOffsets`: 2D maps yaw/pitch to translation, roll to rotation and breath to a bounded scale.
- `app/src/components/Avatar3DStage.tsx`, `app/src/components/KurisuOriginalStage.tsx`, `app/src/components/AvatarStage.tsx` — both stages now consume the same arbiter channels from one `motionChannelsRef`.

## Tests

- `app/scripts/body-systems.test.mjs` — 22 behavioral tests (capability validation, registry fail-closed, motion program contracts, interpolation, arbitration/cross-fade/idle overlay, 3D full-body apply, 2D channel bounds).
- `app/scripts/embodiment-ui-bridge.test.mjs` — 14 tests (existing) still pass with the registry-derived capability table.
- New aggregates: `npm run test:body-systems`, `npm run test:workpass71`.

## Observed runs (OBSERVED)

| Command | Result |
|---|---|
| `npm run typecheck` (app + runtime) | PASS |
| `npm run build` (app) | PASS |
| `npm --prefix app run test:scripts` | 452/452 PASS |
| `npm run test:body-systems` | 22/22 PASS |
| `npm run test:workpass71` | PASS (22 + 14 + 31 + 9 + 7 + 11) |
| runtime `audit:integrity` | PASS, files=4383 |

## Not proven (UNRESOLVED)

- The arbiter emits target channels, not a verified rendered pose. No visual assertion exists for either stage.
- No browser E2E, Android E2E, soak, or latency/memory/battery measurement was run for this change.
- Tests are behavioral and synthetic; they are not device evidence.
- No donor code, model weights or dataset was integrated. The intake ledger entry is a candidate queue, not a license approval.
- The 2.5D depth-rig render path remains unwired (next pass B).

## Rollback

Revert the three commits on `workpass70-source`: capability manifest/motion library, 3D full-body wiring, 2D channel wiring. No persisted state or schema changed.
