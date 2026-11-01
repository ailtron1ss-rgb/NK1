# NK1 checkpoint — avatar semantic boundary normalization (2026-11-01)

- Normalize renderer-facing speech phases through a closed allowlist; unknown provider values become the explicit `unknown` lifecycle state.
- Trim opaque speech event identifiers and reject blank, non-string and over-128-character values.
- Missing gaze and mouth samples project to neutral values before shared semantic-state validation.
- Add regressions for malformed lifecycle data, event identifiers, missing sensory samples and a complete Live2D-to-VRM handoff plan.
- This is a UI projection-boundary hardening change. It does not claim browser visual E2E, lip/audio synchronization, Android soak or completed pose application.

- Correct the avatar preflight workflow's Node.js drift: use approved `actions/checkout@v7` / `actions/setup-node@v7` and the root `.nvmrc` (Node 24), so the repository-wide CI reliability audit no longer fails on this workflow.
- This workflow correction was identified from exact GitHub Actions logs; it is not inferred from a generic CI failure.
- Make the TypeScript input contract match reality: gaze and mouth samples are optional/nullable; speech phase and event identity enter as untrusted values and are normalized before projection. Add a separate regression for omitted samples during reconnect, not only explicit `null`.
- Disable setup-node's implicit package-manager cache in the isolated preflight workflow because the repository intentionally has no root lockfile. Exact-head parser-preflight run passed after this correction.
- Reviewed the subsequent source-branch MotorFrame calibration hardening commit: it changes separate motor-mapping files and the shared CHANGELOG; no file overlap with this PR's avatar speech projection boundary was found. The PR remains one commit behind the source branch, and its next merge-ref CI run must validate the combined base/head state before merge.
- Exact app typecheck caught the expected strict-TypeScript consequence of optional sensor samples: four clamp call sites could receive `undefined`. Widen the clamp helpers to accept nullable/optional numeric values and default non-numeric/missing samples to neutral zero. The regression suite passed before typecheck; the corrected head is now queued for fresh typecheck.
