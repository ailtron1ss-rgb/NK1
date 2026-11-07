import { B272EndogenousGoalGenesis, type B272StepInput, type B272StepResult } from './B272EndogenousGoalGenesis.ts';
import { IntrinsicMotivationEngine, type IntrinsicDriveState } from './IntrinsicMotivationEngine.ts';
import { SelfPriorDensityModel, type SelfPriorObservation } from './SelfPriorDensityModel.ts';

export type IntrinsicDriveSignals = Parameters<IntrinsicMotivationEngine['update']>[0];
export type EndogenousCycleInput = Omit<B272StepInput, 'intrinsicDrive01' | 'intrinsicDriveConfidence01'>;

export interface IntrinsicMotivationGoalStepInput {
  cycle: EndogenousCycleInput;
  drive: IntrinsicDriveSignals;
  /** Caller-calibrated trust in the drive estimate, independent of drive magnitude. */
  driveConfidence01: number;
  /** Current self-latent observation; scored before it updates the learned prior. */
  selfObservation?: readonly number[];
  at?: number;
}

export interface IntrinsicMotivationGoalStepResult {
  driveState: IntrinsicDriveState;
  driveGoal: ReturnType<IntrinsicMotivationEngine['proposeGoal']>;
  goal: B272StepResult;
  effectiveDrive01: number;
  selfPrior: SelfPriorObservation;
}

/**
 * Couples intrinsic drives, a learned self-state predictive prior and B272 goal
 * valuation without introducing another goal owner. The prior is scored before
 * update; bounded self-surprise contributes to coherence/model reconciliation,
 * never to an energy-restoration drive. A rejected tick rolls all three owners back.
 */
export class IntrinsicMotivationGoalCoupling {
  readonly motivation: IntrinsicMotivationEngine;
  readonly goals: B272EndogenousGoalGenesis;
  readonly selfPrior: SelfPriorDensityModel;

  constructor(motivation: IntrinsicMotivationEngine, goals: B272EndogenousGoalGenesis, selfPrior = new SelfPriorDensityModel()) {
    this.motivation = motivation;
    this.goals = goals;
    this.selfPrior = selfPrior;
  }

  step(input: IntrinsicMotivationGoalStepInput): IntrinsicMotivationGoalStepResult {
    if (typeof input.driveConfidence01 !== 'number'
      || !Number.isFinite(input.driveConfidence01)
      || input.driveConfidence01 < 0
      || input.driveConfidence01 > 1) {
      throw new RangeError('intrinsic drive confidence must be in [0, 1]');
    }

    const priorMotivation = this.motivation.snapshot();
    const priorGoals = this.goals.snapshot();
    const priorSelfPrior = this.selfPrior.snapshot();
    try {
      const selfPrior = input.selfObservation
        ? this.selfPrior.observe(input.selfObservation, input.at)
        : { mismatch01: 0, confidence01: 0, rmsZ: 0, sampleCount: priorSelfPrior.sampleCount };
      const driveState = this.motivation.update({
        ...input.drive,
        selfPriorMismatch01: selfPrior.mismatch01,
        selfPriorConfidence01: selfPrior.confidence01,
      });
      const driveGoal = this.motivation.proposeGoal();
      const goal = this.goals.step({
        ...input.cycle,
        intrinsicDrive01: driveState.overall,
        intrinsicDriveConfidence01: input.driveConfidence01,
      });
      return {
        driveState,
        driveGoal,
        goal,
        effectiveDrive01: driveState.overall * input.driveConfidence01,
        selfPrior,
      };
    } catch (error) {
      this.motivation.restore(priorMotivation);
      this.goals.restore(priorGoals);
      this.selfPrior.restore(priorSelfPrior);
      throw error;
    }
  }

  snapshot() {
    return {
      motivation: this.motivation.snapshot(),
      goals: this.goals.snapshot(),
      selfPrior: this.selfPrior.snapshot(),
    };
  }
}
