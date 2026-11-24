# NeuroK patch admission: fresh read-set + policy preflight

**Branch:** \`aspect/neurok-os-readset-admission-20261103\`  
**Parent:** \`aspect/neurok-engineering-os-20261103\`  
**Purpose:** reject patches that target files changed since the task agent's declared read context.

## Admission sequence

1. The task owner records a SHA-256 read-set from the exact immutable task base commit.
2. The patch is parsed as a bounded Git unified diff.
3. The read-set verifier validates the receipt against its base Git tree and checks that every declared file is byte-identical at the current candidate checkout.
4. Admission requires every pre-existing patch target (\`oldPath\`) to be present in the verified unchanged read-set. Newly added files have no pre-existing source path to read.
5. Only after freshness and coverage pass, the existing path policy classifies the patch as \`deny\`, \`human-approval-required\`, or \`reviewable\`.

Any invalid receipt, task-base mismatch, changed/deleted read dependency, or missing patch-target context returns \`blocked\`. Policy denial is never weakened by a fresh receipt.

## CLI

Capture the context against the exact task base:

    node tools/neurok-os-readset.mjs capture \
      --base "$TASK_BASE_SHA" \
      --path tools/neurok-os-patch.mjs \
      --path engineering-os/patch-policy.v1.json \
      --path runtime/neuro-kurisu/src/organism/core/OrganismCore.ts \
      --out .neurok-os/read-set.receipt.json

Generate a unified diff without applying it, then run preflight:

    node tools/neurok-os-patch.mjs admit \
      --patch-file .neurok-os/task.patch \
      --read-set .neurok-os/read-set.receipt.json \
      --base-sha "$TASK_BASE_SHA" \
      --current-sha "$(git rev-parse HEAD)"

Or use the package entrypoint:

    npm run neurok-os:admit -- --patch-file .neurok-os/task.patch \
      --read-set .neurok-os/read-set.receipt.json \
      --base-sha "$TASK_BASE_SHA"

The CLI defaults \`current-sha\` to the current repository HEAD. Receipt and patch files must resolve inside the repository; symlink-resolved paths outside the checkout are rejected.

## Decisions and exit status

| Decision | Meaning | CLI exit |
|---|---|---:|
| \`blocked\` | Invalid/stale read-set, base mismatch, or missing target context | 1 |
| \`deny\` | Existing patch policy explicitly forbids the changed path | 1 |
| \`human-approval-required\` | Fresh context but a protected path requires approval | 2 |
| \`reviewable\` | Fresh context and target coverage; ordinary independent review still required | 0 |

## Evidence and limits

- Receipt contents are SHA-256-bound to Git blobs at an immutable base commit.
- Unrelated commits are allowed if all declared dependencies remain byte-identical.
- Existing patch targets must be represented in the receipt; a patch cannot silently change a file it did not declare as read.
- The evaluator does not apply patches, execute code, mint approvals or replace independent review.
- A receipt proves content correspondence and declared path coverage, not that an agent semantically understood the file or that the receipt author is authentic.
- The current preflight is not yet a mandatory patch-application hook and does not intercept arbitrary filesystem writes. Signed agent identity, sandboxed apply/test, post-apply receipt verification and rollback are subsequent gates.
