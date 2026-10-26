# WorkPass354 — enforce private, disjoint learning-process storage roots (2026-10-26)

- [SECURITY] The generic `LearningProcessSupervisor` now creates run/survive roots with owner-only permissions, validates existing directories instead of silently trusting their permissions, rejects final-component symlinks, and binds each inspected directory to its canonical filesystem identity.
- [BOUNDARY] Rejects equal/nested run and survive roots before filesystem allocation; after canonicalization it also rejects aliased roots sharing the same path or filesystem identity. The execution fingerprint now records canonical storage roots and their identities.
- [REPLACEMENT] On POSIX, a root's immediate parent must not be group/world writable unless the sticky bit protects directory entries. This prevents a private-looking child path from being trivially replaced by another account.
- [TEST] Added direct-supervisor regressions for writable run roots, overlapping storage roots and symlinked run roots. Invalid run-root setup is validated before the survive root is created.
- [VALIDATION] Code and regression commits are present on the WorkPass349 source branch; focused workflow and runtime typecheck are pending for this new pass. The WorkPass353 run (#40289015403) predates these code changes and does not validate them. No dependency added; this is not a sandbox or a production-readiness claim.

# WorkPass353 — canonicalize the mutable-state boundary for evaluator config (2026-10-26)

- [SECURITY] The independent evaluator-config loader now canonicalizes the configured mutable state directory before checking whether the executable host config lives inside it. A symlink alias can no longer make a file physically within mutable organism state appear external.
- [TEST] Added a POSIX regression for an evaluator module reached under the real state directory while the supplied state path is a symlink alias. The regression requires fail-closed rejection.
- [CI] Extended the focused WorkPass349 workflow to run `workpass330-production-revision-wiring.mjs` in addition to the signed-dataset, supervisor-cleanup and host-authority path suites, then runtime typecheck.
- [VALIDATION] Dedicated workflow run [#40289015403](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40289015403) passed on code SHA `6cd2776acc9094d73031c29a9f069687b97e05b9`: native P23 provider, supervisor cleanup, host-owned executable-path checks, evaluator-config identity/state-boundary suite, and runtime typecheck all succeeded. Later commits in the checkpoint block are documentation-only; no dependency added and no production-readiness or learning-uplift claim.

# WorkPass352 — protect host authority executable parent directories (2026-10-26)

- [SECURITY] Host-owned executor/verifier/safety-scanner configuration now checks the canonical executable's parent directory is a directory and not group/world writable on POSIX. A non-writable executable file alone is insufficient when the directory entry can be replaced.
- [SECURITY] The executable parent's filesystem identity (device/inode on POSIX, canonical path on Windows) is stored at preparation and revalidated immediately before each host authority dispatch. A replaced parent directory fails closed even if a new executable is placed at the old path.
- [TEST] Added regressions for a read-only executable inside a writable parent and for replacing the parent directory after service construction.
- [CI] WorkPass349 focused run #40285352614 passed on SHA `b9e0e90710e1380cac0ee57e1a0deaf74e214cf1`: native P23 provider suite 10/10, process-supervisor failure-cleanup regression, host-owned evaluator executable path/parent regressions, and runtime `TYPECHECK=PASS`.
- **Boundary:** host-owned path integrity is defense in depth, not an OS sandbox. Deployment must still provide genuinely isolated executor/verifier/scanner binaries.

