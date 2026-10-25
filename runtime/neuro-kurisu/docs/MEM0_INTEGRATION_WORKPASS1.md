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

Keep MEM0_API_KEY out of source control, browser code, client-visible config, logs, query strings, and diagnostic responses. Use a separate stable NK_MEM0_USER_ID per data owner; the HTTP request body cannot choose the user scope. This first pass is a **single-owner-per-server** integration, not multi-tenant isolation: do not serve unrelated owners from the same Mem0 scope. A multi-tenant deployment needs a trusted authenticated-identity-to-user-ID resolver, never a client-supplied user ID. The base URL must be HTTPS; plain HTTP endpoints are rejected. The adapter has a bounded timeout and response-byte ceiling. `NK_MEM0_COGNITIVE_RECALL=1` is a second, independent gate: without both `NK_MEM0_ENABLED=1` and `NK_MEM0_COGNITIVE_RECALL=1`, ordinary conversation turns do not query Mem0 for prompt context.

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

### Explicit deletion primitive

The adapter also supports an internal, explicit deletion operation using Mem0's documented `DELETE /v1/memories/{memory_id}/` endpoint ([official reference](https://docs.mem0.ai/api-reference/memory/delete-memory)). It is deliberately **not exposed as an HTTP route** in this pass.

Deletion is fail-closed: it requires the write gate and per-operation approval, accepts only a valid UUID observed from an earlier scoped search/add within this adapter process, always sends `delete_linked=false`, and invalidates the in-memory authorization after success. The allow-list is bounded to 256 entries and intentionally disappears at process restart; the caller must re-search in the configured user scope before requesting deletion again. This reduces arbitrary-ID and cross-scope deletion risk, but is not a substitute for a provider-side tenant boundary.

## Privacy and integrity boundaries

- Disabled by default; no network request occurs unless NK_MEM0_ENABLED=1, key and user scope are configured. Live language-context retrieval additionally requires NK_MEM0_COGNITIVE_RECALL=1.
- When both retrieval gates are explicitly enabled, only the current user message or selected autonomous topic is queried; the adapter applies bounded masking for common secret and PII patterns before sending a query, normalizes Unicode, strips invisible/bidirectional control characters, and uses a short timeout. This is defense in depth, not a complete PII classifier. Up to three sanitized remote notes are placed in a low-priority, explicitly untrusted language-context section. They are not executable instructions, do not override current user corrections, and never alter canonical MemoryOS2. This remains a cloud data-transfer choice controlled by the deployment operator.
- No automatic conversation export. The adapter's addConversation(..., { approved: true }) additionally requires NK_MEM0_ALLOW_WRITES=1 and strips non-user/non-assistant roles. The HTTP surface does not expose a write endpoint in this pass.
- Outbound query text, returned candidates, and approved export text pass through targeted masking for private keys, bearer/API credentials, GitHub/Slack/AWS/Google-style tokens, JWT-like strings, quoted credential assignments, email addresses and phone-like strings. Unicode is normalized and invisible/bidirectional controls are removed before pattern matching. Coverage is heuristic, not a complete PII classifier; explicit approval remains required.
- Provider errors are returned as bounded error codes; raw response bodies and secret values are never included in diagnostics.
- Remote memories remain untrusted data, not instructions. They are never promoted to a policy or automatically copied into canonical memory. A separate explicit opt-in allows limited contextual use, with a visible untrusted-data boundary and a strict candidate cap.
- Local retrieval, offline operation, persistence, deletion/revision semantics and MemoryOS2 remain independent of Mem0 availability.

## Validation and remaining work

tests/mem0-platform-adapter-workpass1.mjs covers disabled-by-default behavior, fixed per-user scoping, result provenance, sensitive-text minimization, explicit write approval, HTTPS enforcement, HTTP error redaction, bounded response parsing, the prompt boundary for remote candidates, and consent/scope-bound deletion. `tests/server-language-http-fake-provider.mjs` also exercises the actual server diagnostics/search routes with Mem0 disabled, confirms local MemoryOS2 remains available and confirms no remote recall enters the prompt even if the second gate is set. `.github/workflows/mem0-platform-adapter.yml` runs the adapter suite, server syntax check, and this disabled-provider HTTP smoke separately from the broader repository suite.

Run from runtime/neuro-kurisu:

~~~bash
npm run typecheck
npm run test:mem0-platform-adapter-workpass1
node --experimental-transform-types tests/server-language-http-fake-provider.mjs
npm run server:smoke
~~~

This pass adds a gated path into the live language context. **The latest targeted code checkpoint passed** in [run 40162143665](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40162143665) on head `e64b6f520075ac02379685d826ac0979d598e10f`: Node 24 check, server JavaScript syntax check, **14/14 adapter tests**, and disabled-provider HTTP smoke all passed. The regressions include scope rejection for a mismatched `metadata.user_id`, fail-closed rejection when a provider result has no owner provenance, and abort/timeout behavior without leaking the key. HTTP smoke returned 200 from the actual NK1 server, reached the fake local provider exactly once, and confirmed disabled Mem0 did not enter the language prompt. The smoke child server uses Node 24 `--experimental-transform-types` because the runtime transitively uses parameter properties unsupported by strip-only mode. Two runtime boot/data-attribution blockers uncovered by this test were fixed in `OutcomeVerificationService.ts` (the malformed escaped-control-character regex; commit `91d7daf5db14794fd046ac173e23b4114ae0fe24`) and `OrganismCore.ts` (only credit B272 when its generated action matches the selected action; commit `4ddec187c4004642e0f1ee2240f0b27b44618cf8`). The broader runtime typecheck remains red ([run 40161840799](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40161840799)) with diagnostics elsewhere in the wider codebase; this does not establish a clean repository build. Remaining: live Mem0 API contract check on a disposable user scope, deletion/retention policy alignment, and independent RU/EN retrieval-quality holdout comparison. Keep cognitive recall disabled by default until provider/privacy and quality gates pass.
