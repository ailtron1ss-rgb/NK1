# Memo 0.3.0 → Neuro-Kurisu adaptation

Source: `github.com/ybonda/memo`, release `v0.3.0`, MIT licensed.
Local source archives verified in the integration pass:

- `memo-0.3.0.zip`
- `memo-0.3.0.tar.gz`

This pass intentionally ports **algorithms and data-model ideas**, not a second database/service. The canonical memory owner remains `MemoryOS2`.

## Integrated

1. Content-addressed identity: canonicalized SHA-256 content hash + stable namespaced memory ID.
2. Canonicalization before exact reconciliation (line endings, repeated whitespace, Unicode normalization).
3. Tags and context metadata on canonical memory records.
4. Batched `reconcile()` API using the canonical MemoryOS owner.
5. Compatibility consolidation now routes through canonical reconciliation.
6. Session context capture using host-injected `NEURO_KURISU_PROJECT`, `GIT_BRANCH`, `GIT_COMMIT`, `RUNTIME_HOST` / Termux marker; no git process on the hot path.
7. Legacy restore derives missing content hashes without rewriting legacy IDs.

## Deliberately not copied

- Memo's SQLite database: duplicates the existing persistence owner.
- Memo's embedding service: Neuro-Kurisu already owns semantic retrieval.
- Memo's Obsidian vault: useful as an audit projection, but not canonical organism memory.
- Memo's LLM rendering: presentation layer, not cognition.
- Memo's MCP service implementation: candidate for a later adapter over the existing server rather than a second server.

## Next transplant candidates

- explicit contradiction/revision reconciliation;
- human-auditable memory projection;
- MCP adapter over canonical memory actions;
- stronger hybrid lexical+dense retrieval and reranking;
- temporal validity / memory lifecycle fields.
