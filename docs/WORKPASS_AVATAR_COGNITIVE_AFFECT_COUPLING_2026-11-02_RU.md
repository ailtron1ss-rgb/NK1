# NK1 — WorkPass: cognitive-to-avatar affect coupling

**Date:** 2026-11-02  
**Branch:** `aspect/avatar-cognitive-affect-coupling-20261102`  
**Base:** `workpass70-source` at `608435493b4af3b4a222d385f1b77d978d18583b`

## Finding

The 3D stage already receives organism emotion, valence, dominance, energy, cognitive load, uncertainty, social need, novelty, goal pressure, curiosity, prediction error and personality traits. The Live2D motor planner, however, received only emotion label, valence, arousal, last action, thinking/speaking flags and recent text. The 2D body therefore discarded several brain signals already available in the UI snapshot.

The existing renderer-neutral depth-rig modules are a 2.5D foundation, not a complete selectable 2.5D character. No production layered artwork with hidden-area paint, pivots, masks and garment layers is currently confirmed. Do not present the SVG concept as a true depth puppet.

## Implemented

- Extended `AvatarMotorIntentInput` with optional energy, cognitive load, uncertainty, social need, novelty, goal pressure, prediction error and trait vector fields. Existing pure callers remain backward compatible.
- Wired the canonical `OrganismSnapshot` signals and `identity.traits` into the Live2D planner.
- High cognitive pressure now selects a restrained reflection pose when the organism is not actively speaking; severe load/uncertainty suppresses expansive gestures.
- Low energy can select a rest/idle pose when no active conversation is in progress.
- Novelty and curiosity trait jointly influence inspection gestures.
- Social need and warmth jointly soften active conversational behavior.
- Goal pressure can promote an explanatory gesture; composure, guardedness and playfulness tune bounded pose/motion selection.
- Kept the existing protocol v1 envelope and bundled Live2D motion groups; no unsupported motion group or joint was invented.
- Added regression cases and a dedicated CI workflow.

## Research grounding

- Greenwood & Garfinkel, *Interoceptive Mechanisms and Emotional Processing*, Annual Review of Psychology (2025), DOI: https://doi.org/10.1146/annurev-psych-020924-125202 — bodily signals need contextual appraisal; raw sensor magnitude alone is not affect.
- *Emotions as Computations* (2023): https://pmc.ncbi.nlm.nih.gov/articles/PMC9805532/ — emotions can be treated as computations over state/action/uncertain prospects, supporting causal links to action selection and learning.
- Zhang et al., *A systematic review of emotional nonverbal cues in embodied virtual agents* (2026): https://doi.org/10.1007/s10055-026-01457-5 — review of 52 studies; facial expression, posture and gaze all matter, with posture often especially effective in virtual environments.
- Wang et al., *The interaction design of 3D virtual humans: A survey* (2024), DOI: https://doi.org/10.1016/j.cosrev.2024.100653 — organize embodiment as coordinated speech, eyes, facial expression and posture, not isolated animation toggles.

## Verification boundary

The dedicated workflow runs `npm run test:avatar-motor-intent` and app typecheck. It has not been executed locally in this session. CI must pass on the exact PR head. The change improves the brain-to-Live2D motor-intent route; it does not prove physical embodiment, subjective emotion or 2.5D/3D animation quality on a real device.

## Next closure gates

1. Add browser-level readback that binds the same cognitive revision to the renderer's observed expression, gaze and motion state.
2. Build a true selectable 2.5D stage only after licensed layered artwork, occlusion masks, pivots, depth order and garment assets exist.
3. Connect the existing depth-rig renderer adapter to authored layers; validate each mapped channel with actual render readback.
4. For 3D, finish VRM model calibration, morph/LookAt mapping, IK activation, animation-mixer arbitration and real model tests.
5. Run desktop and Android/Termux soak for speech interruptions, viseme drift, mode switches and low-memory behavior.
