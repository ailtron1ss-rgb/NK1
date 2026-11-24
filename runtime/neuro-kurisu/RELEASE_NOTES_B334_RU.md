# Release Notes B334

## Autonomous Project Lifecycle & Persistence

B334 не добавляет новую goal-system. Добавлен evidence-gate над существующим `SelfDirectedLifeOrchestrator`/commitment ecology.

### Added
- `src/organism/system/B334AutonomousProjectLifecycleGate.ts`
- `tests/big-pass-334-autonomous-project-lifecycle.mjs`
- package script `test:big-pass-334-autonomous-project-lifecycle`
- persistence/migration/projection support for B334 state
- master audit / roadmap / B334 report

### Verified
- typecheck: PASS
- integrity: PASS
- syntax: PASS
- release contract: PASS
- B326–B333 regressions: PASS
- B334 unit lifecycle: PASS
- B334 live Core: PASS
- external-input negative control: PASS
- restart persistence: PASS

### Important correction
B334 observer initially double-counted terminal project states. Completion/abandonment/interruption are now tracked as edge transitions.

### Limits
B334 is not proof of long-term autonomous life, general autonomous planning, Android embodiment, or consciousness.
