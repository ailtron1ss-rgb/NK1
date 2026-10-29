import type { ActionKind } from '../core/types.ts';
import { normalizeNeuralSpaceFrame, validateNeuralSpaceContract, NEURAL_INPUT_DIM } from './NeuralSpaceContract.ts';
import { AdaptiveNeuralContinuityController, defaultAdaptiveNeuralContinuity, type AdaptiveNeuralContinuityState } from './AdaptiveNeuralContinuityController.ts';
import { AdaptiveCausalMemoryPlanner, defaultAdaptiveCausalMemoryPlanner, type AdaptiveCausalMemoryPlannerState } from './AdaptiveCausalMemoryPlanner.ts';
import { EmbodiedCausalWorldBridge, defaultEmbodiedCausalWorldBridge, type EmbodiedCausalWorldBridgeState } from './EmbodiedCausalWorldBridge.ts';
import { WorldModelEvidenceGate, defaultWorldModelEvidenceGate, type WorldModelEvidenceGateState } from './WorldModelEvidenceGate.ts';
import { TransferableEmbodiedSkillSystem, defaultTransferableEmbodiedSkillSystem, type TransferableEmbodiedSkillSystemState } from './TransferableEmbodiedSkillSystem.ts';
import { HierarchicalProceduralSkillEngine, defaultHierarchicalProceduralSkillEngine, type HierarchicalProceduralSkillEngineState } from './HierarchicalProceduralSkillEngine.ts';
import { TaskAgnosticTransferRouter, defaultTaskAgnosticTransferRouter, type TaskAgnosticTransferRouterState } from './TaskAgnosticTransferRouter.ts';
import { RiskAwareRecoveryController, defaultRiskAwareRecoveryController, type RiskAwareRecoveryControllerState } from './RiskAwareRecoveryController.ts';
import { GoalIdentitySkillModulator, defaultGoalIdentitySkillModulator, type GoalIdentitySkillModulatorState } from './GoalIdentitySkillModulator.ts';
import { DeviceAwareNeuralScheduler, defaultDeviceAwareNeuralScheduler, type DeviceAwareNeuralSchedulerState } from './DeviceAwareNeuralScheduler.ts';
import { SelfOptimizingAutobiographicalMemory, defaultSelfOptimizingAutobiographicalMemory, type SelfOptimizingAutobiographicalMemoryState } from './SelfOptimizingAutobiographicalMemory.ts';
import { AdaptiveDevelopmentalController, defaultAdaptiveDevelopmentalController, type AdaptiveDevelopmentalControllerState } from './AdaptiveDevelopmentalController.ts';
import { CrossLayerAdaptiveArbiter, defaultCrossLayerAdaptiveArbiter, type CrossLayerAdaptiveArbiterState, type ArbiterBiases } from './CrossLayerAdaptiveArbiter.ts';
import { ExternalGroundingAdaptiveController, defaultExternalGroundingAdaptiveController, type ExternalGroundingAdaptiveControllerState } from './ExternalGroundingAdaptiveController.ts';
import { ActiveInformationGainController, defaultActiveInformationGainController, type ActiveInformationGainState } from './ActiveInformationGainController.ts';
import { ClosedLoopEvidenceLedger, defaultClosedLoopEvidenceLedger, type ClosedLoopEvidenceLedgerState } from './ClosedLoopEvidenceLedger.ts';
import { B2525LearnedLatentTransitionField, defaultB2525State, type B2525State } from './B2525LearnedLatentTransitionField.ts';
import { B2526MultiscaleCausalRegimeGraph, defaultB2526State, type B2526State } from './B2526MultiscaleCausalRegimeGraph.ts';
import { B2527FactorialAblationHarness, defaultB2527State, type B2527State } from './B2527FactorialAblationHarness.ts';
import { B2528HierarchicalWorldModelFabric, defaultB2528State, type B2528State } from './B2528HierarchicalWorldModelFabric.ts';
import { B2529PolicyInformationGainController, defaultB2529State, type B2529State } from './B2529PolicyInformationGainController.ts';
import { B2530AutonomousExperimentScheduler, defaultB2530State, type B2530State } from './B2530AutonomousExperimentScheduler.ts';
import { NeuralTemporalSubstrate, defaultNeuralTemporalSubstrate, type NeuralTemporalSubstrateState } from './NeuralTemporalSubstrate.ts';
import { P2702PersistentPersonalityDynamics, defaultP2702PersistentPersonality, type P2702PersonalityState } from './P2702PersistentPersonalityDynamics.ts';
import { P2703GlobalWorkspaceConvergence, defaultP2703Workspace, type P2703WorkspaceState, type P2703WorkspaceCandidate } from './P2703GlobalWorkspaceConvergence.ts';
import { P2708DeepLearningCoupler, defaultP2708DeepLearningCoupler, type P2708DeepLearningCouplerState } from './P2708DeepLearningCoupler.ts';
import { P2716DeepIntegrationController, defaultP2716DeepIntegration, type P2716DeepIntegrationState } from './P2716DeepIntegrationController.ts';
import { P2720AdaptiveLifelongController, defaultP2720AdaptiveLifelong, type P2720AdaptiveLifelongState } from './P2720AdaptiveLifelongController.ts';
import { P2724AutonomousContinualFabric, defaultP2724AutonomousContinual, type P2724AutonomousContinualState } from './P2724AutonomousContinualFabric.ts';
import { P2734SelfOptimizingContinualController, defaultP2734SelfOptimizingContinual, type P2734MetaState } from './P2734SelfOptimizingContinualController.ts';
import { P2742CausalPredictiveInterventionFabric, defaultP2742CausalPredictiveIntervention, type P2742State } from './P2742CausalPredictiveInterventionFabric.ts';
import { P2750UnifiedCausalWorldLoop, defaultP2750UnifiedCausalWorldLoop, type P2750State } from './P2750UnifiedCausalWorldLoop.ts';
import { P2774ModelTimeReplayConsolidator, type P2774State } from './P2774ModelTimeReplayConsolidator.ts';
import { P2805StabilityPlasticityArbiter, type P2805State } from './P2805StabilityPlasticityArbiter.ts';
import { P2820SelfKnowledgeCoresetBridge, type P2820State } from './P2820SelfKnowledgeCoresetBridge.ts';
import { P2835TransferSafetySynergyController, type P2835State } from './P2835TransferSafetySynergyController.ts';
import { P2852OfflineConsolidationController, defaultP2852OfflineConsolidation, type P2852OfflineConsolidationState } from './P2852OfflineConsolidationController.ts';
import { P2853SlowMemoryConsolidationController, defaultP2853SlowMemoryConsolidation, type P2853SlowMemoryConsolidationState, type P2853SlowMemoryPhase } from './P2853SlowMemoryConsolidationController.ts';
import { P2854HierarchicalSlowMemoryController, defaultP2854HierarchicalSlowMemory, type P2854HierarchicalSlowMemoryState, type P2854SlowMemoryPhase } from './P2854HierarchicalSlowMemoryController.ts';
import { P2855ContextualActionPolicyController, defaultP2855ContextualActionPolicy, type P2855ContextualActionPolicyState, type P2855ActionPolicyPhase } from './P2855ContextualActionPolicyController.ts';
import { VerifiedSyntheticTrajectoryGate, defaultVerifiedSyntheticTrajectoryGate, type VerifiedSyntheticTrajectoryGateState } from './VerifiedSyntheticTrajectoryGate.ts';

const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const tanh=(x:number)=>Math.tanh(Math.max(-6,Math.min(6,x)));
const sigmoid=(x:number)=>1/(1+Math.exp(-Math.max(-8,Math.min(8,x))));
const prand=(seed:number)=>{let x=seed|0;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);x^=x>>>13;return (x>>>0)/0xffffffff;};
const finite=(x:number,f=0)=>Number.isFinite(x)?x:f;
const deep=(x:any)=>structuredClone(x);
const selfKnowledgeMetricsSafe=(m:any,ctx:number)=>clamp(Number(m?.teacherConfidence01?.[Math.max(0,Math.min(7,Math.floor(ctx)))]??.5));

export interface NeuralExperienceToken {
  tick:number;
  contextId?:number;
  input:number[];
  neuralBefore:number[];
  neuralAfter:number[];
  prediction01:number;
  actual01:number;
  predictionError01:number;
  pressure01:number;
  novelty01:number;
  uncertainty01:number;
  reward01:number;
  action:ActionKind|null;
  actionUtilities:Record<ActionKind,number>;
  selectedAssembly:number[];
  replayEligible:boolean;
  verified:boolean;
  replayPriority01?:number;
  retrievedMemoryIds?:string[];
  policyCue?:number[];
  policyContextId?:number;
}

export interface NeuralExperienceBranchState {
  version:32;
  contractVersion:number;
  persistentPersonality:P2702PersonalityState;
  globalWorkspaceConvergence:P2703WorkspaceState;
  temporalSubstrate:NeuralTemporalSubstrateState;
  populationKinds:string[];
  areaOf:number[];
  edgeTargets:number[][];
  edgeWeights:number[][];
  edgeDelays:number[][];
  delayHistory:number[][];
  edgeEligibility:number[][];
  delayEligibility:number[][];
  cascadeEligibilityMid:number[][];
  cascadeEligibilitySlow:number[][];
  astroGate:number[];
  edgeUncertainty:number[][];
  inputEligibility:number[][];
  inputMean:number[];
  inputVar:number[];
  inputNormCount:number;
  excitatoryFraction01:number;
  inhibition01:number;
  areaPrediction01:number[];
  enabled:boolean;
  tick:number;
  cycles:number;
  learningUpdates:number;
  neurons:number;
  areas:number;
  state:number[];
  velocity:number[];
  thresholds:number[];
  gains:number[];
  plasticity:number[];
  activityEma:number[];
  recurrent:number[][];
  inputProjection:number[][];
  actionReadout:number[][];
  predictionReadout:number[];
  delayLearningUpdates:number;
  eligibilityUpdates:number;
  sensoryLearningUpdates:number;
  memoryLearningUpdates:number;
  metaplasticityUpdates:number;
  pressure:number[];
  pressureNames:string[];
  prediction01:number;
  predictionError01:number;
  novelty01:number;
  uncertainty01:number;
  coherence01:number;
  sparsity01:number;
  structuralUpdates:number;
  structuralGrew:number;
  structuralPruned:number;
  replayBuffer:NeuralExperienceToken[];
  replayCompactions:number;
  replayCompactedTokens:number;
  lastExperience:NeuralExperienceToken|null;
  holdoutSeen:number;
  holdoutCorrect:number;
  generalization01:number;
  computeCost01:number;
  eligibilityDecay01:number;
  metaplasticity01:number;
  slowMemory:number[];
  slowMemoryDecay:number[];
  slowMemoryReadout:number[];
  slowMemoryInput:number[][];
  longMemoryStability01:number;
  cueTraceStrength01:number;
  eligibilityClipCount:number;
  homeostaticScaleUpdates:number;
  meanFiring01:number;
  replayDiversity01:number;
  replayWeightUpdates:number;
  replaySignedCredit01:number;
  replayEvaluated:number;
  replayTaskErrorBefore01:number;
  replayTaskErrorAfter01:number;
  replayUtilityGain01:number;
  replayRollbacks:number;
  replayTransferRejected:number;
  developmentalPlasticityScale01:number;
  crossModalAgreement01:number;
  crossModalUpdates:number;
  crossModalPairWeights:number[][];
  crossModalTraces:number[][];
  offlineConsolidation:P2852OfflineConsolidationState;
  slowMemoryConsolidation:P2853SlowMemoryConsolidationState;
  hierarchicalSlowMemory:P2854HierarchicalSlowMemoryState;
  contextualActionPolicy:P2855ContextualActionPolicyState;
  verifiedSyntheticTrajectoryGate:VerifiedSyntheticTrajectoryGateState;
  fastPlasticity01:number;
  mediumPlasticity01:number;
  slowPlasticity01:number;
  semanticRecurrentProtection01:number;
  multiscalePlasticityUpdates:number;
  onlineCreditUpdates:number;
  creditBaseline01:number;
  creditModelResidual01:number;
  creditAgreement01:number;
  creditTraceNorm01:number;
  onlineCreditMix01:number;
  cascadeCreditUpdates:number;
  cascadeCreditNorm01:number;
  astroGateMean01:number;
  longDelayCredit01:number;
  adaptiveCreditMix01:number;
  experimentalLayerEnabled:boolean;
  deepLearningCoupler:P2708DeepLearningCouplerState;
  deepIntegration:P2716DeepIntegrationState;
  adaptiveLifelong:P2720AdaptiveLifelongState;
  autonomousContinual:P2724AutonomousContinualState;
  selfOptimizingContinual:P2734MetaState;
  causalPredictiveIntervention:P2742State;
  unifiedCausalWorldLoop:P2750State;
  modelTimeReplay:P2774State;
  stabilityPlasticity:P2805State;
  selfKnowledgeCoreset:P2820State;
  transferSafetySynergy:P2835State;
  continuity:AdaptiveNeuralContinuityState;
  causalPlanner:AdaptiveCausalMemoryPlannerState;
  causalSensitivity01:number;
  transfer01:number;
  foresightQuality01:number;
  embodiedBridge:EmbodiedCausalWorldBridgeState;
  worldModelGate:WorldModelEvidenceGateState;
  transferableSkills:TransferableEmbodiedSkillSystemState;
  hierarchicalSkills:HierarchicalProceduralSkillEngineState;
  taskAgnosticTransfer:TaskAgnosticTransferRouterState;
  riskRecovery:RiskAwareRecoveryControllerState;
  goalIdentityModulator:GoalIdentitySkillModulatorState;
  deviceScheduler:DeviceAwareNeuralSchedulerState;
  selfOptimizingMemory:SelfOptimizingAutobiographicalMemoryState;
  developmentalController:AdaptiveDevelopmentalControllerState;
  crossLayerArbiter:CrossLayerAdaptiveArbiterState;
  externalGrounding:ExternalGroundingAdaptiveControllerState;
  activeInformationGain:ActiveInformationGainState;
  evidenceLedger:ClosedLoopEvidenceLedgerState;
  learnedTransition:B2525State;
  causalRegimeGraph:B2526State;
  factorialAblation:B2527State;
  hierarchicalWorldModel:B2528State;
  policyInformationGain:B2529State;
  autonomousExperimentScheduler:B2530State;
}

const defaultActionReadout=(n:number)=>ACTIONS.map(()=>new Array(n).fill(0));
const makeMatrix=(rows:number,cols:number,seed:number,scale=.12)=>Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>((prand(seed+r*97+c*31)*2)-1)*scale));
const makeNested=(rows:number,cols:number,fn:(r:number,c:number)=>number)=>Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>fn(r,c)));

export const defaultNeuralExperienceBranch=():NeuralExperienceBranchState=>{
  const neurons=96, input=64, edges=12, memory=16;
  return {
    version:32,contractVersion:1,enabled:true,tick:0,cycles:0,learningUpdates:0,neurons,areas:8,
    populationKinds:Array.from({length:neurons},(_,i)=>i%12<9?'E':'I'),areaOf:Array.from({length:neurons},(_,i)=>Math.floor(i/12)),
    edgeTargets:Array.from({length:neurons},(_,i)=>Array.from({length:edges},(_,q)=>(i*17+q*29+3)%neurons)),
    edgeWeights:makeNested(neurons,edges,(i,q)=>((prand(7100+i*13+q*31)*2)-1)*.035),
    edgeDelays:Array.from({length:neurons},(_,i)=>Array.from({length:edges},(_,q)=>1+Math.floor(prand(8100+i*7+q*19)*3))),
    delayHistory:Array.from({length:neurons},()=>new Array(4).fill(0)),
    edgeEligibility:Array.from({length:neurons},()=>new Array(edges).fill(0)),
    delayEligibility:Array.from({length:neurons},()=>new Array(edges).fill(0)),
    cascadeEligibilityMid:Array.from({length:neurons},()=>new Array(edges).fill(0)),
    cascadeEligibilitySlow:Array.from({length:neurons},()=>new Array(edges).fill(0)),
    astroGate:new Array(neurons).fill(.72),
    edgeUncertainty:Array.from({length:neurons},()=>new Array(edges).fill(.65)),
    inputEligibility:Array.from({length:neurons},()=>new Array(input).fill(0)),
    inputMean:new Array(input).fill(0),inputVar:new Array(input).fill(.25),inputNormCount:1,
    excitatoryFraction01:.75,inhibition01:.2,areaPrediction01:new Array(8).fill(.5),
    state:new Array(neurons).fill(0),velocity:new Array(neurons).fill(0),thresholds:new Array(neurons).fill(.22),activityEma:new Array(neurons).fill(.10),
    gains:new Array(neurons).fill(.8),plasticity:new Array(neurons).fill(.35),
    recurrent:makeMatrix(neurons,neurons,101,.035),inputProjection:makeMatrix(neurons,input,303,.055),
    actionReadout:defaultActionReadout(neurons),predictionReadout:Array.from({length:neurons},(_,i)=>((prand(9300+i*17)*2)-1)*.05),
    delayLearningUpdates:0,eligibilityUpdates:0,sensoryLearningUpdates:0,memoryLearningUpdates:0,metaplasticityUpdates:0,
    pressure:new Array(6).fill(.15),pressureNames:['prediction','homeostasis','identity','goal','novelty','uncertainty'],
    prediction01:.5,predictionError01:.5,novelty01:.2,uncertainty01:.3,coherence01:.5,sparsity01:.9,
    structuralUpdates:0,structuralGrew:0,structuralPruned:0,replayBuffer:[],replayCompactions:0,replayCompactedTokens:0,lastExperience:null,holdoutSeen:0,holdoutCorrect:0,
    generalization01:0,computeCost01:0,eligibilityDecay01:.86,metaplasticity01:.65,
    slowMemory:new Array(memory).fill(0),slowMemoryDecay:Array.from({length:memory},(_,i)=>.92+i*.005),
    slowMemoryReadout:Array.from({length:memory},(_,i)=>((prand(14000+i*11)*2)-1)*.08),
    slowMemoryInput:makeMatrix(memory,16,15100,.08),longMemoryStability01:.5,cueTraceStrength01:0,eligibilityClipCount:0,homeostaticScaleUpdates:0,meanFiring01:.10,replayDiversity01:0,replayWeightUpdates:0,replaySignedCredit01:0,replayEvaluated:0,replayTaskErrorBefore01:.5,replayTaskErrorAfter01:.5,replayUtilityGain01:.5,replayRollbacks:0,replayTransferRejected:0,developmentalPlasticityScale01:1,crossModalAgreement01:.5,crossModalUpdates:0,crossModalPairWeights:Array.from({length:8},(_,i)=>Array.from({length:8},(_,j)=>i===j?1:.25)),crossModalTraces:Array.from({length:8},()=>new Array(8).fill(0)),
    offlineConsolidation:defaultP2852OfflineConsolidation(),slowMemoryConsolidation:defaultP2853SlowMemoryConsolidation(),hierarchicalSlowMemory:defaultP2854HierarchicalSlowMemory(),contextualActionPolicy:defaultP2855ContextualActionPolicy(),fastPlasticity01:.72,mediumPlasticity01:.58,slowPlasticity01:.42,semanticRecurrentProtection01:.84,multiscalePlasticityUpdates:0,
    onlineCreditUpdates:0,creditBaseline01:0,creditModelResidual01:0,creditAgreement01:0,creditTraceNorm01:0,onlineCreditMix01:.65,cascadeCreditUpdates:0,cascadeCreditNorm01:0,
    astroGateMean01:.72,longDelayCredit01:0,adaptiveCreditMix01:.65,experimentalLayerEnabled:true,
    deepLearningCoupler:defaultP2708DeepLearningCoupler(),deepIntegration:defaultP2716DeepIntegration().snapshot(),adaptiveLifelong:defaultP2720AdaptiveLifelong().snapshot(),
    autonomousContinual:defaultP2724AutonomousContinual(),selfOptimizingContinual:defaultP2734SelfOptimizingContinual(),causalPredictiveIntervention:defaultP2742CausalPredictiveIntervention(),unifiedCausalWorldLoop:defaultP2750UnifiedCausalWorldLoop(),modelTimeReplay:new P2774ModelTimeReplayConsolidator().snapshot(),stabilityPlasticity:new P2805StabilityPlasticityArbiter(neurons).snapshot(),selfKnowledgeCoreset:new P2820SelfKnowledgeCoresetBridge().snapshot(),transferSafetySynergy:new P2835TransferSafetySynergyController().snapshot(),
    continuity:defaultAdaptiveNeuralContinuity(),causalPlanner:defaultAdaptiveCausalMemoryPlanner(),temporalSubstrate:defaultNeuralTemporalSubstrate(),persistentPersonality:defaultP2702PersistentPersonality(),globalWorkspaceConvergence:defaultP2703Workspace(),causalSensitivity01:0,transfer01:0,foresightQuality01:.5,
    embodiedBridge:defaultEmbodiedCausalWorldBridge(),worldModelGate:defaultWorldModelEvidenceGate(),transferableSkills:defaultTransferableEmbodiedSkillSystem(),
    hierarchicalSkills:defaultHierarchicalProceduralSkillEngine(),taskAgnosticTransfer:defaultTaskAgnosticTransferRouter(),riskRecovery:defaultRiskAwareRecoveryController(),
    goalIdentityModulator:defaultGoalIdentitySkillModulator(),deviceScheduler:defaultDeviceAwareNeuralScheduler(),selfOptimizingMemory:defaultSelfOptimizingAutobiographicalMemory(),
    developmentalController:defaultAdaptiveDevelopmentalController(),
    crossLayerArbiter:defaultCrossLayerAdaptiveArbiter(),
    externalGrounding:defaultExternalGroundingAdaptiveController(),
    activeInformationGain:defaultActiveInformationGainController(),
    evidenceLedger:defaultClosedLoopEvidenceLedger(),
    learnedTransition:defaultB2525State(),
    causalRegimeGraph:defaultB2526State(),
    factorialAblation:defaultB2527State(),
    hierarchicalWorldModel:defaultB2528State(),
    policyInformationGain:defaultB2529State(),
    verifiedSyntheticTrajectoryGate:defaultVerifiedSyntheticTrajectoryGate(),
    autonomousExperimentScheduler:defaultB2530State(),
  };
};


function selfMemoryBiasFallback(m:any):Record<ActionKind,number>{const z=Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;if(m.selectedStrategy==='verify')z.verify=.03;if(m.selectedStrategy==='explore')z.explore=.03;if(m.selectedStrategy==='reflect')z.reflect=.03;if(m.selectedStrategy==='abstain')z.defer=.03;return z;}
function developmentalBiasForLearning(m:any):Record<ActionKind,number>{const z=Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;if(m.selectedAction&&ACTIONS.includes(m.selectedAction))z[m.selectedAction as ActionKind]=.025;return z;}

