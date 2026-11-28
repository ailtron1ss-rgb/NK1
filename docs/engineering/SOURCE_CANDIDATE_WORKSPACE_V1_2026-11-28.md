# NK1 — Host-admitted immutable source-candidate workspaces

Date: 2026-11-28
Target PR: #1234
Canonical base: `workpass70-source@847f273d6f249c11f7904463460cbab2630c66ff`

## Purpose and ownership

`SourceCandidateWorkspaceV1` materializes a proposed source edit set into a disposable candidate directory. It does not modify the canonical checkout. It is distinct from the existing `CodeAssimilationArchiveWorkspace`, which owns safe extraction and read-only inspection of untrusted donor archives.

The new workspace owns only the later staging step: copy a host-provided snapshot, apply explicit edits whose before-hashes match, require admission, and write a content-addressed receipt. It does not execute, build, validate, install, activate, deploy, or release the candidate.

## Admission contract

- Input contains an immutable 40-character base SHA, a bounded file snapshot and a bounded edit set.
- Each edit binds to an expected before-file SHA-256, or explicitly creates a missing file.
- Before-tree, edit-set and candidate identifiers are deterministic and content-addressed.
- A host authorization callback is mandatory. Missing, throwing, denied or mismatched callbacks fail closed.
- `createCodeAssimilationSourceCandidateAuthorizationV1` composes authenticated Ed25519 source-provenance and SBOM receipts with a license-decision receipt that explicitly permits `modify`.
- Candidate identity, source fingerprint, dependency-lock fingerprint, SBOM fingerprint, license evidence and base SHA must all bind to the same candidate.
- The host callback must independently recompute/verify that the supplied before-tree belongs to the exact trusted checkout identified by the base SHA. A caller-supplied boolean or the candidate's own hash is not sufficient authority.
- The current process-local authenticated-receipt registry means receipts restored from JSON must be signature-verified again before constructing the adapter.

## Filesystem safety

Path traversal, reserved names, Windows device names/alternate streams, portable aliases, duplicate edits, ancestor collisions and oversized input are rejected before admission. Candidate creation is exclusive/no-overwrite. Partial materialization is removed on failure; the manifest is written last and marks the result `materialized` / `not-executed`.

On POSIX, root/nested directories are owner-only `0700`; source files and manifest are owner-only `0600`. Windows retains host ACL behavior.

## Explicit limitations

This PR adds the tested staging primitive and signed-evidence admission adapter; it does **not** connect a production server endpoint or trusted host snapshot verifier. The host must supply that verifier and must keep it outside learner/agent control. The next integration layer can connect the host-owned PatchReceipt/PairedHoldout admission service and LearningProcessSupervisor. Execution of untrusted code still requires an OS-level sandbox; this materializer is not one.

## Verification

The two regression files cover source snapshot hashes, deterministic identities, exact before-hash binding, path traversal/alias/reserved-name rejection, authorization denial and mismatch, source provenance/SBOM/license binding, modify-only policy, exclusive candidate creation, private file modes, cleanup after partial failure, and host snapshot verification failures.
