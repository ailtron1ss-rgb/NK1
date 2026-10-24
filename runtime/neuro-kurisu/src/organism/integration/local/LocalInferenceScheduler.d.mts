export interface LocalInferenceSchedulerOptions {
  maxConcurrentPerGroup?: number;
  maxQueuedPerGroup?: number;
  queueTimeoutMs?: number;
  clock?: () => number;
}
export interface LocalInferenceRunOptions {
  signal?: AbortSignal;
  queueTimeoutMs?: number;
}
export interface LocalInferenceGroupDiagnostics {
  id: string;
  active: number;
  pending: number;
  started: number;
  completed: number;
  failed: number;
  rejected: number;
  cancelled: number;
  timedOut: number;
  totalQueueWaitMs: number;
  maxQueueWaitMs: number;
}
export interface LocalInferenceSchedulerSnapshot {
  version: 1;
  policy: string;
  maxConcurrentPerGroup: number;
  maxQueuedPerGroup: number;
  queueTimeoutMs: number;
  active: number;
  pending: number;
  groups: LocalInferenceGroupDiagnostics[];
  privacy: { endpointKeysExposed: false; promptsLogged: false; modelPathsLogged: false };
}
export class LocalInferenceScheduler {
  constructor(options?: LocalInferenceSchedulerOptions);
  run<T>(rawGroup: string, task: () => Promise<T> | T, options?: LocalInferenceRunOptions): Promise<T>;
  snapshot(): LocalInferenceSchedulerSnapshot;
}
export function localEndpointResourceKey(provider: unknown, fallbackRole?: string): string;
export const sharedLocalInferenceScheduler: LocalInferenceScheduler;
