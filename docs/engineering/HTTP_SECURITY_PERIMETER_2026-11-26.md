# NK1 HTTP security perimeter and state budgets
Date: 2026-11-26
Canonical base: `workpass70-source@7e601680c765d6dc94e51e4c8f5e729b48a6f56e`
Combined work: PR #1193 HTTP perimeter/state-growth plus selected bounded-rate-limit work from PR #1192.

## Security contracts
- API bearer authorization remains fail-closed for non-loopback traffic.
- Local research mode requires an actual loopback socket peer and no `Forwarded` / `X-Forwarded-For` headers.
- Rate limiting runs before API authorization, so missing and invalid bearer attempts consume the bounded per-peer budget.
- The fixed-window limiter has a hard key limit. When peer cardinality reaches capacity, additional peers share an overflow bucket; active per-peer counters are not evicted.
- Forwarded client addresses are trusted only when both `NEURO_TRUST_PROXY=1` and the socket peer is in `NEURO_TRUSTED_PROXY_ADDRESSES`. Direct clients cannot rotate rate-limit identity by forging XFF.
- CORS is allowlist-only via `NEURO_CORS_ORIGINS`.
- Each request receives a random request ID; access logs omit query strings. Unexpected 500 responses expose only a stable label and request ID.
- Rate-window and request-limit environment settings are bounded decimal values with safe defaults.

## Configuration
- `NEURO_TRUST_PROXY=1` enables reverse-proxy resolution.
- `NEURO_TRUSTED_PROXY_ADDRESSES=127.0.0.1,::1` is an example; replace with exact TCP socket peer IPs of the actual proxy.
- `NEURO_CORS_ORIGINS=https://your-ui.example` is a comma-separated explicit origin allowlist.
- `NEURO_ACCESS_LOG=1` emits JSON access lines without query strings.
- `NEURO_RATE_WINDOW_MS=60000`, `NEURO_RATE_LIMIT=240` configure the bounded fixed window.

## State budget
Domain-closure fingerprints retain the first-1600-character comparison window but store a full SHA-256 digest. The growth regression measures serialized Core snapshot size over repeated runtime steps.

## Typecheck honesty
With a semantic TypeScript compiler available, `npm run typecheck` runs `tsc --noEmit`. Otherwise it reports `TYPECHECK=DEGRADED` after Node strip-only syntax validation. Set `NEURO_TYPECHECK_STRICT=1` to make fallback mode fail where semantic coverage is mandatory. Syntax-only validation is not semantic typechecking.

## Verification boundary
The workflow covers authorization, bounded rate limiting, trusted proxy resolution, CORS/request context, state growth and runtime typecheck status. It is not a production reverse-proxy audit, external penetration test or Android/Termux power-loss soak.
