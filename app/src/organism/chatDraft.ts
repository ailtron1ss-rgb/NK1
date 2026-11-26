/**
 * Keep a failed submission recoverable without overwriting text the user typed
 * while the request was in flight.
 */
export function draftAfterSend(currentDraft: string, submittedDraft: string, delivered: boolean): string {
  if (delivered || currentDraft.trim().length > 0) return currentDraft;
  return submittedDraft;
}
