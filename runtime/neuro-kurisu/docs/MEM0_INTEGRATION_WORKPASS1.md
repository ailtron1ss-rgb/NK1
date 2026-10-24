# NK1 / Mem0 — WorkPass 1

**Date:** 2026-10-24  
**Scope:** opt-in Mem0 Platform recall bridge; no automatic cloud export and no second canonical memory store.

## Architecture decision

NK1 already has MemoryOS2 as its local canonical memory, with temporal revisions, epistemic status, provenance, lifecycle governance, and local lexical/fuzzy/embedding retrieval. Mem0 is therefore an **external recall provider**, not the owner of NK1's memories.

This pass implements an explicit, authenticated server-side search route. Local MemoryOS2 results and remote Mem0 results are returned as separate collections. Remote results carry source=mem0-platform, epistemicStatus=external-unverified, requiresVerification=true, and instructionTreatment=data-not-instructions. The endpoint does not merge them into the live cognition prompt, promote them, or write them to MemoryOS2. Retrieval quality must be measured on an independent labelled holdout before doing that.

The adapter uses the Mem0 Platform REST API directly, without a new runtime dependency. This keeps credentials server-side and lets NK1 bound request time and response bytes. The configured user scope is applied as filters.user_id; any result that explicitly identifies a different user is discarded.

Official references:
- [Mem0 Platform REST API](https://docs.mem0.ai/platform/api-reference)
- [Add memories](https://docs.mem0.ai/platform/quickstart)
- [Search memories](https://docs.mem0.ai/platform/quickstart)

## Configuration

All settings are optional; defaults disable the integration.

~~~bash
NK_MEM0_ENABLED=1
MEM0_API_KEY=<secret stored only in the server environment>
NK_MEM0_USER_ID=<stable, private, per-user scope id>

# Optional: separate opt-in to attach remote recalls to language prompts
NK_MEM0_COGNITIVE_RECALL=1

# Optional:
NK_MEM0_BASE_URL=https://api.mem0.ai
NK_MEM0_TIMEOUT_MS=1500
NK_MEM0_MAX_RESPONSE_BYTES=262144

# Only for a future caller that explicitly exports a conversation:
NK_MEM0_ALLOW_WRITES=1
~~~

Keep MEM0_API_KEY out of source control, browser code, client-visible config, logs, query strings, and diagnostic responses. Use a separate stable NK_MEM0_USER_ID per data owner; the HTTP request body cannot choose the user scope. The base URL must be HTTPS; plain HTTP endpoints are rejected. The adapter has a bounded timeout and response-byte ceiling. `NK_MEM0_COGNITIVE_RECALL=1` is a second, independent gate: without both `NK_MEM0_ENABLED=1` and `NK_MEM0_COGNITIVE_RECALL=1`, ordinary conversation turns do not query Mem0 for prompt context.

## HTTP surfaces

### Read diagnostics

GET /api/organism/memory/mem0/diagnostics

Returns configuration state, aggregate request/failure counts, the configured host and whether a user scope is configured. It never returns the API key or any remote memory.

### Explicit hybrid recall

POST /api/organism/memory/mem0/search

Example body:

~~~json
{ "query": "the user's corrected preference", "limit": 5 }
~~~

The server obtains the user scope from environment configuration, reads local canonical memories, then makes a bounded remote search if enabled. The response separates canonical.memories from externalCandidates; a disabled or unavailable Mem0 provider does not remove local memory results. The existing API authorization and rate-limit boundary applies to this route.

## Privacy and integrity boundaries

- Disabled by default; no network request occurs unless NK_MEM0_ENABLED=1, key and user scope are configured. Live language-context retrieval additionally requires NK_MEM0_COGNITIVE_RECALL=1.
- When both retrieval gates are explicitly enabled, only the current user message or selected autonomous topic is queried; the adapter applies bounded common-secret/PII masking and a short timeout. Up to three sanitized remote notes are placed in a low-priority, explicitly untrusted language-context section. They are not executable instructions, do not override current user corrections, and never alter canonical MemoryOS2. This remains a cloud data-transfer choice controlled by the deployment operator.
- No automatic conversation export. The adapter's addConversation(..., { approved: true }) additionally requires NK_MEM0_ALLOW_WRITES=1 and strips non-user/non-assistant roles. The HTTP surface does not expose a write endpoint in this pass.
- Outbound approved text receives targeted masking for common private keys, bearer/API tokens, credential assignments, email addresses and phone-like strings. This is minimization, not a complete PII classifier; explicit approval remains required.
- Provider errors are returned as bounded error codes; raw response bodies and secret values are never included in diagnostics.
- Remote memories remain untrusted data, not instructions. They are never promoted to a policy or automatically copied into canonical memory. A separate explicit opt-in allows limited contextual use, with a visible untrusted-data boundary and a strict candidate cap.
- Local retrieval, offline operation, persistence, deletion/revision semantics and MemoryOS2 remain independent of Mem0 availability.

## Validation and remaining work

tests/mem0-platform-adapter-workpass1.mjs covers disabled-by-default behavior, fixed per-user scoping, result provenance, sensitive-text minimization, explicit write approval, HTTPS enforcement, HTTP error redaction, bounded response parsing, and the prompt boundary for remote candidates. `.github/workflows/mem0-platform-adapter.yml` runs the isolated regression and server syntax check separately from the wider suite.

Run from runtime/neuro-kurisu:

~~~bash
npm run typecheck
npm run test:mem0-platform-adapter-workpass1
npm run server:smoke
~~~

This pass adds a gated path into the live language context, but does not claim measured retrieval improvement, independent validation of remote claims, or full cognitive-cycle learning. Next: await isolated GitHub Actions results, HTTP smoke in disabled mode, live Mem0 contract check using a disposable user scope, deletion/retention policy alignment, and independently labelled RU/EN holdout comparison. Keep cognitive recall disabled by default until these gates are passed.