export class NeuralExperienceBranch {
  private state=defaultNeuralExperienceBranch();
  private readonly offlineConsolidation=new P2852OfflineConsolidationController();
  private readonly slowMemoryConsolidation=new P2853SlowMemoryConsolidationController();
  private readonly hierarchicalSlowMemory=new P2854HierarchicalSlowMemoryController();
  private readonly contextualActionPolicy=new P2855ContextualActionPolicyController();
  private readonly verifiedSyntheticTrajectoryGate=new VerifiedSyntheticTrajectoryGate();
  private continuity=new AdaptiveNeuralContinuityController();
  private causalPlanner=new AdaptiveCausalMemoryPlanner();
  private embodiedBridge=new EmbodiedCausalWorldBridge();
  private worldModelGate=new WorldModelEvidenceGate();
  private transferableSkills=new TransferableEmbodiedSkillSystem();
  private hierarchicalSkills=new HierarchicalProceduralSkillEngine();
  private taskAgnosticTransfer=new TaskAgnosticTransferRouter();
  private riskRecovery=new RiskAwareRecoveryController();
  private goalIdentityModulator=new GoalIdentitySkillModulator();
  private deviceScheduler=new DeviceAwareNeuralScheduler();
  private selfOptimizingMemory=new SelfOptimizingAutobiographicalMemory();
  private developmentalController=new AdaptiveDevelopmentalController();
  private crossLayerArbiter=new CrossLayerAdaptiveArbiter();
  private lastArbiterBiases:ArbiterBiases|null=null;
  private lastHierarchicalActionBias:number[]=[];
  private externalGrounding=new ExternalGroundingAdaptiveController();
  private activeInformationGain=new ActiveInformationGainController();
  private evidenceLedger=new ClosedLoopEvidenceLedger();
  private learnedTransition=new B2525LearnedLatentTransitionField();
  private causalRegimeGraph=new B2526MultiscaleCausalRegimeGraph();
  private factorialAblation=new B2527FactorialAblationHarness();
  private hierarchicalWorldModel=new B2528HierarchicalWorldModelFabric();
  private policyInformationGain=new B2529PolicyInformationGainController();
  private autonomousExperimentScheduler=new B2530AutonomousExperimentScheduler();
  private temporalSubstrate=new NeuralTemporalSubstrate();
  private persistentPersonality=new P2702PersistentPersonalityDynamics();
  private deepLearningCoupler=new P2708DeepLearningCoupler();
  private deepIntegration=new P2716DeepIntegrationController(96);
  private adaptiveLifelong=new P2720AdaptiveLifelongController(96);
  private autonomousContinual=new P2724AutonomousContinualFabric(6);
  private selfOptimizingContinual=new P2734SelfOptimizingContinualController(6);
  private causalPredictiveIntervention=new P2742CausalPredictiveInterventionFabric();
  private unifiedCausalWorldLoop=new P2750UnifiedCausalWorldLoop();
  private modelTimeReplay=new P2774ModelTimeReplayConsolidator();
  private stabilityPlasticity=new P2805StabilityPlasticityArbiter(96);
  private selfKnowledgeCoreset=new P2820SelfKnowledgeCoresetBridge();
  private transferSafetySynergy=new P2835TransferSafetySynergyController();
  private globalWorkspaceConvergence=new P2703GlobalWorkspaceConvergence();
  readonly systemName='cognition:neural-experience-branch' as const;
  snapshot(options:{clone?:boolean}={}){
    // Each managed subsystem is snapshotted exactly once per branch snapshot.
    // The previous implementation repeated several expensive snapshots and then
    // deep-cloned the complete state again; that amplified allocation/GC pressure.
    this.state.deepLearningCoupler=this.deepLearningCoupler.snapshot();
    this.state.deepIntegration=this.deepIntegration.snapshot();
    this.state.adaptiveLifelong=this.adaptiveLifelong.snapshot();
    this.state.causalPredictiveIntervention=this.causalPredictiveIntervention.snapshot();
    this.state.stabilityPlasticity=this.stabilityPlasticity.snapshot();
    this.state.selfKnowledgeCoreset=this.selfKnowledgeCoreset.snapshot();
    this.state.transferSafetySynergy=this.transferSafetySynergy.snapshot();
    this.state.offlineConsolidation=this.offlineConsolidation.snapshot();
    this.state.slowMemoryConsolidation=this.slowMemoryConsolidation.snapshot();
    this.state.unifiedCausalWorldLoop=this.unifiedCausalWorldLoop.snapshot();
    this.state.modelTimeReplay=this.modelTimeReplay.snapshot();
    this.state.hierarchicalSlowMemory=this.hierarchicalSlowMemory.snapshot();
    this.state.contextualActionPolicy=this.contextualActionPolicy.snapshot();
    this.state.verifiedSyntheticTrajectoryGate=this.verifiedSyntheticTrajectoryGate.snapshot();
    this.state.continuity=this.continuity.snapshot();
    this.state.causalPlanner=this.causalPlanner.snapshot();
    this.state.transferableSkills=this.transferableSkills.snapshot();
    this.state.activeInformationGain=this.activeInformationGain.snapshot();
    this.state.evidenceLedger=this.evidenceLedger.snapshot();
    this.state.learnedTransition=this.learnedTransition.snapshot();
    this.state.causalRegimeGraph=this.causalRegimeGraph.snapshot();
    this.state.factorialAblation=this.factorialAblation.snapshot();
    this.state.hierarchicalWorldModel=this.hierarchicalWorldModel.snapshot();
    this.state.policyInformationGain=this.policyInformationGain.snapshot();
    this.state.autonomousExperimentScheduler=this.autonomousExperimentScheduler.snapshot();
    this.state.temporalSubstrate=this.temporalSubstrate.snapshot();
    this.state.persistentPersonality=this.persistentPersonality.snapshot();
    this.state.globalWorkspaceConvergence=this.globalWorkspaceConvergence.snapshot();
    this.state.hierarchicalSkills=this.hierarchicalSkills.snapshot();
    this.state.taskAgnosticTransfer=this.taskAgnosticTransfer.snapshot();
    this.state.riskRecovery=this.riskRecovery.snapshot();
    this.state.goalIdentityModulator=this.goalIdentityModulator.snapshot();
    this.state.deviceScheduler=this.deviceScheduler.snapshot();
    this.state.selfOptimizingMemory=this.selfOptimizingMemory.snapshot();
    this.state.developmentalController=this.developmentalController.snapshot();
    this.state.embodiedBridge=this.embodiedBridge.snapshot();
    this.state.worldModelGate=this.worldModelGate.snapshot();
    this.state.crossLayerArbiter=this.crossLayerArbiter.snapshot();
    this.state.externalGrounding=this.externalGrounding.snapshot();
    return options.clone===false ? this.state : deep(this.state);
  }

  restore(raw?:Partial<NeuralExperienceBranchState>|null){
    const d=defaultNeuralExperienceBranch(),r:any=raw??{};
    const n=Math.max(32,Math.min(160,Math.floor(Number(r.neurons??d.neurons))));
    const arr=(v:any,len:number,fill=0)=>Array.isArray(v)?v.slice(0,len).concat(new Array(Math.max(0,len-v.length)).fill(fill)).slice(0,len):new Array(len).fill(fill);
    const matrix=(v:any,rows:number,cols:number,fill=0)=>Array.isArray(v)?Array.from({length:rows},(_,i)=>arr(v[i],cols,fill)):Array.from({length:rows},()=>new Array(cols).fill(fill));
    this.state={...d,...deep(r),version:32,contractVersion:1,neurons:n,
      state:arr(r.state,n),velocity:arr(r.velocity,n),thresholds:arr(r.thresholds,n,.22),activityEma:arr(r.activityEma,n,.10),gains:arr(r.gains,n,.8),plasticity:arr(r.plasticity,n,.35),
      recurrent:matrix(r.recurrent,n,n),inputProjection:matrix(r.inputProjection,n,64),actionReadout:Array.isArray(r.actionReadout)?Array.from({length:ACTIONS.length},(_,a)=>arr(r.actionReadout[a],n)):d.actionReadout,
      predictionReadout:arr(r.predictionReadout,n,.05),delayLearningUpdates:Number(r.delayLearningUpdates??0),
      pressure:arr(r.pressure,6,.15),replayBuffer:Array.isArray(r.replayBuffer)?r.replayBuffer.slice(-192):[],replayCompactions:Number(r.replayCompactions??0),replayCompactedTokens:Number(r.replayCompactedTokens??0),lastExperience:r.lastExperience??null,
      populationKinds:Array.isArray(r.populationKinds)?r.populationKinds.slice(0,n).concat(d.populationKinds.slice(r.populationKinds.length,n)):d.populationKinds,
      areaOf:Array.isArray(r.areaOf)?r.areaOf.slice(0,n).concat(d.areaOf.slice(r.areaOf.length,n)):d.areaOf,
      edgeTargets:matrix(r.edgeTargets,n,12),edgeWeights:matrix(r.edgeWeights,n,12),edgeDelays:matrix(r.edgeDelays,n,12,1),
      delayHistory:matrix(r.delayHistory,n,4),edgeEligibility:matrix(r.edgeEligibility,n,12),delayEligibility:matrix(r.delayEligibility,n,12),cascadeEligibilityMid:matrix(r.cascadeEligibilityMid,n,12),cascadeEligibilitySlow:matrix(r.cascadeEligibilitySlow,n,12),astroGate:arr(r.astroGate,n,.72),edgeUncertainty:matrix(r.edgeUncertainty,n,12,.65),inputEligibility:matrix(r.inputEligibility,n,64),
      inputMean:arr(r.inputMean,64),inputVar:arr(r.inputVar,64,.25),inputNormCount:Number(r.inputNormCount??1),
      excitatoryFraction01:clamp(Number(r.excitatoryFraction01??d.excitatoryFraction01)),inhibition01:clamp(Number(r.inhibition01??d.inhibition01)),areaPrediction01:arr(r.areaPrediction01,8,.5),
      eligibilityDecay01:clamp(Number(r.eligibilityDecay01??d.eligibilityDecay01),.7,.97),metaplasticity01:clamp(Number(r.metaplasticity01??d.metaplasticity01)),
      slowMemory:arr(r.slowMemory,16),slowMemoryDecay:arr(r.slowMemoryDecay,16,.95),slowMemoryReadout:arr(r.slowMemoryReadout,16,.08),slowMemoryInput:matrix(r.slowMemoryInput,16,16),
      longMemoryStability01:clamp(Number(r.longMemoryStability01??.5)),
      cueTraceStrength01:clamp(Number(r.cueTraceStrength01??0)),
      eligibilityClipCount:Number(r.eligibilityClipCount??0),
      homeostaticScaleUpdates:Number(r.homeostaticScaleUpdates??0),
      meanFiring01:clamp(Number(r.meanFiring01??.10)),
      replayDiversity01:clamp(Number(r.replayDiversity01??0)),
      replayWeightUpdates:Number(r.replayWeightUpdates??0),
      replaySignedCredit01:clamp(Number(r.replaySignedCredit01??0),-1,1),
      replayEvaluated:Number(r.replayEvaluated??0),
      replayTaskErrorBefore01:clamp(Number(r.replayTaskErrorBefore01??.5)),
      replayTaskErrorAfter01:clamp(Number(r.replayTaskErrorAfter01??.5)),
      replayUtilityGain01:clamp(Number(r.replayUtilityGain01??.5)),
      replayRollbacks:Number(r.replayRollbacks??0),
      replayTransferRejected:Number(r.replayTransferRejected??0),
      developmentalPlasticityScale01:clamp(Number(r.developmentalPlasticityScale01??1),.70,1.30),
      crossModalAgreement01:clamp(Number(r.crossModalAgreement01??.5)),
      crossModalUpdates:Number(r.crossModalUpdates??0),
      crossModalPairWeights:matrix(r.crossModalPairWeights,8,8,.25),
      crossModalTraces:matrix(r.crossModalTraces,8,8),
      offlineConsolidation:defaultP2852OfflineConsolidation(),
      slowMemoryConsolidation:defaultP2853SlowMemoryConsolidation(),
      hierarchicalSlowMemory:defaultP2854HierarchicalSlowMemory(),
      contextualActionPolicy:defaultP2855ContextualActionPolicy(),
    verifiedSyntheticTrajectoryGate:defaultVerifiedSyntheticTrajectoryGate(),
      fastPlasticity01:clamp(Number(r.fastPlasticity01??.72),.10,1.40),
      mediumPlasticity01:clamp(Number(r.mediumPlasticity01??.58),.10,1.40),
      slowPlasticity01:clamp(Number(r.slowPlasticity01??.42),.10,1.40),
      multiscalePlasticityUpdates:Number(r.multiscalePlasticityUpdates??0),
      onlineCreditUpdates:Number(r.onlineCreditUpdates??0), creditBaseline01:clamp(Number(r.creditBaseline01??0),-1,1),
      creditModelResidual01:clamp(Number(r.creditModelResidual01??0)), creditAgreement01:clamp(Number(r.creditAgreement01??0)),
      creditTraceNorm01:clamp(Number(r.creditTraceNorm01??0)), onlineCreditMix01:clamp(Number(r.onlineCreditMix01??.65)),
      cascadeCreditUpdates:Number(r.cascadeCreditUpdates??0), cascadeCreditNorm01:clamp(Number(r.cascadeCreditNorm01??0)),
      astroGateMean01:clamp(Number(r.astroGateMean01??.72)), longDelayCredit01:clamp(Number(r.longDelayCredit01??0)),
      adaptiveCreditMix01:clamp(Number(r.adaptiveCreditMix01??.65)), experimentalLayerEnabled:r.experimentalLayerEnabled!==false, deepLearningCoupler:defaultP2708DeepLearningCoupler(), deepIntegration:defaultP2716DeepIntegration().snapshot(), adaptiveLifelong:defaultP2720AdaptiveLifelong().snapshot(), autonomousContinual:defaultP2724AutonomousContinual(), selfOptimizingContinual:defaultP2734SelfOptimizingContinual(),
      continuity:defaultAdaptiveNeuralContinuity(),
      causalPlanner:defaultAdaptiveCausalMemoryPlanner(),
      temporalSubstrate:defaultNeuralTemporalSubstrate(),
      persistentPersonality:defaultP2702PersistentPersonality(),
      globalWorkspaceConvergence:defaultP2703Workspace(),
      causalSensitivity01:clamp(Number(r.causalSensitivity01??0)),
      transfer01:clamp(Number(r.transfer01??0)),
      foresightQuality01:clamp(Number(r.foresightQuality01??.5)),
      embodiedBridge:defaultEmbodiedCausalWorldBridge(),
      worldModelGate:defaultWorldModelEvidenceGate(),
      transferableSkills:defaultTransferableEmbodiedSkillSystem(),
      hierarchicalSkills:defaultHierarchicalProceduralSkillEngine(),
      taskAgnosticTransfer:defaultTaskAgnosticTransferRouter(),
      riskRecovery:defaultRiskAwareRecoveryController(),
      goalIdentityModulator:defaultGoalIdentitySkillModulator(),
      deviceScheduler:defaultDeviceAwareNeuralScheduler()
    };
    this.deepLearningCoupler.restore(r.deepLearningCoupler);
    this.deepLearningCoupler.setEnabled(r.experimentalLayerEnabled!==false);
    this.deepIntegration.restore(r.deepIntegration,n);
    this.deepIntegration.setEnabled(r.experimentalLayerEnabled!==false);
    this.adaptiveLifelong.restore(r.adaptiveLifelong,n);
    this.adaptiveLifelong.setEnabled(r.experimentalLayerEnabled!==false);
    this.autonomousContinual.restore(r.autonomousContinual,6);
    this.autonomousContinual.setEnabled(r.experimentalLayerEnabled!==false);
    this.selfOptimizingContinual.restore(r.selfOptimizingContinual);
    this.causalPredictiveIntervention.restore(r.causalPredictiveIntervention);
    this.unifiedCausalWorldLoop.restore(r.unifiedCausalWorldLoop);
    this.modelTimeReplay.restore(r.modelTimeReplay);
    this.stabilityPlasticity.restore(r.stabilityPlasticity,n);
    this.selfKnowledgeCoreset.restore(r.selfKnowledgeCoreset);
    this.transferSafetySynergy.restore(r.transferSafetySynergy);
    this.offlineConsolidation.restore(r.offlineConsolidation);
    this.slowMemoryConsolidation.restore(r.slowMemoryConsolidation);
    this.hierarchicalSlowMemory.restore(r.hierarchicalSlowMemory);
    this.contextualActionPolicy.restore(r.contextualActionPolicy);
    this.verifiedSyntheticTrajectoryGate.restore(r.verifiedSyntheticTrajectoryGate);
    this.causalPredictiveIntervention.setEnabled(r.experimentalLayerEnabled!==false);
    this.stabilityPlasticity.setEnabled(r.experimentalLayerEnabled!==false);
    this.unifiedCausalWorldLoop.setEnabled(r.experimentalLayerEnabled!==false);
    this.selfOptimizingContinual.setEnabled(r.experimentalLayerEnabled!==false);
    this.continuity.restore(r.continuity);
    this.causalPlanner.restore(r.causalPlanner);
    this.embodiedBridge.restore(r.embodiedBridge);
    this.worldModelGate.restore(r.worldModelGate);
    this.transferableSkills.restore(r.transferableSkills);
    this.hierarchicalSkills.restore(r.hierarchicalSkills);
    this.taskAgnosticTransfer.restore(r.taskAgnosticTransfer);
    this.riskRecovery.restore(r.riskRecovery);
    this.goalIdentityModulator.restore(r.goalIdentityModulator);
    this.deviceScheduler.restore(r.deviceScheduler);
    this.selfOptimizingMemory.restore(r.selfOptimizingMemory);
    this.developmentalController.restore(r.developmentalController);
    this.crossLayerArbiter.restore(r.crossLayerArbiter);
    this.externalGrounding.restore(r.externalGrounding);
    this.activeInformationGain.restore(r.activeInformationGain);
    this.evidenceLedger.restore(r.evidenceLedger);
    this.learnedTransition.restore(r.learnedTransition);
    this.causalRegimeGraph.restore(r.causalRegimeGraph);
    this.factorialAblation.restore(r.factorialAblation);
    this.hierarchicalWorldModel.restore(r.hierarchicalWorldModel);
    this.policyInformationGain.restore(r.policyInformationGain);
    this.autonomousExperimentScheduler.restore(r.autonomousExperimentScheduler);
    this.temporalSubstrate.restore(r.temporalSubstrate);
    this.persistentPersonality.restore(r.persistentPersonality);
    this.globalWorkspaceConvergence.restore(r.globalWorkspaceConvergence);
    this.state.hierarchicalSlowMemory=this.hierarchicalSlowMemory.snapshot();
    this.state.contextualActionPolicy=this.contextualActionPolicy.snapshot();
    this.state.verifiedSyntheticTrajectoryGate=this.verifiedSyntheticTrajectoryGate.snapshot();
    this.state.continuity=this.continuity.snapshot();
    this.state.causalPlanner=this.causalPlanner.snapshot();
    this.state.transferableSkills=this.transferableSkills.snapshot();
    this.state.activeInformationGain=this.activeInformationGain.snapshot();
    this.state.evidenceLedger=this.evidenceLedger.snapshot();
    this.state.learnedTransition=this.learnedTransition.snapshot();
    this.state.causalRegimeGraph=this.causalRegimeGraph.snapshot();
    this.state.factorialAblation=this.factorialAblation.snapshot();
    this.state.hierarchicalWorldModel=this.hierarchicalWorldModel.snapshot();
    this.state.policyInformationGain=this.policyInformationGain.snapshot();
    this.state.autonomousExperimentScheduler=this.autonomousExperimentScheduler.snapshot();
    this.state.temporalSubstrate=this.temporalSubstrate.snapshot();
    this.state.persistentPersonality=this.persistentPersonality.snapshot();
    this.state.globalWorkspaceConvergence=this.globalWorkspaceConvergence.snapshot();
    this.state.hierarchicalSkills=this.hierarchicalSkills.snapshot();
    this.state.taskAgnosticTransfer=this.taskAgnosticTransfer.snapshot();
    this.state.riskRecovery=this.riskRecovery.snapshot();
    this.state.goalIdentityModulator=this.goalIdentityModulator.snapshot();
    this.state.deviceScheduler=this.deviceScheduler.snapshot();
    this.state.selfOptimizingMemory=this.selfOptimizingMemory.snapshot();
    this.state.developmentalController=this.developmentalController.snapshot();
    this.state.causalPlanner=this.causalPlanner.snapshot();
    this.state.embodiedBridge=this.embodiedBridge.snapshot();this.state.worldModelGate=this.worldModelGate.snapshot();this.state.transferableSkills=this.transferableSkills.snapshot();this.state.hierarchicalSkills=this.hierarchicalSkills.snapshot();this.state.taskAgnosticTransfer=this.taskAgnosticTransfer.snapshot();this.state.riskRecovery=this.riskRecovery.snapshot();this.state.goalIdentityModulator=this.goalIdentityModulator.snapshot();this.state.deviceScheduler=this.deviceScheduler.snapshot();this.state.selfOptimizingMemory=this.selfOptimizingMemory.snapshot();
    // Migrate legacy dense recurrent weights into the canonical 12-edge sparse graph once.
    for(let i=0;i<n;i++) for(let q=0;q<12;q++){
      const j=this.state.edgeTargets[i]?.[q]??((i*17+q*29+3)%n);
      const oldW=Array.isArray(r.edgeWeights)?Number(this.state.edgeWeights[i]?.[q]??0):Array.isArray(r.recurrent)?Number(r.recurrent[i]?.[j]??0):0;
      this.state.edgeTargets[i]![q]=j;
      this.state.edgeWeights[i]![q]=Number.isFinite(oldW)?oldW:0;
      this.state.edgeDelays[i]![q]=Math.max(1,Math.min(3,Math.floor(Number(this.state.edgeDelays[i]?.[q]??1))));
      this.state.edgeEligibility[i]![q]=finite(this.state.edgeEligibility[i]?.[q]);
      this.state.delayEligibility[i]![q]=finite(this.state.delayEligibility[i]?.[q]);
      this.state.cascadeEligibilityMid[i]![q]=finite(this.state.cascadeEligibilityMid[i]?.[q]);
      this.state.cascadeEligibilitySlow[i]![q]=finite(this.state.cascadeEligibilitySlow[i]?.[q]);
      this.state.astroGate[i]=clamp(Number(this.state.astroGate[i]??.72),.20,1);
      this.state.edgeUncertainty[i]![q]=clamp(Number(this.state.edgeUncertainty[i]?.[q]??.65));
    }
    this.syncDenseReference();
  }

