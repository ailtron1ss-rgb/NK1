# Strict Numeric Types During Memory Restore

## Intent
Prevent corrupted or non-canonical MemoryOS2 snapshots from silently promoting numeric-looking strings into trusted chronology, scores, confidence, or revision history.

## Goals
- Accept finite JavaScript numbers for all numeric snapshot fields, including nested evidence-source timestamps, freshness values and authority scores.
- Fail closed on malformed validity timestamps.
- Downgrade facts whose confidence is not a finite number in [0, 1].
- Keep MemoryOS2 as the single writable owner and preserve the existing JSON-number snapshot contract.

## Non-goals
- No schema migration or conversion of historical string-number data.
- No retrieval-ranking changes, storage-provider changes, database writes, or release packaging.

## Approach
Reuse the canonical restore path's shared numeric normalizer and remove coercion from revision-history timestamps, fact confidence and nested evidence-source normalization. This is the smallest change that closes the trust boundary without adding another persistence layer.

## Verification
A real MemoryOS2 restore regression must fail before the fix and pass after it. The memory-integrity workflow must validate typecheck, restore integrity, lineage, persistence and retrieval gates on the exact PR head.
