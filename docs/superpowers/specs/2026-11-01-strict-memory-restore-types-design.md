# Strict Numeric Types During Memory Restore

## Intent
Prevent corrupted or non-canonical snapshot values such as numeric-looking strings from being promoted into trusted memory state.

## Goals
- Accept finite JavaScript numbers for numeric snapshot fields only.
- Fail closed on malformed validity timestamps.
- Downgrade facts whose confidence is not a finite JSON number in [0, 1].
- Preserve the canonical snapshot contract: JSON numbers remain numbers.

## Non-goals
- No schema migration, storage-provider change, or conversion of historical strings.
- No changes to retrieval ranking, memory ownership, or external databases.

## Approaches
- Coerce strings with Number(): rejected because it silently trusts malformed serialized data.
- Reject all non-number values at restore boundaries: selected because it matches JSON snapshot serialization and existing fail-closed integrity policy.
- Introduce a versioned migration layer: deferred because no documented string-number snapshot contract exists.

## Constraints
- Modify only the canonical MemoryOS2 restore path and its regression test.
- Preserve MemoryOS2 as the sole writable owner.
- Do not change main or publish a Release ZIP in this pass.