  setEnabled(v:boolean){this.state.enabled=!!v;}
  setExperimentalLayerEnabled(v:boolean){
    this.state.experimentalLayerEnabled=!!v;
    this.deepLearningCoupler.setEnabled(this.state.experimentalLayerEnabled);
    this.deepIntegration.setEnabled(this.state.experimentalLayerEnabled);
    this.autonomousContinual.setEnabled(this.state.experimentalLayerEnabled);
    this.selfOptimizingContinual.setEnabled(this.state.experimentalLayerEnabled);
    this.causalPredictiveIntervention.setEnabled(this.state.experimentalLayerEnabled);
    this.unifiedCausalWorldLoop.setEnabled(this.state.experimentalLayerEnabled);
    this.stabilityPlasticity.setEnabled(this.state.experimentalLayerEnabled);
    this.selfKnowledgeCoreset.setEnabled(this.state.experimentalLayerEnabled);
    this.transferSafetySynergy.setEnabled(this.state.experimentalLayerEnabled);
    this.state.deepLearningCoupler=this.deepLearningCoupler.snapshot();
    this.state.deepIntegration=this.deepIntegration.snapshot();
    this.state.causalPredictiveIntervention=this.causalPredictiveIntervention.snapshot();
    this.state.unifiedCausalWorldLoop=this.unifiedCausalWorldLoop.snapshot();
  }
  setSelfOptimizingContinualEnabled(v:boolean){this.selfOptimizingContinual.setEnabled(v);this.state.selfOptimizingContinual=this.selfOptimizingContinual.snapshot();}
  setCausalPredictiveInterventionEnabled(v:boolean){this.causalPredictiveIntervention.setEnabled(v);this.state.causalPredictiveIntervention=this.causalPredictiveIntervention.snapshot();}
  setUnifiedCausalWorldLoopEnabled(v:boolean){this.unifiedCausalWorldLoop.setEnabled(v);this.state.unifiedCausalWorldLoop=this.unifiedCausalWorldLoop.snapshot();}
  setModelTimeReplayEnabled(v:boolean){this.modelTimeReplay.setEnabled(v);this.state.modelTimeReplay=this.modelTimeReplay.snapshot();}
  setStabilityPlasticityEnabled(v:boolean){this.stabilityPlasticity.setEnabled(v);this.state.stabilityPlasticity=this.stabilityPlasticity.snapshot();}
  setSelfKnowledgeCoresetEnabled(v:boolean){this.selfKnowledgeCoreset.setEnabled(v);this.state.selfKnowledgeCoreset=this.selfKnowledgeCoreset.snapshot();}
  setTransferSafetySynergyEnabled(v:boolean){this.transferSafetySynergy.setEnabled(v);this.state.transferSafetySynergy=this.transferSafetySynergy.snapshot();}
  setCreditDelayProfile(name:string){this.deepLearningCoupler.setDelayProfile(name);this.state.deepLearningCoupler=this.deepLearningCoupler.snapshot();}
  setSelfNormalizationStrength(strength01:number){this.deepLearningCoupler.setSelfNormalization(strength01);this.state.deepLearningCoupler=this.deepLearningCoupler.snapshot();}
  setWorldDevelopmentFabricEnabled(v:boolean){this.hierarchicalWorldModel.setEnabled(v);this.policyInformationGain.setEnabled(v);this.autonomousExperimentScheduler.setEnabled(v);}
  private syncDenseReference(){const n=this.state.neurons;this.state.recurrent=Array.from({length:n},(_,i)=>{const row=new Array(n).fill(0);for(let q=0;q<12;q++)row[this.state.edgeTargets[i]![q]!] = this.state.edgeWeights[i]![q]!;return row;});}
  private encode(raw:number[]){
    const x=normalizeNeuralSpaceFrame({input:raw}).input;
    this.state.inputNormCount+=1;
    const rate=1/Math.min(this.state.inputNormCount,256);
    for(let k=0;k<NEURAL_INPUT_DIM;k++){
      const v=x[k]??0, oldM=this.state.inputMean[k]??0, delta=v-oldM;
      this.state.inputMean[k]=oldM+delta*rate;
      this.state.inputVar[k]=clamp((this.state.inputVar[k]??.25)*(1-rate)+delta*delta*rate,.01,1);
    }
    return x.map((v,k)=>clamp((v-(this.state.inputMean[k]??0))/Math.sqrt(this.state.inputVar[k]??.25),-1,1));
  }
  private pressureField(i:{predictionError01:number;novelty01:number;uncertainty01:number;homeostasis01:number;identityGap01:number;goalPressure01:number}){
    const p=[i.predictionError01,i.homeostasis01,i.identityGap01,i.goalPressure01,i.novelty01,i.uncertainty01].map(x=>clamp(x));
    this.state.pressure=this.state.pressure.map((x,k)=>clamp(x*.82+p[k]*.18));
    return clamp(this.state.pressure.reduce((a,b)=>a+b,0)/this.state.pressure.length);
  }
  private deriveSlowContextId(input:number[],worldContext=0,novelty01=.5){
    let mean=0,energy=0;
    for(let k=0;k<Math.min(16,input.length);k++){const v=finite(input[k]);mean+=v;energy+=Math.abs(v);}
    mean/=Math.max(1,Math.min(16,input.length));
    energy/=Math.max(1,Math.min(16,input.length));
    return Math.abs(Math.floor((mean+1)*1.7+energy*2.3+clamp(novelty01)*2.7)+Math.floor(Number(worldContext)||0)*3)%8;
  }

  private selectiveSlowMemory(x:number[],pressure:number,contextId=0,budget01=.7){
    const phase=this.offlineConsolidation.metrics().phase as P2853SlowMemoryPhase;
    const hierarchicalPhase=this.offlineConsolidation.metrics().phase as P2854SlowMemoryPhase;
    const summary=new Array(16).fill(0);
    for(let k=0;k<16;k++){for(let j=0;j<16;j++)summary[k]+=(this.state.slowMemoryInput[k]?.[j]??0)*(x[j]??0);}
    const slowContext=this.slowMemoryConsolidation.retrieve(contextId,this.state.state.slice(0,16),budget01,phase);
    const hierarchical=this.hierarchicalSlowMemory.retrieve(contextId,this.state.state.slice(0,16),budget01,hierarchicalPhase);
    const hierarchyActionBias=this.hierarchicalSlowMemory.actionBias(contextId,ACTIONS.length,budget01,hierarchicalPhase);
    this.lastHierarchicalActionBias=hierarchyActionBias;
    const hierarchyWeight=.08+.18*clamp(this.state.slowPlasticity01/1.2);
    let delta=0;
    for(let k=0;k<16;k++){
      const drive=tanh(summary[k]+this.state.pressure[k%6]!*.18+this.state.state[k*6%this.state.neurons]!*.08);
      const gate=sigmoid(-.4+pressure*.8+this.state.novelty01*.9+this.state.uncertainty01*.45);
      const decay=clamp(this.state.slowMemoryDecay[k]??.95,.9,.995);
      const legacyDrive=(slowContext.vector[k]??0)*slowContext.strength01;
      const hierarchyReliability=clamp((hierarchical.hierarchyAgreement01-.58)/.32);
      const hierarchicalDrive=(hierarchical.vector[k]??0)*hierarchical.strength01*hierarchyReliability*hierarchyWeight;
      const contextDrive=legacyDrive+hierarchicalDrive;
      const next=clamp((this.state.slowMemory[k]??0)*decay+drive*(1-decay)*(.34+.66*gate)+contextDrive*(.025+.075*gate),-1,1);
      delta+=Math.abs(next-(this.state.slowMemory[k]??0));
      this.state.slowMemory[k]=next;
    }
    this.state.longMemoryStability01=clamp(this.state.longMemoryStability01*.97+(1-delta/16)*.03);
    this.state.cueTraceStrength01=clamp(this.state.cueTraceStrength01*.92+Math.abs(this.state.slowMemory.reduce((a,b,i)=>a+b*(this.state.slowMemoryReadout[i]??0)))*.08+hierarchical.hierarchyAgreement01*.005);
  }

  private stepDynamics(x:number[],action:ActionKind|null){
    const n=this.state.neurons, prev=this.state.state, next=new Array(n).fill(0), spikes=new Array(n).fill(0);
    const ai=action?Math.max(0,ACTIONS.indexOf(action)):-1;
    let inhibition=0,exc=0;
    // First pass: membrane dynamics on the sparse graph.
    for(let i=0;i<n;i++){
      let drive=0;
      for(let k=0;k<NEURAL_INPUT_DIM;k++) drive+=(this.state.inputProjection[i]?.[k]??0)*x[k]!;
      const area=this.state.areaOf[i]??Math.floor(i/12);
      if(area>0){let upstream=0;const from=(area-1)*12,to=Math.min(from+12,n);for(let u=from;u<to;u++)upstream+=prev[u]??0;drive+=tanh(upstream/12)*.10;}
      const hist=this.state.delayHistory[i]??[0,0,0,0]; let recurrent=0;
      for(let q=0;q<12;q++){
        const j=this.state.edgeTargets[i]?.[q]??0,d=Math.max(1,Math.min(3,Math.floor(this.state.edgeDelays[i]?.[q]??1)));
        const src=this.state.populationKinds[j]==='I'?-1:1;
        recurrent+=(this.state.edgeWeights[i]?.[q]??0)*(hist[d]??prev[j]??0)*src;
        // Eligibility traces are causal-time memory: the synapse keeps the pre/post event
        // association until the delayed reward/error arrives.
        const pre=hist[d]??prev[j]??0, post=prev[i]??0;
        const oldE=this.state.edgeEligibility[i]![q]??0;
        let nextE=oldE*this.state.eligibilityDecay01+pre*post;
        // P2705: bounded eligibility prevents rare long-horizon traces from
        // dominating every later credit-assignment event. This is a numerical
        // stabilizer, not a claim of biological exactness.
        if(Math.abs(nextE)>2){nextE=Math.sign(nextE)*2;this.state.eligibilityClipCount++;}
        this.state.edgeEligibility[i]![q]=nextE;
        // P2707 experimental cascade: retain the same local eligibility event at
        // multiple time scales. The slow states are deliberately bounded and cheap;
        // they target delayed credit assignment rather than adding a second learner.
        const delayProfile=this.deepLearningCoupler.delayProfile();
        const midDecay=delayProfile.midDecay01, slowDecay=delayProfile.slowDecay01;
        let mid=(this.state.cascadeEligibilityMid[i]![q]??0)*midDecay+nextE*(1-midDecay);
        let slow=(this.state.cascadeEligibilitySlow[i]![q]??0)*slowDecay+mid*(1-slowDecay);
        if(Math.abs(mid)>2)mid=Math.sign(mid)*2; if(Math.abs(slow)>2)slow=Math.sign(slow)*2;
        this.state.cascadeEligibilityMid[i]![q]=mid;
        this.state.cascadeEligibilitySlow[i]![q]=slow;
        let nextDE=this.state.delayEligibility[i]![q]!* .90+(post*(hist[Math.min(3,d+1)]??0)-post*(hist[Math.max(1,d-1)]??0));
        if(Math.abs(nextDE)>2)nextDE=Math.sign(nextDE)*2;
        this.state.delayEligibility[i]![q]=nextDE;
      }
      const actionDrive=ai>=0?(this.state.actionReadout[ai]?.[i]??0):0;
      const e=this.state.populationKinds[i]==='E',tau=e?.82:.68;
      const v=tanh(prev[i]*tau+drive+recurrent+actionDrive+this.state.pressure[i%6]!*.18-this.state.inhibition01*.12);
      const spike=v>this.state.thresholds[i]?1:0;spikes[i]=spike;next[i]=spike?0:v;
      this.state.activityEma[i]=clamp((this.state.activityEma[i]??.10)*.97+spike*.03,0,1);
      if(e)exc+=spike;else inhibition+=spike;
      // Sensor eligibility spans time even before a reward is present.
      const inputTrace=this.state.inputEligibility[i]!;
      for(let k=0;k<NEURAL_INPUT_DIM;k++)inputTrace[k]=inputTrace[k]!*this.state.eligibilityDecay01+(x[k]??0)*v;
    }
    const count=spikes.reduce((a,b)=>a+b,0),target=Math.max(3,Math.ceil(n*.10));
    if(count>target){const ranked=spikes.map((v,i)=>({v,i})).filter(z=>z.v).sort((a,b)=>Math.abs(next[b.i]??0)-Math.abs(next[a.i]??0));const keep=new Set(ranked.slice(0,target).map(z=>z.i));for(const z of ranked)if(!keep.has(z.i))spikes[z.i]=0;}
    for(let i=0;i<n;i++){
      const h=this.state.delayHistory[i]??(this.state.delayHistory[i]=new Array(4).fill(0));h.unshift(next[i]??0);h.length=4;
      this.state.velocity[i]=next[i]-prev[i];this.state.state[i]=next[i];
      // Experimental P2704 stability/plasticity separation, inspired by recent
      // sparsity-aware on-device SNN work: neurons whose synapses have become
      // stable should resist threshold drift, while high-plasticity neurons remain
      // available for rapid adaptation. This is deliberately local and bounded so
      // it remains viable on the phone and can be ablated in isolation.
      const plasticGate=clamp((this.state.plasticity[i]??.35),.05,1.2);
      const thresholdAdaptationGain=.30+.70*clamp((plasticGate-.12)/.88);
      this.state.thresholds[i]=clamp(this.state.thresholds[i]+(count/n-.10)*.006*thresholdAdaptationGain,.12,.65);
    }
    const exRate=exc/Math.max(1,n*.75),inRate=inhibition/Math.max(1,n*.25);
    for(let a=0;a<this.state.areas;a++){const from=a*12,to=Math.min(from+12,n);let s=0,c=0;for(let u=from;u<to;u++){s+=spikes[u]??0;c++;}this.state.areaPrediction01[a]=clamp((this.state.areaPrediction01[a]??.5)*.9+(s/Math.max(1,c))*.1);}
    this.state.excitatoryFraction01=.75;this.state.inhibition01=clamp(this.state.inhibition01*.9+clamp(inRate/(exRate+inRate+.001))*.1);
    this.state.sparsity01=clamp(1-count/n);this.state.computeCost01=clamp((n*12+64*n+16*16)/18000);
    this.state.eligibilityUpdates++;
    return {state:next,spikes};
  }

  private applyHomeostaticScaling(){
    // P2705 homeostatic synaptic scaling: keep the sparse recurrent population
    // near a target activity regime while preserving learned relative weights.
    // Scaling is deliberately tiny and infrequent so it cannot erase plasticity.
    const target=.10;
    for(let i=0;i<this.state.neurons;i++){
      const activity=clamp(this.state.activityEma[i]??target);
      const error=target-activity;
      if(Math.abs(error)<.012) continue;
      const factor=clamp(1+error*.08,.985,1.015);
      const row=this.state.edgeWeights[i]!;
      for(let q=0;q<row.length;q++) row[q]=clamp((row[q]??0)*factor,-.35,.35);
      this.state.homeostaticScaleUpdates++;
    }
    this.state.meanFiring01=clamp(this.state.activityEma.reduce((a,b)=>a+b,0)/Math.max(1,this.state.activityEma.length));
    this.syncDenseReference();
  }

  private zeroActionBias(){return Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;}
  private meanAbs(values:number[]){return values.reduce((s,v)=>s+Math.abs(v),0)/Math.max(1,values.length);}

  private updateCrossModalBinding(i:{tick:number;input:number[];embodied?:{sensorFeatures?:number[];sensors?:Record<string,{values:number[];confidence01:number;freshness01:number;ageTicks:number;source:string}>}}){
    const slots=['text','vision','audio','sensor','world','body','self','other'];
    const vectors:number[][]=slots.map((name,idx)=>{
      const sensor=Object.values(i.embodied?.sensors??{}).find(s=>String(s.source??'').toLowerCase().includes(name));
      const base=sensor?.values??(idx===3?(i.embodied?.sensorFeatures??i.input):idx===4?i.input:[]);
      return base.slice(0,12).map(Number).map(v=>Number.isFinite(v)?Math.max(-1,Math.min(1,v)):0);
    });
    let active=0,agreementSum=0;
    for(let a=0;a<8;a++)for(let b=a+1;b<8;b++){
      const av=vectors[a]!,bv=vectors[b]!;
      const an=Math.sqrt(av.reduce((x,v)=>x+v*v,0)),bn=Math.sqrt(bv.reduce((x,v)=>x+v*v,0));
      const sim=an&&bn?Math.max(0,Math.min(1,(av.reduce((x,v,k)=>x+v*(bv[k]??0),0)/an/bn+1)/2)):0;
      const trace=this.state.crossModalTraces[a]![b]!*.88+sim*.12;
      this.state.crossModalTraces[a]![b]=this.state.crossModalTraces[b]![a]=trace;
      this.state.crossModalPairWeights[a]![b]=this.state.crossModalPairWeights[b]![a]=Math.max(.02,Math.min(1,this.state.crossModalPairWeights[a]![b]!+(sim-.5)*.015));
      agreementSum+=trace*this.state.crossModalPairWeights[a]![b]!;active+=av.length&&bv.length?1:0;
    }
    this.state.crossModalAgreement01=active?Math.max(0,Math.min(1,agreementSum/Math.max(1,active))):this.state.crossModalAgreement01*.98;
    this.state.crossModalUpdates++;
    const fused=new Array(16).fill(0);
    for(let k=0;k<16;k++){let sum=0,weight=0;for(let m=0;m<8;m++){const v=vectors[m]![k%Math.max(1,vectors[m]!.length)]??0;const w=m===3?1.1:(m===4?.9:.45);sum+=v*w;weight+=vectors[m]!.length?w:0;}fused[k]=weight?Math.max(-1,Math.min(1,sum/weight)):0;}
    return {fused,agreement01:this.state.crossModalAgreement01};
  }

