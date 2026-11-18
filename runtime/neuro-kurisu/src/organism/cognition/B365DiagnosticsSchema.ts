/**
 * Canonical B365 persisted-state and diagnostics contract version.
 *
 * Bump this only when the B365 state/diagnostics signal layout changes.
 * Consumers must fail closed on versions they do not explicitly understand.
 */
export const B365_STATE_SCHEMA_VERSION = 14 as const;
