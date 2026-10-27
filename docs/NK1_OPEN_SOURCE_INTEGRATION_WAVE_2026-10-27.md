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
- [x] Added a static runtime-wiring contract and an integration CI workflow.
- [x] Registered test commands and documented limitations in the runtime package and `CHANGELOG.md`.
- [ ] Execute the newly wired tests on this exact branch head and inspect all workflow steps/logs.
- [ ] Run an opted-in live Mem0 contract check against a dedicated test-only user scope. It is intentionally skipped without explicit operator credentials/flags.
- [ ] Demonstrate a positive, independently sourced retrieval uplift on immutable RU/EN holdout data across paired model/training seeds.
- [ ] Run the production UI/build/migration, browser/Live2D, real Android/Termux audio, soak, SBOM and license gates.
- [ ] Publish a refreshed Release ZIP from the validated source head. No release artifact is modified by this pass.

## Integration boundaries

### Hexis

The current target line already contains Hexis HMX staging/review, canonical memory projection, evidence lineage, source identity/replay protections, and rollback paths. Mem0 does not bypass these capabilities. A Mem0 result enters language context as an external clue only; it is not canonical evidence and cannot change a belief by itself.

### Mem0

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

No test pass is asserted in this file. The current pass writes code and wires test commands, but final correctness depends on the actual CI/typecheck/runtime result for the final branch head. The live Mem0 check must remain opt-in and read-only. No learning or retrieval score is changed by assertion, and no Release ZIP is published here.
