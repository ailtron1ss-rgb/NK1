# NK1 WorkPass — hostile motor-frame record validation (2026-11-01)

Motor-frame data crosses an organism-to-renderer boundary and is treated as untrusted input.

The mapper requires plain own-data records for the frame, joint map and joint samples. Accessor properties are rejected through descriptors without invoking getters. Inherited records, sparse/accessor joint-ID arrays, non-standard array prototypes and Proxy reflection traps return the normal invalid-frame result.

Regression coverage includes root and nested getters, inherited frames and hostile proxies. The existing embodiment workflow runs mapper tests and app typecheck.

This is defensive input validation only; it does not establish renderer presentation, physical rig calibration, browser visual E2E or Android soak.
