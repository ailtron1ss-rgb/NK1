# Archive optimization and restoration

WorkPass42 is a source-first cleanup of the WorkPass41 baseline. It removes path-level copies only where the exact byte stream is retained elsewhere and the omitted path is indexed for restoration. Path semantics that matter for migrations, licenses, package markers, independent fixtures, and version-specific evidence are preserved.

## Canonical owners

- **Runtime and canonical Live2D assets:** `runtime/neuro-kurisu/`
- **Application/UI:** `app/`; its 21 byte-identical `app/public/live2d` shadow files are materialized only before Vite dev/build. The app-specific `viewer.html` and `vendor/` files remain app-owned.
- **Legacy sources:** `legacy/`; compacted bytes and original path restoration are described by hash-checked manifests. Kurisu v9/v56 shared source copies are represented by canonical files in v56 plus path restoration entries.
- **Historical documents and reports:** `docs/history/`; current navigation and current pass documents stay in `docs/`.
- **Archive manifests and content-addressed old bytes:** `docs/archive-optimization/`.

## Hash-locked duplicate path restoration

`historical-duplicate-paths-workpass42.json` describes 56 omitted exact path copies: 27 history reports, 27 same-relative-path source files shared between Kurisu v9/v56, and two aliases of retained Lumina/Letta raw-source ZIPs. Their byte streams remain at exact-hash canonical paths.

- Verify restore sources without writing: `node tools/restore-historical-duplicate-paths.mjs`
- Restore omitted paths: `npm run restore:historical-paths`
- Legacy's earlier 3,873-entry compacted path set: `node tools/restore-legacy-deduplicated-files.mjs` (check) or `npm run restore:legacy-deduplicated` (restore).

Restore commands are idempotent and refuse to overwrite differing files or follow symlink paths. A restoration produces the full physical layout; the compact source package intentionally does not carry byte-identical duplicate copies twice.

## Live2D public shadows

`contracts/inventory/canonical-public-assets-workpass42.json` pins every shadow by size and SHA-256.

- Generate only missing exact shadows before Vite dev/build: `npm run assets:sync`
- Remove only generated shadows that still match the canonical hash: `npm run assets:clean`
- Test hydration/conflict/drift/symlink and cleaning behavior: `npm run test:canonical-public-assets`

The cleanup command refuses to delete a modified shadow; it preserves app-specific viewer/vendor assets. `tools/audit-assets.mjs` checks canonical model references and permits omitted shadows because `app/scripts/with-app-env.mjs` hydrates them before starting Vite.

## Compacted source ZIPs

Four source archive manifests keep all member bytes, sizes and SHA-256 values. Repeated contents reference verified canonical files; evolved or historical bytes live under `source-archive-blobs/`. The **8,512/8,512** member checks pass.

- `npm run check:compacted-source-archives`
- Rebuild one ZIP: `python3 tools/restore-compacted-source-archives.py --archive <archive-basename.zip>`
- Rebuild all compacted source ZIPs: `python3 tools/restore-compacted-source-archives.py`

Rebuilt ZIP container bytes can differ due to compression and central-directory order; every restored member's byte stream is verified.

## Historical 2026-10-06 snapshot

`historical-snapshot-2026-10-06.manifest.json` preserves all **10,427** path records. It now uses eight immutable blobs for ten old file versions that no longer match evolved active files. The snapshot passes **10,427/10,427** source checks.

- Verify all sources: `npm run check:historical-snapshot`
- Rebuild a snapshot archive: `npm run restore:historical-snapshot -- --output <path.zip>`

The original WorkPass34 ZIP remains the full immutable baseline; reconstructed historical ZIPs preserve member bytes but not necessarily original container compression bytes.

## Why some identical files remain

Byte equality alone does not prove a path is dispensable. Repeated LICENSE/NOTICE files remain alongside independently licensed subprojects; identical SQL content at bootstrap and versioned migration paths remains at both entry points; repeated `__init__.py` files are package markers; similarly named test fixtures and version-specific evidence retain their names and archive provenance. WorkPass42 removes only the duplicates that are safe to materialize without changing these roles.

### Shared immutable content blobs (WorkPass42)

When the same historical preimage is needed by both an embedded source archive and the 2026-10-06 snapshot, both manifests may point to the same file under `source-archive-blobs/<sha256>`. WorkPass42 removed five extra snapshot copies (31,893 raw bytes) only after SHA-256 and byte equality checks. The blob remains immutable; restore tools follow the manifest `blobPath` and verify its hash. `shared-content-blob-dedup-workpass42.json` records the consolidation.

The final hash scan has 18 exact-content groups / 39 extra paths (91,244 raw bytes). They are intentionally retained because paths encode distinct runtime roles or provenance: bootstrap and versioned SQL migrations, per-package LICENSE/SOURCE notices, named test fixtures, version-specific evidence, and Python package markers. This is not an excuse for unexplained file loss: every path omitted by WorkPass42 is represented by a relocation, exact-duplicate, or generated-asset manifest.
