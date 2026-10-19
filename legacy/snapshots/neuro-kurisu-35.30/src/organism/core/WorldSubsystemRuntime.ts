import { probeOrganismSystem, type OrganismSystemHealthSnapshot } from './OrganismSystemContract.ts';
import { WorldModel } from '../world/WorldModel.ts';
import type { ActionKind } from './types.ts';
import type { InternalWorldState } from '../world/WorldModel.ts';
import type { WorldContext, WorldTransitionForOrganism } from './types.ts';
import { ActiveInferenceEngine } from '../world/ActiveInferenceEngine.ts';
import { LearnedResidualWorldModel } from '../world/LearnedResidualWorldModel.ts';
import { ContextualWorldModel } from '../world/ContextualWorldModel.ts';
import { WorldModel2 } from '../developmental/WorldModel2.ts';
import { P24WorldIdentityEngine } from '../developmental/P24WorldIdentityEngine.ts';
import { P27NeuralWorldFoundation } from '../cognition/P27NeuralWorldFoundation.ts';
import { BrainSubstrate } from '../cognition/BrainSubstrate.ts';
import { P44EmbodiedPredictiveSelfWorld } from '../world/P44EmbodiedPredictiveSelfWorld.ts';
import { P50CausalSelfWorldEngine } from '../world/P50CausalSelfWorldEngine.ts';
import { P51GroundedCausalWorkspace } from '../world/P51GroundedCausalWorkspace.ts';
import { P52CounterfactualDevelopmentMind } from '../world/P52CounterfactualDevelopmentMind.ts';
import { P57RealityFirstObservatory } from '../system/P57RealityFirstObservatory.ts';
import { P79EmbodiedSituationModel } from '../world/P79EmbodiedSituationModel.ts';
import { GroundedWorldState } from '../world/GroundedWorldState.ts';
import { P83PersistentRealityModel } from '../world/P83PersistentRealityModel.ts';
import { WorldCausalCalibration, defaultWorldCausalCalibration } from '../system/WorldCausalCalibration.ts';
import { WorldAgencyLearningCausalBridge, defaultWorldAgencyLearning } from '../system/WorldAgencyLearningCausalBridge.ts';
import { DerivedWorldPreviewCache } from '../system/DerivedWorldPreviewCache.ts';
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
import { WorldModelEnsembleController } from '../system/WorldModelEnsembleController.ts';
import { UnifiedLatentWorldState } from '../world/UnifiedLatentWorldState.ts';

/** BIG PASS 51: physical owner for world-model, prediction and reality-model machinery. */
export class WorldSubsystemRuntime {
  readonly systemName='world' as const;
  readonly dependencies=['embodiment'] as const;
  readonly systemCapabilities=['state', 'prediction', 'persistence'] as const;
  health(): OrganismSystemHealthSnapshot { return probeOrganismSystem(this); }

  readonly world = new WorldModel();
  readonly activeInference = new ActiveInferenceEngine();
  readonly residualWorld = new LearnedResidualWorldModel();
  readonly contextualWorld = new ContextualWorldModel();
  readonly worldModel2 = new WorldModel2();
  readonly p24WorldIdentity = new P24WorldIdentityEngine();
  readonly p27NeuralWorld = new P27NeuralWorldFoundation();
  readonly brainSubstrate = new BrainSubstrate();
  readonly p44PredictiveWorld = new P44EmbodiedPredictiveSelfWorld();
  readonly p50CausalSelfWorld = new P50CausalSelfWorldEngine();
  readonly p51GroundedCausalWorkspace = new P51GroundedCausalWorkspace();
  readonly p52CounterfactualDevelopment = new P52CounterfactualDevelopmentMind();
  readonly p57RealityFirstObservatory = new P57RealityFirstObservatory();
  readonly p79EmbodiedSituationModel = new P79EmbodiedSituationModel();
  readonly groundedWorld = new GroundedWorldState();
  readonly p83PersistentReality = new P83PersistentRealityModel();
  readonly worldModelEnsemble = new WorldModelEnsembleController();
  /** Canonical observation→latent→prediction ticket authority. Specialized world models remain contributors. */
  readonly unifiedLatentWorldState = new UnifiedLatentWorldState();

