/**
 * Map canonical Hexis evidence-ingest failures to HTTP semantics.
 * Keep client/data errors distinct from server-side persistence failures.
 */
export function hexisEvidenceHttpStatus(reason) {
  switch (reason) {
    case 'canonical-memory-not-found':
      return 404;
    case 'source-trace-id-conflict':
      return 409;
    case 'canonical-evidence-write-failed':
      return 500;
    default:
      return 400;
  }
}
