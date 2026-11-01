# NK1 WorkPass — hostile motor-frame record validation (2026-11-01)

Motor-frame data crosses an organism-to-renderer boundary and must be treated as untrusted input.

The mapper now requires plain own-data records for the frame, joint map and joint samples. Accessor properties are rejected from property descriptors without invoking getters. Inherited records, sparse/accessor joint-ID arrays, non-standard array prototypes and Proxy reflection traps are rejected through the normal `invalid-motor-frame` result.

The test suite adds root getter, nested joint getter, inherited frame and hostile Proxy regressions. The existing embodiment workflow runs the test through `test:embodiment-switch` and performs app typecheck.

This is defensive input validation only. It does not claim renderer presentation, physical rig calibration, browser visual E2E or Android soak.
