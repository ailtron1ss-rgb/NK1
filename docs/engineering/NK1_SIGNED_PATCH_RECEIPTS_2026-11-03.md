# Signed patch receipts for governed self-improvement

**Status:** implemented admission substrate; not connected to the live rewrite executor.

## Purpose

Bind a proposed code candidate to the exact source revision, exact raw unified diff,
actual changed files and line ranges authorized by its evolve-block declaration.
A candidate's own statement about which lines it changed is not trusted evidence.

## Receipt trust contract

The receipt contains a schema version, key identifier, full 40-character base Git
SHA, SHA-256 of the exact UTF-8 patch bytes, paths and line ranges derived from the
unified diff, and an Ed25519 signature over deterministic JSON.

The verifier receives public keys from a host-owned trust store. The signing
private key remains outside NK1, for example in a protected CI signer or
operator-controlled secret manager. A receipt or invented key identifier grants
no authority.

## Diff policy

Only in-place textual modifications with unambiguous repository-relative paths
are admitted. New/deleted files, renames, copies, mode changes, binary patches,
quoted paths, traversal, malformed hunks and line-count mismatches are refused.
A deletion-only hunk maps to the insertion seam in the new file; this anchor must
also be inside an evolve block.

The verifier requires exact equality between actual diff paths and candidate
targets, actual ranges and signed receipt ranges, and every changed range and at
least one declared evolve block in the same file. Base SHA, patch digest, paths
and ranges are signature-bound.

## Runtime boundary

SelfImprovementCandidatePool.submitVerified(...) is the cryptographically verified
admission path. The existing submit(...) remains an in-memory metrics/ranking API
for experiments and is not permission to stage or execute a patch. The live Core
rewrite caller still lacks a host-owned signing-key feed and trusted independent
downstream evidence. Autonomous code changes therefore remain blocked; this work
does not enable autonomous rewriting.

## Validation

CI exercises valid Ed25519 receipts, base-SHA replay, patch tampering, forged
line claims, out-of-block edits, wrong targets, untrusted keys, invalid signatures,
binary/add/delete/rename/traversal patches, deletion anchors and candidate-pool
verified admission. No third-party dependency or persisted schema migration.
