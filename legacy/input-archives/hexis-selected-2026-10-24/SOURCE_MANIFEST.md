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
