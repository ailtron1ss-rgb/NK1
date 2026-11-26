# NK1 approval actor attribution
Date: 2026-11-26
Base: `aspect/http-perimeter-and-closure-growth-20261125@4507ba9b97e7f653a0fd2f89ae98ba1e220c399e`

## Contract
- Transport principals are `owner`, `api-token-holder`, and `loopback-local-client`.
- The API maps only verified authorization results: `authenticated` becomes `api-token-holder`; `loopback-research-mode` becomes `loopback-local-client`.
- Any other or missing authorization reason fails closed for approval resolution.
- Actor is derived by the server from the authenticated request context. Request JSON cannot supply or override it.
- OrganismCore forwards the principal to the existing ActionGateway; no second approval owner is introduced.
- ActionGateway validates the actor vocabulary, persists it in the existing approval record, exposes it in resolved approval receipts, and validates it on restore.
- Old ledger records without an actor remain unattributed. No owner identity is retroactively invented.
- P34 consent retains its separate domain-level `creator` role; it is not the transport principal.

## Meaning and limitations
These labels record the authenticated transport path, not a verified natural-person identity. `api-token-holder` says only that the request passed the configured bearer-token check. `loopback-local-client` says only that the request passed local research-mode policy on a loopback host. Token sharing, local session ownership and host compromise are outside this evidence.
