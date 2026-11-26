# NK1 — Global workspace pre-arbitration integration

Date: 2026-11-26
Canonical base: `workpass70-source@7e601680c765d6dc94e51e4c8f5e729b48a6f56e`
Aspect PR: #1186 — existing cognitive-workspace aspect branch, transplanted onto the current source line.

## Defect

The operational cognitive cycle invoked `CognitiveKernelCoordinator.integrateAndArbitrate()` before running the global workspace competition. Consequently, P61/P64 could only receive the persisted consciousness ignition value from an earlier stage/cycle; the coalition computed for the current candidate set was produced later and could not influence that decision.

## Change

- Move the single global workspace competition to the point after governed decision candidates are formed and immediately before the coordinator arbitration.
- Feed the same-cycle `globalWorkspace.ignition01` directly to `integrationSignals.workspace01`.
- Apply a small coalition membership support only to selected governed candidates, with a per-candidate upper bound of 0.03.
- Keep the existing Memory `workspaceV2` separate and unchanged; no second workspace owner is introduced.
- Keep all downstream arbitration inside the existing CognitiveKernelCoordinator.

## Acceptance

The dedicated test instruments the real `OrganismCore.observe()` path and checks:
1. workspace competition occurs before P61/P64 arbitration;
2. exactly one global workspace competition runs;
3. the exact ignition scalar from that competition is consumed by arbitration;
4. selected candidates receive positive but bounded support, while non-selected candidates receive none.

This mechanism is an engineering implementation of a bounded global-workspace hypothesis. It does not detect or prove consciousness or subjective experience.

## Verification status

- Test-first checkpoint: `9139591c97798bde77fef23c53ee6d21aaa57439` (test/workflow/package wiring only; exact-head CI was started).
- Production change is in the subsequent commit on this aspect PR. Exact-head checks must complete before merge.
- No changes to the canonical source branch, `main`, releases, or the immutable `gearonone.zip` baseline are included.