  /** Unified world-learning state is deliberately derived from persisted model state.
   * It owns cross-model coordination, not a second copy of the learned world. */
  private lastWorldLatentId:string | null = null;
  private lastWorldContext:WorldContext | null = null;
  private lastP27Latent = this.p27NeuralWorld.snapshot().latent;
  private readonly canonicalPredictionFrames = new Map<string, any>();
  private worldLearningStats = { observations:0, passiveUpdates:0, actionUpdates:0, lastPassiveError01:0, lastActionError01:0, modelAgreement01:0, lastAt:0, brainActionSamples:0, brainValidated:false };

  observeGroundedContext(context:WorldContext){
    const encoded=this.p27NeuralWorld.encode({world:context});
    const p27Latent=this.p27NeuralWorld.fuse(encoded);
    const beforeLatent=this.lastP27Latent;
    const previousWorldLatent=this.worldModel2.snapshot().latentState;
    const worldLatent=this.worldModel2.observeContext(context);
    let passiveError01=0;
    const contextChanged=Boolean(this.lastWorldContext && this.contextSignature(this.lastWorldContext)!==this.contextSignature(context));
    if(this.lastWorldContext && contextChanged){
      const passive=this.worldModel2.observePassiveTransition(this.lastWorldContext, context);
      passiveError01=passive.error01;
    }
    if(beforeLatent?.vector?.length && p27Latent.vector?.length && contextChanged){
      const p27Passive=this.p27NeuralWorld.observePassiveTransition(beforeLatent,p27Latent);
      passiveError01=passiveError01*.65+p27Passive.error01*.35;
      this.worldLearningStats.passiveUpdates++;
    }
    this.brainSubstrate.observe(p27Latent.vector, this.worldLearningStats.observations, Date.now());
    this.lastP27Latent=p27Latent;
    this.lastWorldLatentId=worldLatent.id;
    const groundedSummary=this.groundedWorld.summary();
    const unifiedLatent=this.unifiedLatentWorldState.observe({
      tick:context.tick,
      at:Date.now(),
      context,
      grounding01:clamp(1-context.uncertainty)*0.70+clamp(groundedSummary.confidence01??(1-context.uncertainty))*0.30,
      p27Latent:p27Latent.vector,
      provenanceIds:[...new Set((context.objects??[]).map(o=>o.sourceId).filter((x):x is string=>Boolean(x))), 'grounded-world', 'p27-neural-world'].slice(0,24),
    });
    this.lastWorldContext=structuredClone(context);
    if(contextChanged || this.worldLearningStats.observations===0) this.p83PersistentReality.observeWorld({context,at:Date.now(),confidence01:Math.max(0,Math.min(1,1-context.uncertainty)),reason:contextChanged?'grounded-context-transition':'grounded-context-observation'});
    else if(this.worldLearningStats.observations % 16===0) this.p83PersistentReality.heartbeat(Date.now());
    this.worldLearningStats.observations++;
    this.worldLearningStats.lastPassiveError01=passiveError01;
    this.worldLearningStats.lastAt=Date.now();
    const modelAgreement=this.worldModelAgreement();
    return { worldLatent, p27Latent, unifiedLatent, passiveError01, modelAgreement01:modelAgreement };
  }

  private contextSignature(context:WorldContext):string{
    const facts=Array.isArray(context.facts)?context.facts.slice(-32).map(String).sort().join('|'):'';
    const objects=Array.isArray(context.objects)?context.objects.slice(0,32).map(o=>`${o.id}:${o.label}:${o.visible?'1':'0'}:${o.collected?'1':'0'}`).join('|'):'';
    const events=Array.isArray(context.events)?context.events.slice(-16).map(String).join('|'):'';
    return `${context.location}|${facts}|${objects}|${events}|${Number(context.energy).toFixed(3)}|${Number(context.attention).toFixed(3)}|${Number(context.uncertainty).toFixed(3)}`;
  }

  applyMemoryEvidence(input:{memoryIds:string[];query:string;confidence01:number;salience01:number;at:number}){
    return { ...this.worldModel2.applyMemoryEvidence(input), memoryEvidence:this.worldModel2.memoryEvidenceSnapshot() };
  }

