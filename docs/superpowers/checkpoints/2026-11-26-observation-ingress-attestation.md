# NK1 — Observation ingress host-attestation checkpoint

Date: 2026-11-26  
PR: [#821 — Canonical observation intake gate](https://github.com/ailtron1ss-rgb/NK1/pull/821)  
Canonical branch: `workpass70-source` (read-only during this pass)

## Executive state

The observation-ingress security boundary was hardened after a reproducible CI regression showed that a caller could submit `provenance: "device-capture"` or `"host-interface"` plus fabricated evidence references and be admitted as real physical evidence.

The fix is implemented and passed the focused exact-head CI workflow. It is still feature-branch work in an OPEN/DRAFT PR; it is not merged, not tested on a physical Android/Termux device, and not released.

- Verified code head: `b2e68f4677bbb04dd6566ea66008014e5edf5919`.
- Focused workflow: [NK1 world perception integrity — run 45793258919](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45793258919) — SUCCESS.
- The workflow completed all 20 functional stages plus semantic runtime TypeScript typecheck.
- Current canonical source at inspection: `workpass70-source@7e601680c765d6dc94e51e4c8f5e729b48a6f56e`.
- PR remains Draft and GitHub reports it as non-mergeable/conflicting.

## Failure reproduced before the fix

The normalizer previously accepted any supported provenance string as authoritative:

- `device-capture` and `host-interface` set `isRealCapture=true`.
- Caller-supplied `isRealCapture` was overwritten, but caller-supplied provenance was not.
- Caller-supplied strings in `evidenceRefs` were treated as if they were host evidence references.
- `GroundedWorldState.observationEvidenceKind()` separately converted physical provenance labels to `observed` without checking the canonical `isRealCapture` result.

Regression-first evidence:
- RED tests added in `d89f1866e1394a4da56613cf2551efee69558d69`.
- [RED workflow 45791837310](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45791837310): both caller-forged physical provenance cases failed as expected (actual `true`, expected `false`); earlier perception checks and the camera projection setup passed.

## Implemented trust boundary

### 1. Identity-based host attestation

`ObservationIntakeGate.ts` now maintains a process-local `WeakSet<object>` of the exact observation objects authorized by internal runtime admission points.

- A provenance string, boolean, receipt-shaped ID, or copied/serialized object cannot recreate the attestation.
- `device-capture` / `host-interface` without the WeakSet identity are downgraded to `unresolved`.
- `isRealCapture` becomes true only when the exact object is host-attested and its provenance is one of the physical provenance values.
- The helper is imported only by internal runtime code; it is not re-exported through `organism/index.ts` or the public package barrel.

The WeakSet is an in-process capability boundary, not a cryptographic defense against arbitrary code already executing inside the trusted runtime. Persisted/restored intake records do not regain this transient identity attestation.

### 2. Runtime owns the attestation decision

The exported camera and Android telemetry projection helpers now return ordinary, untrusted data objects. They do not attest their own output.

`OrganismRuntime` is the sole production owner of the authority decision:

- Camera: the runtime attaches attestation only after the completed `ActionGateway.executeTool` result is verified, includes non-empty execution and provider receipt identifiers, and explicit vision consent is still present.
- Android: the runtime attaches attestation only after `EmbodimentRuntime.sampleActive()` returns a newer sample with `source === "android-termux"`, `staleMs === 0`, requested sensors, and explicit device consent.

This prevents a direct call to an exported projection helper with caller-controlled `receiptVerified: true` or fabricated Android telemetry fields from creating observed evidence.

### 3. GroundedWorldState respects the canonical trust result

`observationEvidenceKind(provenance, isRealCapture)` now classifies physical provenance as `observed` only when `isRealCapture === true`. Otherwise it remains `unresolved`.

This closes the second trust-escalation path below the intake gate. The existing monotonic evidence rule remains intact: a later unresolved/model sample does not demote already-grounded observed evidence.

## Verification

At exact code head `b2e68f4677bbb04dd6566ea66008014e5edf5919`:

- [Run 45793258919](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45793258919) — SUCCESS.
- All 20 functional stages completed successfully.
- Semantic runtime TypeScript typecheck completed successfully.
- Runtime-to-Core Android ingress regression passed.
- P41 semantic perception, cross-modal identity, instance tracking, calibration, epistemic integrity, independent-evidence truthfulness passed.
- Canonical admission, provenance and privacy regressions passed.
- Grounded-world admission plus durable restore passed.
- Object identity/evidence provenance, camera MIME/spatial evidence, temporal tracking and runtime camera capture/tracking passed.

The runtime Android test injects a fresh `android-termux` sample through the host sampling boundary. The camera runtime test controls the ActionGateway receipt in CI. These verify code wiring and trust conditions, but are not physical device/OS receipt verification.

## Remaining gates

1. Reconcile with current `workpass70-source@7e601680...`. Comparison from common ancestor `9008a8982a5173304456bee2c604bd0bc8665964`: perception branch is 27 commits ahead and 15 behind. PR #821 remains non-mergeable. No blind rebase/merge.
2. Obtain independent code review of the host-attestation capability and runtime-only attachment points.
3. Run on physical Android/Termux with real camera/Termux receipts; verify denied consent, stale samples, replay, process restart and loss-of-power behavior.
4. Measure intake latency, payload size and memory overhead on target hardware.
5. Re-run exact-head CI after current-source reconciliation and release only through the project's source/release parity gates.

No claim of `DEVICE_VERIFIED`, `PROVEN`, `PRODUCTION_READY`, or `RELEASED` is made.
