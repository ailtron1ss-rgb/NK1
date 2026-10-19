# WorkPass60 code changes

- `AutonomousProjectExecutor`: `ProjectStepExecutionCheckpoint` and stage enum; active operation fields in persisted execution state v7; backward-compatible restore from v6; stable operation key/decision ID; request fingerprint conflict handling.
- `OrganismCore.executeProjectTool`: validate explicit client idempotency key for tools that require one; prepare durable checkpoint before dispatch; carry stable execution options; on unresolved restart/retry use reconciliation instead of executor; changed payload gets a recovery-required outcome; unresolved checkpoints survive; resolved paths clear only after projection; status snapshot returns redacted active operation information.
- `ActionGateway.reconcileToolExecutionDirect`: completed-but-unverified prior receipts may ask the registered adapter for read-only reconciliation rather than returning an immediate replay.
- Two tests cover snapshot/restore, v6 migration, safe prepared replacement, conflicting payload, unknown reconciliation status, no duplicate side effect, and stable key/decision identity.
- Metadata and progress tracking now identify WorkPass60 and keep pass completion separate from overall readiness.

Known blocker: positive authoritative provider reconciliation still collides with OutcomeCognitionFabric's executionId fingerprint guard; fail-closed retained.
