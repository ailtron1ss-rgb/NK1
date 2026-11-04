# NeuroK read-set freshness gate

**Branch:** aspect/neurok-os-readset-freshness-20261103  
**Parent:** PR #716, NeuroK Engineering OS  
**Method:** STORM-style optimistic read consistency, adapted to Git object hashes.

## Contract

An agent records the exact repository paths it relied on and the SHA-256 of each file as read from an immutable base commit. Before a patch is admitted, the verifier checks two independent facts:

1. The receipt digest really matches the file at its declared base SHA. A receipt with a forged or stale digest is invalid.
2. The file at the candidate's current SHA still matches that digest. Changed or deleted dependencies make the read-set stale.

Unrelated commits do not invalidate a task when every file in its read-set remains byte-identical. A changed or deleted dependency requires the agent to refresh its context and recapture the receipt.

## Usage

Capture dependencies from the exact task base:

    node tools/neurok-os-readset.mjs capture \
      --base "$(git rev-parse HEAD)" \
      --path runtime/neuro-kurisu/src/organism/core/OrganismCore.ts \
      --path runtime/neuro-kurisu/src/organism/memory/MemoryOS2.ts \
      --out .neurok-os/read-set.receipt.json

Before patch admission, compare against the candidate checkout:

    node tools/neurok-os-readset.mjs verify \
      --receipt .neurok-os/read-set.receipt.json \
      --current "$(git rev-parse HEAD)"

A non-zero exit code means the receipt is invalid or at least one dependency changed or disappeared. The verifier never modifies source files.

## Safety and limits

- Repository-relative paths only; traversal, .git, drive paths and control characters are refused.
- Full Git commit SHAs and SHA-256 digests are required.
- Receipt arrays are dense and bounded (1,000 files); per-file and aggregate byte limits prevent unbounded reads.
- Git object reads avoid following workspace symlinks.
- No third-party dependency or secret is introduced.
- The receipt proves correspondence to repository content, not that an agent actually read that content or that the author of a receipt is trusted. Authentication/signing and a mandatory patch-apply hook remain future work.
- This validator is an independently testable admission primitive. The existing local lease coordinator is still advisory; no claim is made that arbitrary filesystem writes are intercepted.

## Research decision

STORM's multi-agent collaboration work motivates validating writes against the versions of target files and context dependencies actually read by an agent. NK1 uses Git's immutable commit tree as the base of truth, with content hashes for the read-set and deterministic freshness checks. This is an adaptation, not a vendored implementation.

## Verification

The dedicated GitHub Actions workflow runs the isolated Node test suite and syntax check on the exact PR head.
