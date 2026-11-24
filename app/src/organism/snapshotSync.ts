export interface UiSnapshotStamp {
  version: string;
  schemaVersion: number;
  tick: number;
  at: number;
}

/**
 * Prevent an older in-flight UI snapshot from overwriting a newer request or
 * rolling the visible organism state backwards. A newer timestamp may carry a
 * lower tick after a runtime restart; that is an intentional new epoch.
 */
export function shouldApplyUiSnapshot(
  incoming: UiSnapshotStamp,
  current: UiSnapshotStamp | null,
  requestId: number,
  latestRequestId: number,
): boolean {
  if (!Number.isSafeInteger(requestId) || requestId < 1 || requestId !== latestRequestId) return false;
  if (typeof incoming.version !== "string" || incoming.version.length === 0) return false;
  if (!Number.isSafeInteger(incoming.schemaVersion) || incoming.schemaVersion < 1) return false;
  if (!Number.isSafeInteger(incoming.tick) || incoming.tick < 0) return false;
  if (!Number.isFinite(incoming.at) || incoming.at < 0) return false;
  if (!current) return true;

  if (incoming.version !== current.version || incoming.schemaVersion !== current.schemaVersion) {
    return incoming.at >= current.at;
  }
  if (incoming.at < current.at) return false;
  if (incoming.at === current.at && incoming.tick < current.tick) return false;
  return true;
}
