export type OutcomeVerificationBasis = 'none' | 'tool-contract' | 'external-postcondition';

import type { WorldContext } from '../core/types.ts';

export interface OutcomeVerification {
  verified: boolean;
  basis: OutcomeVerificationBasis;
  confidence01: number;
  externalObservation?: boolean;
  observationId?: string;
  expectedPostcondition?: string;
  observedPostcondition?: string;
  notes?: string;
  observedWorldContextAfter?: WorldContext;
}

export interface OutcomeVerificationContext {
  toolId: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
}

export type OutcomeVerifier = (context: OutcomeVerificationContext) => Promise<OutcomeVerification> | OutcomeVerification;

const clamp = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));

export class OutcomeVerificationService {
  async verify(
    context: OutcomeVerificationContext,
    verifier?: OutcomeVerifier,
  ): Promise<OutcomeVerification> {
    if (verifier) {
      const checked = await verifier(context);
      const external = checked.basis === 'external-postcondition' || checked.externalObservation === true;
      if (checked.verified && external && !checked.observationId) {
        return {
          verified: false,
          basis: 'none',
          confidence01: 0,
          externalObservation: false,
          notes: 'external verification requires observationId',
        };
      }
      return {
        ...checked,
        confidence01: clamp(checked.confidence01),
        externalObservation: external,
      };
    }

    if (context.result.verified === true) {
      return {
        verified: true,
        basis: 'tool-contract',
        confidence01: 0.6,
        externalObservation: false,
        notes: 'tool explicitly declared its own contract-level verification',
      };
    }

    return {
      verified: false,
      basis: 'none',
      confidence01: 0,
      externalObservation: false,
      notes: 'no independent postcondition verifier was registered',
    };
  }
}
