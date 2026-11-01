# NK1 checkpoint — avatar semantic boundary normalization (2026-11-01)

- Normalize renderer-facing speech phases through a closed allowlist; unknown provider values become the explicit `unknown` lifecycle state.
- Trim opaque speech event identifiers and reject blank, non-string and over-128-character values.
- Missing gaze and mouth samples project to neutral values before shared semantic-state validation.
- Add regressions for malformed lifecycle data, event identifiers, missing sensory samples and a complete Live2D-to-VRM handoff plan.
- This is a UI projection-boundary hardening change. It does not claim browser visual E2E, lip/audio synchronization, Android soak or completed pose application.
