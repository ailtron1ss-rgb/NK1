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


## Supplemental source modules (Omega follow-up batches; pinned to the same commit)

All are preserved verbatim as references. SQL migrations remain inactive and must not be run against NK1 without a separate schema/semantics port.

| Upstream path | Git blob SHA | Bytes | Purpose |
|---|---|---:|---|
| `core/memory_exchange.py` | `6620c3ff8838d4b7535d9fabaf182e2ce6f14617` | 112734 | memory exchange and retrieval reference |
| `core/tools/memory.py` | `4fe0e31cc516929374bcacff0310e3e07ceb908f` | 100553 | memory exchange and retrieval reference |
| `core/node_daemon.py` | `d7fcc084ceeb46785eff582a18e87728c8df5ca2` | 24104 | node identity/continuity reference |
| `core/integration_reliability.py` | `c7822194f91902fd3bd35226669ad8b395aa8f43` | 21313 | external integration reliability primitives |
| `core/digest.py` | `e3f4daf10c88f688ffb2b56334757d3cd8796195` | 16647 | canonical hashing and content identity |
| `core/host_services.py` | `b7077b87d722ad90a9d8868f47fd6dae8f3c8fec` | 30535 | worker and host-service orchestration |
| `core/tools/cron.py` | `4e729f3fbda063e722a6f0ff76043d95ecc2ef7f` | 9402 | scheduled-task management |
| `core/tools/journal.py` | `c8fdbcf6031b1a8eccdb2009a10d86ea7e10a7be` | 5961 | journal and experience capture |
| `core/memory_tools.py` | `e90bf54a84b62ea2a961821e052e75360a18b54f` | 9062 | memory exchange and retrieval reference |
| `core/tools/self_inspection.py` | `d70eea97a157ef82f6563498f67730ea129b17f4` | 29645 | self-inspection and diagnostics tools |
| `core/tools/goals.py` | `a2f2819f19aefba77dccadfc6fb3ec47e2bb1ad4` | 5462 | goal and responsibility tools |
| `core/tools/operator_policies.py` | `361d8e3a56f4e4ad9d59ba98614c0fce7d441944` | 4749 | operator policy / guardrail patterns |
| `core/tools/backlog.py` | `05fb011ad1c360b21e55cffbfedf8ebd64990255` | 6836 | backlog/task queue patterns |
| `core/tools/backup.py` | `147216bfd14ae7992c0eaab860b51e28b5e96f75` | 17296 | backup and restore lifecycle |
| `core/state.py` | `009b6ff5c319cac3f801952fc466de49cd471ce2` | 3434 | node identity/continuity reference |
| `core/node_identity.py` | `06a914b4ae1aadee36a8cff4afe3e8bf1fc919e7` | 11142 | node identity/continuity reference |
| `db/migrations/0189_structured_recall_hybrid_candidates.sql` | `432097f0b75cb0aefc54a68c92c252795e6ce5f6` | 3374 | memory provenance, retrieval, or retention schema (inactive) |
| `db/migrations/0190_self_repair_defect_reports.sql` | `998235101a5f7a16ac11b2020b322880ea601e49` | 36005 | skill-learning/recovery schema (inactive) |
| `db/migrations/0201_skill_selection_telemetry.sql` | `af9f2f88fcb1cd1d8a024a3c4578906202dafc76` | 3694 | skill-learning/recovery schema (inactive) |
| `db/migrations/0202_semantic_skill_selection.sql` | `28955dc8a2d75addebfd81b3e75bc2a280d19c5a` | 2258 | skill-learning/recovery schema (inactive) |
| `db/migrations/0213_memory_supersessions.sql` | `289d421346da9061be24fcfd49e69babfa5e4ce3` | 18101 | memory provenance, retrieval, or retention schema (inactive) |
| `db/migrations/0233_contradiction_events.sql` | `471c0a4927ef43ec7d399f7b90e04059d9148a8c` | 36440 | heartbeat and deliberation schema (inactive) |
| `core/tools/policy.py` | `7e196a66104f04775e806c147032a7ea0c06270e` | 8231 | operator policy / guardrail patterns |
| `core/tools/questions.py` | `43662fb823b21e93f96d80e4159e825c49d181d3` | 6630 | agent question tracking |
| `core/tools/responsibilities.py` | `64618e4787fdee202d979471c5cacc1572f09e07` | 13997 | goal and responsibility tools |
| `core/tools/sessions.py` | `04794b840949514646b48f434f9be56f5fcd33a4` | 14263 | session lifecycle tools |
| `core/tools/dynamic.py` | `c4110f33837be14b0061b8db73a8a3c7a2685687` | 13619 | dynamic tool and capability management |
| `core/tools/workflow.py` | `26b5bdd427a9f18fd266e1bc71a39b06e221b1e3` | 22266 | workflow orchestration |
| `db/migrations/0215_operator_policy_corrections.sql` | `d8a0f8d35eb22df6d208d6a99fd2a006cf09562a` | 23029 | safety/policy schema (inactive) |
| `db/migrations/0223_outbound_safety.sql` | `c2b61ddb7d601111bef1543269057569f8d2f3e3` | 93218 | safety/policy schema (inactive) |
| `db/migrations/0225_heartbeat_economy.sql` | `d206fc156ae0c5874d66e3082eb4a4db8c09c6a4` | 34299 | heartbeat and deliberation schema (inactive) |
| `db/migrations/0226_deliberation.sql` | `9f32a9845c7c48128e7bf3d3e1b4a2565fed0918` | 21078 | heartbeat and deliberation schema (inactive) |
| `db/migrations/0247_retention_claims_already_held.sql` | `f17ce28e8934c6ddcaf6abd121164fb31bede279` | 27176 | heartbeat and deliberation schema (inactive) |
| `db/migrations/0249_add_evidence_candidate_recovery.sql` | `910e24b27203be351b071d0c67b92d5a0559fef9` | 32073 | skill-learning/recovery schema (inactive) |
| `db/migrations/0252_encoder_context_and_supersession.sql` | `076640a4404122d055d8dad01c4e95061d7d41eb` | 43432 | memory provenance, retrieval, or retention schema (inactive) |