  /** Action-conditioned prediction over the unified world subsystem. */
  predictIntegrated(action:ActionKind, baseReward:number, uncertainty01:number, context?:WorldContext, organismState?:import('./types.ts').OrganismState, registerDecisionTicket=false){
    if(context && (!this.lastWorldLatentId || this.worldModel2.snapshot().latentState?.id!==this.lastWorldLatentId)) this.observeGroundedContext(context);
    const p10=this.worldModel2.predict(action,baseReward,uncertainty01);
    const p27=this.p27NeuralWorld.predict(this.lastP27Latent,action);
    const brain=this.brainSubstrate.predictAction(action);
    const brainBias=this.brainSubstrate.actionBias(action);
    const residual=this.residualWorld.predict(action,baseReward);
    const contextual = organismState ? this.contextualWorld.predict(organismState, action) : null;
    const candidates=[
      {member:'worldModel2' as const,prediction01:p10.reward,confidence01:p10.confidence},
      {member:'p27' as const,prediction01:p27.reward01,confidence01:p27.confidence01},
      {member:'residual' as const,prediction01:residual.predicted,confidence01:residual.confidence},
      ...(contextual ? [{member:'contextual' as const,prediction01:contextual.reward01,confidence01:contextual.confidence01}] : []),
    ];
    const ensemble=this.worldModelEnsemble.arbitrate(String(action), candidates);
    const integratedReward=clamp(ensemble.prediction01+brainBias);
    const integratedConfidence=ensemble.confidence01;
    const integratedUncertainty=clamp(uncertainty01+ensemble.uncertainty01*.12);
    const canonicalPrediction=registerDecisionTicket ? this.unifiedLatentWorldState.registerPrediction({
      action, predicted01:integratedReward, confidence01:integratedConfidence, uncertainty01:integratedUncertainty,
      predictedNextVector:p10.predictedState ? this.unifiedLatentWorldState.encodePredictionState(p10.predictedState as any) : undefined,
      horizon:1, sourcePredictionId:p10.predictionId,
    }) : undefined;
    const frame={ reward01:integratedReward, confidence01:integratedConfidence, modelAgreement01:ensemble.agreement01, uncertainty01:integratedUncertainty,
      predictionId:canonicalPrediction?.id, sourcePredictionId:p10.predictionId, p10, p27, brain, brainBias, residual, contextual, ensemble, candidates, canonicalPrediction };
    if(canonicalPrediction){
      this.canonicalPredictionFrames.set(canonicalPrediction.id,frame);
      if(this.canonicalPredictionFrames.size>64){const oldest=this.canonicalPredictionFrames.keys().next().value;if(oldest) this.canonicalPredictionFrames.delete(oldest);}
    }
    return frame;
  }

  /**
   * Canonical decision-time world prediction. The returned predictionId is the
   * exact pre-action ticket that must be resolved by the eventual outcome.
   * This prevents calibration from accidentally consuming an older prediction
   * when several candidates share the same action/state.
   */
  predictForDecision(action:ActionKind, baseReward:number, uncertainty01:number, organismState?:import('./types.ts').OrganismState){
    const integrated=this.predictIntegrated(action,baseReward,uncertainty01,undefined,organismState,true);
    return {
      action,
      utility:integrated.reward01,
      confidence:integrated.confidence01,
      uncertainty:integrated.uncertainty01,
      predictionId:integrated.predictionId,
      modelAgreement01:integrated.modelAgreement01,
      reasons:['integrated-world-model'],
      next: organismState ? ({energy:organismState.needs.energy,uncertainty:organismState.needs.uncertainty,cognitiveLoad:organismState.needs.cognitiveLoad,novelty:organismState.needs.novelty} satisfies InternalWorldState) : {energy:.5,uncertainty:.5,cognitiveLoad:.5,novelty:.5},
      worldEvidence:[],
    };
  }

  evaluateAction(action:ActionKind, baseReward:number, uncertainty01:number, context?:WorldContext, organismState?:import('./types.ts').OrganismState, existingPredictionId?:string){
    const integrated=existingPredictionId ? (this.canonicalPredictionFrames.get(existingPredictionId) ?? this.predictIntegrated(action,baseReward,uncertainty01,context,organismState,false)) : this.predictIntegrated(action,baseReward,uncertainty01,context,organismState,false);
    const rollout=this.worldModel2.rollout(
      [action, action==='rest'?'reflect':'verify', action==='explore'?'verify':'reflect'],
      baseReward,
    );
    return { integrated, rollout };
  }

