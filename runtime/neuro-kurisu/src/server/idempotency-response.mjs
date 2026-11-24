/**
 * Translate a canonical action preflight result into an HTTP status without
 * collapsing malformed caller input into a missing-precondition response.
 *
 * 400: a supplied idempotency key is malformed and the caller must correct it.
 * 428: the operation requires a stable key before the action can be attempted.
 * null: this result is not an idempotency-key preflight rejection.
 */
export function idempotencyPreflightHttpStatus(result) {
    if (result?.idempotencyRequired !== true) return null;
    if (result?.result?.error === 'idempotency-key-invalid') return 400;
    return 428;
}
