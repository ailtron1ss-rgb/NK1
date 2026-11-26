# NK1 — Host-admitted immutable source-candidate workspaces

Date: 2026-11-25
Target PR: #1185
Base: `workpass70-source @ 9008a8982a5173304456bee2c604bd0bc8665964`

## Purpose

`SourceCandidateWorkspaceV1` materializes a proposed source edit set into a disposable candidate directory. It is a staging/verification boundary, not an executor, package builder, deployment mechanism, or replacement for the existing Code Assimilation archive extraction workspace.

## Inputs and admission

- The caller supplies an immutable base SHA, a bounded source-file snapshot, and bounded edit records.
- Each edit binds to an expected before-file SHA-256, or explicitly creates a missing file.
- The workspace calculates a deterministic before-tree fingerprint, edit-set fingerprint, and candidate ID.
- Host authorization is mandatory at construction time. The callback receives the candidate/base/tree/edit bindings and must return a receipt bound to the exact base SHA and edit-set fingerprint.
- A missing, throwing, denied, or mismatched authorization callback fails closed and leaves no candidate directory.
- Source and edit paths are checked for traversal, reserved segments, cross-platform aliases, duplicate edits, and file/directory ancestor collisions before host admission.
- Resource bounds cap the source snapshot, individual file, edit count, and replacement sizes.
- Files are written exclusively into a unique workspace; a manifest is atomically renamed into place last. Partial materialization is removed on failure.

## Signed evidence admission bridge

`createCodeAssimilationSourceCandidateAuthorizationV1` composes the workspace host-admission callback with the existing Code Assimilation evidence verifier:

1. A process-authenticated Ed25519 source-provenance receipt must bind the exact candidate ID, candidate fingerprint, source fingerprint, and source subject.
2. A process-authenticated license-decision receipt must bind the same candidate and explicitly permit `modify`. A declared license string or a `study`-only / `research-only` receipt is insufficient.
3. The workspace base SHA must equal the candidate's `baseRuntimeSha`.
4. A mandatory host-owned verifier must independently confirm the supplied before-tree fingerprint belongs to that exact trusted checkout. False, throwing, or unavailable verification denies materialization.
5. The returned admission receipt binds the deterministic workspace candidate ID, base SHA, and edit-set fingerprint.

Receipts copied through JSON or restored across a process boundary are not authenticated by the current process-local receipt registry; persisted evidence must be verified again from its signed artifact before constructing the adapter. The adapter authorizes only modification into the non-executing candidate workspace. Execution, build, installation, activation, deployment, and redistribution remain separate gates.

## Explicit guarantees and non-guarantees

- The manifest is `status: materialized` and `executionStatus: not-executed`.
- Materialization does not import, evaluate, build, run, install, activate, or deploy candidate code.
- It does not grant ActionGateway permissions or approve the source/license.
- `baseSha` is an identifier supplied by the caller; the host authorization callback must independently bind the supplied source snapshot to its trusted checkout/archive receipt. The local before-tree fingerprint is not represented as a Git tree object ID.
- The existing `CodeAssimilationArchiveWorkspace` continues to own safe extraction/read-only inspection of untrusted donor archives. This new workspace owns only a distinct adapted-candidate staging step.

## Verification

The candidate package's 48+ assertions cover request validation, immutable hashes, duplicate paths, portable aliases, reserved/platform-specific paths, path traversal, ancestor collisions, authorization denial/binding mismatch, bounded sizes, exclusive creation, and rollback of partial materialization.

The branch's dedicated source-candidate and repository Actions checks were green on the previously tested head. The engineering-document-only follow-up requires exact-head Actions before merge.
