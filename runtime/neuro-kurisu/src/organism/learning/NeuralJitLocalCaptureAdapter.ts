import type { OutcomeVerification, ExpectedDecisionOutcomeBinding } from '../system/OutcomeVerificationService.ts';
import type { NeuralJitActivationCaptureVerifier, NeuralJitActivationCapture } from './NeuralJitEngine.ts';

export interface NeuralJitInferenceTraceContext {
  decisionId: string;
  tick: number;
  taskFamily: string;
}

export interface NeuralJitLocalInferenceCaptureInput {
  traceContext: NeuralJitInferenceTraceContext;
  request: { system: string; user: string; maxTokens?: number; temperature?: number };
  response: { text: string; backend: string; model?: string; latencyMs: number };
  /** Evaluate a trained candidate in a detached model-host branch; this callback never mutates the base inference state. */
  evaluateCandidateShadow(candidateId: string, inputFeatures: number[]): {
    candidateId: string; rank: 1; residual: number[]; inputFingerprint: string;
    mode: 'shadow'; appliedToInference: false; fallback: 'base-inference-path';
  } | null;
}

/**
 * The model-host adapter is the only authority allowed to observe real hidden
 * activations. Stock OpenAI-compatible chat endpoints do not implement this
 * contract. The opaque pending handle remains process-local until a real
 * ActionGateway outcome is linked to the exact selected decision.
 */
export interface NeuralJitVerifiedOutcomeBinding {
  binding: ExpectedDecisionOutcomeBinding;
  inputFingerprint: string;
  taskFamily: string;
  tick: number;
  verification: OutcomeVerification;
  outcome: { ok: boolean; outcomeClass: string; confidence01: number };
  /** Cancellation is signalled when the runtime's bounded outcome-binding budget expires. */
  signal?: AbortSignal;
}

export interface NeuralJitLocalCaptureAdapter extends NeuralJitActivationCaptureVerifier {
  captureLocalInference(input: NeuralJitLocalInferenceCaptureInput): Promise<unknown | null>;
  bindVerifiedOutcome(
    pendingCapture: unknown,
    context: NeuralJitVerifiedOutcomeBinding,
  ): Promise<NeuralJitActivationCapture | null>;
}
