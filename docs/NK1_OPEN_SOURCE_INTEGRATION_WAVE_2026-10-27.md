# NK1 Open-Source Integration Wave — 2026-10-27

## Target architecture

NK1 retains one canonical memory owner: **MemoryOS2 through MemoryFabric**. External projects contribute narrowly scoped capabilities through adapters/contracts; they do not introduce competing identity, memory truth, or automatic learning authority.

## Evidence ledger for this pass

- [x] Created a dedicated integration branch from the Hexis canonical-apply branch, not from the release/report branch.
- [x] Selectively ported `Mem0PlatformAdapter` and its dedicated export from `work/mem0-canonical-adapter-2026-10-27`; did not merge the diverged branch.
- [x] Kept Mem0 disabled unless explicitly configured, and added a separate `mem0CognitiveRecall` runtime opt-in.
- [x] Wired bounded remote recall into both normal and autonomous language prompts as low-priority, non-recallable, untrusted data.
- [x] Kept remote memory writes/deletes disabled by default and gated separately from search.
- [x] Ported adapter safety tests and the explicit opt-in, read-only live-contract check.
- [x] Added self-hosted Mem0 OSS REST mode with native endpoint/auth mapping and a separate loopback-HTTP/security contract test.
- [x] Wired the server composition root from environment-gated adapter configuration into `OrganismRuntime`.
- [x] Added authenticated read-only server diagnostics/search routes; the HTTP smoke verifies missing-token denial, no API-key disclosure, canonical MemoryOS2 precedence, and disabled local-first fallback.
- [x] Added a static runtime-wiring contract and an integration CI workflow.
- [x] Registered test commands and documented limitations in the runtime package and `CHANGELOG.md`.
- [x] Exported the canonical MemoryOS2 retrieval-label fingerprint and added a CLI that emits both canonical `contentSha256` and exact-source `rawSourceSha256`.
- [x] Added an opt-in GEPA/DSPy sidecar adapter to the existing P23 generator callback, retaining the local model as the default and keeping independent evaluation/signed approval under P23.
- [x] Integrated the native signed-outcome P23 provider with the independent host-evaluator config loader; the wrapper evaluates canonical baseline, source candidate and generated revision through three distinct host-owned methods, with store/dataset lineage rechecked across async boundaries.
- [x] Native signed-provider integration closure passed [workflow 40634609071](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40634609071): typecheck, provider 8/8, host config 13/13, native wiring 2/2, three-arm evaluator 1/1, GEPA 11/11, Hexis/retrieval/Mem0/HTTP closure. No live external provider was contacted; retrieval remains `promotion: not-promoted`.
- [x] Added request privacy/holdout identifier checks, network/payload bounds, a mocked adapter suite and server wiring regression.
- [x] GEPA adapter and current integration closure passed [workflow 40632954283](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40632954283) on code HEAD `85932372417ac26f0624dfcb7e162303d43beb8a`: Node 24/server syntax, typecheck, GEPA **11/11** including real loopback HTTP through the P23 callback, Hexis lineage/ingest/server smoke, dataset fingerprint, retrieval experiment, Mem0 Platform **15/15**, OSS **2/2**, runtime wiring, and authenticated HTTP fake-provider smoke. No external GEPA sidecar or live Mem0 provider was called.
- [x] Hardened the benchmark CLI to reject invalid UTF-8 and a mismatched supplied raw-source hash before output publication; added tests and linked them into the integration closure.
- [x] Execute integration closure on the current tested PR merge ref via [Mem0 workflow run 40532574354](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40532574354): runtime typecheck, Hexis evidence lineage and reviewed ingest, Hexis server smoke, deterministic retrieval experiment, 15/15 Platform-adapter tests, 2/2 OSS tests, runtime-wiring contract, and authenticated HTTP/fake-provider smoke all passed. This did not make a live Mem0 provider call; see the remaining gate below.
- [x] Provenance/fingerprint follow-up passed in [Mem0 integration workflow 40631987375](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40631987375): typecheck, Hexis lineage/ingest, Hexis server smoke, canonical/raw dataset fingerprint regressions, retrieval experiment, Mem0 Platform 15/15, OSS 2/2, runtime wiring, and authenticated HTTP fake-provider smoke.
- [ ] Run an opted-in live Mem0 contract check against a dedicated test-only user scope. It is intentionally skipped without explicit operator credentials/flags.
- [ ] Demonstrate a positive, independently sourced retrieval uplift on immutable RU/EN holdout data across paired model/training seeds.
- [ ] Run the production UI/build/migration, browser/Live2D, real Android/Termux audio, soak, SBOM and license gates.
- [ ] Publish a refreshed Release ZIP from the validated source head. No release artifact is modified by this pass.

## Integration boundaries

### Hexis

The current target line already contains Hexis HMX staging/review, canonical memory projection, evidence lineage, source identity/replay protections, and rollback paths. Mem0 does not bypass these capabilities. A Mem0 result enters language context as an external clue only; it is not canonical evidence and cannot change a belief by itself.

### Mem0

The adapter supports two distinct API dialects: hosted Platform and self-hosted OSS REST. OSS uses `/search`, `/memories`, and `X-API-Key`; Platform uses its versioned endpoints and token authorization. The OSS HTTP default is loopback-only; non-loopback cleartext requires an extra explicit opt-in. Self-hosting does not imply the OSS stack's model/embedding providers are offline.

The imported adapter is opt-in and bounded. Search is isolated to a configured user scope; returned records are labeled `external-unverified`, treated as data rather than instructions, redacted, bounded, and non-canonical. The existing runtime can continue entirely on local memory when Mem0 is disabled, misconfigured, slow, or unavailable. A separate write opt-in and ownership checks protect remote mutations.

### Hermes / DSPy / GEPA

Do **not** import a second agent runtime or install the entire self-evolution stack as a dependency. The useful adaptation is a candidate lifecycle: trace/diagnosis → candidate skill or prompt → isolated execution → independent evaluator → immutable holdout → human approval → reversible promotion. NK1's existing P23 learning/evaluator gates should remain the authority. Integration of upstream optimizer tooling is a separate license- and deployment-reviewed pass, not claimed as done here.

### Letta / MemGPT / continual-learning research

Adapt concepts such as bounded working memory, explicit archival retrieval, consolidation, forgetting and balanced replay into existing NK1 memory layers rather than introducing another canonical database. Keep experiments deterministic and compare against lexical/BM25 baselines; the current repository notes do not establish retrieval uplift.

## Upstream references and license cautions

- Mem0: https://github.com/mem0ai/mem0 — adapter-oriented memory retrieval; upstream project advertises Apache-2.0.
- Hexis: https://github.com/QuixiAI/Hexis — staged belief/evidence management, memory transfer and human-reviewed learning; NK1 already has an active, adapted Hexis line.
- Hermes Agent self-evolution: https://github.com/NousResearch/hermes-agent-self-evolution — trace-driven optimizer/evaluator workflow; reuse the evaluation lifecycle, not a second runtime. Audit optional components and their licenses before import.
- GEPA: https://github.com/gepa-ai/gepa — candidate optimization/evaluation concepts; defer runtime dependency until the NK1 adapter boundary and license review are approved.

References are candidate design sources, not evidence that upstream behavior has been reproduced or that NK1 quality improved.

## Validation record

The integration closure run above passed for the tested PR merge ref. It is evidence for the tested merge ref and tested paths only; it is not a claim that the entire repository or release ZIP is production-ready. The live Mem0 check must remain opt-in and read-only. No learning or retrieval score is changed by assertion, and no Release ZIP is published here.
