# Source branch coverage — final 2026-10-08

## WILL

Высокоценные механизмы WILL из предыдущего аудита адаптированы в canonical runtime: agency/reafference, PMA/fidelity, competence portability, social/known-entity, context accounting, transport/replay, deterministic vector retrieval, MCP/SDK, integrity chain и LLM attribution. Полный исходник сохраняется только как provenance branch, а не как второй brain.

## Lumina

Высокоценные прикладные механизмы Lumina адаптированы: capability policy, exact search, idempotency, browser/security seams, outbound gate, channel policy и voice tooling surface. Самостоятельные Agent/Memory/SQLite/PySide runtime не продвигаются как конкурирующие владельцы.

## Hexis — integrated

- belief revision + evidence independence
- temporal memory + point-in-time diff
- learning review
- retention/forgetting + fidelity receipt
- HMX staged portability + guarded canonical import
- transactional outbox
- connector policy/context/approval/rate limit/expiry
- execution placement
- canonical memory projection
- operator UI/HTTP/API wiring
- persistence and migration
- sanitized provenance

## Hexis — intentionally not promoted

- full PostgreSQL ownership
- second Agent loop
- second Memory/Identity owner
- heartbeat engine as a parallel runtime
- companion executor without a transport implementation
- autonomous code-repair executor
- full Hexis SQL production schema
- separate Next.js application runtime

## Security

The supplied Hexis branch contained credential-bearing files. They were excluded from provenance: `.env.local` and `core/auth/gmail-credentials.json`. No live credential file is present in the final working tree.
