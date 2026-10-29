# WorkPass620 — preserve semantic motor intent across renderers

**Date:** 2026-10-29  
**Branch:** `work/nk1-continuous-body-pose-2026-10-29`

## Implementation

- Add optional `body.motorAction` and `body.intentReason` fields to EmbodimentIntent v1.
- Publish the actual high-level action and machine-readable reason returned by the existing motor-intent planner.
- Validate both values against the supported action set and a bounded reason-token pattern.
- Preserve compatibility for older v1 messages by deriving a conservative action from the shipped Live2D motion group and labelling the reason as `legacy-v1-payload`.
- Add contract tests for successful round-trip, malformed action/reason rejection, and end-to-end source/viewer wiring.

## Why

The motion group (Idle/TapHead/TapBody/Special) is specific to the current Live2D asset. A future 2.5D/3D renderer needs the goal (`inspect`, `explain`, `comfort`, etc.) and its provenance, not just a clip identifier. The semantic goal is now carried alongside renderer-specific motion fields, so future adapters can map one intent to different rigs.

## Limits

The goal selector remains a deterministic contextual planner, not a learned whole-body controller. This work does not create a 2.5D/3D asset, skeleton, IK solver or modular garment meshes. Real browser visual testing and device/audio checks remain separate validation gates.
