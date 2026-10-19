# WorkPass 30 — completed work and remaining tasks

## Completed in this pass

- [x] Embed source-level evidence provenance into the single canonical MemoryOS2 record (max 8 visible independent lineages).
- [x] Retain a bounded replay guard of up to 32 lineage keys so a trimmed old source cannot become a fresh vote when replayed.
- [x] Pass EvidenceFirewall/ProjectResearchSession `sourceLineageKey` through the real Core research ingestion path; do not equate every hostname with an independent source.
- [x] Merge a genuinely independent source into the existing canonical memory; keep syndicated copies and replayed inputs as one vote.
- [x] Ensure repeated lineage ingestion does not increase confidence; external content remains capped and hypothesis-only.
- [x] Include evidence provenance in persistence, restore normalization, memory byte estimates, stats and inspector responses.
- [x] Cover Core → MemoryOS2 integration, mirrors, independent sources, snapshot/restore, replay guard, byte estimates and Runtime Atlas projection with an executable regression.
- [x] Update root/runtime versions, lockfile, release ownership/integration contracts, changelog, canonical backlog and normalized task inventory.
- [x] Preserve Legacy/UI/Live2D paths as source archive members and validate static route/assets linkage.

## Still open

- [ ] Freeze an independent human-labelled temporal holdout; evaluate Recall@k, MRR, latency and false recall against BM25. Do not promote ranking changes based on the current synthetic fixture.
- [ ] Run a dependency-complete React/Vite production build and desktop/mobile browser E2E including actual Live2D interactions.
- [ ] Run the immutable pinned NLI model with real weights on a labelled adversarial holdout; keep calibration split separate from final evaluation.
- [ ] Verify a real external provider research path on multiple allowlisted HTTPS hosts and persist the real source receipt.
- [ ] Run clean-room backup/restore/schema migration/rollback and multi-hour memory/resource soak.
- [ ] Complete SBOM/license/provenance review and final release-candidate sign-off.

**State:** WorkPass30 is a provenance-integration milestone, not a release certification.
