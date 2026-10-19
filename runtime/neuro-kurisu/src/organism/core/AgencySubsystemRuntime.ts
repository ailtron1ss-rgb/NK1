import { probeOrganismSystem, type OrganismSystemHealthSnapshot } from './OrganismSystemContract.ts';
import { SelfProjectEngine } from '../cognition/evolution/SelfProjectEngine.ts';
import { AgencyDeliberationEngine } from '../cognition/evolution/AgencyDeliberationEngine.ts';
import { CognitiveBudgetManager } from '../cognition/CognitiveBudgetManager.ts';
import { CognitiveQuorumEngine } from '../system/CognitiveQuorum.ts';
import { AutonomousProjectExecutor } from '../system/AutonomousProjectExecutor.ts';
import { MultiProjectScheduler } from '../system/MultiProjectScheduler.ts';
import type { SelfProjectState } from '../cognition/evolution/SelfProjectEngine.ts';
import type { AgencyDeliberationState } from '../cognition/evolution/AgencyDeliberationEngine.ts';
import type { CognitiveBudgetState, CognitiveBudgetLedgerEntry } from '../cognition/CognitiveBudgetManager.ts';
import type { CognitiveQuorumState } from '../system/CognitiveQuorum.ts';
import type { ProjectExecutionState } from '../system/AutonomousProjectExecutor.ts';
import { P67AutonomousGoalGenesis } from '../developmental/P67AutonomousGoalGenesis.ts';
import { P68GoalEcology } from '../developmental/P68GoalEcology.ts';
import { B306AutonomousInitiativeVerificationLedger } from '../system/B306AutonomousInitiativeVerificationLedger.ts';
import { B333AutonomousGoalGenesisGate, defaultB333State } from '../system/B333AutonomousGoalGenesisGate.ts';
import { B334AutonomousProjectLifecycleGate, defaultB334State } from '../system/B334AutonomousProjectLifecycleGate.ts';
import { B335AutonomousProjectHoldoutGate, defaultB335State } from '../system/B335AutonomousProjectHoldoutGate.ts';
import { B336ProjectCausalOwnershipGate, defaultB336State } from '../system/B336ProjectCausalOwnershipGate.ts';
import { DecisionActionPipeline, type DecisionCandidateTrace } from './DecisionActionPipeline.ts';
import { LongHorizonAutonomyController } from '../system/LongHorizonAutonomyController.ts';
import { AutonomousResourceToolLifeController } from '../system/AutonomousResourceToolLifeController.ts';
import { AutonomousRuntimeLifeController } from '../system/AutonomousRuntimeLifeController.ts';
import { SelfDirectedLifeOrchestrator } from '../system/SelfDirectedLifeOrchestrator.ts';
import { AutonomousLearningMemoryGovernor } from '../system/AutonomousLearningMemoryGovernor.ts';
import { AutonomousRelationshipManager } from '../system/AutonomousRelationshipManager.ts';
import { OpenEndedSkillAcquisitionController } from '../system/OpenEndedSkillAcquisitionController.ts';
import { AutonomousSocialInitiativeEngine } from '../system/AutonomousSocialInitiativeEngine.ts';
import { LiveSelfImprovementSupervisor } from '../system/LiveSelfImprovementSupervisor.ts';

/**
 * BIG PASS 49: physical ownership boundary for agency/evolution runtime.
 * OrganismCore coordinates this subsystem but no longer owns these engines directly.
 */
export class AgencySubsystemRuntime {
  readonly systemName='agency' as const;
  readonly dependencies=['self', 'world', 'governance'] as const;
  readonly systemCapabilities=['state', 'agency', 'persistence'] as const;
  health(): OrganismSystemHealthSnapshot { return probeOrganismSystem(this); }

  readonly selfProjects = new SelfProjectEngine();
  readonly deliberation = new AgencyDeliberationEngine();
  readonly budget = new CognitiveBudgetManager();
  readonly quorum = new CognitiveQuorumEngine();
  readonly projectExecutor = new AutonomousProjectExecutor();
  readonly projectScheduler = new MultiProjectScheduler();
  readonly p67AutonomousGoalGenesis = new P67AutonomousGoalGenesis();
  readonly p68GoalEcology = new P68GoalEcology();


  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly b306AutonomousInitiativeVerification = new B306AutonomousInitiativeVerificationLedger();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly b333AutonomousGoalGenesis = new B333AutonomousGoalGenesisGate();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly b334AutonomousProjectLifecycle = new B334AutonomousProjectLifecycleGate();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly b335AutonomousProjectHoldout = new B335AutonomousProjectHoldoutGate();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly b336ProjectCausalOwnership = new B336ProjectCausalOwnershipGate();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly decisionActionPipeline = new DecisionActionPipeline();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly longHorizonAutonomy = new LongHorizonAutonomyController();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly autonomousResourceToolLife = new AutonomousResourceToolLifeController();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly autonomousRuntimeLife = new AutonomousRuntimeLifeController();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly selfDirectedLife = new SelfDirectedLifeOrchestrator();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly autonomousLearningMemory = new AutonomousLearningMemoryGovernor();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly autonomousRelationships = new AutonomousRelationshipManager();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly openEndedSkillAcquisition = new OpenEndedSkillAcquisitionController();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly autonomousSocialInitiative = new AutonomousSocialInitiativeEngine();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly liveSelfImprovementSupervisor = new LiveSelfImprovementSupervisor();
  restore(input: {
    selfProjects?: SelfProjectState;
    agency?: AgencyDeliberationState;
    budget?: CognitiveBudgetState & { ledger?: CognitiveBudgetLedgerEntry[] };
    quorum?: Partial<CognitiveQuorumState>;
    executor?: Partial<ProjectExecutionState> | null;
    p67?: unknown; p68?: unknown;
  }) {
    this.selfProjects.restore(input.selfProjects);
    this.deliberation.restore(input.agency);
    this.budget.restore(input.budget);
    this.quorum.restore(input.quorum);
    this.projectExecutor.restore(input.executor);
    this.p67AutonomousGoalGenesis.restore(input.p67 as any);
    this.p68GoalEcology.restore(input.p68 as any);
  }

  snapshot() {
    return {
      selfProjects: this.selfProjects.snapshot(),
      agency: this.deliberation.snapshot(),
      budget: this.budget.snapshot(),
      quorum: this.quorum.snapshot(),
      executor: this.projectExecutor.snapshot(),
      p67: this.p67AutonomousGoalGenesis.snapshot(),
      p68: this.p68GoalEcology.snapshot(),
    };
  }
}
