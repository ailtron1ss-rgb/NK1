# Historical audit note — inherited 33.0.0 snapshot

The inherited `RELEASE_ARCHIVE_MANIFEST.json` expects two files that are not present in the current project surface:

- `.github/workflows/build-dist.yml`
- `.gitignore`

`npm run audit:legacy` therefore returns `ok:false` with exactly these two historical omissions and no hash mismatches/extra files.

This is intentionally NOT treated as a current-runtime failure: the old manifest is evidence for the 33.0.0 archive, while the current release manifest is regenerated from `VERSION.json`.
