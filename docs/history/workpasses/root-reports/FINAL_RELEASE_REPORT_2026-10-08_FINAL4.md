# Neuro-Kurisu SUPER — FINAL4 release report

Date: 2026-10-08

## State

- Application: Neuro-Kurisu SUPER v20 line
- Runtime: Neuro-Kurisu 35.40.0
- Core: 100.32.0-r26-hierarchical-lowrank-causal
- State schema: 223
- Canonical writable owner: OrganismCore / OrganismSystemFabric
- External branches: WILL, Lumina, Hexis, Letta, Conscio 4.8.2 — all adapter/provenance-only, no parallel organism owner.

## Final integrated work

- WILL: agency/affordance, PMA/fidelity, competence, reafference, transport/replay, HNSW/vector seam, provider attribution, integrity chain.
- Lumina: capability policy, idempotency, local sandbox, SSRF-aware web safety, browser/tool/voice/channel patterns, exact search UX.
- Hexis: epistemic belief revision, temporal memory, learning review, deliberate retention, HMX staging/import, transactional outbox, connector policy, risk-aware execution.
- Letta: canonical/research/legacy/provenance source boundary, telemetry controls, generated-artifact review/promotion gate.
- Conscio: FTS5/BM25/trigram/RRF retrieval, quarantined skill federation, peer liaison/ACK/idempotency, calibration, evidence-required claims, metabolic advisory.
- UI: IntegrationConsole, HexisControlConsole, LettaGovernanceConsole, ConscioControlConsole and RuntimeAtlas expose the corresponding runtime surfaces.

## Tests and audits

PASS:
- Runtime TypeScript typecheck.
- Conscio adaptation + HTTP smoke.
- Conscio UI wiring 18/18.
- WILL integration 9/9 + surfaces 3/3.
- Lumina adaptation 3/3.
- Hexis adaptation and server smoke.
- Letta governance tests.
- Server input hardening.
- Server security smoke.
- Organism smoke.
- Restart persistence.
- Memory dedupe.
- Concurrency.
- Full server smoke.
- Function-reality critical path.
- Parameterized function probe: 1186 passed, 0 failed.
- Full project audit: 3922 files, errors 0, warnings 0.
- UI wiring: no missing server routes, no unused tracked methods.
- Architecture: sourceFiles 1806, canonicalFiles 561, missing 0, cycles 0, legacyLeakage 0.
- Core ownership: 5 direct constructors, 0 errors.
- Hygiene: 0 errors, 0 warnings.
- Forensics: duplicateContent 0, duplicateNames 0, staleMarkers 0.
- Syntax: JS 1266, SH 6, JSON 247, failures 0.
- Integrity, release contract and release source: PASS.
- Archive manifest: regenerated after final edits.
- Source archives: WILL/Lumina/Letta ZIPs and Conscio TAR validated as readable containers.

## Environment-limited items

- Full clean-room UI dependency install/Vite/browser E2E is still environment-dependent because the execution environment does not provide the required UI dependency tree/registry access.
- Long unrestricted soak remains outside sandbox limits.
- Semantic coverage of the historical source tree remains intentionally partial; unverified historical functions are not auto-promoted.

## Checklist snapshot

Current checklist counts after FINAL4 updates:
- DONE: 231
- PARTIAL: 115
- TODO: 41
- PASS marker: 1

Treating PASS as completed and PARTIAL as 0.5 gives ~74.6% weighted project-task completion. This is a project checklist metric, not a runtime correctness percentage.
