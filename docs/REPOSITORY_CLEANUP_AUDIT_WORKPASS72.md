# Repository cleanup audit — WorkPass72

**Snapshot:** `f7d579c55f4f044dca9abd4ca8203911d826ed9b`  
**Scope:** byte-exact Git blobs in the recursive tracked tree.  
**Decision:** audit-only. No files deleted or moved.

## Findings

| Metric | Observed |
|---|---:|
| Tracked files | 9,352 |
| Markdown files | 2,890 |
| Exact duplicate-content groups | 39 |
| Files participating in those groups | 99 |
| Excess copies above one per group | 60 |
| Exact duplicate Markdown groups | 0 |
| Theoretical excess-copy bytes | 16,781,907 bytes |
| Removed or moved | **0** |

Theoretical bytes are a **ceiling inside this Git tree**, not a promised disk reduction: paths can be required by separate static roots, upstream archives, package imports, tests, manifests or legal/provenance contracts. Git history retains old blobs too.

## Priority for the next audit

21 exact groups mirror model files between `app/public/live2d/` and `runtime/neuro-kurisu/public/live2d/`. This warrants a targeted static-mount/build audit, but not blind removal. Same files may be needed at both serving roots.

Repeated skill `LICENSE` and `SOURCE.md` notices stay with each skill. Empty package markers and fixtures are preserved. Duplicated SQL/migration, release manifests, evidence and legacy snapshot files remain intact as historical source provenance.

## Cleanup protocol

1. Pick a small candidate group from the manifest.
2. Search source imports, package scripts, workflow references, static asset URLs/mounts, Markdown links, manifests, hash locks and release assembly.
3. Classify each occurrence as runtime-required, build-required, test-required, legal/provenance, or truly unreferenced.
4. Prefer a reversible archive move with updated references over deletion; never deduplicate legal notices or source history.
5. Run focused tests, typecheck, package/bundle checks and CI, then regenerate this inventory.

Full exact paths, blob SHAs, sizes and per-group disposition: [machine-readable manifest](REPOSITORY_CLEANUP_AUDIT_WORKPASS72.json).