  beforeDecision(i:{
    tick:number; input:number[]; baseUtilities:Record<ActionKind,number>;
    predictionError01:number; novelty01:number; uncertainty01:number;
    homeostasis01:number; identityGap01:number; goalPressure01:number;
    reward01?:number; personalityVector?:number[]; identityVector?:number[];
    embodied?:{
      sensors?:Record<string,{tick:number;values:number[];freshness01:number;confidence01:number;ageTicks:number;source:string}>;
      sensorFeatures?:number[]; thermalStrain01?:number; battery01?:number;
      cpuLoad01?:number; ramPressure01?:number; sensorFreshness01?:number;
    }
  }):{
    actionBias:Record<ActionKind,number>; experience:NeuralExperienceToken;
    prediction01:number; pressure01:number; coherence01:number; generalization01:number;
    embodied:{
      actionBias:Record<ActionKind,number>; epistemicValue01:number; activeNeuronFraction01:number;
      activePerception01:number; computeCost01:number; asyncSensorPenalty01:number;
      selectedReward01:number; selectedConfidence01:number; taskFreeCoverage01:number;
      risk01:number; recoveryAction:ActionKind|null; abstain:boolean; goalConditioning01:number;
      identityConditioning01:number; deviceBudget01:number; deviceDegraded01:number;
      memoryUtility01:number; memoryWriteGate01:number; memoryRecallConfidence01:number; liveImprovement01:number; liveRedirectAction:ActionKind|null; selectedMemoryStrategy:string;
      informationGain01:number; epistemicAction01:number; informationExperiment01:number; activeExperimentAction:ActionKind|null; grounding01:number; evidenceQuality01:number;
      developmentalGoalAutonomy01:number; developmentalTransfer01:number; developmentalCoherence01:number; developmentalRecoveryAction:ActionKind|null;
    }
  }{
    const frame=normalizeNeuralSpaceFrame(i),contract=validateNeuralSpaceContract(frame);if(!contract.ok)throw new Error(`NEURAL_SPACE_CONTRACT:${contract.errors.join(',')}`);
    const input=this.encode(frame.input),pressure=this.pressureField(i),before=this.state.state.slice();
    const activeWorldContext=this.unifiedCausalWorldLoop.metrics().activeContextId;
    const computeBudgetHint=this.continuity.metrics().computeBudget01;
    this.state.novelty01=i.novelty01;this.state.uncertainty01=i.uncertainty01;
    const slowContextId=this.deriveSlowContextId(input,activeWorldContext,i.novelty01);
    this.selectiveSlowMemory(input,pressure,slowContextId,computeBudgetHint);
    const continuity=this.continuity.beforeDecision(input,this.state.state.slice(0,8),{novelty01:i.novelty01,uncertainty01:i.uncertainty01,predictionError01:i.predictionError01,goalPressure01:i.goalPressure01,homeostasis01:i.homeostasis01,identityGap01:i.identityGap01,reward01:i.reward01??.5},null);
    const device=this.deviceScheduler.beforeDecision({tick:i.tick,continuityBudget01:continuity.computeBudget01,thermalStrain01:i.embodied?.thermalStrain01,battery01:i.embodied?.battery01,cpuLoad01:i.embodied?.cpuLoad01,ramPressure01:i.embodied?.ramPressure01,sensorFreshness01:i.embodied?.sensorFreshness01,predictionError01:i.predictionError01,novelty01:i.novelty01});
    const computeBudget01=device.budget01;
    const embodied=this.embodiedBridge.beforeDecision({tick:i.tick,features:(i.embodied?.sensorFeatures??input).slice(0,64),actionUtilities:i.baseUtilities,novelty01:i.novelty01,uncertainty01:i.uncertainty01,predictionError01:i.predictionError01,computeBudget01:computeBudget01,sensors:i.embodied?.sensors as any});
    const causal=this.causalPlanner.beforeDecision({
      tick:i.tick,
      context:[...this.state.state.slice(0,16),i.novelty01,i.uncertainty01,i.predictionError01,i.goalPressure01],
      latent:this.state.state.slice(0,8),
      actionUtilities:i.baseUtilities,
      forecast:continuity.forecast.next,
      forecastConfidence01:continuity.forecast.confidence,
      disagreement01:continuity.disagreement01,
      epistemicValue01:continuity.epistemicValue01,
      computeBudget01:computeBudget01,
      retrieved:continuity.retrieved.map(m=>({id:m.id,utility01:m.utility01,confidence01:m.confidence01,protected01:m.protected01})),
      novelty01:i.novelty01,uncertainty01:i.uncertainty01,predictionError01:i.predictionError01,goalPressure01:i.goalPressure01,
    });
    const embodiedMetricsBeforeGate=this.embodiedBridge.metrics();
    const transferable=this.transferableSkills.beforeDecision({
      tick:i.tick,
      context:[...this.state.state.slice(0,16),i.novelty01,i.uncertainty01,i.goalPressure01],
      latent:this.state.state.slice(0,8),
      actionUtilities:i.baseUtilities,
      goalPressure01:i.goalPressure01,
      uncertainty01:i.uncertainty01,
      computeBudget01:computeBudget01,
      predictionError01:i.predictionError01,
      novelty01:i.novelty01,
    });
    const hierarchical=this.hierarchicalSkills.beforeDecision({tick:i.tick,context:[...this.state.state.slice(0,16),i.novelty01,i.uncertainty01,i.goalPressure01],skills:this.transferableSkills.metrics().skills,actionUtilities:i.baseUtilities,goalPressure01:i.goalPressure01,uncertainty01:i.uncertainty01,predictionError01:i.predictionError01,computeBudget01:computeBudget01});
    const taskFree=this.taskAgnosticTransfer.beforeDecision({tick:i.tick,context:[...this.state.state.slice(0,16),i.novelty01,i.uncertainty01,i.goalPressure01,i.identityGap01],skills:this.transferableSkills.metrics().skills,actionUtilities:i.baseUtilities,goalSignal01:clamp(.58*i.goalPressure01+.42*(1-i.identityGap01)),uncertainty01:i.uncertainty01,negativeTransfer01:this.transferableSkills.metrics().negativeTransfer01,computeBudget01});
    const personality=this.goalIdentityModulator.beforeDecision({tick:i.tick,goalPressure01:i.goalPressure01,identityGap01:i.identityGap01,novelty01:i.novelty01,uncertainty01:i.uncertainty01,baseUtilities:i.baseUtilities,traitVector:i.personalityVector});
    const selfMemory=this.selfOptimizingMemory.beforeDecision({tick:i.tick,context:[...this.state.state.slice(0,16),i.novelty01,i.uncertainty01,i.goalPressure01,i.identityGap01],identityVector:(i.identityVector??i.personalityVector??[]).slice(0,24),goalPressure01:i.goalPressure01,identityGap01:i.identityGap01,novelty01:i.novelty01,uncertainty01:i.uncertainty01,predictionError01:i.predictionError01,reward01:i.reward01,computeBudget01});
    const developmental=this.developmentalController.beforeDecision({tick:i.tick,context:[...this.state.state.slice(0,16),i.novelty01,i.uncertainty01,i.goalPressure01,i.identityGap01],identityVector:(i.identityVector??i.personalityVector??[]).slice(0,24),goalPressure01:i.goalPressure01,identityGap01:i.identityGap01,novelty01:i.novelty01,uncertainty01:i.uncertainty01,predictionError01:i.predictionError01,computeBudget01,baseUtilities:i.baseUtilities,taskFreeCoverage01:taskFree.coverage01,negativeTransfer01:this.transferableSkills.metrics().negativeTransfer01,risk01:this.riskRecovery.metrics().selectedRisk01,recoveryAction:this.riskRecovery.metrics().selectedRecovery});
    const risk=this.riskRecovery.beforeDecision({tick:i.tick,actionUtilities:i.baseUtilities,predictionError01:i.predictionError01,uncertainty01:i.uncertainty01,modelDrift01:this.embodiedBridge.metrics().modelDrift01,recoveryGain01:this.embodiedBridge.metrics().recoveryGain01,verified01:0,computeBudget01});
    const grounding=this.externalGrounding.beforeDecision({tick:i.tick,sensors:i.embodied?.sensors,uncertainty01:i.uncertainty01,novelty01:i.novelty01,predictionError01:i.predictionError01,computeBudget01});
    const infoGain=this.activeInformationGain.beforeDecision({tick:i.tick,baseUtilities:i.baseUtilities,uncertainty01:i.uncertainty01,predictionError01:i.predictionError01,novelty01:i.novelty01,computeBudget01,risk01:risk.risk01,grounding01:grounding.grounding01,consensus01:grounding.consensus01,externalQuery:grounding.activeQuery});
    const transition=this.learnedTransition.beforeDecision({tick:i.tick,context:[...this.state.state.slice(0,16),i.novelty01,i.uncertainty01,i.predictionError01,i.goalPressure01],baseUtilities:i.baseUtilities,uncertainty01:i.uncertainty01,novelty01:i.novelty01,predictionError01:i.predictionError01,computeBudget01});
    const regime=this.causalRegimeGraph.beforeDecision({tick:i.tick,context:[...this.state.state.slice(0,24),i.novelty01,i.uncertainty01],baseUtilities:i.baseUtilities,uncertainty01:i.uncertainty01,novelty01:i.novelty01,predictionError01:i.predictionError01,computeBudget01});
    const hierarchicalWorld=this.hierarchicalWorldModel.beforeDecision({tick:i.tick,context:[...this.state.state.slice(0,24),i.novelty01,i.uncertainty01,i.predictionError01],baseUtilities:i.baseUtilities,uncertainty01:i.uncertainty01,novelty01:i.novelty01,predictionError01:i.predictionError01,computeBudget01});
    const policyInfo=this.policyInformationGain.beforeDecision({tick:i.tick,baseUtilities:i.baseUtilities,uncertainty01:i.uncertainty01,novelty01:i.novelty01,predictionError01:i.predictionError01,computeBudget01,worldDisagreement01:clamp(.55*regime.shift01+.45*transition.novelty01)});
    const experiment=this.autonomousExperimentScheduler.beforeDecision({tick:i.tick,uncertainty01:i.uncertainty01,novelty01:i.novelty01,predictionError01:i.predictionError01,computeBudget01,thermalStrain01:i.embodied?.thermalStrain01,battery01:i.embodied?.battery01,baseUtilities:i.baseUtilities,policyExperiment01:policyInfo.experiment01,regimeShift01:regime.shift01});
    const integration=this.deepIntegration.beforeDecision({tick:i.tick,uncertainty01:i.uncertainty01,novelty01:i.novelty01,predictionError01:i.predictionError01,identityGap01:i.identityGap01,goalPressure01:i.goalPressure01,computeBudget01,thermalStrain01:i.embodied?.thermalStrain01,battery01:i.embodied?.battery01,worldConfidence01:clamp(.46*transition.transitionConfidence01+.34*(1-embodiedMetricsBeforeGate.sensorimotorError01)+.20*continuity.forecast.confidence),selfContinuity01:clamp(1-i.identityGap01),policyInformationGain01:policyInfo.policyInformationGain01,experimentValue01:experiment.value01,baseUtilities:i.baseUtilities});
    for(const a of ACTIONS)this.factorialAblation.registerFactor(a,0.5);
    const gate=this.worldModelGate.arbitrate({
      tick:i.tick,baseUtilities:i.baseUtilities,
      continuityReward01:clamp(continuity.forecast.avg.reduce((a,b)=>a+b,0)/Math.max(1,continuity.forecast.avg.length)),
      continuityConfidence01:clamp(continuity.forecast.confidence),
      continuityDisagreement01:clamp(continuity.disagreement01),
      embodiedReward01:clamp(embodied.selectedReward01),
      embodiedConfidence01:clamp(embodied.selectedConfidence01),
      embodiedConsistency01:clamp(1-embodiedMetricsBeforeGate.sensorimotorError01),
      causalSensitivity01:clamp(embodiedMetricsBeforeGate.causalSensitivity01),
      epistemicValue01:clamp(embodied.epistemicValue01),
      computeBudget01:computeBudget01,
      continuityActionRewards01:ACTIONS.map(a=>clamp(i.baseUtilities[a]??.5)),
      embodiedActionRewards01:embodied.actionModelRewards,
      embodiedActionConfidence01:embodied.actionModelConfidence,
    });
    const developmentalBias=developmental.actionBias;
    // P2701: an independent compact recurrent/spiking substrate now participates in the
    // live decision path. Its persistent temporal embedding is blended into the 64-D
    // sensory stream rather than merely being logged, so it can change downstream behavior.
    const personalityDynamics=this.persistentPersonality.beforeDecision({tick:i.tick,novelty01:i.novelty01,uncertainty01:i.uncertainty01,goalPressure01:i.goalPressure01,identityGap01:i.identityGap01,reward01:i.reward01,actionUtilities:i.baseUtilities,identityVector:i.identityVector});
    const temporal=this.temporalSubstrate.step(input,i.tick);
    const crossModal=this.updateCrossModalBinding({tick:i.tick,input,embodied:i.embodied});
    const workspaceCandidates:P2703WorkspaceCandidate[]=[
      {id:'neural',source:'neural',vector:this.state.state.slice(0,16),salience01:clamp(.35+this.meanAbs(this.state.state.slice(0,16))*1.4),uncertainty01:i.uncertainty01,predictionError01:i.predictionError01,actionBias:this.zeroActionBias()},
      {id:'memory',source:'memory',vector:[...this.state.slowMemory.slice(0,16)],salience01:clamp(.25+this.state.cueTraceStrength01),uncertainty01:clamp(i.uncertainty01*.8),predictionError01:i.predictionError01,actionBias:this.zeroActionBias()},
      {id:'world',source:'world',vector:(i.input??[]).slice(0,16),salience01:clamp(.25+i.predictionError01*.7),uncertainty01:i.uncertainty01,predictionError01:i.predictionError01,actionBias:this.zeroActionBias()},
      {id:'goal',source:'goal',vector:[...this.state.pressure.slice(0,6),...new Array(10).fill(i.goalPressure01)],salience01:clamp(.25+i.goalPressure01*.8),uncertainty01:i.uncertainty01*.7,predictionError01:i.predictionError01,actionBias:this.zeroActionBias()},
      {id:'self',source:'self',vector:(i.identityVector??i.personalityVector??[]).slice(0,16),salience01:clamp(.25+(1-i.identityGap01)*.75),uncertainty01:i.identityGap01,predictionError01:i.predictionError01,actionBias:this.zeroActionBias()},
      {id:'personality',source:'personality',vector:(i.personalityVector??[]).slice(0,16),salience01:clamp(.28+(1-i.identityGap01)*.65),uncertainty01:i.identityGap01,predictionError01:i.predictionError01,actionBias:this.zeroActionBias()},
      {id:'causal',source:'causal',vector:[...this.state.state.slice(0,8),...new Array(8).fill(0)],salience01:clamp(.25+this.state.foresightQuality01*.65),uncertainty01:clamp(causal.selectedForesight01),predictionError01:i.predictionError01,actionBias:causal.actionBias},
      {id:'embodied',source:'embodied',vector:(i.embodied?.sensorFeatures??input).slice(0,16),salience01:clamp(.25+embodied.activePerception01*.65),uncertainty01:i.uncertainty01,predictionError01:embodiedMetricsBeforeGate.sensorimotorError01,actionBias:embodied.actionBias},
      {id:'information',source:'information',vector:[...this.state.pressure.slice(0,6),...new Array(10).fill(grounding.grounding01)],salience01:clamp(.22+infoGain.informationGain01*.75),uncertainty01:i.uncertainty01,predictionError01:i.predictionError01,actionBias:infoGain.actionBias},
      {id:'developmental',source:'developmental',vector:[...this.state.state.slice(0,8),...new Array(8).fill(developmental.goalAutonomy01)],salience01:clamp(.22+developmental.goalAutonomy01*.72),uncertainty01:i.uncertainty01,predictionError01:i.predictionError01,actionBias:developmental.actionBias}
    ];
    const workspace=this.globalWorkspaceConvergence.step({tick:i.tick,candidates:workspaceCandidates,uncertainty01:i.uncertainty01,predictionError01:i.predictionError01,computeBudget01});
    const workspaceGain=clamp(.35+.45*workspace.broadcast01+.20*workspace.ignition01);
    const temporalGain=clamp(.08+.18*(1-i.uncertainty01)+.08*temporal.stability01);
    const bindingGain=clamp(.04+.12*crossModal.agreement01+.06*(1-i.uncertainty01),0,.22);
    const temporalInput=input.map((v,k)=>clamp(v*(1-temporalGain-bindingGain)+(temporal.embedding[k%temporal.embedding.length]??0)*temporalGain+(crossModal.fused[k%crossModal.fused.length]??0)*bindingGain,-1,1));
    const dyn=this.stepDynamics(temporalInput,null),spikes=dyn.spikes;
    const mean=spikes.reduce((a,b)=>a+b,0)/this.state.neurons;
    let recurrentSignal=0;for(let iN=0;iN<this.state.neurons;iN+=2){for(let q=0;q<8;q++){const j=this.state.edgeTargets[iN]?.[q]??0;recurrentSignal+=Math.abs((this.state.edgeWeights[iN]?.[q]??0)*(this.state.state[j]??0));}}recurrentSignal=clamp(recurrentSignal/384);
    let predReadout=0;for(let k=0;k<this.state.neurons;k+=2)predReadout+=(this.state.predictionReadout[k]??0)*this.state.state[k]!;
    const memoryReadout=this.state.slowMemory.reduce((a,b,k)=>a+b*(this.state.slowMemoryReadout[k]??0),0);
    const policyCue=(i.embodied?.sensorFeatures??i.input??input).slice(0,64);
    const policyPhase=this.offlineConsolidation.metrics().phase as P2855ActionPolicyPhase;
    const contextualPolicyBias=this.contextualActionPolicy.actionBias(Number(this.unifiedCausalWorldLoop.metrics().activeContextId??0),ACTIONS.length,computeBudget01,policyPhase,policyCue);
    const retrievedUtility=continuity.retrieved.length?continuity.retrieved[0]!.utility01:0;
    const prediction=sigmoid(.18+mean*2.1+pressure*.8+temporal.prediction01*.22+temporal.activeFraction01*.10+recurrentSignal*2.6+predReadout*2.2+memoryReadout*1.8+retrievedUtility*.18+continuity.disagreement01*.12+causal.selectedForesight01*.08+causal.transfer01*.04+(1-embodied.asyncSensorPenalty01)*.08+embodied.activePerception01*.04+crossModal.agreement01*.10-this.state.predictionError01*.35);
    const bias=Object.fromEntries(ACTIONS.map((a,ai)=>{
      let s=0;
      for(let k=0;k<this.state.neurons;k+=2) s+=(this.state.actionReadout[ai]?.[k]??0)*this.state.state[k]!;
      const model=clamp((i.baseUtilities[a]??.5)-.5);
      const memoryAction=a==='reflect'?memoryReadout*.04:a==='explore'||a==='verify'?memoryReadout*.02:-memoryReadout*.01;
      const epistemic=a==='explore'||a==='verify'?continuity.epistemicValue01*.035:-continuity.epistemicValue01*.008;
      const hierarchicalPolicyBias=this.lastHierarchicalActionBias[ai]??0;
      const contextualActionBias=contextualPolicyBias[ai]??0;
      const workspaceBias=this.globalWorkspaceConvergence.actionBias(a), plannerBias=causal.actionBias[a]??0, persistentPersonalityBias=personalityDynamics.actionBias[a]??0, embodiedBias=embodied.actionBias[a]??0, gateBias=gate.actionBias[a]??0, transferableBias=transferable.actionBias[a]??0, hierarchicalBias=hierarchical.actionBias[a]??0, taskFreeBias=taskFree.actionBias[a]??0, personalityBias=personality.actionBias[a]??0, riskBias=risk.actionBias[a]??0, selfMemoryBias=selfMemory.actionBias[a]??0;
      const local=Math.tanh(s*.55+model*.35+pressure*(a==='explore'||a==='verify'?.08:-.02)+memoryAction+epistemic)*.075;
      return [a,clamp(local+hierarchicalPolicyBias*.82+contextualActionBias*1.15+workspaceBias*workspaceGain+persistentPersonalityBias*.62+plannerBias*.72+embodiedBias*.58+gateBias*.36*gate.actionableConfidence01+transferableBias*.55+hierarchicalBias*.48+taskFreeBias*.60+personalityBias*.72+riskBias*.72+selfMemoryBias*.72+(developmentalBias[a]??0)*.78,-.115,.115)];
    })) as Record<ActionKind,number>;
    const arbiterBiases:ArbiterBiases={
      neural:bias, causal:causal.actionBias, embodied:embodied.actionBias, transfer:transferable.actionBias,
      hierarchical:hierarchical.actionBias, taskFree:taskFree.actionBias, personality:personality.actionBias,
      risk:risk.actionBias, memory:selfMemory.actionBias, developmental:developmentalBias
    };
    this.lastArbiterBiases=arbiterBiases;
    const fused=this.crossLayerArbiter.fuse({baseUtilities:i.baseUtilities,biases:arbiterBiases,
      confidence01:{neural:clamp(1-i.predictionError01),causal:clamp(causal.causalSensitivity01),embodied:embodied.selectedConfidence01,
        transfer:transferable.optionCoverage01,hierarchical:hierarchical.metaCoverage01,taskFree:taskFree.coverage01,
        personality:clamp(1-i.identityGap01),risk:clamp(1-risk.risk01),memory:selfMemory.selectedRecallConfidence01,
        developmental:developmental.goalAutonomy01},uncertainty01:i.uncertainty01,computeBudget01,risk01:risk.risk01});
    for(const a of ACTIONS) bias[a]=clamp(bias[a]!*.72+fused.actionBias[a]!*0.34+(grounding.actionBias[a]??0)*.28+(infoGain.actionBias[a]??0)*.34+(transition.actionBias[a]??0)*.20+(regime.actionBias[a]??0)*.16+(hierarchicalWorld.actionBias[a]??0)*.05+(policyInfo.actionBias[a]??0)*.06+(experiment.actionBias[a]??0)*.05+(fused.reroute===a?.012:0),-.115,.115);
    const autonomousContinual=this.autonomousContinual.beforeDecision({
      tick:i.tick,
      context:[...this.state.state.slice(0,16),i.novelty01,i.uncertainty01,i.predictionError01,i.goalPressure01],
      baseUtilities:i.baseUtilities,
      uncertainty01:i.uncertainty01,
      novelty01:i.novelty01,
      predictionError01:i.predictionError01,
      resource01:computeBudget01,
      forgetting01:clamp(this.state.deepIntegration.forgetting01),
      replayDebt01:clamp(this.state.replayDiversity01),
      informationGain01:clamp(infoGain.informationGain01),
      latent:this.state.state.slice(0,8)
    });
    for(const a of ACTIONS) bias[a]=clamp(bias[a]!+autonomousContinual.actionBias[a]!, -.135, .135);
    const metaContinual=this.selfOptimizingContinual.beforeDecision({
      tick:i.tick,context:[...this.state.state.slice(0,16),i.novelty01,i.uncertainty01,i.predictionError01,i.goalPressure01],
      baseUtilities:i.baseUtilities,novelty01:i.novelty01,uncertainty01:i.uncertainty01,predictionError01:i.predictionError01,
      resource01:computeBudget01,forgetting01:clamp(this.state.deepIntegration.forgetting01),informationGain01:clamp(infoGain.informationGain01),
      replayDebt01:clamp(this.state.replayDiversity01),latent:this.state.state.slice(0,8)
    });
    for(const a of ACTIONS) bias[a]=clamp(bias[a]!+metaContinual.actionBias[a]!, -.155, .155);
    const causalPredictive=this.causalPredictiveIntervention.beforeDecision({tick:i.tick,latent:this.state.state.slice(0,8),baseUtilities:i.baseUtilities,novelty01:i.novelty01,uncertainty01:i.uncertainty01,predictionError01:i.predictionError01,resource01:computeBudget01,goalPressure01:i.goalPressure01,identityGap01:i.identityGap01,existingBias:bias});
    for(const a of ACTIONS) bias[a]=clamp(bias[a]!+causalPredictive.actionBias[a]!, -.175, .175);
    const unifiedWorld=this.unifiedCausalWorldLoop.beforeDecision({tick:i.tick,latent:this.state.state.slice(0,8),baseUtilities:i.baseUtilities,novelty01:i.novelty01,uncertainty01:i.uncertainty01,predictionError01:i.predictionError01,resource01:computeBudget01,goalPressure01:i.goalPressure01,identityGap01:i.identityGap01,existingBias:bias});
    for(const a of ACTIONS) bias[a]=clamp(bias[a]!+unifiedWorld.actionBias[a]!, -.19, .19);
    const modelTimeReplay=this.modelTimeReplay.beforeDecision({tick:i.tick,contextId:unifiedWorld.contextId,baseUtilities:i.baseUtilities,predictionError01:i.predictionError01,novelty01:i.novelty01,uncertainty01:i.uncertainty01,verification01:this.externalGrounding.metrics().grounding01,resource01:computeBudget01});
    for(const a of ACTIONS) bias[a]=clamp(bias[a]!+modelTimeReplay.actionBias[a]!, -.205, .205);
    if(!this.stabilityPlasticity.metrics().learningEvents)this.stabilityPlasticity.bootstrapFromCurrent(this.state.actionReadout,this.state.edgeWeights);
    const stabilityPlasticity=this.stabilityPlasticity.beforeDecision({tick:i.tick,contextId:unifiedWorld.contextId,novelty01:i.novelty01,uncertainty01:i.uncertainty01,predictionError01:i.predictionError01,forgetting01:clamp(this.state.deepIntegration.forgetting01),replayPressure01:modelTimeReplay.replayPressure01,resource01:computeBudget01,contextMatch01:unifiedWorld.worldConfidence01});
    const selfKnowledge=this.selfKnowledgeCoreset.beforeDecision({tick:i.tick,contextId:unifiedWorld.contextId,baseUtilities:i.baseUtilities,studentBias:bias,predictionError01:i.predictionError01,uncertainty01:i.uncertainty01,novelty01:i.novelty01,forgetting01:clamp(this.state.deepIntegration.forgetting01),worldConfidence01:unifiedWorld.worldConfidence01,replayPressure01:modelTimeReplay.replayPressure01,resource01:computeBudget01});
    for(const a of ACTIONS) bias[a]=clamp(bias[a]!+selfKnowledge.actionBias[a]!, -.19, .19);
    const transferSafety=this.transferSafetySynergy.beforeDecision({tick:i.tick,latent:this.state.state.slice(0,12),contextId:unifiedWorld.contextId,novelty01:i.novelty01,uncertainty01:i.uncertainty01,predictionError01:i.predictionError01,resource01:computeBudget01,forgetting01:clamp(this.state.deepIntegration.forgetting01),worldConfidence01:unifiedWorld.worldConfidence01,teacherConfidence01:selfKnowledge.teacherConfidence01,replayPressure01:modelTimeReplay.replayPressure01,baseUtilities:i.baseUtilities});
    for(const a of ACTIONS) bias[a]=clamp(bias[a]!+transferSafety.actionBias[a]!, -.205, .205);
    for(const a of ACTIONS) bias[a]=clamp(bias[a]!+stabilityPlasticity.actionBias[a]!, -.215, .215);
    const coherence=clamp(.45+Math.abs(mean-.10)*-.7+(1-i.predictionError01)*.25+pressure*.10+.05*this.state.longMemoryStability01);
    const token:NeuralExperienceToken={
      tick:i.tick,contextId:unifiedWorld.contextId,input:temporalInput,neuralBefore:before,neuralAfter:this.state.state.slice(),
      prediction01:prediction,actual01:i.reward01??.5,predictionError01:i.predictionError01,pressure01:pressure,
      novelty01:i.novelty01,uncertainty01:i.uncertainty01,reward01:i.reward01??.5,action:null,actionUtilities:{...i.baseUtilities},
      selectedAssembly:spikes,replayEligible:true,verified:false,
      replayPriority01:clamp(
        i.predictionError01*.40+i.novelty01*.18+i.uncertainty01*.18+this.state.cueTraceStrength01*.14+
        continuity.disagreement01*.10+risk.risk01*.08+taskFree.taskFreeScore01*.06+selfMemory.selectedRecallConfidence01*.05+
        selfMemory.writeGate01*.03+autonomousContinual.boundary01*.05+autonomousContinual.planning.epistemicValue01*.05+causalPredictive.informationGain01*.05+causalPredictive.interventionValue01*.04+unifiedWorld.informationValue01*.05+unifiedWorld.replayUtility01*.04+(1-unifiedWorld.worldConfidence01)*.03+modelTimeReplay.replayPressure01*.05+modelTimeReplay.forgettingRisk01*.04
      ),
      retrievedMemoryIds:continuity.retrieved.map(m=>m.id),
      policyCue:policyCue.slice(),
      policyContextId:slowContextId
    };
    this.state.lastExperience=token;this.state.prediction01=prediction;this.state.predictionError01=clamp(this.state.predictionError01*.86+i.predictionError01*.14);this.state.coherence01=coherence;this.state.cycles++;this.state.tick=i.tick;
    this.state.foresightQuality01=clamp(this.state.foresightQuality01*.94+causal.selectedForesight01*.06);
    this.state.causalSensitivity01=clamp(this.state.causalSensitivity01*.94+causal.causalSensitivity01*.06);
    this.state.transfer01=clamp(this.state.transfer01*.92+causal.transfer01*.05+transferable.optionCoverage01*.03+taskFree.coverage01*.015);
    // Runtime-owned submodule state is synchronized at the durable/public snapshot boundary.
    return {
      actionBias:bias, experience:token, prediction01:prediction, pressure01:pressure,
      coherence01:coherence, generalization01:this.state.generalization01,
      embodied:{
        actionBias:embodied.actionBias,
        epistemicValue01:embodied.epistemicValue01,
        activeNeuronFraction01:embodied.activeNeuronFraction01,
        activePerception01:embodied.activePerception01,
        computeCost01:embodied.computeCost01,
        asyncSensorPenalty01:embodied.asyncSensorPenalty01,
        selectedReward01:embodied.selectedReward01,
        selectedConfidence01:embodied.selectedConfidence01,
        taskFreeCoverage01:taskFree.coverage01,
        risk01:risk.risk01,
        recoveryAction:risk.recoveryAction,
        abstain:risk.abstain,
        goalConditioning01:personality.goalConditioning01,
        identityConditioning01:personality.identityConditioning01,
        deviceBudget01:computeBudget01,
        deviceDegraded01:device.degraded01,
        memoryUtility01:selfMemory.memoryUtility01,
        memoryWriteGate01:selfMemory.writeGate01,
        memoryRecallConfidence01:selfMemory.selectedRecallConfidence01,
        liveImprovement01:selfMemory.liveImprovement01,
        liveRedirectAction:selfMemory.redirectAction,
        selectedMemoryStrategy:selfMemory.selectedStrategy,
        informationGain01:infoGain.informationGain01, epistemicAction01:infoGain.epistemicValue01, informationExperiment01:infoGain.experiment01, activeExperimentAction:infoGain.selectedAction, grounding01:grounding.grounding01, evidenceQuality01:this.evidenceLedger.metrics().closedLoopQuality01
,developmentalGoalAutonomy01:developmental.goalAutonomy01,developmentalTransfer01:developmental.transfer01,developmentalCoherence01:this.developmentalController.metrics().developmentalCoherence01,developmentalRecoveryAction:developmental.recoveryAction
      }
    };
  }

