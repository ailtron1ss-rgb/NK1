# Hexis source provenance and licensing

Состояние на 2026-10-26. Документ разделяет upstream source, адаптированный код NK1 и будущие production dependencies.

## Зафиксированный upstream

- Upstream: [QuixiAI/Hexis](https://github.com/QuixiAI/Hexis)
- Pinned commit: `9e718951dc2a50dfcdc6f22513a1916315840132`
- Archive path: `legacy/input-archives/hexis-selected-2026-10-24/`
- Manifest: `legacy/input-archives/hexis-selected-2026-10-24/SOURCE_MANIFEST.md`
- Archive description from Operation Omega PR: 73 selected source files, with upstream blob SHAs and byte sizes in the manifest.
- License recorded in the integration PR: MIT. This record is not a substitute for checking the pinned commit's actual LICENSE/NOTICE files and verifying which license covers every redistributed file.
- Upstream Python/PostgreSQL source is reference-only; NK1 does not execute Hexis as a separate production service and no Hexis database migration is applied to NK1.

## Integration mapping

| Source family / concept | NK1 adaptation | Boundary |
|---|---|---|
| Belief state and evidence updates | `HexisAdaptationFabric.ts` projection + canonical MemoryOS2 evidence lineage | No second writable canonical memory store |
| Temporal memory | NK1 adapter valid-time assertions ordered by effective time | Late arrivals are handled in NK1 API; no wholesale migration |
| Outbox and tool delivery patterns | NK1 adapter idempotency journal + retention bounds | A retired key cannot silently enqueue another action |
| Learning reviews and skills | NK1 review inbox, Ed25519 reviewer-decision verification, signed promotion request | Separate propose/review/approve/activate; private keys remain outside runtime |
| Self-inspection / autonomous repair patterns | Existing NK1 P23 learning and evaluation pipeline | Candidate cannot skip independent validation and promotion gate |
| Source trust / provenance | P65EpistemicLedger and SourceMonitor | Evidence labels describe provenance; they do not themselves prove truth |
| HMX import/export patterns | Staging, protected-section conflicts, digest check and explicit decision | Imported state is staged, not automatically applied |

## Provenance for implementation changes

- Operation Omega source archive and review inbox work are summarized in [PR #201](https://github.com/ailtron1ss-rgb/NK1/pull/201).
- P65 record/restore stress test: `runtime/neuro-kurisu/tests/hexis-p65-pending-prediction-retention.mjs`.
- Hexis adapter regression suite: `runtime/neuro-kurisu/tests/integration/hexis-adaptation.mjs`.
- Evidence lineage regression: `runtime/neuro-kurisu/tests/integration/hexis-memory-evidence-lineage.mjs`.
- Authenticated review regression: `runtime/neuro-kurisu/tests/operation-omega-hexis-review-inbox.mjs`.
- Repository and script wiring audit: `.github/workflows/repository-wiring-audit.yml`.

## Reproducibility and future source imports

1. Never track the moving `main` branch as the sole upstream identity for imported code; record immutable commit SHA and manifest each time.
2. For each imported file, preserve original path, blob SHA, byte size, applicable license and local adaptation path.
3. Do not mark a source feature “integrated” when it is only present in the reference archive. Require a live NK1 call path, a regression test and evidence that the call site is reachable.
4. Do not add a second database or copy all Hexis data into another memory owner without a migration plan, baseline benchmark, rollback and provenance-preserving reconciliation.
5. Refresh Release ZIP separately after source integration is accepted and validated; verify checksum and exact included commit. No Release asset update is asserted by this document.

## Outstanding review

- Verify LICENSE and NOTICE in the exact pinned upstream archive and all included files.
- Review third-party licenses for any newly added dependency or copied code before redistribution.
- Confirm Release asset contents after a separate packaging/upload operation.
- Do not treat selected source archive size or file count as evidence of functional completeness.
