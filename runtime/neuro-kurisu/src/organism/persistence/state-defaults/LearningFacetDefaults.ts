/** Domain-specific default-state factory extracted from the persistence coordinator. */
import type { LearningFacet } from '../../core/types.ts';
import { defaultSelfAuthorship } from '../../cognition/SelfAuthorship.ts';
import { defaultSensorimotorState } from '../../cognition/SensorimotorLoop.ts';
import { defaultOperationalLife } from '../../learning/OperationalLifeEngine.ts';
import { defaultP36SelfDevelopment } from '../../learning/P36AutonomousSelfDevelopment.ts';
import { defaultAdaptivePolicy } from '../../learning/AdaptivePolicyEngine.ts';
import { defaultP23Learning } from '../../learning/P23LearningEngine.ts';
import { defaultP26TrueLearning } from '../../learning/P26TrueLearningEngine.ts';
import { defaultP28Plasticity } from '../../learning/P28PlasticitySubstrate.ts';
import { defaultP29Governance } from '../../learning/P29LearningGovernance.ts';
import { defaultP30Continual } from '../../learning/P30ContinualIntelligence.ts';
import { defaultDevelopmentalSynthesis } from '../../learning/DevelopmentalSynthesisEngine.ts';
import { defaultDevelopmentalExecutive } from '../../learning/DevelopmentalExecutiveEngine.ts';
import { defaultMetaDevelopmental } from '../../learning/MetaDevelopmentalStrategyEngine.ts';
import { defaultPersonalCurriculum } from '../../learning/PersonalCurriculumEngine.ts';
import { defaultPersonalWorldline } from '../../learning/PersonalWorldlineEngine.ts';
import { defaultIntegratedLifeTrajectory } from '../../learning/IntegratedLifeTrajectoryEngine.ts';
import { defaultCognitiveOrganismContinuity } from '../../learning/CognitiveOrganismContinuityEngine.ts';
import { defaultDevelopmentalPortfolio } from '../../learning/DevelopmentalPortfolioEngine.ts';
import { defaultLifeCourseNavigator } from '../../learning/LifeCourseNavigator.ts';
import { defaultP38Research } from '../../learning/P38AutonomousCausalResearch.ts';
import { defaultP39ContinuousLife } from '../../learning/P39ContinuousArtificialLife.ts';
import { defaultP40ModelEcology } from '../../learning/P40ModelEcology.ts';
import { defaultP44 } from '../../world/P44EmbodiedPredictiveSelfWorld.ts';

export const defaultLearningFacet = (): LearningFacet => ({
  selfAuthorship: defaultSelfAuthorship(),
  sensorimotor: defaultSensorimotorState(),
  valueRevisionLog: [],
  longitudinal: { cycles: 0, lastBenchmarkAt: 0, lastScore: 0 },
  neuromodulation: {
    dopamine01: .5, norepinephrine01: .42, acetylcholine01: .55, serotonin01: .58,
    explorationBias01: .5, exploitationBias01: .5, attentionGain01: .65, updateRate01: .35,
  },
  lifelong: {
    version: 1, phase: 'awake', cycleCount: 0, totalSleepMs: 0, replayCycles: 0,
    reconsolidations: 0, dormantMemories: 0, reactivatedMemories: 0, dreamCount: 0,
    microDreamCount: 0, deepDreamCount: 0, skillPromotions: 0, skillDemotions: 0,
    projectResumptions: 0, learningBudgetSpent: 0, learningBudgetLimit: .8, skills: [],
    dreams: [], sessions: [], lastSleepAt: 0, lastWakeAt: 0, lastConsolidationAt: 0,
    lastMaintenanceAt: 0, lastInsight: '', lastInsightConfidence: 0,
  },
  adaptivePolicy: defaultAdaptivePolicy(),
  p23: defaultP23Learning(),
  p26: defaultP26TrueLearning(),
  p28: defaultP28Plasticity(),
  p29: defaultP29Governance(),
  p30: defaultP30Continual(),
  p36: defaultP36SelfDevelopment(),
  p38: defaultP38Research(),
  p39: defaultP39ContinuousLife(),
  p40ModelEcology: defaultP40ModelEcology(),
  p44PredictiveWorld: defaultP44(),
  developmentalSynthesis: defaultDevelopmentalSynthesis(),
  developmentalExecutive: defaultDevelopmentalExecutive(),
  metaDevelopmental: defaultMetaDevelopmental(),
  personalCurriculum: defaultPersonalCurriculum(),
  developmentalPortfolio: defaultDevelopmentalPortfolio(),
  lifeCourseNavigator: defaultLifeCourseNavigator(),
  personalWorldline: defaultPersonalWorldline(),
  integratedLifeTrajectory: defaultIntegratedLifeTrajectory(),
  cognitiveOrganismContinuity: defaultCognitiveOrganismContinuity(),
  operationalLife: defaultOperationalLife(),
});
