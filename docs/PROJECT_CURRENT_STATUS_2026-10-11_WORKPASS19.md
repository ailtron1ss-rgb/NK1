# Neuro-Kurisu — WorkPass 19 implementation status (2026-10-11)

## What changed in code

- `ExternalProjectResearchTool.ts`: derives publisher-family keys from the actual serving host; common multi-label public suffixes and multi-tenant hosting domains are grouped conservatively. This is dependency-free and intentionally not represented as a complete Public Suffix List.
- `ProjectResearchSession.ts`: derives source identity from the actual URL instead of trusting caller-supplied independence labels, applies the same normalization to legacy restored records, retains bounded URL/title/snippet/content-type/hash/query/time provenance, and passes a document identity into the firewall.
- `OrganismCore.ts`: integrates diversified research excerpts into the **existing canonical MemoryOS2** rather than creating a parallel memory implementation. Single-source snippets remain in the bounded research session; after publisher+content diversity, eligible records become `hypothesis` notes only, with confidence capped at 0.54, visible source provenance, and no automatic conversion to facts. A contest/rejection quarantines previously recallable notes.
- `EvidenceFirewall.ts`: detects same-document content changes as conflicts while keeping multiple pages from one publisher from becoming a false contradiction. Publisher identity still counts only once. Legacy observations without document identity retain conservative behavior.
- `StateMigrations.ts`: normalizes and bounds old/new research session/firewall records and persists explicit firewall status, diversity counts and document identity.
- `ExternalProjectResearchTool.ts` / package manifests / `SUPER_VERSION.json`: runtime lineage is now 35.41.0 / super-final5 with WorkPass19 metadata.
- The release metadata contract now uses the actual `SUPER_VERSION.date` to find current status files, instead of a hard-coded historical date.

## Implementation evidence

- `npm --prefix runtime/neuro-kurisu run typecheck` — PASS, semantic TypeScript compiler mode.
- `node --experimental-strip-types runtime/neuro-kurisu/tests/big-pass-180-external-research-transport.mjs` — PASS, 14 scenarios including publisher identity grouping, DNS pinning, redirect policy, bounds, query/relevance gate and cache behavior.
- `node --experimental-strip-types runtime/neuro-kurisu/tests/big-pass-179-project-research-gates.mjs` — PASS, including real Core integration: one source does not enter canonical recall; a second independent publisher and page hash produces two hypothesis notes; conflicting same-publisher material quarantines them; notes and contested state survive restart.
- Root `npm run audit:workpass19` — PASS: release metadata 34/34, app source-script tests 212/212, browser-smoke verdict/report contracts, runtime research/persistence/project gates, server imports, UI/API linkage and asset audit all completed successfully.
- Additional `node tools/verify-integration.mjs`: runtime UI snapshot reports `35.41.0`, chat and research bridge probes pass; overall integration status is environment-blocked because app typecheck cannot find `vite/client`. This does not count as a successful React/Vite production build.

## Boundaries not to misrepresent

- Source diversity is not a semantic proof that excerpts support a claim. Retrieved material remains a hypothesis; a claim-specific support/refute/unknown verifier and adversarial labelled corpus are still TODO.
- The current publisher suffix table is conservative but not a full Public Suffix List.
- Live research against real external providers could not be established in this implementation environment. React/Vite dependency-complete production build, actual browser/Live2D E2E, clean-room upgrade/rollback and soak testing remain open.
- WorkPass18's 69.25% score was an internal weighted roadmap estimate, not release readiness. After this pass, the modest re-estimate is **69.90% implementation roadmap progress**; release readiness remains blocked and is separately estimated at **3.2/10**.

## Next useful passes

1. **WorkPass20 — claim support, contradiction and unknown:** split the query into explicit claims and evaluate each source excerpt against the claim, with a visible reasoned result and calibrated confidence; lexical overlap and source count must not satisfy this gate.
2. **WorkPass21 — memory quality:** evaluate temporal/update/contradiction behavior on LongMemEval-V2 plus a fixed project-specific holdout, compare against existing MemoryOS2 retrieval and simple BM25 baseline, and retain only changes that demonstrate uplift.
3. **WorkPass22 — release-critical path:** dependency-complete build, one browser flow through research→memory→conflict handling, then recovery/rollback/soak; keep these focused on closing release blockers, not expanding the audit surface.
