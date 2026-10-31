import type {
  AdapterApplyReceipt,
  AdapterVerification,
} from "./embodimentCoordinator";

export type EmbodimentRendererSignal =
  | { kind: "ready"; adapterId: string; executionId: string; stateRevision: number; modelId?: string }
  | { kind: "failed"; adapterId: string; executionId: string; stateRevision: number; reason: string }
  | { kind: "apply"; receipt: AdapterApplyReceipt }
  | { kind: "verify"; verification: AdapterVerification };

export type EmbodimentRendererSignalKind = EmbodimentRendererSignal["kind"];
