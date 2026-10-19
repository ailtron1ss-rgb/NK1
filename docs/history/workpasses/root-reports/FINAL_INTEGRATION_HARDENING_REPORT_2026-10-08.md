# Neuro-Kurisu SUPER — Final Integration Hardening — 2026-10-08

This pass reviewed the actual WILL and Lumina source branches against the current canonical runtime and repaired remaining integration gaps rather than duplicating subsystem owners.

## Closed gaps
- Lumina capability profiles are now enforceable authorization decisions with explicit confirmation requirements.
- External outbound envelopes are blocked unless the outbound capability is explicitly confirmed.
- Telegram is a first-class channel kind in the WILL adapter.
- Outbound channel IDs and SDK stimulus IDs are deterministic, so retry/replay no longer depends on wall-clock IDs.
- The tamper-evident record chain retains a base continuity checkpoint after 512-anchor compaction and remains verifiable after retention.
- WILL competence artifacts now have portable fingerprinted export/validation.
- WILL social dossiers/conversation aims are exposed through runtime API and UI.
- Lumina-derived web target validation blocks localhost/private/link-local/multicast/special IP destinations after DNS resolution.
- UI wiring now exposes outbound side effects, authorization, social continuity, web validation and competence portability.

## Intentional non-copies
Lumina agent loop, standalone database/memory owner, desktop UI, unrestricted code generator and a second identity/learning owner remain excluded because Neuro-Kurisu already has canonical equivalents.
WILL deliberation cache and provider-specific unfinished layers remain reference/adapters until benchmark evidence justifies promotion.
