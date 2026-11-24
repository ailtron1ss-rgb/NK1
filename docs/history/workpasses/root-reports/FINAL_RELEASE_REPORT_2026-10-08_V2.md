# Neuro-Kurisu SUPER — Final Hardening Report v2

Date: 2026-10-08

## Release identity

- SUPER release: `20.0.0-super-final`
- Canonical organism runtime: Neuro-Kurisu `35.40.0`
- Runtime core: `100.32.0-r26-hierarchical-lowrank-causal`
- State schema: `223`
- Integrated source branches: WILL + Lumina + Hexis (canonical adapter mode)

## Work completed in the final pass

1. HTTP input hardening: byte-based request limit, correct `413 request-too-large`, correct malformed JSON `400`, stronger static path confinement.
2. Runtime Atlas: principal read-only runtime surfaces exposed directly through the active UI.
3. UI wiring audit extended to dynamic Runtime Atlas client methods.
4. Generated Python bytecode removed from shipped provenance tree.
5. Node/npm and Python pins added, root package manager/engine constraints aligned.
6. One-command install, backup, restore, migration, doctor, schema check and release verification tooling added.
7. Version/config migration helpers added with secret-safe config handling.
8. SBOM generated from the locked application dependency graph.
9. Production configuration freeze and operational alert thresholds added.
10. Supervisor shutdown/error handling hardened.
11. Persistence concurrency, restart, crash-injection and corruption-recovery tests re-run successfully.
12. R22/R23/R26 targeted neural, world, memory, epistemic and runtime-claim regression suites re-run successfully.
13. Rollback patch generated against the previous FINAL archive.
14. Release manifests regenerated after the final source changes.

## Validation evidence

- Server input hardening: PASS
- WILL integration: 9/9 PASS
- WILL surfaces: 3/3 PASS
- Lumina adaptation: 3/3 PASS
- Hexis adaptation: PASS
- Hexis server smoke: PASS
- UI/function wiring: PASS; integration surface + Runtime Atlas covered
- Architecture: PASS
- Core ownership: PASS; 5 direct constructors
- Source hygiene: PASS; 0 errors, 0 warnings
- Forensics: PASS; no duplicate content/names/stale markers
- Syntax: PASS
- Integrity: PASS
- Release contract: PASS
- Release source: PASS
- Archive manifest: PASS; no missing, mismatched or extra files after final regeneration
- Concurrency: PASS
- Persistence restore: PASS
- Crash recovery matrix: PASS
- R22/R23/R26 targeted regression tests used in this pass: all PASS

## Environment-limited gates

- Full runtime TypeScript `tsc` is not verified in this sandbox because the process exceeds the execution limit without diagnostic output. Changed-file transpile/syntax checks pass.
- Full application clean-room install/build/browser E2E is not verified. `npm ci` timed out and the offline cache does not contain all package metadata.
- Long-duration unrestricted soak is not claimed as complete.

These are explicitly retained as limitations; they are not marked as successful tests.

## Final archive artifact

- Archive: `Neuro_Kurisu_SUPER_WILL_LUMINA_HEXIS_FINAL2_v20_2026-10-08.zip`
- ZIP integrity: PASS at packaging time
- Runtime archive manifest: 4,161 files, missing 0, mismatches 0, extra 0
- The authoritative SHA-256 is recorded in the adjacent `.sha256` artifact to avoid self-referential metadata.