  observeActionOutcome(transition:WorldTransitionForOrganism, organismState?:import('./types.ts').OrganismState, predictionId?:string){
    // Calibration must use the prediction made before the transition. Never feed
    // the observed reward back into a fresh prediction call before scoring it.
    const beforeState=organismState;
    // Calibration is resolved only against a genuine pre-outcome ensemble ticket.
    // Never synthesize a fresh prediction after the outcome just to manufacture evidence.
    const actual=Math.max(0,Math.min(1,transition.reward));
    const resolution=this.worldModelEnsemble.observeOutcomeForAction(String(transition.action),actual);
    const candidates=resolution.candidates;
    const worldModelResolution=this.worldModel2.observeTransition(transition, predictionId);
    if(beforeState){
      this.contextualWorld.observe(beforeState, transition.action as ActionKind, {
        reward01:actual,
        nextEnergy01:Math.max(0,Math.min(1,transition.after.energy)),
        nextLoad01:Math.max(0,Math.min(1,1-transition.after.attention)),
        nextUncertainty01:Math.max(0,Math.min(1,transition.after.uncertainty)),
        nextNovelty01:Math.max(0,Math.min(1,transition.after.objects.length/8)),
      });
    }
    const before=this.p27NeuralWorld.fuse(this.p27NeuralWorld.encode({world:transition.before}));
    const after=this.p27NeuralWorld.fuse(this.p27NeuralWorld.encode({world:transition.after}));
    const trained=this.p27NeuralWorld.train(before,transition.action as ActionKind,actual,after);
    const canonicalResolution=this.unifiedLatentWorldState.resolvePrediction(predictionId,actual,transition.after,after.vector);
    // The post-action observation is a real world observation, so the canonical
    // latent state must advance here rather than waiting for the next passive tick.
    // This closes the causal loop: latent(t) -> prediction -> action -> outcome -> latent(t+1).
    const groundedAfter=this.groundedWorld.summary();
    const unifiedAfter=this.unifiedLatentWorldState.observe({
      tick:transition.after.tick,
      at:transition.at,
      context:transition.after,
      grounding01:clamp(1-transition.after.uncertainty)*0.70+clamp(groundedAfter.confidence01??(1-transition.after.uncertainty))*0.30,
      p27Latent:after.vector,
      provenanceIds:[...new Set((transition.after.objects??[]).map(o=>o.sourceId).filter((x):x is string=>Boolean(x))), 'action-outcome-observation', 'p27-neural-world'].slice(0,24),
    });
    const brainTrained=this.brainSubstrate.learnAction(transition.action as ActionKind,actual,this.p27NeuralWorld.snapshot().world.predictionError01);
    this.worldLearningStats.brainActionSamples=this.brainSubstrate.snapshot().actionSamples;
    this.worldLearningStats.brainValidated=this.brainSubstrate.quality().validated;
    this.lastP27Latent=after;
    this.lastWorldLatentId=this.worldModel2.snapshot().latentState?.id ?? null;
    this.lastWorldContext=structuredClone(transition.after);
    this.p83PersistentReality.observeWorld({context:transition.after,at:transition.at,confidence01:Math.max(0,Math.min(1,1-transition.after.uncertainty)),reason:'action-outcome-observation'});
    this.worldLearningStats.actionUpdates++;
    this.worldLearningStats.lastActionError01=trained.error01;
    this.worldLearningStats.lastAt=Date.now();
    return { ...trained, brain:brainTrained, unifiedAfter, canonicalResolution, predictionBefore:{candidates,usedStoredPrediction:resolution.resolved,predictionId:resolution.predictionId ?? predictionId,worldModel2:worldModelResolution}, candidates };
  }

  worldModelAgreement(){
    const s=this.worldModel2.snapshot();
    const p27=this.p27NeuralWorld.snapshot().world.predictionError01;
    const p10=s.predictionErrors.at(-1) ?? .5;
    const agreement=1-Math.min(1,(Math.abs(p10-p27)+Math.abs(p10-(s.latentState?.uncertainty01??.5)))/2);
    this.worldLearningStats.modelAgreement01=Number(Math.max(0,Math.min(1,agreement)).toFixed(6));
    return this.worldLearningStats.modelAgreement01;
  }

  worldLearningSnapshot(){
    return { version:1, stats:{...this.worldLearningStats}, lastWorldLatentId:this.lastWorldLatentId, p27Latent:this.lastP27Latent };
  }

