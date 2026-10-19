# Repository cleanup audit — WorkPass72

**Baseline commit:** `585c3d1c66ad452c9684b7969bcbaba9006f60f7`  
**Scope:** exact Git blob duplicates; only manifest-proven generated Live2D shadows were removed.

| Metric | Before | After projected removal |
|---|---:|---:|
| Tracked files | 9,354 | 9,333 |
| Markdown files | 2,891 | 2,891 |
| Exact duplicate SHA groups | 39 | 18 |
| Excess copies above one per group | 60 | 39 |
| Tracked app Live2D shadows | 21 | 0 |
| Duplicate payload removed from tracked tree | — | 16,690,663 bytes (15.92 MiB) |

## Why this deletion is safe

All 21 `app/public/live2d/**` targets matched runtime-owned twins by Git blob SHA and recorded size in `contracts/inventory/canonical-public-assets-workpass42.json`. `app/scripts/with-app-env.mjs` invokes `hydrateCanonicalPublicAssets` before Vite dev/build/preview, where SHA-256 and size are revalidated. Root `.gitignore` already excludes each generated target. The canonical owner remains `runtime/neuro-kurisu/public/live2d/`. App-specific viewer/vendor files and sprites were not touched.

This reduces duplicate payload in the tracked checkout, not Git history size. 18 exact-content groups remain (39 excess paths); they are primarily license/source notices, empty package markers, archived upstream SQL and historical evidence, which remain protected from blind deletion.

The CI workflow now runs `node tools/audit-assets.mjs` before app tests/build. Machine-readable path, SHA and disposition inventory: [cleanup JSON](REPOSITORY_CLEANUP_AUDIT_WORKPASS72.json).