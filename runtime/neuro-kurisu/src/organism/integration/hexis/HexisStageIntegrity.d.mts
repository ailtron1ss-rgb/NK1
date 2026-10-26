export interface HmxStageDigestInput {
  exportId: unknown;
  intent: unknown;
  strategy: unknown;
  sourceSubjectId?: unknown;
  sourceLineageId?: unknown;
  sectionCounts: unknown;
  protectedSections: unknown;
  conflicts: unknown;
  stagedSections: unknown;
}
export declare function computeHmxStageDigest(stage: HmxStageDigestInput): string;
export interface HmxStageLifecycleInput {
  stagingId: unknown;
  status: unknown;
  applicationAttempts?: number;
  application?: { digest?: unknown } | unknown;
  lifecycleDigest?: string;
}
export declare function computeHmxStageLifecycleDigest(stage: HmxStageLifecycleInput): string;
export declare function refreshHmxStageLifecycleDigest(stage: HmxStageLifecycleInput): string;
export declare function isValidHmxStageDigest(stage: unknown): boolean;
export declare function isSafeJsonTree(value: unknown): boolean;
