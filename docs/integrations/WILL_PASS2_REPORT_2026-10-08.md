# Neuro-Kurisu SUPER × WILL — Pass 2 implementation report

Date: 2026-10-08
Build: v20-WILL-PASS2
Canonical runtime: Neuro-Kurisu 35.40.0 / schema 223

## Executive result

The dedicated WILL integration block defined in the previous Pass 1 is now **16/16 implemented**. Integration remains adapter-based: Neuro-Kurisu owns organism state, cognition, memory, identity and persistence; WILL contributes contracts and supporting mechanisms without creating a second brain or memory owner.

The pass also included a targeted code-level review of the active project itself, with ownership, architecture, integrity, source-truth and server-surface audits rerun after the changes.

## Completed 16/16 mechanisms

1. Agency / affordance competition adapter.
2. Decision → reafference/outcome feedback seam.
3. Portable competence artifact.
4. Compact Portable Mind Artifact (PMA).
5. PMA fingerprint validation.
6. PMA structural fidelity evaluation.
7. Known-entity dossier + aliases + relationship statistics.
8. Conversation aims / completion expectations.
9. Context-budget / lossless-cut accounting.
10. Deterministic vector retrieval adapter.
11. Deterministic HNSW-style multi-level graph backend.
12. Vector recall/reduction benchmark with explicit promotion gate.
13. External envelope / queue / pending / ACK / replay seam.
14. Tamper-evident hash-chain records with verification.
15. Provider/model completion attribution and persistent diagnostics.
16. Product surfaces: subject SDK, MCP-compatible JSON-RPC, and isolated external channel adapters.

## Project-level improvements performed in Pass 2

- WILL integration state ownership moved from direct `OrganismCore` construction into `OrganismSystemFabric`, reducing direct core constructors to the established target of five.
- ACK accounting was corrected so duplicate acknowledgements do not mutate the envelope counter.
- Replay anchors now retain the original event timestamp rather than injecting a fresh wall-clock time.
- PMA validation was simplified to an exact fingerprint recomputation with explicit schema/source checks.
- HNSW benchmark comparison counts now come from the actual deterministic search distance evaluations rather than a synthetic estimate.
- Server-side request protection includes bounded body parsing, rate limiting, LLM timeouts and malformed-payload handling.
- Server smoke now exercises WILL endpoint, SDK, MCP, integrity and malformed JSON paths.

## Verification evidence

`npm run typecheck` — PASS
`npm run test:will-integration` — 9/9 PASS
`npm run test:will-surfaces` — 3/3 PASS
`npm run test:server-smoke` — PASS
`npm run test:smoke` — PASS
`npm run audit:integrity` — PASS
`npm run audit:architecture` — PASS; cycles=0, legacyLeakage=0
`npm run audit:core-ownership` — PASS; directConstructors=5
`npm run audit:contract` — PASS
`npm run audit:hygiene` — PASS; errors=0, warnings=0
`npm run audit:source-truth` — PASS

## Release-gate limitation

The project is not marked 100% release-ready solely from these results. The historical release checklist still contains environment-dependent UI clean-build/browser E2E and long-running gates. The available Library `v20` item for 2026-10-08 is currently a checksum record rather than a source archive; therefore this pass uses the available full `Neuro_Kurisu_SUPER_FINAL_2026-10-06_UPDATED.zip` as the source baseline and documents the v20 checksum separately.

## Progress

- Dedicated WILL integration: **100% (16/16)**.
- Pass 2 code-quality/audit gates listed above: **100% of the gates executed in this environment passed**.
- Whole-project release readiness: **not 100% claimed** because the remaining historical UI/browser/clean-room gates require unavailable dependencies/environment.

## Additional core fixes found by the broader project sweep

The broader regression sweep exposed two existing integration/test seams and both were corrected: the live self-agency test now reaches the canonical authority through a read-only getter, and `FileStateStore` serializes concurrent saves so multiple runtime steps cannot overlap temporary-file commit sequences. The concurrency and P7 tests now await `runtime.stop()` before deleting their temporary state directories.

After these fixes: `test:concurrency` and `test:p7` pass, in addition to the WILL-specific and project-wide audit gates listed above.


## Final project sweep

Additional project-level regression hardening was completed after the original WILL block: 38 historical MJS tests with un-awaited runtime shutdown were corrected to await the async durability boundary; the resulting syntax audit is clean. The previously exposed concurrency and P7/P8 temporary-directory races now pass when tests correctly await shutdown. A release artifact provenance manifest and 2026-10-08 verification record are included in the tree.
