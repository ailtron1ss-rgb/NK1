# QuixiAI/Hexis remote peer for NK1

## Purpose and boundary

NK1 already owns its local HexisAdaptationFabric, belief-review model, HMX staging, connector-policy checks, and idempotent outbox. This adapter does not replace those owners or install a second database. It optionally consults a separately deployed QuixiAI/Hexis instance through its documented HTTP contract.

The adapter currently uses only these documented endpoints:

- GET /health to check remote health;
- GET /v1/models to discover a model if none is configured;
- POST /v1/chat/completions for an explicit, bounded consultation.

The public API reference documents these endpoints and notes that the OpenAI-compatible completion route uses the canonical Hexis agent loop. A remote Hexis deployment may have tools enabled; a prompt asking it to behave as a read-only consultant is not a security boundary.

## Enablement

No remote URL means no network call. Configure all of the following deliberately:

- NK1_HEXIS_REMOTE_BASE_URL: origin only, such as http://127.0.0.1:43817 for a local sidecar or https://hexis.example for a TLS-protected remote service.
- NK1_HEXIS_REMOTE_CONSULT_ENABLED=true: second opt-in for consultations.
- NK1_HEXIS_REMOTE_API_KEY: required for a non-loopback peer; sent only as a bearer header over HTTPS.
- NK1_HEXIS_REMOTE_MODEL: optional exact model ID; otherwise discovered from /v1/models.
- NK1_HEXIS_REMOTE_TIMEOUT_MS: optional 500–20000 ms; defaults to 8000 ms.

The adapter rejects credentials embedded in the URL, query/hash/path suffixes, non-loopback plaintext HTTP, and non-loopback HTTPS without an API key. Redirects are rejected to prevent a bearer token being forwarded to another origin. Errors are mapped to stable codes without returning the remote error body.

## Endpoints in NK1

- GET /api/organism/integration/hexis/peer/status: safe status summary; if configured, performs the remote health check.
- POST /api/organism/integration/hexis/peer/consult: submits a consultation only when the deployment opt-in is enabled and request JSON sets confirmExternalConsult to true.

The project's existing authorizeApiRequest policy and rate limiter apply to both routes because they are part of the existing /api/ server.

Consultation context is allowlisted and bounded: current cognitive tick, one current goal, up to eight short observations, and up to eight short memory candidates. Other properties (including arbitrary notes, tokens, and credentials) are dropped. The caller must choose what context is sent; NK1 does not automatically forward conversation history or the whole memory store.

## Trust, memory and learning

Every result is labelled advisoryOnly=true, eligibleAsVerifiedEvidence=false, nk1StateChanged=false, and externalAgentToolsMayRun=true.

A remote answer is not a verified action receipt, not ground truth, and not an approval. It cannot directly revise NK1 beliefs, activate a skill, replace identity, or silently enter causal learning. Any future import must pass through the existing provenance/verification gates. Portable data should use the existing HMX export → stage → explicit NK1 decision path; protected identity/worldview sections must not be auto-accepted.

The bridge does not directly write the Hexis Postgres database. Its documented belief and memory mutations are database functions / agent tools, not a general-purpose public REST write API.

## Verification

Focused tests live in runtime/neuro-kurisu/tests/integration/hexis-adaptation.mjs and runtime/neuro-kurisu/tests/integration/hexis-server-smoke.mjs. Run from runtime/neuro-kurisu:

    npm run test:hexis-adaptation
    npm run test:hexis-server-smoke
    npm run audit:hexis
    npm run typecheck

These tests exercise a fake documented API, the fail-closed disabled server path, context allowlisting, transport/auth configuration, redirect rejection and the non-evidence output contract. They do not prove the operator’s actual Hexis service, keys, TLS, production permissions, or real-world learning uplift. A real-peer test should run only against an operator-controlled Hexis deployment with tool permissions independently limited.
