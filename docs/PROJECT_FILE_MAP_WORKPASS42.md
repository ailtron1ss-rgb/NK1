# Project file map — WorkPass42

This is the canonical map for future development. Do not infer ownership from file count or directory names alone; follow the owner contracts and source manifests.

## Root: source of truth and workflows

- `SUPER_VERSION.json`: current workpass, root version, runtime/schema identity, source baseline and release caveats.
- `package.json` / `package-lock.json`: root workflows and pinned tooling versions.
- `README.md`: setup, architecture and current cleanup instructions.
- `CHANGELOG.md`: latest implementation history; latest section first.
- `Список дел.md`: human-readable canonical current backlog with workpass history.
- `contracts/`: versioned schemas, inventory manifests, source provenance and ownership contracts.

## Runtime / app / research / Legacy

- `runtime/neuro-kurisu/`: sole writable organism runtime, memory/causal/action execution, API endpoints, runtime tests and canonical Live2D assets. Cognition/identity/memory should not acquire parallel writable owners in another folder.
- `app/`: React/Vite UI and service delivery shell. It reads the canonical runtime API. It owns only app-specific `app/public/live2d/viewer.html` and `vendor/` assets, plus sprites in `app/public/sprites`. The 21 model/motion/texture shadows are generated on demand from the runtime source before Vite dev/build.
- `research/`: controlled candidate implementations and source analysis. Research candidates do not auto-promote or dual-write canonical state.
- `legacy/kurisu-v9` / `legacy/kurisu-v56`: historical Kurisu source trees. Twenty-seven exact same-path source copies in v9 have been omitted because identical bytes remain in v56; `legacy/kurisu-v9/README_DEDUPLICATED_FILES.md` and the restoration manifest explain materialization.
- `legacy/snapshots/` and `legacy/input-archives/`: provenance-bearing older code and third-party snapshots. Never rewrite original archive member hashes to match modern active source.
- `legacy/input-archives/raw-source-archives/`: canonical full Lumina and Letta ZIPs. Historical alias paths are restored by the generic manifest if needed.

## Documents and restoration data

- `docs/PROJECT_CURRENT_STATUS_2026-10-14_WORKPASS42.{md,json}`: current checklist status/evidence.
- `docs/PROJECT_PROGRESS_SCORECARD_2026-10-14_WORKPASS42.json`: weighted roadmap; not a release approval.
- `docs/WORKPASS42_REPORT_2026-10-14.md`, `docs/WORKPASS42_TASKS_2026-10-14.md`, `docs/INTEGRATION_MATRIX_WORKPASS42_2026-10-14.md`: current pass artifacts.
- `docs/history/`: archived reports and prior pass artefacts. `docs/history/workpasses/RELOCATION_MANIFEST_WORKPASS42.json` records 68 content-unchanged moves.
- `docs/archive-optimization/`: hash-lock manifests, canonical path index, immutable old-version blobs and restoration instructions.
- `tools/`: repeatable checks, safe restoration, asset sync/clean and release metadata/SBOM workflows.

## Commands

```sh
npm run install:all
npm run audit:workpass42
npm run assets:sync        # before standalone Vite use
npm run assets:clean       # after build/test to keep source tree compact
npm run check:compacted-source-archives
npm run check:historical-snapshot
node tools/restore-historical-duplicate-paths.mjs   # hash-check only
npm run restore:historical-paths                     # restore 56 omitted paths
node tools/restore-legacy-deduplicated-files.mjs     # hash-check the 3,873-entry Legacy map
```

## Safe editing invariants

1. Canonical path changes must update the dependent manifests/contracts in the same pass.
2. Never delete a file because its name looks old; verify exact hashes and all path references first.
3. Historical snapshots point to immutable content-addressed blobs whenever active content evolves.
4. A “PASS” from static linkage or mocked tests is not a substitute for installed production build, real external receipts, or real browser E2E.
5. `assets:clean` and restore tools fail closed if bytes drift, symlinks appear, or a destination already contains different content.


## Immutable archive payloads

`docs/archive-optimization/source-archive-blobs/<sha256>` is also the shared immutable payload pool for historical snapshot entries whose bytes are exactly shared with an embedded source archive. Both snapshot and nested-source reconstruction follow explicit `blobPath` and verify SHA-256. Do not replace historical blobs with active source paths unless the expected hash matches byte-for-byte. Five duplicated payload copies are consolidated and documented in `shared-content-blob-dedup-workpass42.json`.
