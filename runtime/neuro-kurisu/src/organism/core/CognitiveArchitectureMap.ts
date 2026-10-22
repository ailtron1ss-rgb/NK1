/**
 * Canonical, read-only map of the Kurisu cognitive organism.
 *
 * This is an architecture contract, not a second runtime or a set of new
 * cognitive engines. Each subsystem points to existing implementations and
 * identifies the one authoritative owner for the state it coordinates.
 */
export type CognitiveLayer = 'sensorium'|'attention'|'affect-homeostasis'|'self-model'|'goals-values'|'world-model'|'memory'|'executive'|'embodiment'|'outcome-learning'|'social'|'metacognition'|'lifecycle'|'research';
export type CognitiveFlowKind = 'feedforward'|'feedback'|'governance'|'provenance';

export interface CognitiveArchitectureSubsystem {
  id:string;
  label:string;
  layer:CognitiveLayer;
  owner:string;
  cadence:'perception'|'each-cycle'|'after-action'|'background'|'on-demand';
  components:string[];
  inputs:string[];
  outputs:string[];
  dependsOn:string[];
  purpose:string;
}

export interface CognitiveArchitectureFlow {
  from:string;
  to:string;
  kind:CognitiveFlowKind;
  signal:string;
}

const SUBSYSTEMS:CognitiveArchitectureSubsystem[]=[
  {id:'sensorium',label:'Sensorium & perception',layer:'sensorium',owner:'OrganismCore + EmbodimentSubsystemRuntime',cadence:'perception',components:['runtime/neuro-kurisu/src/organism/body/MultimodalPerception.ts','runtime/neuro-kurisu/src/organism/body/PerceptionRouter.ts','runtime/neuro-kurisu/src/organism/cognition/PerceptionEngine.ts'],inputs:['camera/audio/device/user/world observations'],outputs:['bounded percepts','freshness','confidence','prediction error'],dependsOn:[],purpose:'Convert observable inputs to source-labelled evidence; unavailable sensors must stay unavailable rather than fabricating observations.'},
  {id:'attention-workspace',label:'Attention & global workspace',layer:'attention',owner:'CognitiveRuntimeCluster',cadence:'each-cycle',components:['runtime/neuro-kurisu/src/organism/cognition/CognitiveNetworkBus.ts','runtime/neuro-kurisu/src/organism/cognition/GlobalWorkspaceSubstrateV2.ts','runtime/neuro-kurisu/src/organism/cognition/NeuromodulationSystem.ts'],inputs:['percepts','goal pressure','emotion appraisal/feeling access','attention budget','specialist signals'],outputs:['bounded broadcast','selected workspace content','affect-weighted salience','attention gain'],dependsOn:['sensorium','homeostasis-affect','goal-value'],purpose:'Select a small set of high-value specialist signals for the current cognitive cycle.'},
  {id:'homeostasis-affect',label:'Homeostasis, emotion & motivation',layer:'affect-homeostasis',owner:'OrganismCore + CognitiveRuntimeCluster',cadence:'each-cycle',components:['runtime/neuro-kurisu/src/organism/cognition/CognitiveField.ts','runtime/neuro-kurisu/src/organism/cognition/IntrinsicMotivationEngine.ts','runtime/neuro-kurisu/src/organism/system/EmotionAppraisalEngine.ts','runtime/neuro-kurisu/src/organism/body/EmbodiedBody.ts'],inputs:['interoception','outcome appraisal','uncertainty','social need','energy/thermal signals'],outputs:['valence/arousal','intrinsic drives','resource pressure','homeostatic constraints'],dependsOn:['sensorium','world-model'],purpose:'Produce bounded affective and motivational state that changes attention and actions without claiming biological emotion or sentience.'},
  {id:'self-model',label:'Identity, self-model & continuity',layer:'self-model',owner:'OrganismCore persisted identity state',cadence:'each-cycle',components:['runtime/neuro-kurisu/src/organism/cognition/IdentityContinuity.ts','runtime/neuro-kurisu/src/organism/cognition/SelfAuthorship.ts','runtime/neuro-kurisu/src/organism/system/IdentityContinuityGuard.ts','runtime/neuro-kurisu/src/organism/system/PersistentContinuityKernel.ts'],inputs:['autobiographical memories','capability evidence','values','external pressure'],outputs:['identity continuity','self prediction','identity guard decision'],dependsOn:['memory','world-model','outcome-learning'],purpose:'Keep identity and self-claims grounded in longitudinal evidence and preserve continuity across restart/model changes.'},
  {id:'goal-value',label:'Endogenous goals & values',layer:'goals-values',owner:'OrganismCore + canonical goal/value engines',cadence:'each-cycle',components:['runtime/neuro-kurisu/src/organism/cognition/B272EndogenousGoalGenesis.ts','runtime/neuro-kurisu/src/organism/cognition/B273AutonomousGoalLifecycle.ts','runtime/neuro-kurisu/src/organism/system/AutonomousValueFormationEngine.ts','runtime/neuro-kurisu/src/organism/learning/CanonicalActionPolicyArbiter.ts'],inputs:['needs','identity','prediction error','evidence','commitments'],outputs:['active goals','goal pressure','value constraints','ranked action candidates'],dependsOn:['self-model','world-model','homeostasis-affect'],purpose:'Generate and revise goals under stable identity/value constraints; no goal bypasses action governance.'},
  {id:'world-model',label:'World state, prediction & causality',layer:'world-model',owner:'WorldSubsystemRuntime',cadence:'each-cycle',components:['runtime/neuro-kurisu/src/organism/world/ContextualWorldModel.ts','runtime/neuro-kurisu/src/organism/world/ActiveInferenceEngine.ts','runtime/neuro-kurisu/src/organism/world/GroundedWorldState.ts'],inputs:['percepts','actions','verified outcomes','temporal context'],outputs:['world state','counterfactual predictions','uncertainty','causal hypotheses'],dependsOn:['sensorium','outcome-learning'],purpose:'Maintain explicit world beliefs and distinguish prediction from observed reality.'},
  {id:'memory',label:'Canonical memory & autobiography',layer:'memory',owner:'MemoryOS2 (only writable canonical memory authority)',cadence:'each-cycle',components:['runtime/neuro-kurisu/src/organism/developmental/MemoryOS2.ts','runtime/neuro-kurisu/src/organism/memory/SemanticMemoryGraph.ts','runtime/neuro-kurisu/src/organism/memory/SourceMonitor.ts','runtime/neuro-kurisu/src/organism/cognition/evolution/AutobiographicalNarrative.ts'],inputs:['experience','verified observations','source provenance','identity/goal context'],outputs:['episodic/semantic memory','autobiographical episodes','retrieval context','consolidation candidates'],dependsOn:['sensorium','world-model','outcome-learning','self-model'],purpose:'Keep one writable memory authority; other memory-like systems are adapters, projections, indexes or research candidates.'},
  {id:'executive',label:'Executive planning & action arbitration',layer:'executive',owner:'CanonicalActionPolicyArbiter + ActionGateway',cadence:'each-cycle',components:['runtime/neuro-kurisu/src/organism/core/CognitiveExecutionPlanner.ts','runtime/neuro-kurisu/src/organism/learning/CanonicalActionPolicyArbiter.ts','runtime/neuro-kurisu/src/organism/system/ActionGateway.ts','runtime/neuro-kurisu/src/organism/system/EvidenceFirewall.ts'],inputs:['goals','workspace','world predictions','identity/value gates','capability/resource budgets'],outputs:['governed decision','idempotency key','execution reservation'],dependsOn:['attention-workspace','goal-value','world-model','self-model','metacognition'],purpose:'Use one decision authority and one execution gateway, with policy checks before side effects.'},
  {id:'embodiment-action',label:'Body, motor control & tool execution',layer:'embodiment',owner:'EmbodiedActionExecutor behind ActionGateway',cadence:'after-action',components:['runtime/neuro-kurisu/src/organism/body/EmbodiedActionExecutor.ts','runtime/neuro-kurisu/src/organism/cognition/SensorimotorLoop.ts','runtime/neuro-kurisu/src/organism/body/AndroidEmbodimentBridge.ts','runtime/neuro-kurisu/src/organism/body/VoiceEmbodiment.ts'],inputs:['governed action','device capabilities','resource/thermal state'],outputs:['tool/device result','execution ID','motor telemetry'],dependsOn:['executive','sensorium'],purpose:'Execute only available capabilities, preserve action identity, and explicitly report unavailable devices/providers.'},
  {id:'outcome-learning',label:'Reality checks, reafference & learning',layer:'outcome-learning',owner:'ExternalObserverFabric + OutcomeVerificationService + canonical credit authority',cadence:'after-action',components:['runtime/neuro-kurisu/src/organism/system/ExternalObserverFabric.ts','runtime/neuro-kurisu/src/organism/system/OutcomeVerificationService.ts','runtime/neuro-kurisu/src/organism/system/B294CausalNeuralEventSpine.ts','runtime/neuro-kurisu/src/organism/learning/CanonicalTemporalCreditAuthority.ts','runtime/neuro-kurisu/src/organism/learning/CausalExperienceStream.ts','runtime/neuro-kurisu/src/organism/learning/UnifiedLearningSubstrate.ts'],inputs:['predicted postcondition','execution receipt','independent observations','decision lineage','external repair/replay hypotheses'],outputs:['verified/contradicted/unknown outcome','reafference','temporal credit','grounded learning packet','quarantined external hypotheses'],dependsOn:['embodiment-action','world-model'],purpose:'Close the action loop only from attributable evidence. External repair/replay reports remain hypotheses; only grounded runtime transitions enter the unified reward, consolidation and replay lane.'},
  {id:'social-model',label:'Social cognition & relationships',layer:'social',owner:'OrganismCore + autonomous relationship subsystem',cadence:'each-cycle',components:['runtime/neuro-kurisu/src/organism/system/AutonomousRelationshipManager.ts','runtime/neuro-kurisu/src/organism/system/AutonomousSocialInitiativeEngine.ts','runtime/neuro-kurisu/src/organism/cognition/B288SocialPredictiveSelfOtherBrain.ts'],inputs:['social observations','interaction outcomes','user preferences','identity/energy'],outputs:['relationship state','other-agent predictions','social initiative'],dependsOn:['sensorium','self-model','memory','outcome-learning','homeostasis-affect'],purpose:'Track relationship context and social expectations with provenance instead of treating guessed mental states as facts.'},
  {id:'metacognition',label:'Metacognition, safety & recovery',layer:'metacognition',owner:'GovernanceSubsystemRuntime',cadence:'each-cycle',components:['runtime/neuro-kurisu/src/organism/cognition/MetaCognitiveMonitor.ts','runtime/neuro-kurisu/src/organism/cognition/CognitiveImmuneSystem.ts','runtime/neuro-kurisu/src/organism/system/IntegritySentinel.ts','runtime/neuro-kurisu/src/organism/persistence/RecoveryWatchdog.ts'],inputs:['uncertainty','contradictions','capability permissions','resource pressure','recovery state'],outputs:['confidence calibration','holds/deferrals','rollback/recovery decision'],dependsOn:['self-model','world-model','executive'],purpose:'Reject unsafe/unsupported actions and provide recovery paths; governance is not bypassed by developmental systems.'},
  {id:'lifecycle',label:'Central life-cycle scheduler',layer:'lifecycle',owner:'OrganismCore (full cycle) + OperationalMicroCycleRuntime (reduced-resolution mode)',cadence:'each-cycle',components:['runtime/neuro-kurisu/src/organism/core/OrganismCore.ts','runtime/neuro-kurisu/src/organism/core/OperationalMicroCycleRuntime.ts','runtime/neuro-kurisu/src/organism/core/TemporalResolutionGovernor.ts','runtime/neuro-kurisu/src/organism/system/P72LifeCycleOrchestrator.ts'],inputs:['external events','wake/sleep/resources','pending goals','cycle budget'],outputs:['cycle phase','scheduled subsystem cadence','checkpoint request'],dependsOn:['sensorium','homeostasis-affect','attention-workspace','memory','executive','outcome-learning'],purpose:'Own cycle timing and reduced-resolution ticks; a heartbeat is not an action execution, and fast/micro ticks must not attribute stale actions, fabricate success, or bypass durability.'},
  {id:'research',label:'Research, evaluation & controlled improvement',layer:'research',owner:'EvidenceResearchSubsystemRuntime + read-only research bridge',cadence:'background',components:['runtime/neuro-kurisu/src/organism/research/','research/research_bridge.py','runtime/neuro-kurisu/src/organism/system/ResearchClaimAssessment.ts','runtime/neuro-kurisu/src/organism/system/SandboxedSelfRewriteEngine.ts'],inputs:['research questions','candidate source code','holdout evaluation','provenance/licence data'],outputs:['candidate patch','evidence report','promotion/rejection decision'],dependsOn:['memory','world-model','metacognition'],purpose:'Source reuse and self-improvement remain evidence-gated; research candidates cannot mutate canonical runtime until separately qualified.'},
];