  worldLearningRestore(snapshot?:any){
    if(snapshot?.stats) this.worldLearningStats={...this.worldLearningStats,...snapshot.stats};
    this.lastWorldLatentId=snapshot?.lastWorldLatentId ?? this.worldModel2.snapshot().latentState?.id ?? null;
    this.lastP27Latent=snapshot?.p27Latent ?? this.p27NeuralWorld.snapshot().latent;
  }

  trackPrediction(input:{predictionId:string;claimKey:string;predicted01:number;confidence01:number;at?:number}){ return this.p83PersistentReality.linkPrediction(input); }
  reconcileReality(input:{claimKey:string;status:'corroborated'|'supported'|'disputed'|'unknown';support01:number;contradiction01:number;independentSources?:number;provenanceIds?:string[];predictionId?:string;observationId?:string;at?:number}){ return this.p83PersistentReality.reconcileClaim(input); }
  realitySummary(){ return this.p83PersistentReality.summary(); }
  realityContinuity(limit=16){ return this.p83PersistentReality.continuitySnapshot(limit); }


  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly worldCausalCalibration = new WorldCausalCalibration();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly worldAgencyLearningCausalBridge = new WorldAgencyLearningCausalBridge(96);
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly derivedWorldPreviewCache = new DerivedWorldPreviewCache();
  restoreFromPersisted(input: { persisted?: any; cognition?: any; advanced?: any; consciousness?: any; learning?: any }) {
    const persisted=input.persisted ?? {}; const cognition=input.cognition ?? {}; const advanced=input.advanced ?? {}; const consciousness=input.consciousness ?? {}; const learning=input.learning ?? {};
    this.world.restore(persisted.worldModel);
    this.residualWorld.restore(cognition.residualWorld);
    this.contextualWorld.restore(cognition.contextualWorld);
    this.activeInference.restore(consciousness.activeInference);
    this.worldModel2.restore(advanced.worldModel2);
    this.unifiedLatentWorldState.restore(advanced.unifiedLatentWorldState);
    this.groundedWorld.restore(advanced.groundedWorld);
    this.p83PersistentReality.restore(advanced.p83PersistentRealityModel);
    this.worldModelEnsemble.restore(advanced.worldModelEnsemble);
    this.worldLearningRestore(advanced.worldLearning);
    this.lastWorldLatentId=this.lastWorldLatentId ?? this.worldModel2.snapshot().latentState?.id ?? null;
    this.lastWorldContext=null;
    this.lastP27Latent=this.p27NeuralWorld.snapshot().latent;
    this.p24WorldIdentity.restore(advanced.p24);
    this.p27NeuralWorld.restore(cognition.p27);
    this.brainSubstrate.restore(cognition.brainSubstrate);
    this.p44PredictiveWorld.restore(learning.p44PredictiveWorld);
    this.p50CausalSelfWorld.restore(advanced.p50CausalSelfWorld);
    this.p51GroundedCausalWorkspace.restore(advanced.p51GroundedCausalWorkspace);
    this.p52CounterfactualDevelopment.restore(advanced.p52CounterfactualDevelopment);
    this.p57RealityFirstObservatory.restore(advanced.p57RealityFirstObservatory);
    this.p79EmbodiedSituationModel.restore(advanced.p79EmbodiedSituationModel);
  }

  snapshot() { return {
    world:this.world.persisted(), activeInference:this.activeInference.snapshot(), residualWorld:this.residualWorld.snapshot(),
    contextualWorld:this.contextualWorld.snapshot(), worldModel2:this.worldModel2.snapshot(), unifiedLatentWorldState:this.unifiedLatentWorldState.snapshot(), p24:this.p24WorldIdentity.snapshot(),
    p27:this.p27NeuralWorld.snapshot(), brainSubstrate:this.brainSubstrate.snapshot(), p44:this.p44PredictiveWorld.snapshot(), p50:this.p50CausalSelfWorld.snapshot(),
    p51:this.p51GroundedCausalWorkspace.snapshot(), p52:this.p52CounterfactualDevelopment.snapshot(),
    p57:this.p57RealityFirstObservatory.snapshot(), p79:this.p79EmbodiedSituationModel.snapshot(), groundedWorld:this.groundedWorld.snapshot(), p83PersistentRealityModel:this.p83PersistentReality.snapshot(),
  }; }
}
