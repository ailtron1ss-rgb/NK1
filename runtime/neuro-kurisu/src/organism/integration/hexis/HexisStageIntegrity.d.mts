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
export declare function isValidHmxStageDigest(stage: unknown): boolean;
