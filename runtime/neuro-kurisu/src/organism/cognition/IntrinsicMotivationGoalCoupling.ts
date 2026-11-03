import { B272EndogenousGoalGenesis, type B272StepInput, type B272StepResult } from './B272EndogenousGoalGenesis.ts';
import { IntrinsicMotivationEngine, type IntrinsicDriveState } from './IntrinsicMotivationEngine.ts';

export type IntrinsicDriveSignals = Parameters<IntrinsicMotivationEngine['update']>[0];
export type EndogenousCycleInput = Omit<B272StepInput, 'intrinsicDrive01' | 'intrinsicDriveConfidence01'>;

export interface IntrinsicMotivationGoalStepInput {
  cycle: EndogenousCycleInput;
  drive: IntrinsicDriveSignals;
  /** Caller-calibrated trust in the drive estimate, independent of drive magnitude. */
  driveConfidence01: number;
}

export interface IntrinsicMotivationGoalStepResult {
  driveState: IntrinsicDriveState;
  driveGoal: ReturnType<IntrinsicMotivationEngine['proposeGoal']>;
  goal: B272StepResult;
  effectiveDrive01: number;
}

/**
 * Couples six intrinsic drives to endogenous goal valuation without introducing
 * another goal owner. B272 remains the canonical goal generator and receives
 * drive magnitude only after the caller supplies an independent confidence.
 *
 * The two stateful engines advance as one unit: a rejected cognitive tick rolls
 * both snapshots back, preventing drive history from drifting ahead of goals.
 */
export class IntrinsicMotivationGoalCoupling {
  constructor(
    readonly motivation: IntrinsicMotivationEngine,
    readonly goals: B272EndogenousGoalGenesis,
  ) {}

  step(input: IntrinsicMotivationGoalStepInput): IntrinsicMotivationGoalStepResult {
    if (typeof input.driveConfidence01 !== 'number'
      || !Number.isFinite(input.driveConfidence01)
      || input.driveConfidence01 < 0
      || input.driveConfidence01 > 1) {
      throw new RangeError('intrinsic drive confidence must be in [0, 1]');
    }

    const priorMotivation = this.motivation.snapshot();
    const priorGoals = this.goals.snapshot();
    try {
      const driveState = this.motivation.update(input.drive);
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
      };
    } catch (error) {
      this.motivation.restore(priorMotivation);
      this.goals.restore(priorGoals);
      throw error;
    }
  }

  snapshot() {
    return {
      motivation: this.motivation.snapshot(),
      goals: this.goals.snapshot(),
    };
  }
}