  /**
   * P2716 micro-cognition path: preserve a real neural state transition and delayed
   * synaptic credit on temporal-resolution ticks without invoking the expensive full
   * decision stack. This is deliberately smaller than beforeDecision()/afterOutcome(),
   * but it still runs the owned recurrent substrate, eligibility traces, multi-horizon
   * credit controller, protection gate and local plasticity.
   */
  microTick(i:{
    tick:number; input:number[]; action:ActionKind; reward01:number; predictionError01:number;
    verified01?:number; novelty01:number; uncertainty01:number; goalPressure01:number;
    identityGap01:number; identityVector?:number[]; sensorFreshness01?:number;
    worldConfidence01?:number; selfContinuity01?:number;
  }){
    if(!this.state.enabled) return {enabled:false,learningScale01:0,prediction01:this.state.prediction01};
    const before=this.state.state.slice();
    const x=this.encode(i.input.slice(0,NEURAL_INPUT_DIM));
    const pressure=this.pressureField({predictionError01:i.predictionError01,novelty01:i.novelty01,uncertainty01:i.uncertainty01,homeostasis01:1,identityGap01:i.identityGap01,goalPressure01:i.goalPressure01});
    this.state.novelty01=clamp(i.novelty01);this.state.uncertainty01=clamp(i.uncertainty01);
    this.selectiveSlowMemory(x,pressure);
    const dyn=this.stepDynamics(x,i.action);
    const mean=dyn.spikes.reduce((a,b)=>a+b,0)/Math.max(1,this.state.neurons);
    let recurrentSignal=0;
    for(let n=0;n<this.state.neurons;n+=2){
      for(let q=0;q<6;q++){
        const j=this.state.edgeTargets[n]?.[q]??0;
        recurrentSignal+=Math.abs((this.state.edgeWeights[n]?.[q]??0)*(this.state.state[j]??0));
      }
    }
    recurrentSignal=clamp(recurrentSignal/192);
    const prediction=sigmoid(.18+mean*1.8+pressure*.72+recurrentSignal*2.2+this.state.cueTraceStrength01*.16-this.state.predictionError01*.30);
    const reward=clamp(i.reward01),error=clamp(i.predictionError01),verified=clamp(i.verified01??0);
    const tdSignal=tanh(reward-prediction);
    const modelResidual=tanh((this.state.state.slice(0,8).reduce((sum,v,k)=>sum+v-(before[k]??0),0))/8);
    const causalCredit=tanh((.62*tdSignal+.23*modelResidual+.15*((verified-.5)*2))*(.40+.60*(1-i.uncertainty01)));
    const lifelong=this.adaptiveLifelong.beforeDecision({tick:i.tick,context:[...before.slice(0,16),i.novelty01,i.uncertainty01,i.goalPressure01,i.identityGap01],novelty01:i.novelty01,uncertainty01:i.uncertainty01,predictionError01:error,taskShift01:clamp(i.novelty01*.55+i.uncertainty01*.45),forgetting01:clamp(this.state.deepIntegration.forgetting01),resource01:.34,counterfactual01:.5,replayDebt01:clamp(this.state.replayDiversity01),modelConfidence01:this.state.deepIntegration.worldPredictionDebt01});
    const autonomousContinual=this.autonomousContinual.beforeDecision({
      tick:i.tick,context:[...before.slice(0,16),i.novelty01,i.uncertainty01,i.goalPressure01,i.identityGap01],
      baseUtilities:Object.fromEntries(ACTIONS.map(a=>[a,a===i.action?.55:.5])) as Record<ActionKind,number>,
      uncertainty01:i.uncertainty01,novelty01:i.novelty01,predictionError01:error,resource01:.34,
      forgetting01:clamp(this.state.deepIntegration.forgetting01),replayDebt01:clamp(this.state.replayDiversity01),latent:before.slice(0,8)
    });
    const metaContinual=this.selfOptimizingContinual.beforeDecision({
      tick:i.tick,context:[...before.slice(0,16),i.novelty01,i.uncertainty01,i.goalPressure01,i.identityGap01],
      baseUtilities:Object.fromEntries(ACTIONS.map(a=>[a,a===i.action?.55:.5])) as Record<ActionKind,number>,
      uncertainty01:i.uncertainty01,novelty01:i.novelty01,predictionError01:error,resource01:.34,
      forgetting01:clamp(this.state.deepIntegration.forgetting01),replayDebt01:clamp(this.state.replayDiversity01),
      informationGain01:clamp(this.policyInformationGain.metrics().policyInformationGain01??0),latent:before.slice(0,8)
    });
    const causalPredictive=this.causalPredictiveIntervention.beforeDecision({tick:i.tick,latent:before.slice(0,8),baseUtilities:Object.fromEntries(ACTIONS.map(a=>[a,a===i.action?.55:.5])) as Record<ActionKind,number>,novelty01:i.novelty01,uncertainty01:i.uncertainty01,predictionError01:error,resource01:.34,goalPressure01:i.goalPressure01,identityGap01:i.identityGap01,existingBias:metaContinual.actionBias});
    const unifiedWorld=this.unifiedCausalWorldLoop.beforeDecision({tick:i.tick,latent:before.slice(0,8),baseUtilities:Object.fromEntries(ACTIONS.map(a=>[a,a===i.action?.55:.5])) as Record<ActionKind,number>,novelty01:i.novelty01,uncertainty01:i.uncertainty01,predictionError01:error,resource01:.34,goalPressure01:i.goalPressure01,identityGap01:i.identityGap01,existingBias:causalPredictive.actionBias});
    if(!this.stabilityPlasticity.metrics().learningEvents)this.stabilityPlasticity.bootstrapFromCurrent(this.state.actionReadout,this.state.edgeWeights);
    const stabilityPlasticity=this.stabilityPlasticity.beforeDecision({tick:i.tick,contextId:unifiedWorld.contextId,novelty01:i.novelty01,uncertainty01:i.uncertainty01,predictionError01:error,forgetting01:clamp(this.state.deepIntegration.forgetting01),replayPressure01:clamp(this.state.replayDiversity01),resource01:.34,contextMatch01:unifiedWorld.worldConfidence01});
    const deepDecision=this.deepIntegration.beforeDecision({
      tick:i.tick,uncertainty01:i.uncertainty01,novelty01:i.novelty01,predictionError01:error,
      identityGap01:i.identityGap01,goalPressure01:i.goalPressure01,computeBudget01:.34,
      worldConfidence01:clamp(i.worldConfidence01??.35),selfContinuity01:clamp(i.selfContinuity01??1-i.identityGap01),
      policyInformationGain01:clamp(this.policyInformationGain.metrics().policyInformationGain01??0),
      experimentValue01:clamp(this.autonomousExperimentScheduler.metrics().value01??0),
      baseUtilities:Object.fromEntries(ACTIONS.map(a=>[a,a===i.action?.55:.5])) as Record<ActionKind,number>,
    });
    const outcome=this.deepIntegration.afterOutcome({
      tick:i.tick,reward01:reward,predictionError01:error,verified01:verified,
      causalCredit01:Math.abs(causalCredit),latentResidual01:Math.abs(modelResidual),
      policyInformationGain01:clamp(this.policyInformationGain.metrics().policyInformationGain01??0),
      experimentValue01:clamp(this.autonomousExperimentScheduler.metrics().value01??0),
      replayCredit01:clamp(this.state.replayDiversity01),
      selfPredictionError01:clamp(i.identityGap01),identityContinuity01:clamp(1-i.identityGap01),
      worldPredictionError01:clamp(error*.55+(1-clamp(i.worldConfidence01??.35))*.45),
      neuralBefore:before,neuralAfter:this.state.state.slice(),action:i.action,
      goalPressure01:i.goalPressure01,novelty01:i.novelty01,uncertainty01:i.uncertainty01,
    });
    this.state.adaptiveLifelong=this.adaptiveLifelong.snapshot();
    if(i.tick%4===0){
      this.autonomousContinual.observeOutcome({tick:i.tick,context:[...before.slice(0,16),i.novelty01,i.uncertainty01,i.goalPressure01,i.identityGap01],action:i.action,reward01:reward,predictionError01:error,verified01:verified,novelty01:i.novelty01,uncertainty01:i.uncertainty01,latent:this.state.state.slice(0,8),priorLatent:before.slice(0,8),baseUtilities:Object.fromEntries(ACTIONS.map(a=>[a,a===i.action?.55:.5])) as Record<ActionKind,number>,resource01:.34});
      this.state.autonomousContinual=this.autonomousContinual.snapshot();      this.selfOptimizingContinual.observeOutcome({tick:i.tick,context:[...before.slice(0,16),i.novelty01,i.uncertainty01,i.goalPressure01,i.identityGap01],contextId:metaContinual.contextId,action:i.action,reward01:reward,predictionError01:error,novelty01:i.novelty01,uncertainty01:i.uncertainty01,priorLatent:before.slice(0,8),latent:this.state.state.slice(0,8),replayUsed:0,planningAgreement01:metaContinual.planningAgreement01});
      this.causalPredictiveIntervention.observeOutcome({tick:i.tick,latentBefore:before.slice(0,8),latentAfter:this.state.state.slice(0,8),action:i.action,reward01:reward,predictionError01:error,novelty01:i.novelty01,uncertainty01:i.uncertainty01,verified01:verified,contextId:causalPredictive.contextId});
      this.unifiedCausalWorldLoop.observeOutcome({tick:i.tick,latentBefore:before.slice(0,8),latentAfter:this.state.state.slice(0,8),action:i.action,reward01:reward,predictionError01:error,novelty01:i.novelty01,uncertainty01:i.uncertainty01,verified01:verified,contextId:unifiedWorld.contextId});
      this.modelTimeReplay.observeOutcome({tick:i.tick,contextId:unifiedWorld.contextId,action:i.action,latentBefore:before.slice(0,8),latentAfter:this.state.state.slice(0,8),reward01:reward,predictionError01:error,novelty01:i.novelty01,verified01:verified,worldModelDelta01:this.unifiedCausalWorldLoop.metrics().transitionError01,causalDelta01:Math.abs(this.unifiedCausalWorldLoop.metrics().causalCredit01)});
    }
    const infoWeight=clamp(this.policyInformationGain.metrics().policyInformationGain01??0);
    const expWeight=clamp(this.autonomousExperimentScheduler.metrics().value01??0);
    const epistemic=clamp(infoWeight*.72+expWeight*.28);
    const online=this.deepLearningCoupler.composeCredit({causal01:causalCredit,epistemic01:epistemic,experiment01:expWeight,uncertainty01:i.uncertainty01,verified01:verified,stability01:clamp(deepDecision.phaseConfidence01),budget01:.34});
    const planAgreement=autonomousContinual.planning.selectedAction===i.action?1:-.65;
    const metaAgreement=metaContinual.planningAgreement01*((metaContinual.actionBias[i.action]??0)>=0?1:-.65);
    const mod=tanh(.32*causalCredit+.43*online+.08*planAgreement*autonomousContinual.planning.selectedValue01+.12*metaAgreement*(.55+.45*metaContinual.fastLearning01)+.05*(unifiedWorld.causalCredit01)+.04*(unifiedWorld.plannerPolicyAgreement01-.5)+.010*(causalPredictive.informationGain01-.35)+.006*(causalPredictive.interventionValue01-.30)+.003*causalPredictive.counterfactualGap01);
    const unifiedWorldScale=this.unifiedCausalWorldLoop.learningScale01();
    const modelTimeScale=clamp(.94+.08*this.modelTimeReplay.metrics().consolidationPressure01-.05*this.modelTimeReplay.metrics().forgettingRisk01,.86,1.04);
    const selfKnowledgeMetrics=this.selfKnowledgeCoreset.metrics();
    const transferSafetyMetrics=this.transferSafetySynergy.metrics();
    const teacherConfidence=clamp(Number(selfKnowledgeMetrics.teacherConfidence01?.[unifiedWorld.contextId]??.5));
    const teacherScale2=clamp(.96+.10*selfKnowledgeMetrics.distillScale01+.06*selfKnowledgeMetrics.calibration01-.05*(1-teacherConfidence),.90,1.08);
    const transferScale=clamp(transferSafetyMetrics.learningScale01*(.84+.16*transferSafetyMetrics.orthogonalSafety01),.72,1.10);
    const causalLearningScale=clamp((.90+.14*causalPredictive.modelCalibration01+.08*causalPredictive.interventionValue01-.08*causalPredictive.mobilePressure01)*(.92+.08*unifiedWorldScale)*modelTimeScale*teacherScale2*transferScale,.80,1.14);
    const baseLr=(.006+verified*.012)*(.55+.45*clamp(deepDecision.phaseConfidence01))*outcome.learningScale01*(.76+.24*metaContinual.fastLearning01)*causalLearningScale;
    let plasticUpdates=0,traceNorm=0;
    for(let n=0;n<this.state.neurons;n++){
      const rowE=this.state.edgeEligibility[n]!,rowM=this.state.cascadeEligibilityMid[n]!,rowS=this.state.cascadeEligibilitySlow[n]!,rowU=this.state.edgeUncertainty[n]!;
      const localProtection=this.deepIntegration.synapsePlasticityGate(n,i.uncertainty01,error)*this.adaptiveLifelong.synapseGate(n,i.uncertainty01,error)*lifelong.plasticityMultiplier01*this.stabilityPlasticity.gateNeuron(n,error,i.novelty01>0.7?.55:.78,this.stabilityPlasticity.importanceAt(n));
      const astro=clamp(this.state.astroGate[n]??.72);
      for(let q=0;q<12;q++){
        const fast=finite(rowE[q]),mid=finite(rowM[q]),slow=finite(rowS[q]);
        const mixed=this.adaptiveLifelong.delayMix(this.deepLearningCoupler.mixTrace(fast,mid,slow),mid,slow,Math.min(1,(this.state.edgeDelays[n]![q]??1)/3));
        const e=this.state.experimentalLayerEnabled?clamp(mixed,-2,2):fast;
        traceNorm+=Math.abs(e);
        const u=clamp(rowU[q]??.65);
        const transferGate=this.transferSafetySynergy.gateUpdate(clamp(Math.abs(e)),this.stabilityPlasticity.importanceAt(n),transferSafetyMetrics.contextCompatibility01,i.uncertainty01);
        const eta=baseLr*transferGate.scale01*(.25+.75*u)*clamp(this.state.plasticity[n]??.35,.05,1.2)*astro*localProtection;
        const updateScore=clamp(Math.abs(e)*(.55+.45*Math.abs(mod)));
        if(Math.abs(e)>.0005 && this.adaptiveLifelong.shouldUpdate(n,updateScore,.34)){
          const w=this.state.edgeWeights[n]![q]??0;
          const bound=1-Math.min(.75,(Math.abs(w)/.35)**2*.75);
          this.state.edgeWeights[n]![q]=clamp(w+e*mod*eta*(this.state.populationKinds[n]==='I'?-1:1)*bound,-.35,.35);
          rowU[q]=clamp(u+(clamp(.25+error*.75)-u)*.02);
          plasticUpdates++;
          this.adaptiveLifelong.observeSynapse(n,updateScore,true);
        }
        this.state.edgeDelays[n]![q]=Math.max(1,Math.min(3,(this.state.edgeDelays[n]![q]??1)+(Math.abs(rowE[q])>.35&&Math.abs(mod)>.08?(mod>0?1:-1):0)));
        this.state.plasticity[n]=clamp((this.state.plasticity[n]??.35)*.999+Math.abs(e*mod)*.004,.05,1.2);
        rowE[q]=finite(rowE[q])*.70;
        rowM[q]=finite(rowM[q])*.86;
        rowS[q]=finite(rowS[q])*.96;
      }
      const it=this.state.inputEligibility[n]!;
      for(let k=0;k<NEURAL_INPUT_DIM;k++){
        const e=finite(it[k]);
        if(Math.abs(e)>.00025){
          const w=this.state.inputProjection[n]![k]??0;
          this.state.inputProjection[n]![k]=clamp(w+e*mod*baseLr*.42*localProtection,-.20,.20);
          this.state.sensoryLearningUpdates++;
        }
        it[k]=e*.72;
      }
    }
    if(this.state.experimentalLayerEnabled && this.deepIntegration.maintenanceDue('normalize')){
      for(let n=0;n<this.state.neurons;n++) this.deepLearningCoupler.normalizeRow(this.state.edgeWeights[n]!);
      this.syncDenseReference();
    }
    this.state.learningUpdates++;
    this.state.onlineCreditUpdates++;
    this.state.eligibilityUpdates++;
    this.state.cascadeCreditUpdates+=this.state.experimentalLayerEnabled?plasticUpdates:0;
    this.state.creditTraceNorm01=clamp(this.state.creditTraceNorm01*.92+clamp(traceNorm/(this.state.neurons*12),0,1)*.08);
    this.state.longDelayCredit01=clamp(this.state.longDelayCredit01*.97+clamp(traceNorm/(this.state.neurons*12),0,1)*.03);
    this.state.prediction01=prediction;
    this.state.predictionError01=clamp(this.state.predictionError01*.82+error*.18);
    this.state.coherence01=clamp(.45+(1-error)*.35+this.state.longMemoryStability01*.20);
    this.state.lastExperience={
      tick:i.tick,input:x,neuralBefore:before,neuralAfter:this.state.state.slice(),prediction01:prediction,actual01:reward,
      predictionError01:error,pressure01:pressure,novelty01:i.novelty01,uncertainty01:i.uncertainty01,reward01:reward,
      action:i.action,actionUtilities:Object.fromEntries(ACTIONS.map(a=>[a,a===i.action?.55:.5])) as Record<ActionKind,number>,
      selectedAssembly:dyn.spikes,replayEligible:true,verified:verified>.5,
      replayPriority01:clamp(error*.4+i.novelty01*.2+i.uncertainty01*.16+this.state.cueTraceStrength01*.12),retrievedMemoryIds:[]
    };
    this.state.cycles++;this.state.tick=i.tick;
    if(this.state.cycles%16===0)this.applyHomeostaticScaling();
    const token=this.state.lastExperience;
    if(token){this.state.replayBuffer.push(deep(token));if(this.state.replayBuffer.length>192)this.state.replayBuffer.splice(0,this.state.replayBuffer.length-192);}
    this.state.selfKnowledgeCoreset=this.selfKnowledgeCoreset.snapshot();
    this.state.transferSafetySynergy=this.transferSafetySynergy.snapshot();
    const deepMetrics=this.deepIntegration.metrics();
    this.state.deepIntegration=deepMetrics;
    return {enabled:true,learningScale01:outcome.learningScale01,prediction01:prediction,phase:deepDecision.phase,plasticUpdates,protectedMass01:deepMetrics.protectedMass01,delayConsensus01:deepMetrics.delayConsensus01};
  }

  commitAction(action:ActionKind,utilities:Record<ActionKind,number>){this.continuity.commitAction(action);if(this.state.lastExperience){this.state.lastExperience.action=action;this.state.lastExperience.actionUtilities={...utilities};}}

