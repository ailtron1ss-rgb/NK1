# RELEASE NOTES — B500

B451–B500 adds a bounded meta-cognitive developmental controller and repairs real adaptive compute execution in B421–B450.

New:
- hierarchical memory abstraction;
- negative-transfer guard;
- skill-transfer cache;
- world cross-check;
- meta-controller;
- experiment policy;
- compute governor;
- identity consolidation;
- multi-lesion verification;
- 1000-cycle long-horizon benchmark;
- fair comparison benchmark;
- archive/source verification updates.

Verified:
- Typecheck PASS
- Architecture PASS
- Full audit PASS
- Release source PASS
- Integrity PASS
- Contract PASS
- Lock PASS
- Archive PASS: 3175 files, zero mismatches
- Server smoke PASS
- B451 core/integration/restart PASS

Known limitations:
- Android-specific Termux APIs are not installed on the verification host.
- Current meta-controller is not yet a learned neural policy.
- Fair benchmark does not show universal performance gain.
