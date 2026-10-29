import type { MemoryItem2 } from '../developmental/MemoryOS2.ts';
import { AdaptiveReplayGovernor, defaultAdaptiveReplayGovernorState, type AdaptiveReplayGovernorState } from '../system/AdaptiveReplayGovernor.ts';
import { CausalReplayCreditAssigner, defaultCausalReplayCreditState, type CausalReplayCreditState } from '../system/CausalReplayCreditAssigner.ts';
import { isTrustedExternalPostconditionVerification, type OutcomeVerification } from '../system/OutcomeVerificationService.ts';

export type MemoryTier = 'hot' | 'warm' | 'cold';
export type ExperienceEdgeType = 'semantic' | 'temporal' | 'causal' | 'identity' | 'goal';

export interface ExperienceGraphNode {
  id:string;
  memoryId:string;
  tier:MemoryTier;
  kind:MemoryItem2['kind'];
  source:string;
  representative:string;
  keywords:string[];
  createdAt:number;
  lastSeenAt:number;
  retrievalCount:number;
  significance01:number;
  identityImpact01:number;
  futureRelevance01:number;
  novelty01:number;
  emotionalImpact01:number;
  predictionImpact01:number;
  socialImpact01:number;
  stability01:number;
  replayPriority01:number;
  lastReplayedAt:number;
  activeGoalIds:string[];
  replayCount:number;
}

export interface ExperienceGraphEdge {
  from:string;
  to:string;
  type:ExperienceEdgeType;
  weight01:number;
  lastAt:number;
}

export interface ExperienceCluster {
  id:string;
  key:string;
  count:number;
  representativeMemoryIds:string[];
  keywords:string[];
  meanSignificance01:number;
  meanIdentityImpact01:number;
  meanPredictionImpact01:number;
  firstAt:number;
  lastAt:number;
  confidence01:number;
  compressedSummary:string;
  updates:number;
  replayCount:number;
  lastReplayAt:number;
}

export interface IdentityGravityState {
  pressure01:number;
  resistance01:number;
  tension01:number;
  proposedChangeMagnitude01:number;
  evidenceSupport01:number;
  lastAt:number;
}

export interface CognitiveIntegritySignal {
  reliability01:number;
  suspicion01:number;
  flags:string[];
}

export interface ReplayLearningEvent {
  id:string;
  tick:number;
  at:number;
  memoryId:string;
  goalIds:string[];
  identityWeight01:number;
  socialWeight01:number;
  priorityBefore01:number;
  priorityAfter01:number;
  stability01:number;
  learningOpportunity01:number;
  stateGrounded:boolean;
  source:'experience-replay';
}

export interface ReplayValidation {
  id:string;
  memoryId:string;
  at:number;
  delayMs:number;
  retentionScore01:number;
  baselineScore01:number;
  retentionGain01:number;
  transferPotential01:number;
  interferenceRisk01:number;
  independentVerified:boolean;
  evidenceKey:string;
  taskId?:string;
  contextKey?:string;
  replayEventId?:string;
  policyDecisionId?:string;
}

export interface MemorySkillEvidence {
  id:string;
  memoryId:string;
  skillId:string;
  variantId?:string;
  confidence01:number;
  independentVerified:boolean;
  evidenceKey:string;
  at:number;
}

export interface ReplayExperimentProtocol {
  id:string;
  taskId:string;
  sourceTaskId?:string;
  targetTaskId?:string;
  randomized:boolean;
  balanced:boolean;
  requiredPairs:number;
  contextKeys:string[];
  generatedAt:number;
}

export interface ReplayExperimentTrial {
  id:string;
  experimentId:string;
  taskId:string;
  mode:'replay-on'|'replay-off';
  preScore01:number;
  postScore01:number;
  delta01:number;
  independentVerified:boolean;
  randomized:boolean;
  contextKey:string;
  pairKey?:string;
  at:number;
}

export type ReplayExperimentPhase='acquisition'|'delay'|'test'|'holdout';

export interface LongitudinalReplayTrial {
  id:string;
  experimentId:string;
  taskId:string;
  phase:ReplayExperimentPhase;
  mode:'replay-on'|'replay-off';
  contextKey:string;
  pairKey?:string;
  delayMs:number;
  baselineScore01:number;
  score01:number;
  independentVerified:boolean;
  at:number;
}

export interface LongitudinalReplaySummary {
  experimentId:string;
  taskId:string;
  totalTrials:number;
  verifiedTrials:number;
  distinctDelays:number;
  matchedPairs:number;
  pairedComparable:boolean;
  meanRetentionOn01:number;
  meanRetentionOff01:number;
  conditionDifference01:number|null;
  holdoutTrials:number;
  evidenceGrade:'confirmatory-eligible'|'exploratory-matched'|'insufficient';
}

