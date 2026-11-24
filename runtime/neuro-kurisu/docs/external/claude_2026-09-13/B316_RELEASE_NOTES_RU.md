# B316 Release Notes

## Major change

B285 contextual scar is now action-selective.

### Before

Context state had a single local negative signal. Different actions could receive too similar a warning from one bad experience.

### After

Each contextual scar state additionally contains bounded per-action negative strength for the existing action set.

### Recovery

Corrective verified evidence for the same action reduces that action-specific scar without erasing unrelated action states.

### Persistence

State remains schema 127. Restore normalization accepts the additive field and supplies zero defaults for old snapshots.

## Verification

B316 targeted test PASS.
B315 contextual regression PASS.
B315 migration PASS.
B314 isolated regression PASS.
B298 closed-loop neural PASS.
B305 96-cycle host Termux-style benchmark PASS.

## Known limits

Aggregate long-runtime chain remains resource-limited. Physical Android evidence remains open. Consciousness remains unproven.
