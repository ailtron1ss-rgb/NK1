# WorkPass352 — protect host authority executable parent directories (2026-10-26)

- [SECURITY] Host-owned executor/verifier/safety-scanner configuration now checks the canonical executable's parent directory is a directory and not group/world writable on POSIX. A non-writable executable file alone is insufficient when the directory entry can be replaced.
- [SECURITY] The executable parent's filesystem identity (device/inode on POSIX, canonical path on Windows) is stored at preparation and revalidated immediately before each host authority dispatch. A replaced parent directory fails closed even if a new executable is placed at the old path.
- [TEST] Added regressions for a read-only executable inside a writable parent and for replacing the parent directory after service construction.
- [CI] WorkPass349 focused run #40285352614 passed on SHA `b9e0e90710e1380cac0ee57e1a0deaf74e214cf1`: native P23 provider suite 10/10, process-supervisor failure-cleanup regression, host-owned evaluator executable path/parent regressions, and runtime `TYPECHECK=PASS`.
- **Boundary:** host-owned path integrity is defense in depth, not an OS sandbox. Deployment must still provide genuinely isolated executor/verifier/scanner binaries.

