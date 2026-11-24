# RELEASE NOTES — B321

B321 adds a truth-preserving Android/Termux Device Reality Gate.

### New
- runtime device probe
- Android/Termux provenance detection
- RAM/filesystem write measurements
- battery/Wi-Fi/sensor capability probes
- DeviceEvidenceLedger integration
- physical-device certification guard

### Important
Host Linux runs remain `HOST_PROBE` and can never certify physical Android readiness.

### Verified on current environment
B321 PASS, typecheck PASS, B318 PASS, B320 PASS.

### Not yet physically certified
The current execution environment is not an Android/Termux phone. Physical certification must be obtained by running the gate on the target device.
