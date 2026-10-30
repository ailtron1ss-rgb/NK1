## [NK1][WorkPass635] Calibrate humanoid retargeting across local-axis conventions (2026-10-30)

- Extend the data-only humanoid retarget profile with optional source/target world-rest orientations expressed in one shared coordinate frame.
- Derive a per-role source-local → target-local axis basis and conjugate rest-relative quaternion deltas through that basis before applying target rest orientation.
- Report roles that lack paired world-rest calibration and add strict mode that skips those roles instead of silently assuming equal local axes.
- Add deterministic quaternion tests proving a source-local X rotation maps to target-local Y under a 90° frame difference, plus strict/fallback behavior.
- Scope: this improves the standalone retargeting math only. The current production VRMA path remains the official Pixiv compiler; this helper is not yet wired to embedded GLTF playback. Runtime transform capture, source/target animation sampling, foot IK/contact, and real-asset multi-rig E2E remain pending.

## [NK1][WorkPass634] Add humanoid motion retargeting primitives (2026-10-30)

- Added a pure, data-only source/target humanoid profile with semantic role intersection, missing-role reporting, rest-local quaternion snapshots, per-bone length ratios, and avatar-height scaling.
- Added rest-pose-relative local rotation transfer, configurable angular caps, and bounded root translation. Malformed quaternions and non-finite inputs fail closed.
- Added focused regression coverage for quaternion math, source/target rest-pose normalization, target-rest-relative transfer, missing roles, safety bounds, and invalid dimensions.
- This is the mathematical retargeting core only: differing local-axis calibration, VRMA mixer integration, IK, foot contact, and browser multi-rig E2E remain pending.

## [NK1][WorkPass633] Expand full-body VRM humanoid mapping (2026-10-30)

- Expand the semantic bone vocabulary from the upper-body motor subset to torso, shoulders, arms, hands, all finger joints, legs, feet, and toes.
- Resolve VRM 1.0 role-keyed and VRM 0.x bone-array node indices while preserving strict rejection of unknown roles and invalid node indices.
- Add Blender/Mixamo/J_Bip aliases, including finger joint numbering, and collect normalized VRM nodes across the full humanoid skeleton in the active 3D stage.
- Scope: semantic mapping and runtime node discovery only; this does not claim IK, locomotion, contact solving, or successful visual retargeting.

