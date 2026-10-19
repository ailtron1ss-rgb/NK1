# Neuro-Kurisu 34.39.0 — BIG PASS 68

## BIG PASS 68: Identity-Change Lineage

P84 Autobiographical Continuity Fabric расширен компактным identity-change lineage.

### Добавлено

- `identityDelta01`
- `memoryBinding01`
- `realityDelta01`
- `learningSignal01`
- `identityChangeReasons`
- bounded `sourceEventIds` к canonical EventLog
- `identityChangeCount`, `selfChangeLoad01`, `memoryBinding01`
- `OrganismCore.autobiographicalIdentityChanges()`
- API `/api/organism/autobiographical-identity-changes`

### Архитектура

Новый physical owner не создаётся. P84 остаётся частью Self subsystem. Raw memory/event contents не копируются; сохраняются только bounded lineage references и derived metrics.

### Verification

Typecheck, BIG PASS 68 audit, BIG PASS 64–67 regression, architecture, source truth, hygiene, syntax, forensics, integrity, API, restart, replay, concurrency, identity and memory checks: PASS.

250 operational: PASS. 500 natural: PASS. 500 warm: PASS.

1000-cycle: NOT CERTIFIED в текущей среде. Аналогичный late-horizon stall воспроизведён на 34.38.0 baseline, поэтому он не классифицируется как регрессия P84.

### Scientific boundary

Identity-change lineage — engineering construct для причинно-связанной continuity. Он не доказывает феноменальное сознание, субъективный опыт или qualia.
