/**
 * Prevent out-of-order /ui-snapshot responses from rolling the browser UI
 * back to an older canonical organism revision.
 *
 * Each request receives a monotonically increasing ticket. A response may
 * mutate UI state only while its ticket is still the newest issued request.
 */
export function createUiSnapshotCommitGate() {
  let latestTicket = 0;

  return {
    begin(): number {
      latestTicket += 1;
      return latestTicket;
    },

    isCurrent(ticket: number): boolean {
      return Number.isSafeInteger(ticket) && ticket > 0 && ticket === latestTicket;
    },

    commit(ticket: number, apply: () => void): boolean {
      if (!Number.isSafeInteger(ticket) || ticket <= 0 || ticket !== latestTicket) return false;
      apply();
      return true;
    },
  };
}