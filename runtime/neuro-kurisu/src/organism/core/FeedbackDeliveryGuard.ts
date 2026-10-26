import type { ActionKind } from './types.ts';

const ACTIONS: readonly ActionKind[] = ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isDecisionId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 256
    && value.trim() === value
    && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
}

export interface FeedbackDeliveryReceipt {
  version: 1;
  tick: number;
  decisionId: string;
  action: ActionKind;
  status: 'completed';
}

export interface FeedbackDeliveryToken {
  readonly key: string;
  readonly tick: number;
  readonly decisionId: string;
  readonly action: ActionKind;
}

/**
 * Enforces one terminal feedback delivery per organism tick.
 *
 * A reservation is taken before any learner mutates state. If the processing
 * path throws, that in-memory reservation remains fail-closed: replaying the
 * same tick could otherwise double-train learners that ran before the error.
 * Successful receipts are persisted by OrganismCore for restart continuity.
 */
export class FeedbackDeliveryGuard {
  private readonly inFlightByTick = new Map<number, string>();

  begin(input: {
    tick: number;
    decisionId: string;
    action: ActionKind;
    previousReceipt?: unknown;
  }): FeedbackDeliveryToken {
    if (!isRecord(input)) throw new TypeError('feedback delivery input must be an object');
    if (!Number.isSafeInteger(input.tick) || input.tick < 0) {
      throw new RangeError('feedback delivery tick must be a non-negative safe integer');
    }
    if (!isDecisionId(input.decisionId)) throw new TypeError('feedback delivery decision id is invalid');
    if (!ACTIONS.includes(input.action)) throw new TypeError('feedback delivery action is invalid');

    const prior = input.previousReceipt;
    if (isRecord(prior) && prior.tick === input.tick) {
      if (prior.version !== 1
        || prior.status !== 'completed'
        || !isDecisionId(prior.decisionId)
        || !ACTIONS.includes(prior.action as ActionKind)) {
        throw new Error('feedback delivery receipt for the current tick is malformed; refusing replay');
      }
      throw new Error(`feedback for organism tick ${input.tick} has already been finalized`);
    }

    const inFlight = this.inFlightByTick.get(input.tick);
    if (inFlight) {
      throw new Error(`feedback for organism tick ${input.tick} is already in progress; refusing duplicate delivery`);
    }

    const key = `${input.tick}\\u0000${input.decisionId}\\u0000${input.action}`;
    this.inFlightByTick.set(input.tick, key);
    return { key, tick: input.tick, decisionId: input.decisionId, action: input.action };
  }

  complete(token: FeedbackDeliveryToken): FeedbackDeliveryReceipt {
    if (!token || this.inFlightByTick.get(token.tick) !== token.key) {
      throw new Error('feedback delivery completion does not match an in-flight reservation');
    }
    this.inFlightByTick.delete(token.tick);
    return {
      version: 1,
      tick: token.tick,
      decisionId: token.decisionId,
      action: token.action,
      status: 'completed',
    };
  }
}
