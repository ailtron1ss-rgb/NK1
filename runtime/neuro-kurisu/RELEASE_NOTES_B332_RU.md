# Release Notes B332

- Added per-context/action matched-trial accumulation.
- Same-boot repeated recovery observations update one episode instead of creating duplicates.
- Different context/action is not merged silently.
- Added B332 regression gate.
- Revalidated B329/B330/B331 and `npm run typecheck`.
- Explicitly does not claim full live repeated causal promotion.
