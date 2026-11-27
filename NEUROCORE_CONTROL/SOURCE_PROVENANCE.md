# Source provenance

## Seed baseline

- Repository: `github.com/ailtron1ss-rgb/NK1`
- Original source branch: `workpass70-source`
- Seed commit: `3526f61814e19f1f10766f3b2385488eb04e3d2e`
- Seed root Git tree SHA: `7dce12c3a08f5ef26b6c0d1b7e0b0353c13af186`
- Seed tracked blobs: 10,738
- Seed tracked blob bytes: 293,126,769 (279.55 MiB)
- Seed tree query was complete (`truncated=false`).

## Current source synchronization

- Previous source head incorporated: `workpass70-source@3857e805b8224e7630ba1c7ef50e4bc930565b58` (tree `12b4b986310f3a52b3153e85ef988133b7b121fd`)
- Current source head incorporated: `workpass70-source@8994a103f6b735f6347d77d926ee9c024a4d4f4d`
- Current source head tree SHA: `850d417028657861168ad1508b6a446fb3054dd5`
- Product branch: `neurocore-unified/main`
- First two-parent synchronization: `e5fa0fbb41ed7190289e180c8e4eeaa743141169` (product `da115797...` + source `3857e805b8224e7630ba1c7ef50e4bc930565b58`)
- Latest two-parent synchronization: `cb1c22e3c6c7f4eba73ad00b213442cee71c65d2` (product `59b246e8201ec7fd94958af685536f624ccdc739` + source `8994a103f6b735f6347d77d926ee9c024a4d4f4d`)
- Latest source update contains six donor-integration files: OpenClaw skill review import, schema-constrained llama.cpp output, two new contracts, donor review and focused workflow.
- Git compare before the last source update showed the product branch ahead by 129 and behind by zero. The latest two-parent merge preserves source ancestry; recheck live compare before any future merge.
- The product branch retains its NeuroCore integration history. No direct write was made to `main` or `workpass70-source`.

The seed inventory counts above describe the original seed tree; they are not claimed as a re-count of the post-sync tree.

## Major top-level source volumes at seed

| Directory | Files | Bytes |
|---|---:|---:|
| runtime | 4,952 | 82,101,052 |
| legacy | 3,443 | 149,866,575 |
| docs | 842 | 38,767,684 |
| app | 383 | 15,582,281 |
| research | 808 | 4,069,864 |
| .github | 151 | 409,685 |
| tools | 73 | 463,789 |

## Important distinctions

- The seed tree includes active runtime, app, tests, assets, documentation, research and historic archives. It is not all runtime.
- The largest legacy input archive alone is ~54.3 MiB. Historical snapshots and archived donor projects are not to be imported into active runtime without dependency review.
- 93 groups of blob-identical paths were detected in the seed (209 file entries, about 3.2 MiB repeated bytes). Identical contents do not prove interchangeable ownership. No duplicate paths were removed by this pass.
- The latest stable release ZIP was published before the seed source commit and is not treated as equivalent to a source snapshot. Source/release byte parity is not claimed.
- Root `main` is not the direct integration base; the product branch tracks a separate product history and merges updates from `workpass70-source`.

## Commit trail

The product branch starts at the seed baseline and contains the product integration history plus explicit source synchronization merges. Subsequent work uses the `[NK1][этап]` message convention. The source branch and `main` remain unchanged.


## Latest cognitive source synchronization — 2026-11-27

- Source advanced from `8994a103f6b735f6347d77d926ee9c024a4d4f4d` to `9de695dd4713ec909d7312b45966d30dfb76d5c2` (four commits).
- Source tree SHA: `4c74c37aec7dc38eb6cb7cd176364ca2eaf436c7`.
- Product tree before merge: `c9faa8767e3008beb56c22bcf4f347aafb68e806`.
- Product/source merge tree: `8462456934b459ed22e06aca7d55eb9b97dec520`.
- Two-parent merge: `53a5926f753c56b97599b1ee28a0e46d769662b2`.
- Parents: product `24416f34d74be0193534aa3b608d36e712ea6bfc`; source `9de695dd4713ec909d7312b45966d30dfb76d5c2`.
- 45 source-changed paths were applied. Only `runtime/neuro-kurisu/package.json` and `runtime/neuro-kurisu/src/organism/core/OrganismRuntime.ts` differed from the source base on the product side. Package scripts were unioned; the source runtime file received the product's durable shutdown region while retaining all other source-side cognition updates.
- Follow-up health-contract regression correction: `4dfc60c4d1079bc694f3bc0043bced6c59bad564`.
- Current PR #1221 is 174 commits ahead of source and 0 behind; no direct update to source branch or root `main`.


## Recovery watchdog correction — 2026-11-27

- Source advanced from `9de695dd4713ec909d7312b45966d30dfb76d5c2` to `99859cc488efa342ccba1cc74aecb4d2ffdaceb1` with three commits.
- Source head tree SHA: `1184bdf1d976685dc943d8ee23c74312928755b6`.
- Changed paths: `runtime/neuro-kurisu/src/organism/persistence/RecoveryWatchdog.ts` and `runtime/neuro-kurisu/tests/recovery-watchdog-durable-commit-20261127.mjs`.
- No product-file conflicts; both blobs were overlaid on product tree from `d0b5d0b63b2144651ab4a71df74920780354bce0`.
- Two-parent sync commit: `ae26fb8d1bae5dfc1acc985710ec7251ac433d3a`, parents product `d0b5d0b63b2144651ab4a71df74920780354bce0` and source `99859cc488efa342ccba1cc74aecb4d2ffdaceb1`.
- Exact source/product compare after merge: ahead 181, behind 0. No writes to `main` or `workpass70-source`.
