/**
 * In-memory, same-tab continuation for exact one-use runtime approvals.
 *
 * The request body/continuation callback deliberately never leaves this module and
 * is never written to localStorage or the server's approval queue. Only the safe
 * preview returned by the canonical runtime is exposed to UI subscribers.
 */
export type ActionApprovalStage = "pending" | "processing" | "completed" | "declined" | "failed";

export type ActionApprovalCard = {
  id: string;
  toolId: string;
  permissionClass: string;
  operation: string;
  reasonCode: string;
  expiresAt: number;
  createdAt: number;
  inputKeys: string[];
  inputPreview: Record<string, unknown>;
  requestPath: string;
  label: string;
  stage: ActionApprovalStage;
  outcome?: string;
};

type InternalContinuation = {
  card: ActionApprovalCard;
  execute: (approved: boolean) => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
};

const continuations = new Map<string, InternalContinuation>();
const settled: ActionApprovalCard[] = [];
const listeners = new Set<() => void>();
let snapshot: readonly ActionApprovalCard[] = [];

function publish(): void {
  snapshot = [...continuations.values()].map((entry) => structuredClone(entry.card)).concat(settled.map((card) => structuredClone(card)));
  snapshot = snapshot.slice(0, 24);
  for (const listener of listeners) listener();
}

function safeLabel(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").slice(0, 100);
}

export function subscribeActionApprovals(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getActionApprovalSnapshot(): readonly ActionApprovalCard[] {
  return snapshot;
}

/** Suspends the originating API call until this exact request is approved or declined. */
function expireContinuation(id: string): void {
  const entry = continuations.get(id);
  if (!entry || entry.card.stage !== "pending") return;
  entry.card.stage = "failed";
  entry.card.outcome = "Approval expired. No action was resumed.";
  continuations.delete(id);
  settled.unshift(structuredClone(entry.card));
  settled.splice(8);
  entry.reject(new Error("The action approval expired; no side effect was resumed. Submit the action again for a new ticket."));
  publish();
}

export function waitForActionApproval<T>(input: {
  id: string;
  toolId: string;
  permissionClass: string;
  operation: string;
  reasonCode: string;
  expiresAt: number;
  createdAt?: number;
  inputKeys?: string[];
  inputPreview?: Record<string, unknown>;
  requestPath: string;
  label: string;
  execute: (approved: boolean) => Promise<T>;
}): Promise<T> {
  if (continuations.has(input.id)) {
    return Promise.reject(new Error("This exact action is already waiting for approval in this tab."));
  }
  if (input.expiresAt <= Date.now()) {
    return Promise.reject(new Error("The action approval has expired; submit the action again to obtain a new approval."));
  }

  return new Promise<T>((resolve, reject) => {
    const card: ActionApprovalCard = {
      id: input.id,
      toolId: safeLabel(input.toolId),
      permissionClass: safeLabel(input.permissionClass),
      operation: safeLabel(input.operation),
      reasonCode: safeLabel(input.reasonCode || "explicit approval"),
      expiresAt: input.expiresAt,
      createdAt: input.createdAt ?? Date.now(),
      inputKeys: (input.inputKeys ?? []).slice(0, 24).map(safeLabel),
      inputPreview: input.inputPreview ?? {},
      requestPath: safeLabel(input.requestPath),
      label: safeLabel(input.label),
      stage: "pending",
    };
    const entry: InternalContinuation = {
      card,
      execute: input.execute,
      resolve: (value) => resolve(value as T),
      reject,
    };
    entry.timer = setTimeout(() => expireContinuation(input.id), Math.max(1, input.expiresAt - Date.now()));
    // Do not let a pending UI challenge keep a Node-based smoke process alive.
    entry.timer.unref?.();
    continuations.set(input.id, entry);
    publish();
  });
}

/** Called by the global UI. Resolves runtime permission then retries the captured call at most once. */
export async function decideActionApproval(id: string, approved: boolean): Promise<void> {
  const entry = continuations.get(id);
  if (!entry || entry.card.stage !== "pending") return;
  if (entry.card.expiresAt <= Date.now()) {
    clearTimeout(entry.timer);
    entry.card.stage = "failed";
    entry.card.outcome = "Approval expired. No action was resumed.";
    continuations.delete(id);
    settled.unshift(structuredClone(entry.card));
    settled.splice(8);
    entry.reject(new Error("The action approval expired before it was resolved."));
    publish();
    return;
  }

  clearTimeout(entry.timer);
  entry.card.stage = "processing";
  publish();
  try {
    const value = await entry.execute(approved);
    if (!approved) {
      entry.card.stage = "declined";
      entry.card.outcome = "Declined. No side effect was resumed.";
      entry.reject(new Error("Action declined by the owner; no action was resumed."));
    } else {
      entry.card.stage = "completed";
      entry.card.outcome = "Approval accepted and the original request was retried once.";
      entry.resolve(value);
    }
    continuations.delete(id);
    settled.unshift(structuredClone(entry.card));
    settled.splice(8);
    publish();
  } catch (error) {
    entry.card.stage = "failed";
    entry.card.outcome = "The action was not confirmed as completed. Inspect its runtime status before retrying.";
    continuations.delete(id);
    settled.unshift(structuredClone(entry.card));
    settled.splice(8);
    entry.reject(error instanceof Error ? error : new Error(String(error)));
    publish();
  }
}