  afterOutcome(i:{tick:number;action:ActionKind;reward01:number;predictionError01:number;verified01:number;nextInput:number[];holdout01?:number;identityGap01?:number;goalPressure01?:number;identityVector?:number[];evidence?:{verified:boolean;independent:boolean;source:'world-transition'|'external-verification'|'internal';evidenceRef?:string};embodied?:{nextFeatures?:number[];sensorFreshness01?:number;sensors?:Record<string,{tick:number;values:number[];freshness01:number;confidence01:number;ageTicks:number;source:string}>}}){
    if(!this.state.enabled)return;const token=this.state.lastExperience;if(!token)return;
    const error=clamp(i.predictionError01),reward=clamp(i.reward01),verified=clamp(i.verified01),surprise=clamp(Math.abs(reward-token.prediction01)*.7+error*.3);
    const syntheticPromotions=this.verifiedSyntheticTrajectoryGate.observeOutcome({tick:i.tick,action:i.action,reward01:reward,nextLatent:i.nextInput,verified01:verified,holdout01:clamp(i.holdout01??0),contextId:Number(token.contextId??0)});
    for(const promotion of syntheticPromotions){
      const ai=promotion.actionIndex;
      const gain=promotion.gain01;
      for(let j=0;j<this.state.neurons;j+=8){
        const latent=promotion.predictedNext[j%8]??0;
        const current=this.state.actionReadout[ai]?.[j]??0;
        this.state.actionReadout[ai]![j]=clamp(current+gain*latent,-.25,.25);
      }
      this.unifiedCausalWorldLoop.noteSyntheticTrajectoryCredit(clamp(gain*96));
    }
    const sharedContext16:number[]=[...token.neuralBefore.slice(0,16),token.novelty01,token.uncertainty01,i.goalPressure01??.5];
    const sharedNext24:number[]=i.nextInput.slice(0,24);
    const sharedIdentity24:number[]=(i.identityVector??this.state.state).slice(0,24);
    const policyInformationGain01:number=this.policyInformationGain.metrics().policyInformationGain01;
    const experimentValue01:number=this.autonomousExperimentScheduler.metrics().value01;
    const activeWorld=this.unifiedCausalWorldLoop.metrics();
    const selfKnowledgeOutcomeContext=activeWorld.activeContextId;
    const policyPhase=this.offlineConsolidation.metrics().phase as P2855ActionPolicyPhase;
    this.contextualActionPolicy.observe(Number(token.policyContextId??selfKnowledgeOutcomeContext),token.policyCue??token.input,i.action?ACTIONS.indexOf(i.action):-1,reward,error,verified,policyPhase,this.continuity.metrics().computeBudget01);
    this.selfKnowledgeCoreset.observeOutcome({tick:i.tick,contextId:selfKnowledgeOutcomeContext,action:i.action,reward01:reward,predictionError01:error,novelty01:token.novelty01,verified01:verified,uncertainty01:token.uncertainty01,studentConfidence01:clamp(1-error),studentBias:token.actionUtilities,latent:i.nextInput.slice(0,8),replayPriority01:token.replayPriority01});
    this.transferSafetySynergy.observeOutcome({contextId:activeWorld.activeContextId,latent:i.nextInput.slice(0,12),reward01:reward,predictionError01:error,verified01:verified,transferUsed01:clamp(this.transferSafetySynergy.metrics().positiveTransfer01),replayUsed:0});
    this.continuity.afterOutcome({tick:i.tick,input:token.input,latent:token.neuralBefore,nextLatent:i.nextInput.slice(0,8),action:i.action,reward01:reward,predictionError01:error,verified01:verified,novelty01:token.novelty01,uncertainty01:token.uncertainty01,goalPressure01:i.goalPressure01??.5,identityGap01:i.identityGap01??.5,homeostasis01:1});
    const causalOutcome=this.causalPlanner.afterOutcome({tick:i.tick,context:[...token.neuralBefore.slice(0,16),token.novelty01,token.uncertainty01,error,i.goalPressure01??.5],latent:token.neuralBefore.slice(0,8),nextLatent:i.nextInput.slice(0,8),action:i.action,reward01:reward,predictionError01:error,verified01:verified,retrievedMemoryIds:token.retrievedMemoryIds??[],counterfactualReward:this.causalPlanner.metrics().lastCounterfactualReward??new Array(ACTIONS.length).fill(.5),forecastConfidence01:this.causalPlanner.metrics().lastSelectedConfidence01,disagreement01:this.causalPlanner.metrics().selectiveForesight01});
    for(const [id,credit] of causalOutcome.memoryCredit)this.continuity.applyMemoryCredit(id,credit);
    this.embodiedBridge.afterOutcome({tick:i.tick,action:i.action,nextFeatures:(i.embodied?.nextFeatures??i.nextInput).slice(0,64),reward01:reward,verified01:verified,predictionError01:error,sensorFreshness01:i.embodied?.sensorFreshness01});
    const embodiedPostMetrics=this.embodiedBridge.metrics();
    this.unifiedCausalWorldLoop.observeEmbodiedOutcome({action:i.action,reward01:reward,verified01:verified,predictionError01:error,sensorimotorError01:embodiedPostMetrics.sensorimotorError01,sensorFreshness01:clamp(1-embodiedPostMetrics.asyncSensorPenalty01)});
    const transferableOutcome=this.transferableSkills.afterOutcome({tick:i.tick,context:sharedContext16,latent:token.neuralBefore.slice(0,8),nextLatent:i.nextInput.slice(0,8),action:i.action,reward01:reward,predictionError01:error,verified01:verified});
    const hierarchicalOutcome=this.hierarchicalSkills.afterOutcome({tick:i.tick,context:sharedContext16,action:i.action,reward01:reward,predictionError01:error,verified01:verified,skills:this.transferableSkills.metrics().skills});
    this.taskAgnosticTransfer.afterOutcome({selectedSkillId:this.taskAgnosticTransfer.metrics().selectedSkillId,reward01:reward,verified01:verified,predictionError01:error,counterfactualReward01:this.causalPlanner.metrics().lastCounterfactualReward?.[ACTIONS.indexOf(i.action)]});
    const riskM=this.riskRecovery.metrics();
    const recoveryTriggered=!!riskM.selectedRecovery;
    const recoverySuccess=clamp((i.action===riskM.selectedRecovery?reward:.5)*.55+verified*.30+(1-error)*.15);
    this.riskRecovery.afterOutcome({reward01:reward,verified01:verified,predictionError01:error,recoveryTriggered,recoverySuccessful01:recoverySuccess,failureSeverity01:clamp(error*.65+(reward<.35?.35:0)+(1-verified)*.18)});
    this.goalIdentityModulator.afterOutcome({reward01:reward,verified01:verified,identityGap01:i.identityGap01??.5,goalPressure01:i.goalPressure01??.5,selectedAction:i.action});
    this.selfOptimizingMemory.afterOutcome({tick:i.tick,context:[...token.neuralBefore.slice(0,16),token.novelty01,token.uncertainty01,i.goalPressure01??.5,i.identityGap01??.5],identityVector:sharedIdentity24,goalPressure01:i.goalPressure01??.5,identityGap01:i.identityGap01??.5,novelty01:clamp(token.novelty01+policyInformationGain01*.12+experimentValue01*.08),uncertainty01:clamp(token.uncertainty01+policyInformationGain01*.08+experimentValue01*.05),reward01:reward,predictionError01:error,verified01:verified,action:i.action,holdout01:i.holdout01});
    this.developmentalController.afterOutcome({tick:i.tick,context:[...token.neuralBefore.slice(0,16),token.novelty01,token.uncertainty01,i.goalPressure01??.5,i.identityGap01??.5],nextContext:sharedNext24,identityVector:sharedIdentity24,action:i.action,reward01:reward,predictionError01:error,verified01:verified,goalPressure01:i.goalPressure01??.5,identityGap01:i.identityGap01??.5,autonomous01:1,external01:clamp(1-error),fault01:error>.72?error:0,recovery01:clamp((1-error)*.6+verified*.4)});
    this.developmentalController.commitAction(i.action);
    if(this.lastArbiterBiases)this.crossLayerArbiter.learn({action:i.action,reward01:reward,verified01:verified,predictionError01:error,biases:this.lastArbiterBiases,weights:this.crossLayerArbiter.metrics().sourceWeights});
    this.externalGrounding.afterOutcome({tick:i.tick,action:i.action,reward01:reward,verified01:verified,predictionError01:error,sensors:i.embodied?.sensors,observedContradiction01:clamp(error*.45+(1-verified)*.35)});
    this.activeInformationGain.afterOutcome({tick:i.tick,action:i.action,reward01:reward,verified01:verified,predictionError01:error,observedChange01:clamp(Math.abs((i.nextInput[0]??0)-(token.neuralBefore[0]??0))*1.5),contradiction01:clamp(error*.45+(1-verified)*.35),hypothesisId:this.state.activeInformationGain.selectedHypothesis});
    this.evidenceLedger.record({tick:i.tick,action:i.action,predicted01:token.prediction01,observed01:reward,reward01:reward,verified01:verified,predictionError01:error,contradiction01:clamp(error*.45+(1-verified)*.35),grounding01:this.externalGrounding.metrics().grounding01,informationGain01:this.activeInformationGain.metrics().informationGain01,causalCredit01:clamp(causalOutcome.causalGain01),sourceIds:[this.externalGrounding.metrics().selectedChannel??'internal']});
    const regimeMetrics=this.causalRegimeGraph.metrics();
    this.learnedTransition.afterOutcome({tick:i.tick,preContext:[...token.neuralBefore.slice(0,16),token.novelty01,token.uncertainty01],postContext:[...sharedNext24,i.goalPressure01??.5,i.identityGap01??.5],action:i.action,reward01:reward,predictionError01:error});
    this.causalRegimeGraph.afterOutcome({tick:i.tick,preContext:[...token.neuralBefore.slice(0,24),token.novelty01,token.uncertainty01],postContext:[...sharedNext24,i.goalPressure01??.5,i.identityGap01??.5],action:i.action,reward01:reward,predictionError01:error,intervention:regimeMetrics.interventions>regimeMetrics.usefulInterventions});
    this.factorialAblation.recordFactor(i.action,0.5,reward);
    this.hierarchicalWorldModel.afterOutcome({tick:i.tick,predictionError01:error,reward01:reward});
    this.policyInformationGain.afterOutcome({action:i.action,reward01:reward,predictionError01:error});
    this.autonomousExperimentScheduler.afterOutcome({reward01:reward,predictionError01:error});
    const embodiedMetrics=this.embodiedBridge.metrics();this.worldModelGate.afterOutcome({reward01:reward,continuityPred01:clamp(this.state.prediction01),embodiedPred01:clamp(1-embodiedMetrics.sensorimotorError01),verified01:verified,causalGain01:embodiedMetrics.causalSensitivity01,transfer01:embodiedMetrics.transfer01});
    this.state.causalSensitivity01=clamp(this.state.causalSensitivity01*.92+causalOutcome.causalGain01*.08);
    this.state.transfer01=clamp(this.state.transfer01*.84+causalOutcome.transfer01*.05+transferableOutcome.transfer01*.07+hierarchicalOutcome.transfer01*.04);
    // Model-time-aware dream rehearsal: replay stable action rules when forgetting debt rises,
    // protecting the actor policy from the "world model remembers, actor forgets" failure mode.
    if(this.deepIntegration.maintenanceDue('replay')){
      const maintenance=this.causalPlanner.maintenanceBudget();
      if(maintenance>0)this.causalPlanner.dreamRehearse(Math.min(6,maintenance));
    }
    // Runtime-owned submodule state is synchronized at the durable/public snapshot boundary.
    const continuityDiag=this.continuity.metrics();
    this.persistentPersonality.afterOutcome({tick:i.tick,reward01:reward,verified01:verified,predictionError01:error,identityGap01:i.identityGap01??.5,action:i.action,identityVector:i.identityVector,evidence:i.evidence});
    this.globalWorkspaceConvergence.learnOutcome({reward01:reward,verified01:verified,predictionError01:error});
    const temporalLearn=this.temporalSubstrate.learn(token.input,reward,error,verified);
    this.state.temporalSubstrate=this.temporalSubstrate.snapshot();
    this.state.persistentPersonality=this.persistentPersonality.snapshot();
    this.state.globalWorkspaceConvergence=this.globalWorkspaceConvergence.snapshot();
    const baselineSignal=tanh((reward-.5)*1.8+(1-error)*.6+this.state.pressure[0]!- .5);
    // P2706 research synthesis: combine a scalar outcome error with a local latent
    // transition residual and verification signal, then deliver that signed credit through
    // the already-existing eligibility traces. This is intentionally a bounded local
    // approximation of linear-memory online credit assignment (BrainTrace/TESS-inspired),
    // not a reimplementation of either method.
    let latentResidual=0;
    const residualDim=Math.min(8,i.nextInput.length,token.neuralAfter.length);
    for(let k=0;k<residualDim;k++) latentResidual += (i.nextInput[k]??0)-(token.neuralAfter[k]??0);
    latentResidual=tanh(latentResidual/Math.max(1,residualDim));
    const tdSignal=tanh(reward-token.prediction01);
    const modelSignal=tanh(latentResidual);
    const verificationSignal=(verified-.5)*2;
    const uncertaintyWeight=.25+.75*clamp(1-token.uncertainty01);
    const stabilityWeight=.55+.45*continuityDiag.stabilityGate01;
    const causalCredit=tanh((.50*tdSignal+.30*modelSignal+.20*verificationSignal)*uncertaintyWeight*stabilityWeight);
    const personalityAfter=this.persistentPersonality.metrics();
    const worldAfter=this.worldModelGate.metrics();
    const lifelong=this.adaptiveLifelong.beforeDecision({tick:i.tick,context:[...token.neuralBefore.slice(0,16),token.novelty01,token.uncertainty01,i.goalPressure01??.5,i.identityGap01??.5],novelty01:token.novelty01,uncertainty01:token.uncertainty01,predictionError01:error,taskShift01:clamp(token.novelty01*.55+token.uncertainty01*.45),forgetting01:clamp(this.state.deepIntegration.forgetting01),resource01:clamp(continuityDiag.computeBudget01),counterfactual01:clamp(this.causalPlanner.metrics().lastCounterfactualReward?.[ACTIONS.indexOf(i.action)]??.5),replayDebt01:clamp(this.state.replayDiversity01),modelConfidence01:clamp(1-error)});
    const integrationOutcome=this.deepIntegration.afterOutcome({
      tick:i.tick,
      reward01:reward,
      predictionError01:error,
      verified01:verified,
      causalCredit01:clamp(causalOutcome.causalGain01),
      latentResidual01:Math.abs(latentResidual),
      policyInformationGain01:clamp(policyInformationGain01),
      experimentValue01:clamp(experimentValue01),
      replayCredit01:clamp(this.state.replayDiversity01),
      selfPredictionError01:clamp(i.identityGap01??(1-personalityAfter.identityContinuity01)),
      identityContinuity01:clamp(personalityAfter.identityContinuity01),
      worldPredictionError01:clamp(.55*error+.45*((worldAfter.modelErrors01??[error,error]).slice(0,2).reduce((a,b)=>a+b,0)/2)),
      neuralBefore:token.neuralBefore,
      neuralAfter:i.nextInput,
      action:i.action,
      goalPressure01:i.goalPressure01??.5,
      novelty01:token.novelty01,
      uncertainty01:token.uncertainty01,
    });
    this.adaptiveLifelong.observeOutcome({tick:i.tick,action:i.action,reward01:reward,prediction01:token.prediction01,actual01:clamp(1-error),predictionError01:error,verified01:verified,context:[...token.neuralBefore.slice(0,16),token.novelty01,token.uncertainty01,i.goalPressure01??.5,i.identityGap01??.5],taskShift01:clamp(token.novelty01*.55+token.uncertainty01*.45),counterfactual01:clamp(this.causalPlanner.metrics().lastCounterfactualReward?.[ACTIONS.indexOf(i.action)]??.5),replayDebt01:clamp(this.state.replayDiversity01),worldConfidence01:clamp(1-error)});
    this.autonomousContinual.observeOutcome({tick:i.tick,context:[...token.neuralBefore.slice(0,16),token.novelty01,token.uncertainty01,i.goalPressure01??.5,i.identityGap01??.5],action:i.action,reward01:reward,predictionError01:error,verified01:verified,novelty01:token.novelty01,uncertainty01:token.uncertainty01,latent:i.nextInput.slice(0,8),priorLatent:token.neuralBefore.slice(0,8),baseUtilities:token.actionUtilities,resource01:continuityDiag.computeBudget01});
    const metaContextMetrics=this.selfOptimizingContinual.metrics();
    const metaOutcomeContext=metaContextMetrics.activeContextId;
    this.selfOptimizingContinual.observeOutcome({tick:i.tick,context:[...token.neuralBefore.slice(0,16),token.novelty01,token.uncertainty01,i.goalPressure01??.5,i.identityGap01??.5],contextId:metaOutcomeContext,action:i.action,reward01:reward,predictionError01:error,novelty01:token.novelty01,uncertainty01:token.uncertainty01,priorLatent:token.neuralBefore.slice(0,8),latent:i.nextInput.slice(0,8),replayUsed:0});
    const causalPredictive=this.causalPredictiveIntervention.beforeDecision({tick:i.tick,latent:token.neuralBefore.slice(0,8),baseUtilities:token.actionUtilities,novelty01:token.novelty01,uncertainty01:token.uncertainty01,predictionError01:error,resource01:continuityDiag.computeBudget01,goalPressure01:i.goalPressure01??.5,identityGap01:i.identityGap01??.5});
    this.causalPredictiveIntervention.observeOutcome({tick:i.tick,latentBefore:token.neuralBefore.slice(0,8),latentAfter:i.nextInput.slice(0,8),action:i.action,reward01:reward,predictionError01:error,novelty01:token.novelty01,uncertainty01:token.uncertainty01,verified01:verified,contextId:causalPredictive.contextId});
    const unifiedWorld=this.unifiedCausalWorldLoop.metrics();
    this.unifiedCausalWorldLoop.observeOutcome({tick:i.tick,latentBefore:token.neuralBefore.slice(0,8),latentAfter:i.nextInput.slice(0,8),action:i.action,reward01:reward,predictionError01:error,novelty01:token.novelty01,uncertainty01:token.uncertainty01,verified01:verified,contextId:unifiedWorld.activeContextId});
    this.modelTimeReplay.observeOutcome({tick:i.tick,contextId:unifiedWorld.activeContextId,action:i.action,latentBefore:token.neuralBefore.slice(0,8),latentAfter:i.nextInput.slice(0,8),reward01:reward,predictionError01:error,novelty01:token.novelty01,verified01:verified,worldModelDelta01:unifiedWorld.transitionError01,causalDelta01:Math.abs(unifiedWorld.causalCredit01)});
    const semanticTrace=this.modelTimeReplay.semanticReadout(unifiedWorld.activeContextId);
    const identityStabilityGate=clamp(personalityAfter.identityContinuity01*(1-.35*clamp(i.identityGap01??0)));
    const semanticBlend=clamp(semanticTrace.consolidationPressure01*.018*(.55+.45*semanticTrace.confidence01)*(.72+.28*identityStabilityGate),0,.024);
    const semanticProtectionTarget=clamp(.78+.16*semanticTrace.confidence01+.06*identityStabilityGate-.10*semanticTrace.consolidationPressure01);
    this.state.semanticRecurrentProtection01=clamp(this.state.semanticRecurrentProtection01*.94+semanticProtectionTarget*.06,.70,1);
    if(semanticBlend>0){for(let k=0;k<Math.min(16,semanticTrace.vector.length);k++)this.state.slowMemory[k]=clamp((this.state.slowMemory[k]??0)*(1-semanticBlend)+semanticTrace.vector[k]!*.14*semanticBlend,-1,1);}
    this.state.deepIntegration=this.deepIntegration.snapshot();
    this.state.adaptiveLifelong=this.adaptiveLifelong.snapshot();
    this.state.causalPredictiveIntervention=this.causalPredictiveIntervention.snapshot();
    const metaLearningScale=clamp(.76+.24*this.selfOptimizingContinual.metrics().fastLearning01);
    const unifiedWorldScale=this.unifiedCausalWorldLoop.learningScale01();
    const causalLearningScale=clamp((.90+.14*causalPredictive.modelCalibration01+.08*causalPredictive.interventionValue01-.08*causalPredictive.mobilePressure01)*(.88+.12*unifiedWorldScale),.82,1.12);
    const slowMemoryPhase=this.offlineConsolidation.metrics().phase as P2853SlowMemoryPhase;
    const slowContextId=this.deriveSlowContextId(token.neuralBefore.slice(0,16),unifiedWorld.activeContextId,token.novelty01);
    const slowMemoryWrite=this.slowMemoryConsolidation.observe(slowContextId,this.state.state.slice(0,16),reward,error,verified,token.novelty01,slowMemoryPhase,continuityDiag.computeBudget01);
    const hierarchicalSlowMemoryWrite=this.hierarchicalSlowMemory.observe(slowContextId,this.state.state.slice(0,16),reward,error,verified,token.novelty01,slowMemoryPhase as P2854SlowMemoryPhase,continuityDiag.computeBudget01,ACTIONS.indexOf(i.action));
    this.state.longMemoryStability01=clamp(this.state.longMemoryStability01*.94+slowMemoryWrite.agreement01*.035+hierarchicalSlowMemoryWrite.hierarchyAgreement01*.025);
    const developmentalEvidence=clamp((.55*verified+.25*(1-error)+.20*(1-token.novelty01))*(.55+continuityDiag.stabilityGate01*.45));
    this.state.developmentalPlasticityScale01=clamp(this.state.developmentalPlasticityScale01*.985+(0.72+0.56*developmentalEvidence)*.015,.70,1.30);
    const taskShift01=clamp(.55*token.novelty01+.35*token.uncertainty01+.20*error);
    const stability01=clamp(continuityDiag.stabilityGate01);
    const surprise01=clamp(error);
    this.state.fastPlasticity01=clamp(this.state.fastPlasticity01*.94+(.72+.38*surprise01+.10*taskShift01)*.06,.10,1.40);
    this.state.mediumPlasticity01=clamp(this.state.mediumPlasticity01*.985+(.58+.24*taskShift01+.14*(1-stability01))*.015,.10,1.40);
    this.state.slowPlasticity01=clamp(this.state.slowPlasticity01*.995+(.42+.18*(1-taskShift01)+.14*stability01)*.005,.10,1.40);
    this.state.multiscalePlasticityUpdates++;
    const multiScale=.46*this.state.fastPlasticity01+.34*this.state.mediumPlasticity01+.20*this.state.slowPlasticity01;
    const baseLr=(.009+verified*.018)*(.55+.45*continuityDiag.stabilityGate01)*integrationOutcome.learningScale01*metaLearningScale*causalLearningScale*this.state.developmentalPlasticityScale01*multiScale;
    this.state.eligibilityDecay01=clamp(.995*this.state.eligibilityDecay01+.005*(.82+.12*this.state.mediumPlasticity01+.06*this.state.slowPlasticity01),.70,.995);
    if(!this.stabilityPlasticity.metrics().learningEvents)this.stabilityPlasticity.bootstrapFromCurrent(this.state.actionReadout,this.state.edgeWeights);
    const stabilityPlasticityMetrics=this.stabilityPlasticity.metrics();
    const lifelongMetricsForLearning=this.adaptiveLifelong.metrics();
    const stabilityContextMatch=clamp(lifelongMetricsForLearning.contextMatch01??.7);
    const stabilityLearningScale=clamp(.84+.22*stabilityPlasticityMetrics.plasticity01+.08*stabilityPlasticityMetrics.stability01-.08*stabilityPlasticityMetrics.conflict01,.74,1.10);
    const infoMetrics=this.policyInformationGain.metrics();
    const experimentMetrics=this.autonomousExperimentScheduler.metrics();
    const epistemicSignal=clamp(Number(infoMetrics.policyInformationGain01??0)*.72+Number(experimentMetrics.value01??0)*.28);
    const onlineCredit=this.deepLearningCoupler.composeCredit({causal01:causalCredit,epistemic01:epistemicSignal,experiment01:Number(experimentMetrics.value01??0),uncertainty01:token.uncertainty01,verified01:verified,stability01:continuityDiag.stabilityGate01,budget01:continuityDiag.computeBudget01});
    // P2707 experimental meta-plasticity: move the credit mixture toward the
    // locally observed agreement when the model residual is reliable, while
    // preserving an exploration floor. This is not a learned policy; it is a
    // bounded controller so the experimental branch can be ablated cleanly.
    const agreement=clamp(1-Math.abs(baselineSignal-onlineCredit)/2);
    const residualReliability=clamp(Math.abs(modelSignal)*.7+verified*.3);
    const targetMix=clamp(.42+.40*agreement+.12*residualReliability,.35,.92);
    const adaptiveMix=clamp(this.state.adaptiveCreditMix01*.96+targetMix*.04,.35,.92);
    this.state.adaptiveCreditMix01=adaptiveMix;
    const creditMix=this.state.experimentalLayerEnabled?clamp(this.state.onlineCreditMix01*.35+adaptiveMix*.65,.20,.95):clamp(this.state.onlineCreditMix01);
    const mod=tanh((1-creditMix)*baselineSignal+creditMix*onlineCredit+.10*unifiedWorld.causalCredit01+.055*(unifiedWorld.plannerPolicyAgreement01-.5)+.045*(unifiedWorld.informationValue01-.5)+.010*(causalPredictive.informationGain01-.35)+.006*(causalPredictive.interventionValue01-.30)+.003*causalPredictive.counterfactualGap01);
    this.state.onlineCreditUpdates++;
    this.state.creditBaseline01=clamp(this.state.creditBaseline01*.94+baselineSignal*.06,-1,1);
    this.state.creditModelResidual01=clamp(this.state.creditModelResidual01*.94+Math.abs(modelSignal)*.06);
    this.state.creditAgreement01=clamp(this.state.creditAgreement01*.94+(1-Math.abs(baselineSignal-onlineCredit)/2)*.06);
    // Continual local learning: the delayed outcome updates every synapse that accumulated
    // eligibility across intervening ticks, not merely the final state.
    let traceNorm=0,cascadeTraceNorm=0,plasticUpdates=0;
    for(let iN=0;iN<this.state.neurons;iN++){
      const post=this.state.state[iN]??0;
      const rowE=this.state.edgeEligibility[iN]!,rowD=this.state.delayEligibility[iN]!,rowM=this.state.cascadeEligibilityMid[iN]!,rowS=this.state.cascadeEligibilitySlow[iN]!,rowU=this.state.edgeUncertainty[iN]!;
      const astroActivity=clamp(this.state.activityEma[iN]??.10);
      const astroTarget=clamp(.78-Math.abs(astroActivity-.10)*1.7+surprise*.22,.20,1);
      const astro=this.state.experimentalLayerEnabled?clamp((this.state.astroGate[iN]??.72)*.985+astroTarget*.015,.20,1):1;
      this.state.astroGate[iN]=astro;
      for(let q=0;q<12;q++){
        const fast=finite(rowE[q]),midTrace=finite(rowM[q]),slowTrace=finite(rowS[q]);
        const cascadeMixed=this.deepLearningCoupler.mixTrace(fast,midTrace,slowTrace);
        const cascadePart=this.state.experimentalLayerEnabled?clamp(cascadeMixed-fast,-2,2):0;
        const e=this.state.experimentalLayerEnabled?clamp(cascadeMixed,-2,2):fast;
        cascadeTraceNorm+=Math.abs(cascadePart);
        if(Math.abs(cascadePart)>.0001) this.state.cascadeCreditUpdates++;
        const dE=finite(rowD[q]),u=clamp(rowU[q]??.65);
        traceNorm+=Math.abs(e);
        const spGate=this.stabilityPlasticity.gateNeuron(iN,surprise,stabilityContextMatch,stabilityPlasticityMetrics.neuronImportance01[iN]);
        const transferGate=this.transferSafetySynergy.gateUpdate(clamp(Math.abs(cascadeMixed)),this.stabilityPlasticity.importanceAt(iN),this.transferSafetySynergy.metrics().contextCompatibility01,token.uncertainty01);
        const localProtection=this.deepIntegration.synapsePlasticityGate(iN,token.uncertainty01,surprise)*this.adaptiveLifelong.synapseGate(iN,token.uncertainty01,surprise)*lifelong.plasticityMultiplier01*spGate*transferGate.scale01;
        const localEta=baseLr*stabilityLearningScale*(.20+.80*u)*clamp(this.state.plasticity[iN]??.35,.05,1.2)*astro*localProtection*this.state.semanticRecurrentProtection01;
        const sign=this.state.populationKinds[iN]==='I'?-1:1;
        const updateScore=clamp(Math.abs(e)*(.55+.45*Math.abs(mod)));
        if(Math.abs(e)>.0005 && this.adaptiveLifelong.shouldUpdate(iN,updateScore,continuityDiag.computeBudget01)){
          const currentW=this.state.edgeWeights[iN]![q]??0;
          const softBound=1-Math.min(.75,(Math.abs(currentW)/.35)**2*.75);
          const w=clamp(currentW+e*mod*localEta*sign*softBound,-.35,.35);
          this.state.edgeWeights[iN]![q]=w;
          // Only synapses that were actually active receive a metaplastic confidence update.
          {const targetU=clamp(.25+surprise*.75);rowU[q]=clamp(u+(targetU-u)*.025);}
          plasticUpdates++;
          this.adaptiveLifelong.observeSynapse(iN,updateScore,true);
          this.stabilityPlasticity.observeNeuron(iN,Math.abs(e*mod*localEta),astroActivity,updateScore,stabilityContextMatch);
          if(q%3===0)this.state.edgeWeights[iN]![q]=this.stabilityPlasticity.consolidateEdgeWeight(iN,q,w,clamp(.025+stabilityPlasticityMetrics.stability01*.055,.02,.09),stabilityPlasticityMetrics.neuronImportance01[iN]);
        }
        // Delay update uses the same temporally accumulated eligibility signal. It is a
        // bounded experimental rule rather than a claim of biological exactness.
        if(Math.abs(dE)>.0005 && (Math.abs(mod)>.06 || verified>.5)){
          const dir=Math.sign(dE*mod);const old=this.state.edgeDelays[iN]![q]??1;
          this.state.edgeDelays[iN]![q]=Math.max(1,Math.min(3,old+(dir>0?1:dir<0?-1:0)));this.state.delayLearningUpdates++;
        }
        // Synaptic uncertainty controls plasticity: surprising outcomes reopen uncertain
        // connections; repeated verified outcomes consolidate them.
        this.state.plasticity[iN]=clamp((this.state.plasticity[iN]??.35)*.998+Math.abs(e*mod)*.008,.05,1.2);
      }
      // Sensory encoder plasticity is driven by the same long-lived trace. This makes the
      // input mapping learned rather than permanently frozen random projection.
      const it=this.state.inputEligibility[iN]!;
      let sensoryTrace=0;
      for(let k=0;k<NEURAL_INPUT_DIM;k++){
        const e=finite(it[k]);
        sensoryTrace += Math.abs(e);
        if(Math.abs(e)>.0002){const eta=baseLr*(.15+.85*clamp(this.state.metaplasticity01));{const cw=this.state.inputProjection[iN]?.[k]??0;const sb=1-Math.min(.70,(Math.abs(cw)/.20)**2*.70);this.state.inputProjection[iN]![k]=clamp(cw+e*mod*eta*sb*.90,-.20,.20); }this.state.sensoryLearningUpdates++;}
      }
      // Action-specific credit is also carried by the same sensory eligibility trace.
      // This is the key delayed-credit bridge: a reward arriving after several blank ticks
      // can still strengthen the action associated with the original cue.
      const traceAction=clamp(sensoryTrace/NEURAL_INPUT_DIM,0,1);
      for(let ai=0;ai<ACTIONS.length;ai++){
        const selected=ai===ACTIONS.indexOf(i.action)?1:-.22;
        if(traceAction>.001){
          const actionDelta=(reward-.5)*traceAction*baseLr*selected*.55;
          {const cw=this.state.actionReadout[ai]?.[iN]??0;const sb=1-Math.min(.70,(Math.abs(cw)/.25)**2*.70);const ag=this.stabilityPlasticity.actionGate(i.action,Math.abs(mod));const raw=clamp(cw+actionDelta*sb*ag,-.25,.25);this.state.actionReadout[ai]![iN]=this.stabilityPlasticity.consolidateActionWeight(ai,iN,raw,clamp(.018+stabilityPlasticityMetrics.stability01*.05,.015,.08),stabilityPlasticityMetrics.neuronImportance01[iN]);}
        }
      }
      for(let k=0;k<NEURAL_INPUT_DIM;k++)it[k]=finite(it[k])*.68;
      rowE.fill(0);rowD.fill(0);
    }
    // P2724 selective replay + sparse structural plasticity.
    // Replay is compact and budget-aware: it revisits only a small coreset of high-value
    // contexts instead of growing the full token history. Structural edits are similarly
    // sparse so the mobile runtime gets additional plastic capacity without dense churn.
    const replayBudget=this.autonomousContinual.mobileBudget();
    const unifiedWorldForReplay=this.unifiedCausalWorldLoop.metrics();
    const activeReplayContext=unifiedWorldForReplay.activeContextId;
    const modelTimePlan=this.modelTimeReplay.replayPlan(continuityDiag.computeBudget01);
    const replayAllocation=this.selfKnowledgeCoreset.replayAllocation({resource01:continuityDiag.computeBudget01,predictionError01:this.state.predictionError01,novelty01:continuityDiag.disagreement01,grounding01:unifiedWorldForReplay.worldConfidence01,transferRisk01:this.transferSafetySynergy.metrics().negativeTransfer01,contextMatch01:1});
    const replayLimit=Math.max(0,Math.min(8,Math.floor(2+replayBudget.replayBudget01*10),modelTimePlan.due?Math.max(1,Math.min(modelTimePlan.maxSamples,replayAllocation.fastBudget)):1));
    const metaSelectedArm=this.selfOptimizingContinual.metrics().selectedReplayArm;
    const replaySamples=this.autonomousContinual.replaySamples(replayLimit,this.autonomousContinual.metrics().activeContextId,metaSelectedArm)
      .sort((a,b)=>this.modelTimeReplay.scoreSample({tick:b.tick,contextId:b.contextId,action:b.action,priority01:b.priority01,predictionError01:b.predictionError01,verified01:b.verified01})-this.modelTimeReplay.scoreSample({tick:a.tick,contextId:a.contextId,action:a.action,priority01:a.priority01,predictionError01:a.predictionError01,verified01:a.verified01}));
    for(const sample of replaySamples){
      const ai=ACTIONS.indexOf(sample.action);
      if(ai<0) continue;
      const causalReplayPriority=this.causalPredictiveIntervention.replayScore({latent:sample.latent,priority01:sample.priority01,predictionError01:sample.predictionError01,reward01:sample.reward01,verified01:sample.verified01,contextId:sample.contextId});
      const unifiedReplayPriority=this.unifiedCausalWorldLoop.replayScore({latent:sample.latent,priority01:sample.priority01,predictionError01:sample.predictionError01,reward01:sample.reward01,verified01:sample.verified01,contextId:sample.contextId});
      const replayMatch=sample.contextId===activeReplayContext?1:.35;
      const replayGuard=this.stabilityPlasticity.replayCompatibility(replayMatch,unifiedWorldForReplay.worldConfidence01,sample.predictionError01,continuityDiag.computeBudget01);
      if(replayGuard<.30)continue;
      const replayGain=(sample.reward01-.5)*(.008+.012*sample.verified01)*(.40+.22*sample.priority01+.19*causalReplayPriority+.19*unifiedReplayPriority)*replayGuard;
      const replayConfidence=.35+.65*(1-sample.predictionError01);
      const cap=Math.min(.18,replayGain*replayConfidence);
      for(let j=0;j<this.state.neurons;j+=4){
        const latent=(sample.latent[j%Math.max(1,sample.latent.length)]??0);
        const cw=this.state.actionReadout[ai]?.[j]??0;
        this.state.actionReadout[ai]![j]=clamp(cw+cap*latent,-.25,.25);
      }
      const pe=(.5-sample.reward01)*.5;
      for(let j=0;j<this.state.neurons;j+=6){
        const latent=(sample.latent[j%Math.max(1,sample.latent.length)]??0);
        this.state.predictionReadout[j]=clamp((this.state.predictionReadout[j]??0)+pe*latent*.006,-.5,.5);
      }
      this.state.replayDiversity01=clamp(this.state.replayDiversity01*.98+.02*(sample.contextId===this.autonomousContinual.metrics().activeContextId?1:.25));
    }
    if(replaySamples.length>0)this.modelTimeReplay.noteReplay(replaySamples.length);
    const syntheticTrajectories=this.unifiedCausalWorldLoop.syntheticTrajectories(Math.min(2,replayLimit>4?2:1),continuityDiag.computeBudget01>.58?3:2);
    if(syntheticTrajectories.length){
      for(const trajectory of syntheticTrajectories){
        const staged=this.verifiedSyntheticTrajectoryGate.stage({tick:i.tick,contextId:trajectory.contextId,steps:trajectory.steps,priority01:trajectory.priority01,confidence01:trajectory.confidence01});
        if(staged)this.unifiedCausalWorldLoop.noteSyntheticTrajectoryCredit(clamp(trajectory.priority01*.08));
      }
    } else {
      // Synthetic rollouts are planning hypotheses only. They may be staged for
      // later real-outcome confirmation, but they must never mutate canonical
      // action weights or earn learning credit before an observed consequence.
      const syntheticSamples=this.unifiedCausalWorldLoop.syntheticReplay(Math.min(2,replayLimit>4?2:1));
      for(const sample of syntheticSamples){
        if(sample.actionIndex<0||sample.actionIndex>=ACTIONS.length)continue;
        const staged=this.verifiedSyntheticTrajectoryGate.stage({
          tick:i.tick,
          contextId:sample.contextId,
          priority01:sample.priority01,
          confidence01:sample.confidence01,
          steps:[{
            actionIndex:sample.actionIndex,
            latent:sample.latent.slice(0,8),
            predictedNext:sample.predictedNext.slice(0,8),
            reward01:sample.reward01,
            confidence01:sample.confidence01,
            priority01:sample.priority01,
          }]
        });
        if(staged)this.unifiedCausalWorldLoop.noteSyntheticTrajectoryCredit(clamp(sample.priority01*.02));
      }
    }
    const metaBudget=this.selfOptimizingContinual.mobilePlan(continuityDiag.computeBudget01,0,0).replayLimit;
    const metaReplayBudget=Math.min(metaBudget,replaySamples.length);
    if(metaReplayBudget>0){
      const metaSamples=replaySamples.slice(0,metaReplayBudget).map(s=>({contextId:s.contextId,reward01:s.reward01,priority01:s.priority01,latent:s.latent,actionIndex:ACTIONS.indexOf(s.action)}));
      this.selfOptimizingContinual.consolidate(metaSamples,Math.min(Math.min(4,metaBudget),metaReplayBudget));
    }
    let structuralEvents=0;
    const stabilityNow=this.stabilityPlasticity.beforeDecision({tick:i.tick,contextId:this.unifiedCausalWorldLoop.metrics().activeContextId,novelty01:token.novelty01,uncertainty01:token.uncertainty01,predictionError01:error,forgetting01:clamp(this.state.deepIntegration.forgetting01),replayPressure01:clamp(this.state.replayDiversity01),resource01:continuityDiag.computeBudget01,contextMatch01:this.unifiedCausalWorldLoop.metrics().worldConfidence01});
    const acm=this.autonomousContinual.metrics();
    const structuralBudget=Math.max(1,Math.floor(this.state.neurons*acm.structuralPlasticity01*.10));
    const stabilityNowMetrics=this.stabilityPlasticity.metrics();
    let stabilityResetBudget=stabilityNowMetrics.dormant01>0.05?Math.max(0,Math.min(stabilityNow.dormantBudget,Math.ceil(this.state.neurons*.06))):0;
    for(let k=0;k<structuralBudget;k++){
      const n=(k*17+this.state.tick*7)%this.state.neurons;
      if(stabilityResetBudget>0 && this.stabilityPlasticity.shouldResetNeuron(n,stabilityNow.resetThreshold01)){
        const row=this.state.edgeWeights[n]!;
        for(let q=0;q<row.length;q+=2){const current=row[q]??0;row[q]=this.stabilityPlasticity.resetEdgeWeight(n,q,current);}
        for(let q=0;q<this.state.actionReadout.length;q+=1){const current=this.state.actionReadout[q]?.[n]??0;this.state.actionReadout[q]![n]=this.stabilityPlasticity.resetActionWeight(q,n,current);}
        stabilityResetBudget--;structuralEvents++;
      }
      const kind=this.autonomousContinual.structuralDecision(n,lifelongMetricsForLearning.importance[n]??.05,this.state.activityEma[n]??.10,stabilityContextMatch,continuityDiag.computeBudget01);
      if(kind==='wake'){
        const row=this.state.edgeWeights[n]!;
        for(let q=0;q<row.length;q+=3) row[q]=clamp(row[q]+(acm.boundary01-.35)*.006,-.35,.35);
        this.state.plasticity[n]=clamp((this.state.plasticity[n]??.35)+.03,.05,1.2);
        for(let x=0;x<NEURAL_INPUT_DIM;x+=8) this.state.inputProjection[n]![x]=clamp((this.state.inputProjection[n]![x]??0)+(this.state.state[n]??0)*.002,-.20,.20);
        structuralEvents++;
      } else if(kind==='prune'){
        const row=this.state.edgeWeights[n]!;
        for(let q=0;q<row.length;q++) if(Math.abs(row[q]??0)<.015) row[q]=0;
        structuralEvents++;
      }
    }
    if(structuralEvents){this.autonomousContinual.observeStructural(clamp(structuralEvents/Math.max(1,structuralBudget)),true);this.syncDenseReference();}
    if(this.state.experimentalLayerEnabled && this.deepIntegration.maintenanceDue('normalize')){
      for(let iN=0;iN<this.state.neurons;iN++) this.deepLearningCoupler.normalizeRow(this.state.edgeWeights[iN]!);
      this.syncDenseReference();
    }
    this.state.eligibilityUpdates+=plasticUpdates;
    this.state.cascadeCreditUpdates+=this.state.experimentalLayerEnabled?plasticUpdates:0;
    this.state.creditTraceNorm01=clamp(this.state.creditTraceNorm01*.90+clamp(traceNorm/(this.state.neurons*12),0,1)*.10);
    this.state.cascadeCreditNorm01=clamp(this.state.cascadeCreditNorm01*.90+clamp(cascadeTraceNorm/(this.state.neurons*12),0,1)*.10);
    this.state.astroGateMean01=clamp(this.state.astroGateMean01*.96+(this.state.astroGate.reduce((a,b)=>a+b,0)/Math.max(1,this.state.neurons))*.04);
    this.state.longDelayCredit01=clamp(this.state.longDelayCredit01*.96+clamp(cascadeTraceNorm/(this.state.neurons*12),0,1)*.04);
    this.state.learningUpdates+=1+Math.min(1,temporalLearn.updates>0?1:0);this.state.metaplasticityUpdates++;
    const targetUncertainty=clamp(.25+surprise*.75);this.state.metaplasticity01=clamp(this.state.metaplasticity01*.94+targetUncertainty*.06);
    // Slow memory update: stable verified outcomes can make useful traces more persistent;
    // noisy outcomes shorten them. This is the selective-memory analogue of consolidation.
    for(let k=0;k<16;k++){const old=this.state.slowMemoryDecay[k]??.95;this.state.slowMemoryDecay[k]=clamp(old+(verified*.004-surprise*.003),.90,.995);}
    const predErr=reward-token.prediction01;
    for(let k=0;k<this.state.neurons;k+=2){const pre=this.state.state[k]??0;this.state.predictionReadout[k]=clamp((this.state.predictionReadout[k]??0)+predErr*pre*(.005+verified*.006),-.5,.5);}
    for(let ai=0;ai<ACTIONS.length;ai++){const selected=ai===ACTIONS.indexOf(i.action)?1:0;for(let k=0;k<this.state.neurons;k+=3){const pre=this.state.state[k]??0;const delta=(reward-.5)*pre*baseLr*(selected?.35:-.06)*.35;this.state.actionReadout[ai]![k]=clamp((this.state.actionReadout[ai]?.[k]??0)+delta,-.25,.25);}}
    // Center action readout per neuron so the neural branch expresses relative action
    // preference rather than accumulating a global positive/negative bias.
    for(let k=0;k<this.state.neurons;k++){
      let meanAction=0;for(let ai=0;ai<ACTIONS.length;ai++)meanAction+=this.state.actionReadout[ai]?.[k]??0;
      meanAction/=ACTIONS.length;
      for(let ai=0;ai<ACTIONS.length;ai++)this.state.actionReadout[ai]![k]=clamp((this.state.actionReadout[ai]?.[k]??0)-meanAction,-.25,.25);
    }
    // Memory readout learns slowly to avoid allowing the slow state to dominate policy.
    for(let k=0;k<16;k++){const mem=this.state.slowMemory[k]??0;this.state.slowMemoryReadout[k]=clamp((this.state.slowMemoryReadout[k]??0)+predErr*mem*.004,-.35,.35);this.state.memoryLearningUpdates++;}
    const holdout=clamp(i.holdout01??0);if(holdout>.5){this.state.holdoutSeen++;const pred=token.prediction01>.5?1:0,actual=reward>.5?1:0;if(pred===actual)this.state.holdoutCorrect++;this.state.generalization01=clamp(this.state.holdoutCorrect/Math.max(1,this.state.holdoutSeen));}
    token.actual01=reward;token.predictionError01=error;token.verified=verified>.5;token.replayEligible=true;token.replayPriority01=clamp(surprise*.50+i.predictionError01*.20+i.goalPressure01!*.10+this.state.cueTraceStrength01*.20+continuityDiag.disagreement01*.08+continuityDiag.antiForgetting01<.55?.08:0);
    this.state.replayBuffer.push(deep(token));if(this.state.replayBuffer.length>192)this.state.replayBuffer.sort((a,b)=>(b.replayPriority01??0)-(a.replayPriority01??0)).splice(192);
    if(i.tick%16===0) this.compactReplayBuffer(clamp(continuityDiag.computeBudget01));
    this.state.tick=i.tick;this.state.predictionError01=clamp(this.state.predictionError01*.82+error*.18);
    if(this.state.cycles%24===0)this.structuralPlasticity(mod);
    if(this.state.cycles%16===0)this.applyHomeostaticScaling();
    // Persist the newest self-teacher/transfer-safety state after outcome learning, not the stale pre-outcome snapshot.
    this.state.selfKnowledgeCoreset=this.selfKnowledgeCoreset.snapshot();
    this.state.transferSafetySynergy=this.transferSafetySynergy.snapshot();
    this.state.modelTimeReplay=this.modelTimeReplay.snapshot();
    this.state.stabilityPlasticity=this.stabilityPlasticity.snapshot();
  }

