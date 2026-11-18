# NK1 Repository Coding Context Engine

## Purpose

The Repository Coding Context Engine turns the useful Hermes Coding Context pattern into an NK1-owned, auditable capability. It is not a source-code copy and it is not a free-form shell agent. It adds a bounded repository index, immutable patch proposals, sandbox evidence, and a narrow patch-application adapter.

## Native NK1 flow

1. **repository-context.read** reads one host-pinned repository snapshot. The engine ranks source/test/configuration/documentation files, computes SHA-256 fingerprints, and returns small line excerpts.
2. Repository material is untrusted data. .env files, credential-like paths, secret-shaped content, symlinks, binary files, ignored build folders, oversized entries, and irrelevant files are excluded before excerpts are returned.
3. **patch.propose** creates an immutable proposal bound to the exact base revision and pre-image hashes. Only a fixed allowlist of test command forms is accepted.
4. **patch.verify** delegates to a host-created isolated workspace. The host must disable network access and return a hashed attestation, run identity, sandbox identity, command list, exit codes, output digests, and timestamps.
5. **patch.apply** is registered as a destructive self-modification ActionGateway tool. It requires a durable idempotency key and the existing one-shot owner approval. The engine itself never grants approval.
6. Application receipts must prove an atomic working-tree-only write and include the resulting revision, exact changed-file digest set, and rollback snapshot digest. Ambiguous or partial application is moved to reconciliation-required.

## Higher-risk controls

Changes to ActionGateway, tool-input contracts, OrganismCore/Runtime, auth, permissions, safety, governance, and CI workflows are classified as critical. They require two independent sandbox runs with distinct run and sandbox identities plus a third holdout identity tied to a fixed test-suite/output digest. Other classes require at least one clean isolated run.

Verification expires after 30 minutes. Any base revision drift blocks verify/apply. The engine stores proposals and evidence via the injected RepositoryCodingStateStore; restored state is fingerprint-checked and bounded.

## Host adapter contract

A host composes:

- snapshot(): return candidate file paths and contents for one immutable revision, with complete=true only when the inventory is exhaustive; do not follow symlinks. The engine checks each modified/deleted pre-image against this snapshot and requires create targets to be absent.
- verifySandbox(payload): run only supplied allowlisted test commands in an ephemeral, isolated, network-disabled workspace. Compute repositorySandboxAttestationSha256 from the proposal id, repository, base revision, exact test set and runner facts outside repository-controlled code. Critical changes additionally require distinct primary, independent and holdout run/sandbox identities; holdout evidence is bound with repositorySandboxHoldoutAttestationSha256 and repositorySandboxSuiteSha256.
- applyPatch(payload, idempotencyKey): atomically apply to the working tree only, preserving a rollback snapshot. Never push, merge, tag, release, deploy, or write outside the selected workspace.
- reconcilePatch(payload, idempotencyKey): authoritative, read-only lookup for the exact prior idempotent provider operation. It must never retry or execute the patch. A provider receipt is accepted only after proposal/repository/base/idempotency bindings, atomicity, resulting revision, rollback digest and exact changed-file digest set match.

The host is a trusted adapter boundary. A plain boolean in an untrusted runner response is not a security proof; production hosts must derive sandbox identity, isolation, network policy, run identity, test completion, output digests and attestations from their own trusted runner control plane. The host must not allow repository content to control the isolation boundary or attestations.

## Enable in runtime

Pass an engine and trusted host adapter in RuntimeConfig.repositoryCoding. This capability is disabled by default. Runtime initialization registers the four tools through OrganismCore.registerActionTool, so mutation remains under the existing ActionGateway. Do not implement host methods by calling arbitrary model-authored shell commands.

## Status semantics

- awaiting-tests: immutable proposal only.
- tests-failed: verification absent, invalid, failed, or insufficient.
- verified-awaiting-approval: required sandbox evidence passed; owner approval is still mandatory.
- applied: verified atomic working-tree change has a matching receipt.
- reconciliation-required: the write may have partially happened or its receipt does not match; no next mutation should proceed until reconciled.

This feature does not itself make changes to the repository under analysis. It creates the narrow NK1 capability used by a trusted host adapter to propose, verify, and apply changes.
