# WorkPass621 — share body pose policy across current 2D renderers

**Date:** 2026-10-29  
**Branch:** `work/nk1-continuous-body-pose-2026-10-29`

## Implemented

- Replace the duplicate action/emotion pose table in `KurisuOriginalStage` with the shared `deriveEmbodimentPose` mapper used by Live2D.
- Keep renderer-specific display scales in the SVG adapter; visual representation differs while organism intent and affect remain the same.
- Extend regression assertions to prevent reintroduction of a separate SVG emotion-to-pose table.

## Scope limits

This unifies continuous pose policy across currently available 2D renderers (Live2D and SVG Original). It does not create the missing 2.5D/3D model, skeleton, IK or garment meshes. The future rigged adapter should consume the same normalized pose plus semantic `motorAction` and `intentReason` fields.