  private compactReplayBuffer(resource01:number){
    const len=this.state.replayBuffer.length;
    const target=resource01<.28?192:resource01<.45?256:resource01<.58?320:384;
    if(len<=target) return;
    const recent=this.state.replayBuffer.slice(-96);
    const recentTicks=new Set(recent.map(e=>e.tick));
    const ranked=this.state.replayBuffer.slice().sort((a,b)=>(b.replayPriority01??0)-(a.replayPriority01??0));
    const selected=ranked.filter(e=>!recentTicks.has(e.tick)).slice(0,Math.max(0,target-96));
    const keepTicks=new Set([...recentTicks,...selected.map(e=>e.tick)]);
    let compacted=0;
    for(const e of this.state.replayBuffer){
      if(!keepTicks.has(e.tick)||recentTicks.has(e.tick)) continue;
      if(e.input.length||e.selectedAssembly.length||e.retrievedMemoryIds?.length){
        e.input=[];e.selectedAssembly=[];e.retrievedMemoryIds=e.retrievedMemoryIds?.slice(-4);compacted++;
      }
      if(e.actionUtilities && Object.keys(e.actionUtilities).length>3){
        e.actionUtilities={respond:e.actionUtilities.respond??.5,explore:e.actionUtilities.explore??.5,verify:e.actionUtilities.verify??.5,rest:e.actionUtilities.rest??.5,reflect:e.actionUtilities.reflect??.5,wait:e.actionUtilities.wait??.5,defer:e.actionUtilities.defer??.5};
      }
    }
    const retained=this.state.replayBuffer.filter(e=>keepTicks.has(e.tick));
    this.state.replayBuffer=retained.sort((a,b)=>a.tick-b.tick);
    if(compacted||retained.length<len){this.state.replayCompactions++;this.state.replayCompactedTokens+=compacted;}
  }

