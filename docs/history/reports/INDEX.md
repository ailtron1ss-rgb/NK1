# Historical reports archive

This directory preserves old status and release reports that are no longer authoritative for the current runtime, without discarding their original content.

## Archived records

- [Final internal status — 2026-10-06](FINAL-STATUS-2026-10-06.md) — preserved from `docs/FINAL-STATUS-2026-10-06.md`. It describes Neuro-Kurisu 35.40.0 / schema 223 and the 2026-10-06 state, so it must not be read as current status. The file was copied byte-for-byte and its original path was removed only after the archived copy was verified.
- [Archive manifest](archive-manifest.json) — records original path, archive path, SHA-256, Git blob identity, reason and move commits.

## Safe-move rule

A file may be moved here only after checking inbound Markdown links, text references from source/config/manifest files, and available GitHub issue/PR references. A zero-reference scan is not proof that no external consumer exists. Archive the exact contents; do not rewrite old reports to make them look current.