const FLOWS:CognitiveArchitectureFlow[]=[
  {from:'sensorium',to:'attention-workspace',kind:'feedforward',signal:'percepts + novelty + uncertainty'},
  {from:'sensorium',to:'world-model',kind:'feedforward',signal:'source-labelled observation'},
  {from:'homeostasis-affect',to:'attention-workspace',kind:'feedforward',signal:'arousal + attention gain'},
  {from:'homeostasis-affect',to:'goal-value',kind:'feedforward',signal:'intrinsic drives + resource pressure'},
  {from:'attention-workspace',to:'executive',kind:'feedforward',signal:'global-workspace broadcast'},
  {from:'world-model',to:'goal-value',kind:'feedforward',signal:'predictions + uncertainty'},
  {from:'world-model',to:'executive',kind:'feedforward',signal:'predicted action outcomes'},
  {from:'memory',to:'self-model',kind:'feedforward',signal:'autobiographical/episodic evidence'},
  {from:'self-model',to:'goal-value',kind:'governance',signal:'identity + continuity constraints'},
  {from:'goal-value',to:'executive',kind:'feedforward',signal:'active goals + value constraints'},
  {from:'metacognition',to:'executive',kind:'governance',signal:'risk gate + confidence + hold/defer'},
  {from:'executive',to:'embodiment-action',kind:'feedforward',signal:'governed action + idempotency key'},
  {from:'embodiment-action',to:'outcome-learning',kind:'feedforward',signal:'execution ID + result receipt'},
  {from:'outcome-learning',to:'world-model',kind:'feedback',signal:'prediction error + verified world delta'},
  {from:'outcome-learning',to:'memory',kind:'feedback',signal:'verified/contradicted/unknown evidence'},
  {from:'outcome-learning',to:'self-model',kind:'feedback',signal:'attributed experience and temporal credit'},
  {from:'outcome-learning',to:'goal-value',kind:'feedback',signal:'verified reward + goal progress'},
  {from:'memory',to:'social-model',kind:'feedforward',signal:'interaction history + source confidence'},
  {from:'social-model',to:'homeostasis-affect',kind:'feedback',signal:'social need and relationship appraisal'},
  {from:'lifecycle',to:'attention-workspace',kind:'governance',signal:'cycle mode + budget'},
  {from:'lifecycle',to:'outcome-learning',kind:'governance',signal:'heartbeat tick is not an action receipt; no micro-cycle action credit'},
  {from:'lifecycle',to:'memory',kind:'governance',signal:'checkpoint/consolidation cadence'},
  {from:'research',to:'metacognition',kind:'provenance',signal:'candidate quality + holdout result'},
  {from:'research',to:'outcome-learning',kind:'provenance',signal:'external repair/replay claims enter an unverified hypothesis lane; no direct reward credit'},
];

