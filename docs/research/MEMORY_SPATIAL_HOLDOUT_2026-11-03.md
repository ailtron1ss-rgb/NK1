# MemoryOS2 spatial retrieval holdout

This controlled fixture evaluates the *spatial retrieval mechanism*, not camera calibration or the complete organism.

## Design

Five deterministic seeds each generate 80 canonical MemoryOS2 records:
- 16 objects in the target coordinate frame and inside the query radius;
- 24 objects in that same frame but outside the radius;
- 24 objects at nearby numeric coordinates in a different frame;
- 16 records with no spatial coordinates.

The natural-language query is identical in both conditions. The baseline uses text-only retrieval. The variant adds an explicit frame-aware spatial query. Every result is scored against the labelled set of physically near objects.

## Required gates

- Mean recall@10 must increase over the baseline.
- Every seed must show positive delta; a single seed cannot mask regressions.
- No cross-frame or out-of-radius/unlocated object may appear in the spatial top-10.
- Derived index diagnostics must match canonical MemoryOS2 context.

The workflow reports per-seed and aggregate recall. This deterministic synthetic fixture does not demonstrate general-world recall, perceptual accuracy, transfer, or a consciousness-related property. Real P41-to-memory evidence, coordinate calibration and external holdout tasks remain separate gates.
