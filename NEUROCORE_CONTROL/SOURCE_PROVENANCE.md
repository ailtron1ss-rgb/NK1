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

- Current source head incorporated: `workpass70-source@3857e805b8224e7630ba1c7ef50e4bc930565b58`
- Source head tree SHA: `12b4b986310f3a52b3153e85ef988133b7b121fd`
- Product branch: `neurocore-unified/main`
- Two-parent synchronization commit: `e5fa0fbb41ed7190289e180c8e4eeaa743141169`
- Merge parents: previous NeuroCore product head `da115797bc1d7feb9bd7acb4db0dce1fa5687a26` and current source head `3857e805b8224e7630ba1c7ef50e4bc930565b58`.
- Git compare confirms the product branch is ahead of `workpass70-source` and behind by zero commits after synchronization.
- The product branch retains its own source history and the 27 product changes. No direct write was made to `main` or `workpass70-source`.

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