  replay(budget=8){
    const continuityMetrics=this.continuity.metrics();
    const recommended=continuityMetrics.replayBudget;
    const forgetting01=clamp(this.state.deepIntegration.forgetting01);
    const taskShift01=clamp(.55*this.state.novelty01+.35*this.state.uncertainty01+.20*this.state.predictionError01);
    const plan=this.offlineConsolidation.plan(this.state.tick,clamp(continuityMetrics.computeBudget01),this.state.novelty01,forgetting01,taskShift01);
    budget=Math.max(1,Math.min(budget,recommended,plan.budget));
    const activeContext=this.unifiedCausalWorldLoop.metrics().activeContextId;
    const maxTick=Math.max(1,this.state.tick);
    const raw=this.state.replayBuffer.slice().sort((a,b)=>{
      const ageA=clamp((maxTick-(a.tick??maxTick))/96),ageB=clamp((maxTick-(b.tick??maxTick))/96);
      const contextA=Math.abs(Number(a.contextId??activeContext)-Number(activeContext??0))>0?1:0;
      const contextB=Math.abs(Number(b.contextId??activeContext)-Number(activeContext??0))>0?1:0;
      const scoreA=(a.replayPriority01??0)+plan.recentMix01*(1-ageA)+plan.priorMix01*ageA+plan.transferMix01*contextA;
      const scoreB=(b.replayPriority01??0)+plan.recentMix01*(1-ageB)+plan.priorMix01*ageB+plan.transferMix01*contextB;
      return scoreB-scoreA;
    });
    const candidates=raw.map((e)=>({token:e,tick:e.tick,contextId:Number(e.contextId??activeContext),action:(e.action??'wait'),priority01:e.replayPriority01??0,predictionError01:e.predictionError01,verified01:e.verified?1:0,novelty01:e.novelty01,latent:e.neuralBefore.slice(0,8)}));
    const rankedCandidates=this.selfKnowledgeCoreset.rankReplaySamples(candidates,activeContext,this.continuity.metrics().computeBudget01,Math.max(1,budget*2));
    const gateMetrics=this.transferSafetySynergy.metrics();
    const worldConfidence=this.unifiedCausalWorldLoop.metrics().worldConfidence01;
    const resource=this.continuity.metrics().computeBudget01;
    const ranked=rankedCandidates.filter(c=>{
      const gate=this.transferSafetySynergy.replayGate(c.contextId,activeContext,c.latent,this.state.state.slice(0,8),Number(selfKnowledgeMetricsSafe(this.selfKnowledgeCoreset.metrics(),activeContext)),worldConfidence,resource);
      const mismatched=Number(c.contextId)!==Number(activeContext??0);
      const compatibility=this.slowMemoryConsolidation.compatibility(c.contextId,c.latent);
      const hierarchicalCompatibility=this.hierarchicalSlowMemory.compatibility(c.contextId,c.latent);
      const combinedCompatibility=.56*compatibility+.44*clamp(.62*hierarchicalCompatibility.context01+.38*hierarchicalCompatibility.schema01);
      const compatibleTransfer=!mismatched || (combinedCompatibility>=.54 && hierarchicalCompatibility.accepted);
      if(mismatched&&!compatibleTransfer)this.state.replayTransferRejected++;
      return compatibleTransfer && (gate>=.42 || (gateMetrics.negativeTransfer01<.35 && c.priority01>.78));
    }).map(c=>c.token);
    const fallback=ranked.length?ranked:raw.slice(0,Math.max(1,budget));
    const items:NeuralExperienceToken[]=[];
    const minGap=budget>=6?3:2;
    for(const candidate of fallback){
      if(items.length>=Math.max(1,budget)) break;
      if(items.every(x=>Math.abs(x.tick-candidate.tick)>=minGap || (candidate.replayPriority01??0)>.90)) items.push(candidate);
    }
    if(items.length<Math.max(1,budget)) for(const candidate of fallback){ if(items.length>=Math.max(1,budget)) break; if(!items.includes(candidate)) items.push(candidate); }
    this.state.replayDiversity01=clamp(items.length<=1?0:items.reduce((sum,e,idx)=>sum+(idx===0?1:Math.min(1,Math.abs(e.tick-items[idx-1]!.tick)/16)),0)/items.length);
    let recentCount=0,priorCount=0,transferCount=0;
    let utilityAccum=0,interferenceAccum=0,retentionAccum=0;
    const activeContextNow=Number(activeContext??0);
    for(const e of items){
      const age=clamp((maxTick-(e.tick??maxTick))/96);
      if(age<.25)recentCount++; else if(age>.60)priorCount++;
      if(Number(e.contextId??activeContextNow)!==activeContextNow)transferCount++;
      const gain=.0015*(e.verified?1.6:1)*(0.6+(e.replayPriority01??0));const temporalErr=e.actual01-e.prediction01;
      const anchorPool=this.state.replayBuffer.filter(a=>a!==e&&Number(a.contextId??activeContextNow)===Number(e.contextId??activeContextNow)).slice(-4);
      const replayProbeError=(rows:NeuralExperienceToken[])=>{
        let total=0;
        for(const row of rows){
          const latent=row.neuralBefore.slice(0,Math.min(8,this.state.neurons));
          let signal=0;for(let q=0;q<latent.length;q++)signal+=(this.state.predictionReadout[q*2]??0)*(latent[q]??0);
          total+=Math.abs(row.actual01-sigmoid(signal*2.2));
        }
        return total/Math.max(1,rows.length);
      };
      const replayAnchors=[e,...anchorPool];
      const replayAnchorBefore=replayProbeError(replayAnchors);
      const taskLatent=e.neuralBefore.slice(0,Math.min(8,this.state.neurons));
      let taskSignalBefore=0;
      for(let q=0;q<taskLatent.length;q++)taskSignalBefore+=(this.state.predictionReadout[q*2]??0)*(taskLatent[q]??0);
      const taskPredBefore=sigmoid(taskSignalBefore*2.2);
      const taskErrorBefore=Math.abs(e.actual01-taskPredBefore);
      for(let i=0;i<this.state.neurons;i++){
        const elig=(e.neuralBefore[i]??0)*(e.neuralAfter[i]??0);
        this.state.plasticity[i]=clamp(this.state.plasticity[i]+Math.abs(elig)*gain,.05,1.2);
        const slot=i%12;
        const u=this.state.edgeUncertainty[i]![slot]??.65;
        const targetU=clamp(.25+Math.abs(temporalErr)*.75);
        this.state.edgeUncertainty[i]![slot]=clamp(u+(targetU-u)*.02);
        const oldDelay=this.state.edgeDelays[i]![slot]??1;
        if(Math.abs(temporalErr)>.08)this.state.edgeDelays[i]![slot]=Math.max(1,Math.min(3,oldDelay+(temporalErr>0?1:-1)));
        const signed=temporalErr*(e.verified?1:.35)*gain;
        const delta=clamp(signed*(e.neuralBefore[i]??0)*(0.35+Math.abs(e.neuralAfter[i]??0)),-.006,.006);
        this.state.edgeWeights[i]![slot]=clamp(this.state.edgeWeights[i]![slot]!+delta,-.22,.22);
        this.state.replayWeightUpdates++;
        this.state.replaySignedCredit01=clamp(this.state.replaySignedCredit01*.995+signed*.005,-1,1);
        this.state.delayLearningUpdates++;
      }
      const oldReplayEdges=Array.from({length:this.state.neurons},(_,n)=>({w:this.state.edgeWeights[n]?.[n%12]??0,u:this.state.edgeUncertainty[n]?.[n%12]??.65,d:this.state.edgeDelays[n]?.[n%12]??1,p:this.state.plasticity[n]??.35}));
      const oldAction=this.state.actionReadout.map(row=>row.slice());
      const oldPrediction=this.state.predictionReadout.slice();
      const oldSlowReadout=this.state.slowMemoryReadout.slice();
      const ai=e.action==null?-1:ACTIONS.indexOf(e.action);if(ai>=0){for(let n=0;n<this.state.neurons;n+=2){const delta=clamp(temporalErr*(e.neuralBefore[n]??0)*gain,-.004,.004);this.state.actionReadout[ai]![n]=clamp(this.state.actionReadout[ai]![n]!+delta,-.25,.25);}}
      for(let n=0;n<taskLatent.length;n++){const idx=n*2;const delta=clamp(temporalErr*(taskLatent[n]??0)*(.004+.004*(e.verified?1:.35)),-.006,.006);this.state.predictionReadout[idx]=clamp((this.state.predictionReadout[idx]??0)+delta,-.5,.5);}
      const phaseConsolidationGain=plan.phase==='sleepPrior'?1:plan.phase==='sleepRecent'?.78:plan.phase==='transfer'?.58:plan.phase==='quiet'?.42:.24;
      const replaySlow= this.hierarchicalSlowMemory.observe(Number(e.contextId??activeContextNow),e.neuralBefore.slice(0,16),clamp(e.reward01),Math.abs(temporalErr),e.verified?1:.35,e.novelty01,plan.phase as P2854SlowMemoryPhase,resource,ACTIONS.indexOf(e.action??'wait'));
      for(let k=0;k<16;k++){
        const mem=this.state.slowMemory[k]??0;
        const delta=clamp(temporalErr*mem*.006*phaseConsolidationGain*(e.verified?1:.35),-.004,.004);
        const hierarchicalRead=clamp((replaySlow.agreement01-.5)*.004+(replaySlow.hierarchyAgreement01-.5)*.004,-.0025,.0025);
        this.state.slowMemoryReadout[k]=clamp((this.state.slowMemoryReadout[k]??0)+delta+hierarchicalRead,-.35,.35);
        this.state.memoryLearningUpdates++;
      }
      const replayAnchorAfter=replayProbeError(replayAnchors);
      const replayRollback=replayAnchorAfter>replayAnchorBefore+.0015;
      if(replayRollback)this.state.replayRollbacks++;
      if(replayRollback){
        for(let n=0;n<this.state.neurons;n++){const slot=n%12;const old=oldReplayEdges[n]!;this.state.edgeWeights[n]![slot]=old.w;this.state.edgeUncertainty[n]![slot]=old.u;this.state.edgeDelays[n]![slot]=old.d;this.state.plasticity[n]=old.p;}
        this.state.actionReadout=oldAction;this.state.predictionReadout=oldPrediction;this.state.slowMemoryReadout=oldSlowReadout;
      }
      let taskSignalAfter=0;
      for(let q=0;q<taskLatent.length;q++)taskSignalAfter+=(this.state.predictionReadout[q*2]??0)*(taskLatent[q]??0);
      const taskPredAfter=sigmoid(taskSignalAfter*2.2);
      const taskErrorAfter=Math.abs(e.actual01-taskPredAfter);
      utilityAccum+=clamp(taskErrorBefore-taskErrorAfter,-1,1);
      interferenceAccum+=clamp(Math.abs(temporalErr)*(.35+.65*age));
      retentionAccum+=clamp(1-taskErrorAfter);
      this.state.replayEvaluated++;
      this.state.replayTaskErrorBefore01=clamp(this.state.replayTaskErrorBefore01*.96+taskErrorBefore*.04);
      this.state.replayTaskErrorAfter01=clamp(this.state.replayTaskErrorAfter01*.96+taskErrorAfter*.04);
      this.state.replayUtilityGain01=clamp(this.state.replayUtilityGain01*.96+clamp(.5+(taskErrorBefore-taskErrorAfter)*2,-.5,.5)*.04);
      this.state.cueTraceStrength01=clamp(this.state.cueTraceStrength01*.99+(e.replayPriority01??0)*.01);
    }
    if(items.length){
      const utility=clamp(.5+(utilityAccum/items.length)*2);
      const interference=clamp(interferenceAccum/items.length);
      const retention=clamp(retentionAccum/items.length);
      this.offlineConsolidation.observe(items.length,recentCount,priorCount,transferCount,utility,interference,retention);
    }
    return items.length;
  }

  private structuralPlasticity(mod:number){let updates=0;for(let i=0;i<this.state.neurons;i+=5){const slot=(i/5|0)%12,j=this.state.edgeTargets[i]?.[slot]??((i*31+7)%this.state.neurons),w=this.state.edgeWeights[i]?.[slot]??0;if(Math.abs(w)<.006&&mod>.15){const nw=((prand(this.state.tick+i*13)*2)-1)*.025;this.state.edgeWeights[i]![slot]=nw;this.state.structuralGrew++;updates++;}else if(Math.abs(w)<.0015&&mod<.08){this.state.edgeWeights[i]![slot]=0;this.state.structuralPruned++;updates++;}}this.state.structuralUpdates+=updates;this.syncDenseReference();}

  setSlowMemoryConsolidationEnabled(enabled:boolean){this.slowMemoryConsolidation.setEnabled(enabled);}
  setHierarchicalSlowMemoryEnabled(enabled:boolean){this.hierarchicalSlowMemory.setEnabled(enabled);}
  setContextualActionPolicyEnabled(enabled:boolean){this.contextualActionPolicy.restore({...this.contextualActionPolicy.snapshot(),enabled:!!enabled});}
  applyDreamRehearsalSignal(input:{robustness01:number;promoted:boolean;uncertainty01:number;resource01:number}){ this.autonomousContinual.applyDreamRehearsalSignal(input); this.state.autonomousContinual=this.autonomousContinual.snapshot(); }

  evaluateHoldout(samples:Array<{tick:number;input:number[];actual01:number;baseUtilities?:Record<ActionKind,number>;contextId?:number;expectedAction?:ActionKind}>) {
    const probe=new NeuralExperienceBranch();
    probe.restore(this.snapshot());
    let predictionError=0,actionSuccess=0,taskSuccess=0,marginTotal=0;
    const predictions:number[]=[];
    for(const s of samples){
      const base=s.baseUtilities??Object.fromEntries(ACTIONS.map(a=>[a,.5])) as Record<ActionKind,number>;
      const r=probe.beforeDecision({tick:s.tick,input:s.input,baseUtilities:base,predictionError01:.30,novelty01:.20,uncertainty01:.20,homeostasis01:.20,identityGap01:.12,goalPressure01:.40,embodied:{sensorFeatures:s.input}});
      const error=Math.abs(s.actual01-r.prediction01);
      predictionError+=error;
      if(error<.15)taskSuccess++;
      predictions.push(r.prediction01);
      let ordered=ACTIONS.map(a=>({a,score:(base[a]??.5)+(r.actionBias[a]??0)})).sort((a,b)=>b.score-a.score);
      const top=ordered[0]?.a??'wait';
      const second=ordered[1]?.score??ordered[0]?.score??0;
      marginTotal+=clamp((ordered[0]?.score??0)-second,-1,1);
      if(s.expectedAction)actionSuccess+=top===s.expectedAction?1:0;
    }
    const n=Math.max(1,samples.length),actionSamples=samples.filter(s=>!!s.expectedAction).length;
    return {samples:samples.length,error01:predictionError/n,taskSuccess01:taskSuccess/n,predictions,actionSuccess01:actionSamples?actionSuccess/actionSamples:.5,meanActionMargin01:marginTotal/n,estimatedNeuralMemoryBytes:probe.estimateNeuralMemoryBytes()};
  }

  estimateNeuralMemoryBytes(){
    const n=this.state.neurons,input=NEURAL_INPUT_DIM,e=this.state.edgeTargets[0]?.length??12;
    const denseArrays=n*n + n*input + n*e*7 + n*16 + n*24 + 16*16 + 8*16 + 4*16 + 8*4 + 64*2;
    return denseArrays*8;
  }

  lesion(fraction01=.5){
    const before=this.state.prediction01,n=Math.floor(this.state.neurons*clamp(fraction01)),backup=this.state.edgeWeights.map(r=>r.slice());
    for(let i=0;i<n;i++)this.state.edgeWeights[i]=this.state.edgeWeights[i]!.map(()=>0);
    this.syncDenseReference();
    const probeInput=this.state.lastExperience?.input??new Array(64).fill(0);
    const probe={tick:this.state.tick+1,input:probeInput,baseUtilities:Object.fromEntries(ACTIONS.map(a=>[a,.5])) as Record<ActionKind,number>,predictionError01:this.state.predictionError01,novelty01:this.state.novelty01,uncertainty01:this.state.uncertainty01,homeostasis01:.2,identityGap01:.2,goalPressure01:.4};
    const healthy=this.beforeDecision(probe);
    const healthyBias=ACTIONS.map(a=>healthy.actionBias[a]??0),healthyLatent=healthy.experience.neuralAfter.slice(0,Math.min(16,healthy.experience.neuralAfter.length));
    this.state.edgeWeights=backup.map(r=>r.slice());this.syncDenseReference();
    for(let i=0;i<n;i++)this.state.edgeWeights[i]=this.state.edgeWeights[i]!.map(()=>0);
    this.syncDenseReference();
    const lesioned=this.beforeDecision(probe);
    const lesionedBias=ACTIONS.map(a=>lesioned.actionBias[a]??0),lesionedLatent=lesioned.experience.neuralAfter.slice(0,Math.min(16,lesioned.experience.neuralAfter.length));
    const biasDistance=Math.sqrt(healthyBias.reduce((sum,v,k)=>sum+(v-lesionedBias[k]!)**2,0)/Math.max(1,ACTIONS.length));
    const latentDistance=Math.sqrt(healthyLatent.reduce((sum,v,k)=>sum+(v-(lesionedLatent[k]??0))**2,0)/Math.max(1,healthyLatent.length));
    this.state.edgeWeights=backup.map(r=>r.slice());this.syncDenseReference();
    const recovered=this.beforeDecision(probe);
    const recoveredBias=ACTIONS.map(a=>recovered.actionBias[a]??0);
    const recoveryDistance=Math.sqrt(healthyBias.reduce((sum,v,k)=>sum+(v-recoveredBias[k]!)**2,0)/Math.max(1,ACTIONS.length));
    this.state.prediction01=before;
    return {causalDrop01:clamp(Math.abs(before-lesioned.prediction01)),before01:before,after01:lesioned.prediction01,behavioralDrop01:clamp(biasDistance*8),latentDrop01:clamp(latentDistance*4),recovery01:clamp(1-recoveryDistance*8)};
  }

  ablationMatrix(probe?:Parameters<NeuralExperienceBranch["beforeDecision"]>[0]){
    const mkProbe=probe??{tick:this.state.tick+1,input:this.state.lastExperience?.input??new Array(64).fill(.08),baseUtilities:Object.fromEntries(ACTIONS.map(a=>[a,.5])) as Record<ActionKind,number>,predictionError01:this.state.predictionError01,novelty01:this.state.novelty01,uncertainty01:this.state.uncertainty01,homeostasis01:.2,identityGap01:.2,goalPressure01:.4};
    const baseline=this.snapshot();
    const healthy=this.beforeDecision(mkProbe);
    const healthyLatent=healthy.experience.neuralAfter.slice(0,16);
    const healthyBias=ACTIONS.map(a=>healthy.actionBias[a]??0);
    const metricsFor=(label:string,mutate:(s:any)=>void)=>{
      this.restore(baseline);
      const altered=this.snapshot(); mutate(altered); this.restore(altered);
      const out=this.beforeDecision(mkProbe);
      const latent=out.experience.neuralAfter.slice(0,16);
      const bias=ACTIONS.map(a=>out.actionBias[a]??0);
      const latentDrop=clamp(Math.sqrt(healthyLatent.reduce((sum,v,k)=>sum+(v-(latent[k]??0))**2,0)/Math.max(1,healthyLatent.length))*4);
      const behaviorDrop=clamp(Math.sqrt(healthyBias.reduce((sum,v,k)=>sum+(v-(bias[k]??0))**2,0)/Math.max(1,ACTIONS.length))*8);
      const predictionDrop=clamp(Math.abs(healthy.prediction01-out.prediction01));
      return {label,predictionDrop01:predictionDrop,behavioralDrop01:behaviorDrop,latentDrop01:latentDrop,compositeDrop01:clamp(.40*predictionDrop+.35*behaviorDrop+.25*latentDrop)};
    };
    const result=[
      metricsFor('edgeWeights',s=>{s.edgeWeights=s.edgeWeights.map((r:any)=>r.map(()=>0));}),
      metricsFor('inputProjection',s=>{s.inputProjection=s.inputProjection.map((r:any)=>r.map(()=>0));}),
      metricsFor('slowMemoryReadout',s=>{s.slowMemoryReadout=s.slowMemoryReadout.map(()=>0);}),
      metricsFor('actionReadout',s=>{s.actionReadout=s.actionReadout.map((r:any)=>r.map(()=>0));}),
      metricsFor('predictionReadout',s=>{s.predictionReadout=s.predictionReadout.map(()=>0);}),
      metricsFor('contextualActionPolicy',s=>{s.contextualActionPolicy=defaultP2855ContextualActionPolicy();s.contextualActionPolicy.enabled=false;}),
    ];
    this.restore(baseline);
    const recovery=this.beforeDecision(mkProbe);
    const recBias=ACTIONS.map(a=>recovery.actionBias[a]??0);
    const recoveryError=Math.sqrt(healthyBias.reduce((sum,v,k)=>sum+(v-(recBias[k]??0))**2,0)/Math.max(1,ACTIONS.length));
    return {baseline01:healthy.prediction01,ablations:result,recovery01:clamp(1-recoveryError*8),phase:this.state.offlineConsolidation.phase};
  }

  lastExperiencePressureMean01(){
    const pressure=this.state.pressure;
    if(!Array.isArray(pressure) || pressure.length===0) return 0.5;
    let sum=0;
    for(const value of pressure) sum += Number.isFinite(value) ? value : 0.5;
    return clamp(sum/pressure.length);
  }

  continuityMetrics(){return {
    ...this.continuity.metrics(),
    crossLayerArbiter:this.crossLayerArbiter.metrics(),
    externalGrounding:this.externalGrounding.metrics(),
    activeInformationGain:this.activeInformationGain.metrics(),
    evidenceLedger:this.evidenceLedger.metrics(),
    learnedTransition:this.learnedTransition.metrics(),causalRegimeGraph:this.causalRegimeGraph.metrics(),factorialAblation:this.factorialAblation.metrics(),hierarchicalWorldModel:this.hierarchicalWorldModel.metrics(),policyInformationGain:this.policyInformationGain.metrics(),autonomousExperimentScheduler:this.autonomousExperimentScheduler.metrics(),
    causalPlanner:this.causalPlanner.metrics(),
    embodiedBridge:this.embodiedBridge.metrics(),
    worldModelGate:this.worldModelGate.metrics(),
    transferableSkills:this.transferableSkills.metrics(),
    hierarchicalSkills:this.hierarchicalSkills.metrics(),
    taskAgnosticTransfer:this.taskAgnosticTransfer.metrics(),
    riskRecovery:this.riskRecovery.metrics(),
    goalIdentityModulator:this.goalIdentityModulator.metrics(),
    deviceScheduler:this.deviceScheduler.metrics(),
    selfOptimizingMemory:this.selfOptimizingMemory.metrics(),
    developmentalController:this.developmentalController.metrics(),
    causalSensitivity01:this.state.causalSensitivity01,
    transfer01:this.state.transfer01,
    foresightQuality01:this.state.foresightQuality01,
    adaptiveLifelong:this.adaptiveLifelong.metrics(),
    autonomousContinual:this.autonomousContinual.metrics(),
    selfOptimizingContinual:this.selfOptimizingContinual.metrics(),
    causalPredictiveIntervention:this.causalPredictiveIntervention.metrics(),
    unifiedCausalWorldLoop:this.unifiedCausalWorldLoop.metrics(),modelTimeReplay:this.modelTimeReplay.metrics(),selfKnowledgeCoreset:this.selfKnowledgeCoreset.metrics(),transferSafetySynergy:this.transferSafetySynergy.metrics(),
    deepIntegration:this.deepIntegration.metrics(),
    replayLearning:{
      weightUpdates:this.state.replayWeightUpdates,
      rollbacks:this.state.replayRollbacks,
      transferRejected:this.state.replayTransferRejected,
      signedCredit01:this.state.replaySignedCredit01,
      diversity01:this.state.replayDiversity01,
      evaluated:this.state.replayEvaluated,
      taskErrorBefore01:this.state.replayTaskErrorBefore01,
      taskErrorAfter01:this.state.replayTaskErrorAfter01,
      utilityGain01:this.state.replayUtilityGain01,
    },
    developmentalPlasticity:{scale01:this.state.developmentalPlasticityScale01},
    multiTimescalePlasticity:{
      fast01:this.state.fastPlasticity01,
      medium01:this.state.mediumPlasticity01,
      slow01:this.state.slowPlasticity01,
      updates:this.state.multiscalePlasticityUpdates,
    },
    offlineConsolidation:this.offlineConsolidation.metrics(),
    slowMemoryConsolidation:this.slowMemoryConsolidation.metrics(),
    hierarchicalSlowMemory:this.hierarchicalSlowMemory.metrics(),
    contextualActionPolicy:this.contextualActionPolicy.metrics(),
    crossModal:{agreement01:this.state.crossModalAgreement01,updates:this.state.crossModalUpdates},
    onlineCredit:{updates:this.state.onlineCreditUpdates,baseline01:this.state.creditBaseline01,modelResidual01:this.state.creditModelResidual01,agreement01:this.state.creditAgreement01,traceNorm01:this.state.creditTraceNorm01,mix01:this.state.onlineCreditMix01,adaptiveMix01:this.state.adaptiveCreditMix01,cascadeUpdates:this.state.cascadeCreditUpdates,cascadeNorm01:this.state.cascadeCreditNorm01,astroGateMean01:this.state.astroGateMean01,longDelayCredit01:this.state.longDelayCredit01,coupled:this.deepLearningCoupler.metrics()}
  };}
  transferSafetySynergyMetricsLite(){return this.transferSafetySynergy.metricsLite();}
  mobileRetentionDiagnostics(){return {replayBufferLength:this.state.replayBuffer.length,embodiedTransitionsLogLength:this.state.embodiedBridge.transitionsLog.length};}
  causalPlannerDiagnostics(){return this.causalPlanner.diagnostics();}
  diagnostics(){
    // snapshot() already performs the required subsystem synchronization and deep clone.
    // Re-cloning this.state here doubled allocation/GC cost for every diagnostics call.
    const out:any=this.snapshot();
    out.hierarchicalSlowMemory=this.hierarchicalSlowMemory.metrics();
    out.contextualActionPolicy=this.contextualActionPolicy.metrics();
    return out;
  }
}
