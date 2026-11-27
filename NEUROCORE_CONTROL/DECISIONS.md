# Decisions

- **ADR-001 — Product branch:** all new work goes to `neurocore-unified/main`. It was seeded from `3526f618...`, synchronized through `3857e805...` by `e5fa0fbb...`, then through current source head `8994a103...` by `cb1c22e...`; no direct writes to upstream source branch or main.
- **ADR-002 — Canonical owners:** one OrganismCore and one MemoryOS2 authority. MemoryFabric coordinates writes and projections; no duplicate persistent memory.
- **ADR-003 — Runtime is the source of truth:** browser UI sends commands and renders snapshots. It does not run a shadow cognitive core.
- **ADR-004 — Compatibility migration:** keep `runtime/neuro-kurisu` and `app/src/neuro-kurisu` paths while moving the product identity to NeuroCore. Path renaming is deferred until all imports, scripts and tests can be migrated atomically.
- **ADR-005 — Embodiment:** a static image is not a body. VRM/GLB import support is useful but does not satisfy the full articulated-body requirement. The final system needs a skeleton, joint constraints, IK and motor controller.
- **ADR-006 — Evidence:** tests authored are not tests passed; CI attached to an earlier PR head is not a test of this branch; runtime/device readiness is not assumed.
- **ADR-007 — Legacy deduplication:** only delete repeated or archived content after path consumers and semantic ownership have been checked.
- **ADR-008 — Build artifact:** no small bootstrap ZIP will be presented as the application. A final package must contain the actual app/runtime source and assets and have a verifiable size/hash manifest.
