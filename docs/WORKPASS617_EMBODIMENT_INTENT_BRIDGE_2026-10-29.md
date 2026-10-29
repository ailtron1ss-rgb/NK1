# [NK1][WorkPass617] Embodiment intent bridge and motor-intent selection

Date: 2026-10-29
Branch: `feature/embodiment-motor-intent-20261029`
Base: `workpass70-source` at `d1fa4bb37e2c948683aa0d4ce4bfb6da98f6fcc4`

## Implemented in this pass

1. Connected the protocol actually emitted by `AvatarStage.tsx` (`kurisu_embodiment_intent`) to the production Live2D viewer. The viewer now validates and normalizes the v1 envelope before changing model state, and rejects duplicate/out-of-order state versions.
2. Added a strict browser-safe protocol module that validates required and nested fields, numeric bounds, speech cancellation requirements, and the motion groups/index ranges that really exist in the bundled Kurisu model.
3. Fixed a lip-sync path issue: the viewer's animation ticker previously moved the mouth toward `lipTarget` while the incoming embodiment handler only changed the core parameter. The incoming mouth pose now updates the target the ticker actually renders.
4. Included `motionToken` in motion identity, so a new semantic action may replay the same available group/index once, while routine snapshots and viseme frames do not continually restart that clip.
5. Added a deterministic motor-intent planner for rest, listening, reflection, inspection, explanation, comfort, and response. It selects only the bundled `Idle`, `TapHead`, `TapBody`, and `Special` motion groups and produces bounded head tilt and gesture intensity.
6. Wired the planner into `AvatarStage`, registered an explicit test command in app/root package scripts, and added a regression suite covering intent selection, protocol validation, lip-target integration, and motion-token wiring.

## Scope and honest limitations

- This is a functional integration repair and a bounded high-level intent selector. It is **not** a 3D skeleton, free joint control, inverse kinematics, a garment simulation, or proof of autonomous bodily agency.
- Current physical motion remains limited by the motions embedded in the existing Live2D asset. Intent reasons are selected from organism context, action, emotion, and text cues; they are not a learned motor policy.
- No production build, browser E2E, Android/Termux audio test, or real device render has been run from this connector session. The tests were added but must be executed in a working checkout/CI.
- The Release ZIP remains unchanged in this pass. The source branch must be validated before any refreshed ZIP can truthfully be called updated.
