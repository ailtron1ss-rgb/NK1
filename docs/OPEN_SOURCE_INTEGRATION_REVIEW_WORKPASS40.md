# Open-source integration review — WorkPass40 — 2026-10-14

This is an integration decision log, not a claim that all upstream repositories have been cloned line-by-line. The current environment did not reliably resolve `registry.npmjs.org`; external source was not bundled unless already retained in `legacy/input-archives`.

## Candidates and decisions

### `ggml-org/llama.cpp` — adapt API, do not vendor engine
- Upstream: https://github.com/ggml-org/llama.cpp (MIT).
- Relevant reusable interface: `llama-server` OpenAI-compatible `/v1/chat/completions`.
- Applied: a minimal TypeScript local-provider adapter to the already-existing P40 Model Ecology, constrained to loopback HTTP and bounded requests. It does not own model selection, persistence, memory, or fallback policy. Redirect following is disabled and response bodies are capped at 2 MiB to avoid remote redirects or unbounded reads.
- Not done: no repository clone and no weights downloaded; local inference is tested with a mock endpoint only. `CapabilityRegistry` now names configuration `configured-unverified` rather than claiming runtime availability before a successful request. On a target PC, verify server version/model identity, latency, RAM/VRAM, cancellation and fallback before marking capability runtime-available.

### OpenAI Agents SDK guardrails patterns
- Reference: https://github.com/openai/openai-agents-python/blob/main/docs/guardrails.md
- Applied design principle: pre/post-action guard boundaries are consistent with the canonical ActionGateway and external-observation lifecycle. Do not add a competing tool executor or second receipt store.
- Not done: no full SDK dependency added; project remains source-first and uses existing gates.

### OpenAI Guardrails Python
- Upstream: https://github.com/openai/openai-guardrails-python (MIT).
- Decision: candidate for selective policy/validation adaptation only. Full framework not added because Python deployment and policy ownership would create a parallel stack; current project still needs real provider-boundary tests.

### Graphiti temporal knowledge graph
- Upstream: https://github.com/Agentopia/Graphiti (Apache-2.0).
- Decision: do not import its full database/writable graph as-is. MemoryOS2 is the only canonical memory owner, and a second temporal graph would duplicate state/transactions. Reusable temporal retrieval concepts can be tested as isolated, read-only candidate ranking behind MemoryFabric.

### Letta
- Upstream now points to: https://github.com/letta-ai/letta and https://github.com/letta-ai/letta-code (Apache-2.0 upstream licensing should be reviewed against exact revision).
- Decision: preserve existing source snapshots and adapter/governance boundaries. Do not merge a second agent runtime or reassign memory writes to Letta. Compare the exact current upstream code only when network cloning and license inspection are available.

### Existing embedded upstreams and legacy
- Ten source archives under `legacy/input-archives` are hashed and indexed by `contracts/SOURCE_PROVENANCE_LICENSES_WORKPASS40.json`; repository `LICENSE`/`NOTICE` files are inventoried. This is hash-level provenance, not full file-by-file semantic audit or legal clearance.
- Existing WILL, LUMINA, HEXIS, LETTA, CONSCIO, Kurisu and NeuroCore code remains preserved within active adapters, research-only branches, legacy source trees or immutable archives according to `contracts/integration-manifest.json`.
- Do not materialize every historical archive in the active tree. Use verified materializers, compare behavior, promote only useful implementation, and retain unique legacy byte lineage.

## License and quality gate before importing upstream code
1. Pin exact commit/tag and archive SHA-256.
2. Read repository license plus nested package licenses and `NOTICE` files; identify files without license evidence.
3. Compare source behavior and dependencies against current canonical owner.
4. Import only a bounded module/adaptor or exact useful implementation; test parity/failure modes before routing production traffic.
5. Add attribution/provenance and remove any obsolete implementation only after equivalence and rollback evidence.

## Known limits
The current dependency install/Vite build is blocked if npm registry DNS remains unavailable. No external source was falsely claimed as cloned or line-by-line reviewed in this pass.