export interface ExperienceContinuumState {
  version:7;
  cycles:number;
  observations:number;
  hotCount:number;
  warmCount:number;
  coldCount:number;
  graphNodes:ExperienceGraphNode[];
  graphEdges:ExperienceGraphEdge[];
  clusters:ExperienceCluster[];
  identityGravity:IdentityGravityState;
  identityGravityHistory:Array<{tick:number;at:number;memoryId?:string;pressure01:number;resistance01:number;tension01:number;proposedChangeMagnitude01:number;evidenceSupport01:number}>;
  integrity:{observed:number; flagged:number; quarantined:number; meanReliability01:number; lastFlags:string[]};
  compression:{runs:number; compressedNodes:number; lastAt:number};
  replay:{runs:number; selected:number; reactivated:number; validated:number; lastAt:number; events:ReplayLearningEvent[]; validations:ReplayValidation[]; experiments:ReplayExperimentTrial[]; protocols:ReplayExperimentProtocol[]; longitudinal:LongitudinalReplayTrial[]};
  retention:{observations:number;validated:number;meanRetention01:number;meanDelayDays:number;curve:{base01:number;slope01:number;fit01:number;distinctDelays:number};lastAt:number};
  memorySkillBindings:MemorySkillEvidence[];
  adaptiveReplayGovernor:AdaptiveReplayGovernorState;
  causalReplayCredit:CausalReplayCreditState;
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clean=(x:unknown,n=140)=>String(x??'').trim().replace(/\s+/g,' ').slice(0,n);
const uniq=(xs:string[],limit:number)=>[...new Set(xs.map(x=>clean(x,32)).filter(Boolean))].slice(0,limit);
const tokenise=(text:string)=>text.toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]{3,}/gu)??[];
const topKeywords=(text:string)=>uniq(tokenise(text).filter(x=>x.length>=4),8);
const stable=(x:string)=>{let h=2166136261>>>0;for(const c of x){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return (h>>>0).toString(16).padStart(8,'0');};

export const defaultExperienceContinuum=():ExperienceContinuumState=>({
  version:7,cycles:0,observations:0,hotCount:0,warmCount:0,coldCount:0,
  graphNodes:[],graphEdges:[],clusters:[],
  identityGravity:{pressure01:0,resistance01:.58,tension01:0,proposedChangeMagnitude01:0,evidenceSupport01:0,lastAt:0},
  identityGravityHistory:[],
  integrity:{observed:0,flagged:0,quarantined:0,meanReliability01:1,lastFlags:[]},
  compression:{runs:0,compressedNodes:0,lastAt:0},
  replay:{runs:0,selected:0,reactivated:0,validated:0,lastAt:0,events:[],validations:[],experiments:[],protocols:[],longitudinal:[]},
  retention:{observations:0,validated:0,meanRetention01:0,meanDelayDays:0,curve:{base01:0,slope01:0,fit01:0,distinctDelays:0},lastAt:0},
  memorySkillBindings:[],
  adaptiveReplayGovernor:defaultAdaptiveReplayGovernorState(),
  causalReplayCredit:defaultCausalReplayCreditState()
});

/**
 * Derived experience layer: it does not replace MemoryOS2 and never deletes canonical memories.
 * It builds a bounded graph, assigns logical hot/warm/cold tiers, and stores compact cold summaries.
 */
export class ExperienceContinuumFabric {
  readonly systemName='memory:experience-continuum' as const;
  private state=defaultExperienceContinuum();
  private readonly maxNodes:number;
  private readonly maxEdges:number;
  private readonly maxClusters:number;
  private readonly nodeIndex=new Map<string,ExperienceGraphNode>();
  private readonly edgeIndex=new Map<string,ExperienceGraphEdge>();
  private readonly clusterIndex=new Map<string,ExperienceCluster>();
  private readonly replayGovernor=new AdaptiveReplayGovernor();
  private readonly causalReplayCredit=new CausalReplayCreditAssigner();

  constructor(options:{maxNodes?:number;maxEdges?:number;maxClusters?:number}={}){
    this.maxNodes=Math.max(128,Math.min(768,Math.floor(options.maxNodes??384)));
    this.maxEdges=Math.max(256,Math.min(2048,Math.floor(options.maxEdges??1024)));
    this.maxClusters=Math.max(32,Math.min(256,Math.floor(options.maxClusters??96)));
  }

  restore(raw?:Partial<ExperienceContinuumState>|null){
    const d=defaultExperienceContinuum(); const r=raw??{};
    this.state={...d,...r,
      graphNodes:Array.isArray(r.graphNodes)?r.graphNodes.slice(-this.maxNodes).map((n:any)=>({...n,replayCount:Math.max(0,Number(n?.replayCount??0)),activeGoalIds:Array.isArray(n?.activeGoalIds)?n.activeGoalIds.slice(0,4).map(String):[]})):[],
      graphEdges:Array.isArray(r.graphEdges)?r.graphEdges.slice(-this.maxEdges):[],
      clusters:Array.isArray(r.clusters)?r.clusters.slice(-this.maxClusters):[],
      identityGravity:{...d.identityGravity,...(r.identityGravity??{})},
      integrity:{...d.integrity,...(r.integrity??{}),lastFlags:Array.isArray(r.integrity?.lastFlags)?r.integrity!.lastFlags.slice(0,12):[]},
      identityGravityHistory:Array.isArray(r.identityGravityHistory)?r.identityGravityHistory.slice(-32):[],
      compression:{...d.compression,...(r.compression??{})},
      replay:{...d.replay,...(r.replay??{}),events:Array.isArray(r.replay?.events)?r.replay!.events.slice(-128):[],validations:Array.isArray(r.replay?.validations)?r.replay!.validations.slice(-96):[],experiments:Array.isArray(r.replay?.experiments)?r.replay!.experiments.slice(-128):[],protocols:Array.isArray((r.replay as any)?.protocols)?(r.replay as any).protocols.slice(-24):[],longitudinal:Array.isArray((r.replay as any)?.longitudinal)?(r.replay as any).longitudinal.slice(-192):[]},
      retention:{...d.retention,...(r.retention??{}),curve:{...d.retention.curve,...(r.retention?.curve??{})}},
      memorySkillBindings:Array.isArray((r as any).memorySkillBindings)?(r as any).memorySkillBindings.slice(-96):[],
      adaptiveReplayGovernor:{...defaultAdaptiveReplayGovernorState(),...((r as any).adaptiveReplayGovernor??{})},
      causalReplayCredit:{...defaultCausalReplayCreditState(),...((r as any).causalReplayCredit??{})}
    };
    this.replayGovernor.restore(this.state.adaptiveReplayGovernor);
    this.causalReplayCredit.restore(this.state.causalReplayCredit);
    this.rebuildIndexes();
    this.recountTiers();
  }

  snapshot(options:{clone?:boolean}={}){ this.state.adaptiveReplayGovernor=this.replayGovernor.snapshot(); this.state.causalReplayCredit=this.causalReplayCredit.snapshot(); return options.clone===false ? this.state : structuredClone(this.state); }

  observe(memory:MemoryItem2,input:{tick:number;at?:number;novelty01?:number;identityContinuity01?:number;valueStability01?:number;activeGoalIds?:string[];evidenceSupport01?:number}){
    const at=Number.isFinite(input.at)?Number(input.at):Date.now();
    const novelty=clamp(input.novelty01??memory.predictionError);
    const identityImpact=clamp(memory.identityRelevance*(.62+novelty*.18)+memory.salience*.2);
    const futureRelevance=clamp(memory.goalRelevance*.45+memory.predictionError*.3+identityImpact*.25);
    const emotional=clamp(memory.emotionalWeight);
    const social=clamp(memory.socialRelevance);
    const significance=clamp(memory.salience*.28+identityImpact*.24+futureRelevance*.16+novelty*.12+memory.confidence*.10+emotional*.06+social*.04);
    const tier=this.classifyTier(memory,significance,at);
    const node:ExperienceGraphNode={
      id:`experience:${memory.id}`,memoryId:memory.id,tier,kind:memory.kind,source:clean(memory.source,40),
      representative:clean(memory.content,120),keywords:topKeywords(memory.content),createdAt:memory.createdAt,lastSeenAt:at,retrievalCount:memory.retrievalCount,
      significance01:significance,identityImpact01:identityImpact,futureRelevance01:futureRelevance,novelty01:novelty,
      emotionalImpact01:emotional,predictionImpact01:clamp(memory.predictionError),socialImpact01:social,
      stability01:clamp(.35+memory.confidence*.3+Math.min(1,memory.retrievalCount/8)*.25+identityImpact*.1),
      replayPriority01:clamp(.28+significance*.32+memory.predictionError*.2+futureRelevance*.14+identityImpact*.1),
      lastReplayedAt:0,
      replayCount:0,
      activeGoalIds: (input.activeGoalIds??[]).slice(0,4).map(x=>clean(x,64))
    };
    const existing=this.nodeIndex.get(memory.id);
    if(existing){ node.lastReplayedAt=existing.lastReplayedAt??0; node.activeGoalIds=[...(input.activeGoalIds??existing.activeGoalIds??[])].slice(0,4).map(x=>clean(x,64)); }
    if(existing) { node.lastReplayedAt=existing.lastReplayedAt??0; node.replayCount=existing.replayCount??0; Object.assign(existing,node); } else { this.state.graphNodes.push(node); this.nodeIndex.set(memory.id,node); if(this.state.graphNodes.length>this.maxNodes){ this.state.graphNodes=this.state.graphNodes.slice(-this.maxNodes); this.rebuildNodeIndex(); } }
    const links=[...(memory.semanticLinks??[]).map(to=>({to,type:'semantic' as const,weight:.58})),...(memory.temporalLinks??[]).map(to=>({to,type:'temporal' as const,weight:.48})),...(memory.causalLinks??[]).map(to=>({to,type:'causal' as const,weight:.72}))];
    for(const link of links) this.upsertEdge(node.id,`experience:${link.to}`,link.type,link.weight,at);
    const goals=input.activeGoalIds??[];
    for(const goal of goals.slice(0,4)) this.upsertEdge(node.id,`goal:${clean(goal,64)}`,'goal',clamp(.42+futureRelevance*.4),at);
    if(identityImpact>=.62) this.upsertEdge(node.id,'self:identity','identity',identityImpact,at);
    if(this.state.graphEdges.length>this.maxEdges){ this.state.graphEdges=this.state.graphEdges.slice(-this.maxEdges); this.rebuildEdgeIndex(); }

    const integrity=this.integrityFor(memory);
    this.state.integrity.observed++;
    this.state.integrity.meanReliability01=clamp(this.state.integrity.meanReliability01*.97+integrity.reliability01*.03);
    if(integrity.flags.length){
      this.state.integrity.flagged++;
      this.state.integrity.lastFlags=integrity.flags.slice(0,12);
      if(memory.epistemicStatus==='quarantined')this.state.integrity.quarantined++;
    }
    this.state.observations++;
    this.recountTiers();
    this.evaluateIdentityGravity({significance01:significance,identityImpact01:identityImpact,identityContinuity01:input.identityContinuity01??.8,valueStability01:input.valueStability01??.8,evidenceSupport01:input.evidenceSupport01??memory.confidence,at,tick:input.tick,memoryId:memory.id});
    return {node:structuredClone(node),integrity:structuredClone(integrity),identityGravity:structuredClone(this.state.identityGravity)};
  }

  tick(input:{tick:number;at?:number;pressure01?:number;identityContinuity01?:number;valueStability01?:number;evidenceSupport01?:number;activeGoalIds?:string[]}={tick:0}){
    const at=Number.isFinite(input.at)?Number(input.at):Date.now();
    const pressure=clamp(input.pressure01??0);
    for(const node of this.state.graphNodes){
      const age=Math.max(0,at-Math.max(node.lastSeenAt,node.lastReplayedAt??0));
      const significance=clamp(node.significance01*(.92+node.retrievalCount*.004));
      const ageDays=age/86400000;
      node.stability01=clamp(node.stability01*.97+Math.min(1,node.retrievalCount/8)*.02);
      node.replayPriority01=clamp(.30+significance*.30+node.predictionImpact01*.20+node.futureRelevance01*.12+node.identityImpact01*.08+Math.min(1,ageDays/7)*.04);
      node.significance01=significance;
      if(age<2*60*60*1000||node.retrievalCount>=3||significance>=.78||node.identityImpact01>=.76) node.tier='hot';
      else if(age<7*24*60*60*1000||significance>=.46||node.futureRelevance01>=.58) node.tier='warm';
      else node.tier='cold';
    }
    this.recountTiers();
    this.state.cycles++;
    if(input.tick>0 && (input.tick%8===0 || pressure>.88)) this.replayForConsolidation(pressure,at,input.activeGoalIds??[],input.tick);
    if(input.tick>0 && (input.tick%32===0 || pressure>.8)) this.consolidateCold(pressure,at);
    return this.summary();
  }

  relevanceBoost(memoryId:string,query:string){
    const node=this.nodeIndex.get(memoryId); if(!node)return 0;
    const q=new Set(topKeywords(query)); const overlap=node.keywords.filter(k=>q.has(k)).length/Math.max(1,Math.max(node.keywords.length,q.size));
    const tierBoost=node.tier==='hot'?.05:node.tier==='warm'?.025:0;
    return clampSigned01(overlap*.09+tierBoost+node.futureRelevance01*.03);
  }

  coldSearch(query:string,limit=6){
    const q=new Set(topKeywords(query));
    return this.state.clusters.map(c=>({cluster:c,score:c.keywords.filter(k=>q.has(k)).length/Math.max(1,Math.max(c.keywords.length,q.size)) + c.meanSignificance01*.15 + c.meanIdentityImpact01*.08}))
      .sort((a,b)=>b.score-a.score).slice(0,Math.max(1,Math.min(16,Math.floor(limit)))).map(x=>structuredClone(x.cluster));
  }

  recordLongitudinalReplayTrial(input:{experimentId:string;taskId:string;phase:ReplayExperimentPhase;mode:'replay-on'|'replay-off';contextKey:string;pairKey?:string;delayMs:number;baselineScore01:number;score01:number;independentVerified?:boolean;at?:number}){
    const row:LongitudinalReplayTrial={id:`lrt:${clean(input.experimentId,48)}:${clean(input.taskId,48)}:${input.phase}:${input.at??Date.now()}:${this.state.replay.longitudinal.length}`,experimentId:clean(input.experimentId,64),taskId:clean(input.taskId,96),phase:input.phase,mode:input.mode,contextKey:clean(input.contextKey,64),pairKey:input.pairKey?clean(input.pairKey,64):undefined,delayMs:Math.max(0,Number(input.delayMs)||0),baselineScore01:clamp(input.baselineScore01),score01:clamp(input.score01),independentVerified:Boolean(input.independentVerified),at:input.at??Date.now()};
    const duplicate=this.state.replay.longitudinal.some(x=>x.experimentId===row.experimentId&&x.taskId===row.taskId&&x.phase===row.phase&&x.mode===row.mode&&x.contextKey===row.contextKey&&x.pairKey===row.pairKey&&x.delayMs===row.delayMs);
    if(!duplicate){this.state.replay.longitudinal.push(row);if(this.state.replay.longitudinal.length>192)this.state.replay.longitudinal=this.state.replay.longitudinal.slice(-192);}
    return structuredClone(duplicate?this.state.replay.longitudinal.find(x=>x.experimentId===row.experimentId&&x.taskId===row.taskId&&x.phase===row.phase&&x.mode===row.mode&&x.contextKey===row.contextKey&&x.pairKey===row.pairKey&&x.delayMs===row.delayMs)!:row);
  }

  longitudinalReplaySummary(experimentId:string,taskId:string):LongitudinalReplaySummary{
    const rows=this.state.replay.longitudinal.filter(x=>x.experimentId===experimentId&&x.taskId===taskId&&x.independentVerified);
    const delays=new Set(rows.map(x=>Math.round(x.delayMs/86400000)));
    const on=rows.filter(x=>x.mode==='replay-on'),off=rows.filter(x=>x.mode==='replay-off');
    const pairs=new Map<string,{on?:LongitudinalReplayTrial;off?:LongitudinalReplayTrial}>();
    for(const x of rows){if(!x.pairKey)continue;const key=`${x.pairKey}|${x.contextKey}|${Math.round(x.delayMs/86400000)}`;const pair=pairs.get(key)??{};pair[x.mode==='replay-on'?'on':'off']=x;pairs.set(key,pair);}
    const matched=[...pairs.values()].filter(x=>x.on&&x.off) as Array<{on:LongitudinalReplayTrial;off:LongitudinalReplayTrial}>;
    const mean=(xs:LongitudinalReplayTrial[])=>xs.length?xs.reduce((a,x)=>a+x.score01,0)/xs.length:0;
    const diff=matched.length?matched.reduce((a,p)=>a+(p.on.score01-p.off.score01),0)/matched.length:null;
    const holdout=rows.filter(x=>x.phase==='holdout').length;
    const comparable=matched.length>=2;
    const protocol=this.state.replay.protocols.find(p=>p.id===experimentId&&p.taskId===taskId);
    const eligible=Boolean(protocol?.randomized&&protocol?.balanced&&comparable&&matched.length>=Math.max(2,protocol.requiredPairs)&&holdout>=2&&delays.size>=2);
    return {experimentId,taskId,totalTrials:this.state.replay.longitudinal.filter(x=>x.experimentId===experimentId&&x.taskId===taskId).length,verifiedTrials:rows.length,distinctDelays:delays.size,matchedPairs:matched.length,pairedComparable:comparable,meanRetentionOn01:mean(on),meanRetentionOff01:mean(off),conditionDifference01:diff,holdoutTrials:holdout,evidenceGrade:eligible?'confirmatory-eligible':comparable?'exploratory-matched':'insufficient'};
  }

    summary(){return {version:7,cycles:this.state.cycles,observations:this.state.observations,hotCount:this.state.hotCount,warmCount:this.state.warmCount,coldCount:this.state.coldCount,graphNodes:this.state.graphNodes.length,graphEdges:this.state.graphEdges.length,clusters:this.state.clusters.length,identityGravity:this.state.identityGravity,identityGravityHistory:this.state.identityGravityHistory.slice(-8),integrity:this.state.integrity,compression:this.state.compression,replay:this.state.replay,retention:this.state.retention,memorySkillBindings:this.state.memorySkillBindings.length,adaptiveReplayGovernor:this.replayGovernor.diagnostics(),causalReplayCredit:this.causalReplayCredit.diagnostics()};}

  private evaluateIdentityGravity(input:{significance01:number;identityImpact01:number;identityContinuity01:number;valueStability01:number;evidenceSupport01:number;at:number;tick:number;memoryId?:string}){
    const pressure=clamp(input.significance01*.55+input.identityImpact01*.45);
    const resistance=clamp(.38+input.identityContinuity01*.32+input.valueStability01*.18+input.evidenceSupport01*.12);
    const tension=clamp(pressure*(1-resistance));
    const proposal=clamp(tension*(1-clamp(input.evidenceSupport01)*.45));
    this.state.identityGravity={pressure01:clamp(this.state.identityGravity.pressure01*.88+pressure*.12),resistance01:resistance,tension01:clamp(this.state.identityGravity.tension01*.86+tension*.14),proposedChangeMagnitude01:clamp(this.state.identityGravity.proposedChangeMagnitude01*.84+proposal*.16),evidenceSupport01:clamp(this.state.identityGravity.evidenceSupport01*.9+clamp(input.evidenceSupport01)*.1),lastAt:input.at};
    this.state.identityGravityHistory.push({tick:input.tick,at:input.at,memoryId:input.memoryId,pressure01:this.state.identityGravity.pressure01,resistance01:resistance,tension01:this.state.identityGravity.tension01,proposedChangeMagnitude01:this.state.identityGravity.proposedChangeMagnitude01,evidenceSupport01:this.state.identityGravity.evidenceSupport01});
    if(this.state.identityGravityHistory.length>32)this.state.identityGravityHistory=this.state.identityGravityHistory.slice(-32);
  }

  replayCandidates(limit=8,activeGoalIds:string[]=[]){
    const goals=new Set(activeGoalIds.slice(0,8).map(x=>clean(x,64)));
    const validationsByMemory=new Map<string,ReplayValidation[]>();
    for(const v of this.state.replay.validations){if(!v.independentVerified)continue;const arr=validationsByMemory.get(v.memoryId)??[];arr.push(v);validationsByMemory.set(v.memoryId,arr.slice(-4));}
    const bindingsByMemory=new Map<string,MemorySkillEvidence[]>();
    for(const b of this.state.memorySkillBindings){const arr=bindingsByMemory.get(b.memoryId)??[];arr.push(b);bindingsByMemory.set(b.memoryId,arr.slice(-3));}
    const scored=this.state.graphNodes.map(n=>{
      const goalBoost=(n.activeGoalIds??[]).some(g=>goals.has(g))?.10:0;
      const validation=validationsByMemory.get(n.memoryId)??[];
      const retention=validation.length?validation.reduce((s,v)=>s+v.retentionScore01,0)/validation.length:0;
      const interference=validation.length?validation.reduce((s,v)=>s+v.interferenceRisk01,0)/validation.length:0;
      const skillBoost=(bindingsByMemory.get(n.memoryId)??[]).some(b=>b.independentVerified)?0.06:0;
      const score=clamp(.68*n.replayPriority01+.14*retention+.08*goalBoost+.06*n.socialImpact01+.04*skillBoost-.08*interference);
      return {n,score};
    });
    return scored.sort((a,b)=>b.score-a.score).slice(0,Math.max(1,Math.min(32,Math.floor(limit)))).map(x=>structuredClone(x.n));
  }

  reactivate(memoryId:string,at=Date.now()){
    const node=this.nodeIndex.get(String(memoryId)); if(!node)return null;
    const before=node.replayPriority01;
    node.lastReplayedAt=at; node.tier='hot';
    node.replayPriority01=clamp(node.replayPriority01*.82+.18);
    this.recountTiers();
    this.state.replay.reactivated++; this.state.replay.lastAt=at;
    const event:ReplayLearningEvent={id:`replay:${memoryId}:${at}`,tick:0,at,memoryId,goalIds:[...(node.activeGoalIds??[])].slice(0,4),identityWeight01:node.identityImpact01,socialWeight01:node.socialImpact01,priorityBefore01:before,priorityAfter01:node.replayPriority01,stability01:node.stability01,learningOpportunity01:clamp(.38*node.replayPriority01+.22*node.novelty01+.18*node.futureRelevance01+.12*node.identityImpact01+.10*node.socialImpact01),stateGrounded:false,source:'experience-replay'};
    this.appendReplayEvent(event);
    this.markClusterReplay(node.memoryId,at);
    return structuredClone(node);
  }

  recordReplayValidation(input:{memoryId:string;retentionScore01:number;baselineScore01?:number;delayMs?:number;transferPotential01?:number;interferenceRisk01?:number;/** Deprecated; a caller boolean is not proof. */ independentVerified?:boolean;verification?:OutcomeVerification;evidenceKey:string;taskId?:string;contextKey?:string;replayEventId?:string;policyDecisionId?:string;at?:number}){
    const at=input.at??Date.now();
    const delayMs=Math.max(0,Number(input.delayMs??0));
    const retentionScore01=clamp(input.retentionScore01);
    const baselineScore01=clamp(input.baselineScore01??retentionScore01);
    let validation:ReplayValidation={id:`rv:${input.memoryId}:${at}`,memoryId:String(input.memoryId),at,delayMs,retentionScore01,baselineScore01,retentionGain01:clamp(retentionScore01-baselineScore01),transferPotential01:clamp(input.transferPotential01??0),interferenceRisk01:clamp(input.interferenceRisk01??0),independentVerified:isTrustedExternalPostconditionVerification(input.verification,{memoryId:String(input.memoryId),evidenceKey:clean(input.evidenceKey,96),taskId:input.taskId?clean(input.taskId,96):undefined,contextKey:input.contextKey?clean(input.contextKey,96):undefined,delayMs,retentionScore01,baselineScore01,transferPotential01:clamp(input.transferPotential01??0),interferenceRisk01:clamp(input.interferenceRisk01??0)}),evidenceKey:clean(input.evidenceKey,96),taskId:input.taskId?clean(input.taskId,96):undefined,contextKey:input.contextKey?clean(input.contextKey,96):undefined,replayEventId:input.replayEventId?clean(input.replayEventId,96):undefined,policyDecisionId:input.policyDecisionId?clean(input.policyDecisionId,128):undefined};
    const duplicateIndex=this.state.replay.validations.findIndex(v=>v.evidenceKey===validation.evidenceKey && v.memoryId===validation.memoryId && v.taskId===validation.taskId && v.contextKey===validation.contextKey && v.delayMs===validation.delayMs);
    let verificationTransition:'unverified'|'newly-verified'|'promoted'|'duplicate'=validation.independentVerified?'newly-verified':'unverified';
    if(duplicateIndex>=0){
      const prior=this.state.replay.validations[duplicateIndex]!;
      if(prior.independentVerified) return structuredClone({...prior,verificationTransition:'duplicate' as const});
      if(!validation.independentVerified) return structuredClone({...prior,verificationTransition:'unverified' as const});
      validation={...validation,id:prior.id};
      verificationTransition='promoted';
    }
    const replayEvent=this.state.replay.events.find(e=>e.id===validation.replayEventId) ?? this.state.replay.events.slice().reverse().find(e=>e.memoryId===validation.memoryId && e.at<=validation.at);
    if(replayEvent){
      const credit=this.causalReplayCredit.assign({
        memoryId:validation.memoryId,replayEventId:replayEvent.id,validationId:validation.id,replayAt:replayEvent.at,validationAt:validation.at,
        delayMs:validation.delayMs,retentionGain01:validation.retentionGain01,transferPotential01:validation.transferPotential01,
        interferenceRisk01:validation.interferenceRisk01,learningOpportunity01:replayEvent.learningOpportunity01,priorityAfter01:replayEvent.priorityAfter01,
        independentVerified:validation.independentVerified
      });
      const node=this.nodeIndex.get(validation.memoryId);
      if(node && validation.independentVerified) node.replayPriority01=clamp(node.replayPriority01*.88+credit.credit01*.12);
    }
    if(duplicateIndex>=0) this.state.replay.validations[duplicateIndex]=validation;
    else this.state.replay.validations.push(validation);
    if(this.state.replay.validations.length>96)this.state.replay.validations=this.state.replay.validations.slice(-96);
    this.state.retention.observations++;
    if(validation.independentVerified){
      this.state.replay.validated++;
    this.replayGovernor.feedback({memoryId:validation.memoryId,retentionGain01:validation.retentionGain01,transferPotential01:validation.transferPotential01,interferenceRisk01:validation.interferenceRisk01,independentVerified:validation.independentVerified,delayMs:validation.delayMs});
    this.state.adaptiveReplayGovernor=this.replayGovernor.snapshot();
      this.state.retention.validated++;
      this.state.retention.meanRetention01=clamp(this.state.retention.meanRetention01*.9+retentionScore01*.1);
      this.state.retention.meanDelayDays=validation.delayMs>0?this.state.retention.meanDelayDays*.9+(validation.delayMs/86400000)*.1:this.state.retention.meanDelayDays;
      this.state.retention.lastAt=at;
      const node=this.nodeIndex.get(validation.memoryId); if(node){ node.stability01=clamp(node.stability01*.9+retentionScore01*.1); }
      this.recomputeRetentionCurve();
    }
    return structuredClone({...validation,verificationTransition});
  }

  retentionSummary(){return structuredClone(this.state.retention);}
  memorySkillEvidence(memoryId?:string,skillId?:string){
    return this.state.memorySkillBindings.filter(x=>(!memoryId||x.memoryId===memoryId)&&(!skillId||x.skillId===skillId)).slice(-24).map(x=>structuredClone(x));
  }

  causalReplayCreditLedger(limit=32){
    const rows=this.causalReplayCredit.snapshot().recent.slice(-Math.max(1,Math.min(128,Math.floor(limit))));
    return structuredClone(rows);
  }

  replayEvidenceLedger(limit=32){
    const validations=this.state.replay.validations.filter(v=>v.independentVerified).slice(-Math.max(1,Math.min(128,Math.floor(limit))));
    const eventsById=new Map(this.state.replay.events.map(e=>[e.id,e]));
    return validations.map(v=>({validationId:v.id,memoryId:v.memoryId,evidenceKey:v.evidenceKey,delayMs:v.delayMs,retentionScore01:v.retentionScore01,retentionGain01:v.retentionGain01,transferPotential01:v.transferPotential01,interferenceRisk01:v.interferenceRisk01,replayEventId:v.replayEventId??null,replayMatched:Boolean(v.replayEventId&&eventsById.has(v.replayEventId))}));
  }


  bindMemoryToSkill(input:{memoryId:string;skillId:string;variantId?:string;confidence01:number;independentVerified?:boolean;evidenceKey:string;at?:number}){
    const row:MemorySkillEvidence={id:`mse:${input.memoryId}:${input.skillId}:${input.at??Date.now()}`,memoryId:String(input.memoryId).slice(0,120),skillId:String(input.skillId).slice(0,120),variantId:input.variantId?String(input.variantId).slice(0,120):undefined,confidence01:clamp(input.confidence01),independentVerified:Boolean(input.independentVerified),evidenceKey:clean(input.evidenceKey,96),at:input.at??Date.now()};
    this.state.memorySkillBindings.push(row); if(this.state.memorySkillBindings.length>96)this.state.memorySkillBindings=this.state.memorySkillBindings.slice(-96); return structuredClone(row);
  }

  private recomputeRetentionCurve(){
    const rows=this.state.replay.validations.filter(v=>v.independentVerified && v.delayMs>0);
    const bins=new Map<number,{n:number;sum:number}>();
    for(const v of rows){const day=Math.max(1,Math.round(v.delayMs/86400000));const b=bins.get(day)??{n:0,sum:0};b.n++;b.sum+=v.retentionScore01;bins.set(day,b);}
    const points=[...bins.entries()].map(([day,b])=>({x:Math.log(day),y:b.sum/b.n,n:b.n})).sort((a,b)=>a.x-b.x);
    if(points.length<3){this.state.retention.curve={base01:this.state.retention.meanRetention01,slope01:0,fit01:0,distinctDelays:points.length};return;}
    const x0=points.reduce((s,p)=>s+p.x,0)/points.length; const y0=points.reduce((s,p)=>s+p.y,0)/points.length;
    let num=0,den=0,ss=0; for(const p of points){num+=(p.x-x0)*(p.y-y0);den+=(p.x-x0)**2;ss+=(p.y-y0)**2;}
    const slope=den?num/den:0; const intercept=y0-slope*x0;
    let resid=0;for(const p of points){const e=p.y-(intercept+slope*p.x);resid+=e*e;}
    const fit=ss?clamp(1-resid/ss):0;
    this.state.retention.curve={base01:clamp(intercept),slope01:Math.max(-1,Math.min(1,slope)),fit01:fit,distinctDelays:points.length};
  }

  createReplayExperimentProtocol(input:{id:string;taskId:string;sourceTaskId?:string;targetTaskId?:string;randomized?:boolean;balanced?:boolean;requiredPairs?:number;contextKeys:string[];at?:number}){
    const protocol:ReplayExperimentProtocol={id:clean(input.id,64),taskId:clean(input.taskId,96),sourceTaskId:input.sourceTaskId?clean(input.sourceTaskId,96):undefined,targetTaskId:input.targetTaskId?clean(input.targetTaskId,96):undefined,randomized:Boolean(input.randomized),balanced:Boolean(input.balanced),requiredPairs:Math.max(2,Math.min(32,Math.floor(input.requiredPairs??4))),contextKeys:[...new Set(input.contextKeys.map(x=>clean(x,64)).filter(Boolean))].slice(0,64),generatedAt:input.at??Date.now()};
    this.state.replay.protocols.push(protocol); if(this.state.replay.protocols.length>24)this.state.replay.protocols=this.state.replay.protocols.slice(-24);
    return structuredClone(protocol);
  }

  replayExperimentProtocolCheck(experimentId:string,taskId?:string){
    const protocol=this.state.replay.protocols.find(p=>p.id===experimentId && (!taskId || p.taskId===taskId));
    const rows=this.state.replay.experiments.filter(x=>x.experimentId===experimentId&&(!taskId||x.taskId===taskId)&&x.independentVerified);
    const on=rows.filter(x=>x.mode==='replay-on'),off=rows.filter(x=>x.mode==='replay-off');
    const declaredContexts=new Set(protocol?.contextKeys??[]);
    const undeclaredContextKeys=[...new Set(rows.map(x=>x.contextKey).filter(key=>!declaredContexts.has(key)))].sort();
    const countsByContext=new Map<string,{on:number;off:number}>();
    for(const row of rows){
      const counts=countsByContext.get(row.contextKey)??{on:0,off:0};
      counts[row.mode==='replay-on'?'on':'off']++;
      countsByContext.set(row.contextKey,counts);
    }
    const balanced=rows.length>0 && on.length===off.length &&
      [...countsByContext.values()].every(counts=>counts.on===counts.off);
    const randomized=rows.length>0 && rows.every(x=>x.randomized);
    const summary=this.replayExperimentSummary(experimentId,taskId);
    const matched=summary.matchedPairs;
    const duplicatePairCells=summary.duplicatePairCells;
    const required=protocol?.requiredPairs??2;
    const hasUndeclaredContexts=Boolean(protocol&&undeclaredContextKeys.length>0);
    const hasDuplicatePairCells=duplicatePairCells>0;
    const eligible=Boolean(protocol&&protocol.randomized&&protocol.balanced&&randomized&&balanced&&
      !hasUndeclaredContexts&&!hasDuplicatePairCells&&matched>=required);
    const reason=!protocol?'missing-protocol':!protocol.randomized?'protocol-not-randomized':
      !protocol.balanced?'protocol-not-balanced':hasUndeclaredContexts?'undeclared-context-key':
      !randomized?'trials-not-randomized':!balanced?'trial-count/context-imbalance':
      hasDuplicatePairCells?'duplicate-pair-cell':matched<required?'insufficient-matched-pairs':'eligible';
    return {experimentId,taskId:taskId??null,protocolDefined:Boolean(protocol),randomized,balanced,
      undeclaredContextKeys,duplicatePairCells,matchedPairs:matched,requiredPairs:required,
      eligibleForConfirmatoryInference:eligible,reason};
  }

  recordReplayExperimentTrial(input:{experimentId:string;taskId:string;mode:'replay-on'|'replay-off';preScore01:number;postScore01:number;independentVerified:boolean;randomized?:boolean;contextKey:string;pairKey?:string;at?:number}){
    const trial:ReplayExperimentTrial={id:`rx:${input.experimentId}:${input.taskId}:${Date.now()}`,experimentId:clean(input.experimentId,64),taskId:clean(input.taskId,96),mode:input.mode,preScore01:clamp(input.preScore01),postScore01:clamp(input.postScore01),delta01:clamp(input.postScore01)-clamp(input.preScore01),independentVerified:Boolean(input.independentVerified),randomized:Boolean(input.randomized),contextKey:clean(input.contextKey,96),pairKey:input.pairKey?clean(input.pairKey,96):undefined,at:input.at??Date.now()};
    this.state.replay.experiments.push(trial); if(this.state.replay.experiments.length>128)this.state.replay.experiments=this.state.replay.experiments.slice(-128);
    return this.replayExperimentSummary(trial.experimentId,trial.taskId);
  }

  replayExperimentSummary(experimentId:string,taskId?:string){
    const rows=this.state.replay.experiments.filter(x=>x.experimentId===experimentId&&(!taskId||x.taskId===taskId)&&x.independentVerified);
    const on=rows.filter(x=>x.mode==='replay-on'),off=rows.filter(x=>x.mode==='replay-off');
    const mean=(xs:ReplayExperimentTrial[])=>xs.length?xs.reduce((s,x)=>s+x.delta01,0)/xs.length:0;
    type PairCell={on?:ReplayExperimentTrial;off?:ReplayExperimentTrial;duplicateOn:boolean;duplicateOff:boolean};
    const pairs=new Map<string,PairCell>();
    for(const row of rows){
      if(!row.pairKey)continue;
      const key=`${row.pairKey}|${row.taskId}|${row.contextKey}`;
      const pair=pairs.get(key)??{duplicateOn:false,duplicateOff:false};
      const side=row.mode==='replay-on'?'on':'off';
      if(pair[side]) {
        if(side==='on')pair.duplicateOn=true; else pair.duplicateOff=true;
      } else {
        pair[side]=row;
      }
      pairs.set(key,pair);
    }
    const pairCells=[...pairs.values()];
    const duplicatePairCells=pairCells.filter(p=>p.duplicateOn||p.duplicateOff).length;
    // Duplicate measurements for a pair/condition are ambiguous; never let the
    // last-arriving row overwrite earlier evidence and silently choose a winner.
    const matched=pairCells.filter(p=>p.on&&p.off&&!p.duplicateOn&&!p.duplicateOff) as Array<{on:ReplayExperimentTrial;off:ReplayExperimentTrial}>;
    const pairedDeltas=matched.map(p=>p.on.delta01-p.off.delta01);
    const pairedMean=pairedDeltas.length?pairedDeltas.reduce((a,b)=>a+b,0)/pairedDeltas.length:null;
    const randomizedMatched=matched.length>0&&matched.every(p=>p.on.randomized&&p.off.randomized);
    return {experimentId,taskId:taskId??null,replayOnSamples:on.length,replayOffSamples:off.length,
      replayOnMeanDelta01:mean(on),replayOffMeanDelta01:mean(off),matchedPairs:matched.length,
      duplicatePairCells,pairedComparable:matched.length>=2,
      estimatedConditionDifference01:matched.length>=2?pairedMean:null,
      evidenceGrade:matched.length>=2?(randomizedMatched?'randomized-matched-observational':'matched-observational'):'insufficient'};
  }

  private appendReplayEvent(event:ReplayLearningEvent){
    this.state.replay.events.push(event); if(this.state.replay.events.length>128)this.state.replay.events=this.state.replay.events.slice(-128);
  }

  private replayForConsolidation(pressure01:number,at:number,activeGoalIds:string[]=[],tick=0){
    const replayCandidates=this.state.graphNodes.map(n=>({
      id:n.memoryId,kind:n.kind,ageMs:Math.max(0,at-n.lastSeenAt),lastReplayedAt:n.lastReplayedAt??0,
      replayCount:n.replayCount??0,surprise01:clamp(n.predictionImpact01),decayNeed01:clamp(1-n.stability01),
      transferPotential01:clamp(n.futureRelevance01),identity01:clamp(n.identityImpact01),goal01:clamp((n.activeGoalIds??[]).some(g=>activeGoalIds.includes(g))?.86:n.futureRelevance01*.75),
      novelty01:clamp(n.novelty01),stability01:clamp(n.stability01),interference01:clamp(1-n.stability01),
      activeGoalMatch:(n.activeGoalIds??[]).some(g=>activeGoalIds.includes(g)),clusterKey:`${n.kind}|${n.keywords[0]??'general'}`
    }));
    const mobile=this.maxNodes<=384;
    const plan=this.replayGovernor.plan({tick,at,pressure01,energy01:clamp(1-pressure01*.7),memoryPressure01:clamp(pressure01),mobile,activeGoalIds,nodes:replayCandidates});
    const selectedIds=new Set(plan.candidates.map(x=>x.id));
    this.state.replay.runs++; this.state.replay.selected+=plan.candidates.length;
    for(const row of plan.candidates){
      const node=this.nodeIndex.get(row.id); if(!node || !selectedIds.has(node.memoryId)) continue;
      const age=Math.max(0,at-node.lastSeenAt);
      const before=node.replayPriority01;
      node.lastReplayedAt=at; node.replayCount=(node.replayCount??0)+1; node.tier='hot';
      node.replayPriority01=clamp(node.replayPriority01*.82+.18*clamp(row.learningOpportunity01*.72+row.retentionPotential01*.28));
      this.appendReplayEvent({id:`replay:${node.memoryId}:${at}`,tick,at,memoryId:node.memoryId,goalIds:(activeGoalIds.length?activeGoalIds:node.activeGoalIds??[]).slice(0,4).map(x=>clean(x,64)),identityWeight01:node.identityImpact01,socialWeight01:node.socialImpact01,priorityBefore01:before,priorityAfter01:node.replayPriority01,stability01:node.stability01,learningOpportunity01:row.learningOpportunity01,stateGrounded:false,source:'experience-replay'});
      if(age>6*60*60*1000)this.markClusterReplay(node.memoryId,at);
    }
    this.recountTiers(); this.state.replay.lastAt=at;
  }

  private markClusterReplay(memoryId:string,at:number){
    for(const cluster of this.state.clusters){if(cluster.representativeMemoryIds.includes(memoryId)){cluster.replayCount=(cluster.replayCount??0)+1;cluster.lastReplayAt=Math.max(cluster.lastReplayAt??0,at);}}
  }

  private consolidateCold(pressure01:number,at:number){
    const cold=this.state.graphNodes.filter(n=>n.tier==='cold' && n.significance01<.70).sort((a,b)=>b.significance01-a.significance01);
    if(cold.length<4 && pressure01<.6)return;
    const groups=new Map<string,ExperienceGraphNode[]>();
    for(const n of cold){
      const key=`${n.kind}|${n.keywords[0]??'general'}|${n.source||'unknown'}`;
      const arr=groups.get(key)??[]; arr.push(n); groups.set(key,arr);
      if(groups.size>=this.maxClusters*2)break;
    }
    let compressed=0;
    for(const [key,rows] of groups){
      if(rows.length<3)continue;
      const ids=rows.slice(0,8).map(x=>x.memoryId);
      const keywords=uniq(rows.flatMap(x=>x.keywords),10);
      const mean=(field:keyof ExperienceGraphNode)=>rows.reduce((s,x)=>s+Number(x[field]),0)/rows.length;
      const existing=this.clusterIndex.get(key);
      const cluster:ExperienceCluster={
        id:existing?.id??`cluster:${stable(key)}`,key,count:(existing?.count??0)+rows.length,
        representativeMemoryIds:ids,keywords,meanSignificance01:clamp(mean('significance01')),
        meanIdentityImpact01:clamp(mean('identityImpact01')),meanPredictionImpact01:clamp(mean('predictionImpact01')),
        firstAt:Math.min(...rows.map(x=>x.createdAt)),lastAt:Math.max(...rows.map(x=>x.lastSeenAt)),confidence01:clamp(.42+Math.min(rows.length,16)*.025),
        compressedSummary:`${rows.length} experiences · ${key} · sig=${mean('significance01').toFixed(2)} · identity=${mean('identityImpact01').toFixed(2)} · prediction=${mean('predictionImpact01').toFixed(2)} · refs=${ids.join(',')}`,
        updates:(existing?.updates??0)+1,replayCount:(existing?.replayCount??0)+rows.filter(r=>this.state.replay.events.some(e=>e.memoryId===r.memoryId)).length,lastReplayAt:Math.max(existing?.lastReplayAt??0,...rows.map(r=>r.lastReplayedAt??0),0)
      };
      if(existing){Object.assign(existing,cluster);}else{this.state.clusters.push(cluster);this.clusterIndex.set(key,cluster);}
      compressed+=rows.length;
    }
    if(this.state.clusters.length>this.maxClusters){this.state.clusters=this.state.clusters.slice(-this.maxClusters);this.rebuildClusterIndex();}
    this.state.compression.runs++;this.state.compression.compressedNodes+=compressed;this.state.compression.lastAt=at;
  }

  private upsertEdge(from:string,to:string,type:ExperienceEdgeType,weight01:number,at:number){
    const key=`${from}|${to}|${type}`;
    const existing=this.edgeIndex.get(key);
    if(existing){ existing.weight01=clamp(weight01); existing.lastAt=at; return; }
    const edge={from,to,type,weight01:clamp(weight01),lastAt:at};
    this.state.graphEdges.push(edge); this.edgeIndex.set(key,edge);
  }

  private classifyTier(memory:MemoryItem2,significance:number,at:number):MemoryTier{
    const age=Math.max(0,at-memory.lastAccessAt);
    if(age<2*60*60*1000||memory.retrievalCount>=3||significance>=.78||memory.identityRelevance>=.76)return 'hot';
    if(age<7*24*60*60*1000||significance>=.46||memory.goalRelevance>=.58)return 'warm';
    return 'cold';
  }

  private integrityFor(memory:MemoryItem2):CognitiveIntegritySignal{
    const flags:string[]=[];
    if(memory.epistemicStatus==='quarantined')flags.push('quarantined');
    if(memory.identityRelevance>=.75&&memory.confidence<.45)flags.push('identity-critical-low-confidence');
    if(memory.source==='unknown'||memory.source==='')flags.push('unknown-source');
    const contradictionRisk=memory.epistemicStatus==='hypothesis'&&memory.identityRelevance>=.8&&memory.confidence<.55?.12:0;
    flags.push(...(contradictionRisk>.1?['high-identity-hypothesis-risk']:[]));
    const suspicion=clamp(flags.length*.18+contradictionRisk);
    return {reliability01:clamp(memory.confidence*(1-suspicion)),suspicion01:suspicion,flags};
  }

  private rebuildNodeIndex(){this.nodeIndex.clear();for(const n of this.state.graphNodes)this.nodeIndex.set(n.memoryId,n);}
  private rebuildEdgeIndex(){this.edgeIndex.clear();for(const e of this.state.graphEdges)this.edgeIndex.set(`${e.from}|${e.to}|${e.type}`,e);}
  private rebuildClusterIndex(){this.clusterIndex.clear();for(const c of this.state.clusters)this.clusterIndex.set(c.key,c);}
  private rebuildIndexes(){this.rebuildNodeIndex();this.rebuildEdgeIndex();this.rebuildClusterIndex();}

  private recountTiers(){let hot=0,warm=0,cold=0;for(const n of this.state.graphNodes){if(n.tier==='hot')hot++;else if(n.tier==='warm')warm++;else cold++;}this.state.hotCount=hot;this.state.warmCount=warm;this.state.coldCount=cold;}
}

function clampSigned01(x:number){return clamp(x);}
