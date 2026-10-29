# [NK1][WorkPass618] Expose the existing Original 2D avatar as a selectable mode

Date: 2026-10-29
Branch: `feature/embodiment-motor-intent-20261029`
Base head before this pass: `116574b6cf71a2bfb85b84a5ab8f1e665d596113`

## Implemented
- Brought the existing `KurisuOriginalStage` prototype from `feature/kurisu-2p5d-body-20261026` into the active source branch without overwriting the newer motor-intent work.
- Added a third mode, `NK1 Original`, alongside `Live2D` and `Legacy` in the active avatar selector.
- Restored saved selection for the new mode with the existing safe preference store.
- Passed current emotion, action, arousal, gaze, speaking, thinking, and mouth-viseme data into the prototype so its visual face/body responds to live organism state.
- Kept the prototype's device-local outfit, eye/hair/accent colour, motion-style, pose and scale controls.
- Added regression assertions for the selector wiring and the expected clothing/pose controls.

## Technical classification
This is a real selectable **2D SVG concept mode**. It is not represented as production 2.5D: it has authored SVG silhouettes, preset limb poses and small transform-based movements, but no depth-aware model, skeleton, IK, or full-body joint controller. Live2D and the SVG concept are separate renderers selected by the user.

## Validation
The active source branch's earlier motor-intent test and related workflows passed on the parent head. This added UI integration has just been committed; its CI and a production build/browser render still need confirmation. The Release ZIP has not been regenerated.
