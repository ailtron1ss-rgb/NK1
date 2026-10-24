# Hexis selected source snapshot

- Upstream: https://github.com/QuixiAI/Hexis
- Pinned commit: 9e718951dc2a50dfcdc6f22513a1916315840132
- License: MIT; see this directory's `LICENSE` (Copyright Eric Hartford, 2026).
- Imported on: 2026-10-24
- Purpose: reference source for selective adaptation into NK1's canonical TypeScript/P23 learning lifecycle.
- Runtime status: archive/reference only; no Hexis Python process or SQL migration is wired into NK1.

| Upstream path | Git blob SHA | Bytes | Purpose |
|---|---|---:|---|
| `LICENSE` | `790aa39fefe3dfcba304ea00e1a69d261602c975` | 1070 | MIT attribution |
| `README.md` | `0ed6e442960139749f1c78c2dd8ad64dc6382ed2` | 17890 | upstream overview |
| `core/agent_loop.py` | `16a1f45e01f13599e36d52f3d6bc620b4d056782` | 66829 | agent/heartbeat orchestration |
| `core/cognitive_memory_api.py` | `e294d25fc7213b7767ca20ee5e415502614b8d61` | 76086 | cognitive memory API |
| `core/memory_repo.py` | `6f450a1e0a307b992763fff9cfea02f9a1f2c906` | 12281 | memory persistence |
| `core/tools/skills.py` | `b7bdae16785123c50948dc34472e0e2c6788f748` | 46715 | skill discovery and authoring |
| `db/56_functions_skill_improvement.sql` | `42f67f651ff8537fe6cb714aaa4deda0ea80e72e` | 17152 | skill-improvement review functions |
| `db/56a_functions_learning_reviews.sql` | `2067b832f77fa070680e1c0142e81875d9a88b67` | 24797 | review lifecycle functions |
| `db/migrations/0017_skill_improvement_proposals.sql` | `54826b2e87e4a7324ad2740c60df40e64ea43c45` | 13126 | proposal queue schema |

The upstream source is preserved verbatim. Changes made for NK1 live outside this directory and are documented in `docs/OPERATION_OMEGA_HEXIS_INTEGRATION_2026-10-24.md`.


## Additional cognition, continuity, and learning reference modules (same pinned commit)

Added in the Operation Omega follow-up pass. These files remain reference/archive-only; PostgreSQL migrations must be adapted and reviewed before any use in NK1.

| Upstream path | Git blob SHA | Bytes | Purpose |
|---|---|---:|---|
| `core/agent_api.py` | `16caaffac7ff2140f40dfce69654e8096c819d58` | 16897 | agent-facing cognition and action API |
| `core/capability_maturity.py` | `9b84f0110ac6018d866fd07f64765bbf24897f9e` | 20537 | capability maturity and staged readiness |
| `core/node_life.py` | `abed714acdcf3fe288e7fbb7089d81d7d646f140` | 21369 | autonomous life-cycle / heartbeat routines |
| `core/node_wake.py` | `0ab664fba41b1895ee0936ef10b63b291aea159e` | 13266 | wake-up and continuity logic |
| `core/subconscious.py` | `76bc77006e6a1886b1c77b31594601c2eb2c42b3` | 2069 | subconscious reflection seam |
| `core/tools/self_repair.py` | `b50d03bf7e3b695cf4932e65d6c655b9e7e47033` | 8443 | bounded self-repair workflow |
| `core/tools/registry.py` | `816390aa7286788ca701c65df1b2fcd18fbe840c` | 40790 | tool registration and discovery |
| `core/trust_anchors.py` | `08ec5fc3ccec67d8d27e7e43e474075afd7a001e` | 9255 | trust-root and authority patterns |
| `db/migrations/0188_heartbeat_continuity_packet.sql` | `ffac559e0c035a7a3cb53373ff382a95b9da2598` | 10913 | heartbeat continuity packet schema |
| `db/migrations/0214_belief_propagation.sql` | `d79695d6b52e92ba64863d1f988b92a467eba562` | 21910 | belief propagation and provenance |
| `db/migrations/0217_appraisal_emotion_families.sql` | `bf45cf2400d6855f88644c9cad67d74ef6caed66` | 48619 | appraisal/emotion state schema |
| `db/migrations/0232_memory_provenance.sql` | `b6cb59ea36dfd180a820dbd64ee0c0387539b991` | 23424 | memory provenance schema |
| `db/migrations/0234_temporal_memory_history.sql` | `f9844b880e7522b140de82d3398e8bfa70fa881f` | 19265 | temporal memory history |
| `db/migrations/0235_weekly_learning_reviews.sql` | `2067b832f77fa070680e1c0142e81875d9a88b67` | 24797 | scheduled learning review workflow |
| `db/migrations/0236_deliberate_forgetting.sql` | `eac850e4c5b3c0dcde13afad84a0ce8a4899acee` | 25434 | deliberate forgetting / retention workflow |