const AUTHORITIES=[
  {role:'writable-organism-state',owner:'OrganismCore',rule:'One persisted organism state owner; facades are read-only/adapter boundaries.'},
  {role:'writable-canonical-memory',owner:'MemoryOS2',rule:'Legacy memories are imported/projected; no parallel writable memory authority.'},
  {role:'final-action-decision',owner:'CanonicalActionPolicyArbiter',rule:'One final policy arbitration path; subsystems submit candidates and evidence.'},
  {role:'side-effect-execution',owner:'ActionGateway',rule:'All governed tool/device side effects pass through one idempotent gateway.'},
  {role:'external-evidence',owner:'ExternalObserverFabric + OutcomeVerificationService',rule:'Execution results are not proof of world state without postcondition assessment.'},
  {role:'research-promotion',owner:'Evidence-gated release workflow',rule:'Research/Legacy candidates stay read-only until independently evaluated and explicitly promoted.'},
];

export function validateCognitiveArchitecture():{ok:boolean;subsystemCount:number;flowCount:number;duplicateIds:string[];unresolvedReferences:string[];duplicateAuthorityRoles:string[];missingOwners:string[]} {
  const ids=SUBSYSTEMS.map(x=>x.id),idSet=new Set(ids);
  const duplicateIds=ids.filter((id,index)=>ids.indexOf(id)!==index);
  const unresolvedReferences=FLOWS.flatMap(flow=>[flow.from,flow.to].filter(id=>!idSet.has(id))).concat(SUBSYSTEMS.flatMap(system=>system.dependsOn.filter(id=>!idSet.has(id)).map(id=>`${system.id}->${id}`)));
  const roles=AUTHORITIES.map(x=>x.role);
  const duplicateAuthorityRoles=roles.filter((role,index)=>roles.indexOf(role)!==index);
  const missingOwners=SUBSYSTEMS.filter(x=>!x.owner.trim()||!x.components.length).map(x=>x.id);
  return {ok:duplicateIds.length===0&&unresolvedReferences.length===0&&duplicateAuthorityRoles.length===0&&missingOwners.length===0,subsystemCount:SUBSYSTEMS.length,flowCount:FLOWS.length,duplicateIds:[...new Set(duplicateIds)],unresolvedReferences:[...new Set(unresolvedReferences)],duplicateAuthorityRoles:[...new Set(duplicateAuthorityRoles)],missingOwners};
}

export function buildCognitiveArchitectureSnapshot(){
  const validation=validateCognitiveArchitecture();
  return {schemaVersion:1,mainSystem:{id:'kurisu-organism',label:'Neuro-Kurisu cognitive organism',owner:'runtime/neuro-kurisu/src/organism/core/OrganismCore.ts',purpose:'A single stateful autonomous digital personality architecture coordinated by one life-cycle and governed action path.',nonConsciousnessClaim:true},authorities:AUTHORITIES.map(x=>({...x})),subsystems:SUBSYSTEMS.map(x=>({...x,components:[...x.components],inputs:[...x.inputs],outputs:[...x.outputs],dependsOn:[...x.dependsOn]})),flows:FLOWS.map(x=>({...x})),validation};
}
