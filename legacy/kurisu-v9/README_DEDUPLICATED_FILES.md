# Kurisu v9 — shared-file materialization

WorkPass42 omits 27 files that were proven byte-identical, at the same relative path, to files in the retained `legacy/kurisu-v56` source tree. Their exact SHA-256 and sizes are recorded in `docs/archive-optimization/historical-duplicate-paths-workpass42.json`; the source-archive manifests were redirected only after verifying the canonical bytes.

To restore the full physical v9 tree, run from the repository root:

```sh
node tools/restore-historical-duplicate-paths.mjs --restore
```

The tool refuses to overwrite changed targets, follows no symlinks, verifies each canonical file before copying, and is idempotent. The v9 branch's unique files and all version-specific evidence remain in place.
