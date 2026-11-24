import { createHash, randomUUID } from 'node:crypto';
import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const MODES=['fast','normal','deep','research'] as const;
type Mode=typeof MODES[number];
type ClaimKind='identity'|'trait'|'habit'|'preference'|'value'|'belief'|'uncertainty'|'commitment';
type MemoryKind='event'|'experience'|'observation'|'fact'|'belief'|'skill'|'commitment'|'identity';

const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:.5;
const clean=(x:unknown,n=128)=>String(x??'').replace(/\s+/g,' ').trim().slice(0,n);
const uniq=(xs:unknown[],n=32)=>[...new Set(xs.map(x=>clean(x,96)).filter(Boolean))].slice(-n);
const v48=(x:number[]|undefined)=>Array.from({length:48},(_,i)=>clamp(x?.[i%(x?.length||1)]??.5));
const dist=(a:number[],b:number[])=>mean(Array.from({length:Math.min(a.length,b.length)},(_,i)=>Math.abs((a[i]??.5)-(b[i]??.5))));
const stable=(x:unknown):string=>JSON.stringify(x,(k,val)=>Array.isArray(val)?val:val&&typeof val==='object'?Object.keys(val).sort().reduce((o,key)=>{o[key]=val[key];return o;},{} as any):val);
const hash=(x:unknown)=>createHash('sha256').update(stable(x)).digest('hex');
const zero=()=>Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;

export interface LifeContinuityReceipt {
  id:string; seq:number; tick:number; sessionId:string; subjectId:string; parentStateHash:string; stateHash:string;
  eventHash:string; causeIds:string[]; goalIds:string[]; memoryIds:string[]; skillIds:string[]; policyAction:ActionKind;
  neuralContribution01:number; worldEvidence01:number; confidence01:number; reason:string;
}
export interface ContinuitySegment {
  index:number; firstSeq:number; lastSeq:number; firstHash:string; lastHash:string; lastStateHash:string; parentRoot:string; rootHash:string; commits:number; sealedAt:number;
}
export interface BehaviorContract {
  activeGoalIds:string[]; intentionIds:string[]; activeProjectId:string; preferenceKeys:string[]; valueKeys:string[]; skillIds:string[]; identityFingerprint:string;
}
export interface SelfClaim {
  id:string; kind:ClaimKind; subject:string; value:string; confidence01:number; provenance:string[]; firstTick:number; lastTick:number; status:'active'|'superseded'|'uncertain';
}
export interface MemoryEntry {
  id:string; kind:MemoryKind; tick:number; action:ActionKind; reward01:number; confidence01:number; provenance:string[]; validFrom:number; validTo:number|null; importance01:number; embedding:number[];
}
export interface SkillNode {
  id:string; name:string; mastery01:number; stability01:number; interference01:number; uses:number; prereqIds:string[]; lastTick:number;
}
export interface ResearchQuestion {id:string; domain:string; uncertainty01:number; informationGain01:number; cost01:number; attempts:number; status:'open'|'validated'|'rejected'; lastTick:number;}

export interface B1701B2200State {
  version:1; enabled:boolean; subjectId:string; birthAt:number; branchId:string; sessionId:string; sessionEpoch:number;
  tick:number; headSeq:number; headStateHash:string; headReceiptHash:string; headTick:number; headAt:number;
  segmentSize:number; hotWindowSize:number; segments:ContinuitySegment[]; hotReceipts:LifeContinuityReceipt[];
  continuity01:number; behaviorContinuity01:number; causalContinuity01:number; identityContinuity01:number; migrationContinuity01:number;
  behaviorContract:BehaviorContract; lastContractHash:string; lastAcceptedContractHash:string;
  selfClaims:SelfClaim[]; memory:MemoryEntry[]; skills:SkillNode[]; research:ResearchQuestion[];
  neuralVector:number[]; neuralAnchor:number[]; neuralEligibility:number[]; neuralAssembly:number[]; neuralReadoutWeights:number[]; neuralCausal01:number;
  worldDelta:number[]; worldUncertainty01:number; worldCalibration01:number;
  curriculumPressure01:number; researchPressure01:number; homeostaticPressure01:number; sleepPressure01:number;
  campaign:{step:number;cycles:number;restarts:number;longHorizonChecks:number;transferEvents:number;rehabEvents:number;forgetEvents:number;researchEvents:number;selfChanges:number};
  stats:{decisions:number;updates:number;commits:number;segmentsSealed:number;resumes:number;rejectedReceipts:number;chainChecks:number;tamperRejects:number;behaviorChecks:number;behaviorBreaks:number;memoryWrites:number;memoryReads:number;memoryConflicts:number;memoryConsolidations:number;skillUpdates:number;researchSelections:number;researchValidated:number;researchRejected:number;curriculumSelections:number;neuralUpdates:number;neuralLesionChecks:number;neuralRehab:number;worldUpdates:number;migrations:number;lastLatencyMs:number;last:{mode:Mode;continuity:number;behavior:number;causal:number;neural:number;world:number;research:number;curriculum:number;homeostasis:number}};
  lesions:Record<string,boolean>;
}

const lesionNames=['continuity','behavior-contract','memory-fabric','neural-causal','world-model','researcher','curriculum','homeostasis'];

export const defaultB1701B2200State=():B1701B2200State=>({
  version:1,enabled:true,subjectId:randomUUID(),birthAt:Date.now(),branchId:randomUUID(),sessionId:'',sessionEpoch:0,tick:0,
  headSeq:0,headStateHash:'',headReceiptHash:'',headTick:0,headAt:0,segmentSize:128,hotWindowSize:256,segments:[],hotReceipts:[],
  continuity01:1,behaviorContinuity01:1,causalContinuity01:1,identityContinuity01:1,migrationContinuity01:1,
  behaviorContract:{activeGoalIds:[],intentionIds:[],activeProjectId:'',preferenceKeys:[],valueKeys:[],skillIds:[],identityFingerprint:''},lastContractHash:'',lastAcceptedContractHash:'',
  selfClaims:[],memory:[],skills:[],research:[],neuralVector:Array.from({length:512},(_,i)=>Math.sin(i*.031)*.035),neuralAnchor:Array.from({length:512},(_,i)=>Math.sin(i*.031)*.035),neuralEligibility:Array(512).fill(0),neuralAssembly:Array.from({length:48},(_,i)=>i),neuralReadoutWeights:Array.from({length:224},(_,i)=>(((i*37)%17)-8)/80),neuralCausal01:.5,
  worldDelta:Array(48).fill(0),worldUncertainty01:.5,worldCalibration01:.5,curriculumPressure01:.2,researchPressure01:.2,homeostaticPressure01:.2,sleepPressure01:0,
  campaign:{step:0,cycles:0,restarts:0,longHorizonChecks:0,transferEvents:0,rehabEvents:0,forgetEvents:0,researchEvents:0,selfChanges:0},
  stats:{decisions:0,updates:0,commits:0,segmentsSealed:0,resumes:0,rejectedReceipts:0,chainChecks:0,tamperRejects:0,behaviorChecks:0,behaviorBreaks:0,memoryWrites:0,memoryReads:0,memoryConflicts:0,memoryConsolidations:0,skillUpdates:0,researchSelections:0,researchValidated:0,researchRejected:0,curriculumSelections:0,neuralUpdates:0,neuralLesionChecks:0,neuralRehab:0,worldUpdates:0,migrations:0,lastLatencyMs:0,last:{mode:'fast',continuity:1,behavior:1,causal:.5,neural:.5,world:.5,research:.2,curriculum:.2,homeostasis:.2}},
  lesions:Object.fromEntries(lesionNames.map(k=>[k,false])),
});

export interface B1701Input {
  tick:number; at?:number; context01:number[]; baseUtilities:Record<ActionKind,number>; priorBias?:Record<ActionKind,number>; uncertainty01:number; predictionError01:number; novelty01:number; confidence01:number; energy01:number; cognitiveLoad01:number; identityContinuity01:number; subjectId:string; identityFingerprint:string; activeGoalIds?:string[]; intentionIds?:string[]; activeProjectId?:string; preferenceKeys?:string[]; valueKeys?:string[]; p84MomentId?:string; memoryAnchorIds?:string[]; reward01?:number|null;
}
export interface B1701Output {actionBias:Record<ActionKind,number>; predictiveBias:Record<ActionKind,number>; confidence01:number; mode:Mode; continuity01:number; behaviorContinuity01:number; causalContinuity01:number; neuralCausal01:number; worldModel01:number; researchPressure01:number; curriculumPressure01:number; homeostaticPressure01:number; sleepPressure01:number; selectedResearchId:string|null; selectedCurriculumSkillId:string|null; stateHash:string; headSeq:number;}

export class B1701B2200UnifiedLifeContinuityCore {
  readonly systemName='system:b1701-b2200-unified-life-continuity' as const;
  private state=B1701B2200UnifiedLifeContinuityCore.defaultState();
  private readonly maxMemory=1024;
  private readonly maxClaims=96;
  private readonly maxSkills=256;
  private readonly maxQuestions=96;
  private lastInput:B1701Input|null=null;

  static defaultState(){return defaultB1701B2200State();}
  snapshot(){return structuredClone(this.state);}
  diagnostics(){return structuredClone(this.state.stats);}
  restore(raw?:Partial<B1701B2200State>|null){
    const d=defaultB1701B2200State(),s:any=raw??{};
    this.state={...d,...structuredClone(s),tick:Math.max(0,Math.floor(Number(s.tick??0))),campaign:{...d.campaign,...(s.campaign??{})},stats:{...d.stats,...(s.stats??{}),last:{...d.stats.last,...(s.stats?.last??{})}},lesions:{...d.lesions,...(s.lesions??{})},
      behaviorContract:{...d.behaviorContract,...(s.behaviorContract??{})},segments:Array.isArray(s.segments)?s.segments.slice(-512):[],hotReceipts:Array.isArray(s.hotReceipts)?s.hotReceipts.slice(-d.hotWindowSize):[],selfClaims:Array.isArray(s.selfClaims)?s.selfClaims.slice(-this.maxClaims):[],memory:Array.isArray(s.memory)?s.memory.slice(-this.maxMemory):[],skills:Array.isArray(s.skills)?s.skills.slice(-this.maxSkills):[],research:Array.isArray(s.research)?s.research.slice(-this.maxQuestions):[],
      neuralVector:Array.isArray(s.neuralVector)?s.neuralVector.slice(0,512):d.neuralVector,neuralAnchor:Array.isArray(s.neuralAnchor)?s.neuralAnchor.slice(0,512):d.neuralAnchor,neuralEligibility:Array.isArray(s.neuralEligibility)?s.neuralEligibility.slice(0,512):d.neuralEligibility,neuralAssembly:Array.isArray(s.neuralAssembly)?s.neuralAssembly.slice(0,48):d.neuralAssembly,neuralReadoutWeights:Array.isArray(s.neuralReadoutWeights)?s.neuralReadoutWeights.slice(0,224):d.neuralReadoutWeights,worldDelta:Array.isArray(s.worldDelta)?s.worldDelta.slice(0,48):d.worldDelta};
  }

  beginSession(subjectId:string, currentStateHash:string, tick:number, now=Date.now()){const s=this.state;if(s.subjectId!==subjectId && s.headSeq>0){return {verified:false,error:'subject-mismatch',sessionId:s.sessionId};}
    s.subjectId=subjectId;s.sessionId=randomUUID();s.sessionEpoch++;s.campaign.restarts+=s.sessionEpoch>1?1:0;s.stats.resumes++;s.identityContinuity01=clamp(.96*s.identityContinuity01+.04);const expected=s.headStateHash;s.continuity01=clamp(expected&&expected!==currentStateHash?s.continuity01*.5+0*.5:s.continuity01*.99+.01);return {verified:!expected||expected===currentStateHash,sessionId:s.sessionId,predecessorHash:s.headReceiptHash,headSeq:s.headSeq};}

  private contract(i:B1701Input):BehaviorContract{return {activeGoalIds:uniq(i.activeGoalIds??[]),intentionIds:uniq(i.intentionIds??[]),activeProjectId:clean(i.activeProjectId??'',96),preferenceKeys:uniq(i.preferenceKeys??[]),valueKeys:uniq(i.valueKeys??[]),skillIds:this.state.skills.filter(s=>s.mastery01>.45).slice(-16).map(s=>s.id),identityFingerprint:clean(i.identityFingerprint,128)};}
  private contractHash(c:BehaviorContract){return hash(c);}
  private stateHash(i:B1701Input,c:BehaviorContract){return hash({subjectId:this.state.subjectId,schema:1,tick:i.tick,lastAction:'pending',contract:c,neuralAnchor:this.state.neuralVector.slice(0,32),worldDelta:this.state.worldDelta.slice(0,16),continuity:this.state.continuity01});}

  private learnMemory(i:B1701Input,action:ActionKind,reward:number,importance:number){if(this.state.lesions['memory-fabric'])return;
    const id=hash({subject:this.state.subjectId,tick:i.tick,action,kind:'experience'}).slice(0,20);const row:MemoryEntry={id,kind:reward>.62?'experience':'event',tick:i.tick,action,reward01:reward,confidence01:clamp(.45+.35*(1-i.predictionError01)),provenance:uniq([`tick:${i.tick}`,i.p84MomentId??'',...(i.memoryAnchorIds??[])]),validFrom:i.tick,validTo:null,importance01:clamp(importance),embedding:v48(i.context01)};this.state.memory=[...this.state.memory.filter(m=>m.id!==id),row].slice(-this.maxMemory);this.state.stats.memoryWrites++;}
  private memoryScore(ctx:number[],action:ActionKind){if(this.state.lesions['memory-fabric'])return .5;const rows=this.state.memory.filter(m=>m.action===action).slice(-64);this.state.stats.memoryReads++;if(!rows.length)return .5;const vals=rows.map(m=>.55*m.reward01+.25*m.confidence01+.20*(1-dist(ctx,m.embedding)));return clamp(mean(vals));}
  private reconcileClaims(i:B1701Input){const claimRows:Array<[ClaimKind,string,string]>=[];for(const g of i.activeGoalIds??[])claimRows.push(['commitment','goal',g]);for(const v of i.valueKeys??[])claimRows.push(['value','value',v]);for(const p of i.preferenceKeys??[])claimRows.push(['preference','preference',p]);for(const [kind,subject,value] of claimRows){const existing=this.state.selfClaims.find(c=>c.kind===kind&&c.subject===subject&&c.value===value);if(existing){existing.lastTick=i.tick;existing.confidence01=clamp(existing.confidence01*.96+.04*.8);continue;}this.state.selfClaims.push({id:randomUUID(),kind,subject,value,confidence01:.62,provenance:[`tick:${i.tick}`],firstTick:i.tick,lastTick:i.tick,status:'active'});}this.state.selfClaims=this.state.selfClaims.slice(-this.maxClaims);}
  private skillFor(action:ActionKind){let s=this.state.skills.find(x=>x.name===`skill:${action}`);if(!s){s={id:randomUUID().slice(0,14),name:`skill:${action}`,mastery01:.15,stability01:.45,interference01:0,uses:0,prereqIds:[],lastTick:this.state.headTick};this.state.skills.push(s);}return s;}
  private updateSkills(action:ActionKind,reward:number,error:number,tick:number){const s=this.skillFor(action);const lr=.018/(1+s.uses*.001);s.mastery01=clamp(s.mastery01*(1-lr)+(reward*(.65)+(1-error)*.35)*lr);s.stability01=clamp(.97*s.stability01+.03*(1-error));s.interference01=clamp(.97*s.interference01+.03*Math.abs(reward-.5));s.uses++;s.lastTick=tick;this.state.stats.skillUpdates++;return s;}
  private researchSelect(i:B1701Input){
    if(this.state.lesions['researcher'])return null;
    const domains=[
      ['world-model',i.predictionError01],['self-model',1-i.identityContinuity01],
      ['memory',Math.max(i.uncertainty01,.5*(1-i.confidence01))],
      ['skill-transfer',Math.max(this.state.curriculumPressure01,i.novelty01)],
      ['continuity',Math.max(0,1-this.state.behaviorContinuity01)],
    ] as Array<[string,number]>;
    for(const [domain,u] of domains){
      const existing=this.state.research.find(r=>r.domain===domain&&r.status==='open');
      if(existing){existing.uncertainty01=clamp(.95*existing.uncertainty01+.05*u);continue;}
      const candidate:ResearchQuestion={id:randomUUID().slice(0,16),domain,uncertainty01:clamp(u),informationGain01:clamp(.25+.65*u),cost01:.12+.18*u,attempts:0,status:'open',lastTick:i.tick};
      this.state.research.push(candidate);
    }
    const open=this.state.research.filter(r=>r.status==='open').sort((a,b)=>(b.informationGain01/b.cost01)-(a.informationGain01/a.cost01));
    const q=open[0];
    if(q){q.attempts++;q.lastTick=i.tick;this.state.stats.researchSelections++;this.state.campaign.researchEvents++;}
    this.state.researchPressure01=clamp(.92*this.state.researchPressure01+.08*mean(domains.map(x=>x[1])));
    return q?.id??null;
  }
  private curriculumSelect(){if(this.state.lesions['curriculum'])return null;const s=this.state.skills.slice().sort((a,b)=>(a.mastery01+a.stability01*.35-a.interference01*.4)-(b.mastery01+b.stability01*.35-b.interference01*.4))[0];if(s){this.state.stats.curriculumSelections++;}this.state.curriculumPressure01=clamp(.94*this.state.curriculumPressure01+.06*(s?1-s.mastery01:.2));return s?.id??null;}
  private neural(ctx:number[],action:ActionKind,error:number,reward:number){
    if(this.state.lesions['neural-causal'])return .5;
    const seed=ACTIONS.indexOf(action)+1;
    let active=0;
    const drive=clamp(.2+.55*error+.35*Math.abs(reward-.5));
    for(let j=0;j<32;j++){
      const idx=(seed*73+j*17)%512;
      const z=Math.tanh((ctx[j%48]-.5)*1.7+this.state.neuralVector[idx]);
      this.state.neuralEligibility[idx]=clamp(.985*this.state.neuralEligibility[idx]+.015*Math.abs(z));
      const lr=.0009*(.4+.6*this.state.neuralEligibility[idx])*drive;
      const before=this.state.neuralVector[idx];
      this.state.neuralVector[idx]=clamp(before*(1-lr)+z*lr,-1,1);
      const wIdx=Math.max(0,ACTIONS.indexOf(action))*32+(j%32);
      const advantage=reward-.5;
      this.state.neuralReadoutWeights[wIdx]=clamp((this.state.neuralReadoutWeights[wIdx]??0)+advantage*(ctx[j%48]-.5)*.004,-.25,.25);
      active+=Math.abs(this.state.neuralVector[idx]-this.state.neuralAnchor[idx]);
    }
    this.state.stats.neuralUpdates++;
    this.state.neuralCausal01=clamp(.96*this.state.neuralCausal01+.04*(1-Math.min(1,active/32)));
    return this.state.neuralCausal01;
  }
  private neuralReadout(action:ActionKind,ctx:number[]){if(this.state.lesions['neural-causal'])return 0;const ai=Math.max(0,ACTIONS.indexOf(action));let s=0;for(let j=0;j<24;j++){const idx=(ai*32+j*13+7)%512;const w=this.state.neuralReadoutWeights[ai*32+(j%32)]??0;const dir=ai%2===0?1:-1;s+=Math.abs(this.state.neuralVector[idx])*(.55+Math.abs(w))*(.35+.65*Math.abs(ctx[j%48]-.5))*dir;}return Math.tanh(s*2.4)*.18;}
  private world(i:B1701Input){if(this.state.lesions['world-model'])return {bias:zero(),quality:.5};const ctx=v48(i.context01);let q=.5;const b=zero();for(const a of ACTIONS){const rows=this.state.memory.filter(m=>m.action===a).slice(-32);const empirical=rows.length?mean(rows.map(m=>m.reward01)):.5;const similarity=rows.length?mean(rows.map(m=>1-dist(ctx,m.embedding))):.5;q=.92*q+.08*clamp(.55*empirical+.45*similarity);b[a]=clamp((empirical-.5)*.025+(similarity-.5)*.012,-.04,.04);}this.state.worldUncertainty01=clamp(.96*this.state.worldUncertainty01+.04*(1-q));this.state.worldCalibration01=clamp(.97*this.state.worldCalibration01+.03*q);this.state.stats.worldUpdates++;return {bias:b,quality:q};}
  private homeostasis(i:B1701Input){if(this.state.lesions['homeostasis'])return .5;const pressure=clamp(.36*(1-i.energy01)+.22*i.cognitiveLoad01+.20*i.uncertainty01+.12*i.predictionError01+.10*i.novelty01);this.state.homeostaticPressure01=clamp(.94*this.state.homeostaticPressure01+.06*pressure);this.state.sleepPressure01=clamp(.93*this.state.sleepPressure01+.07*(i.cognitiveLoad01*.55+(1-i.energy01)*.45));return this.state.homeostaticPressure01;}
  beforeDecision(i:B1701Input):B1701Output{
    const t=performance.now();this.lastInput=i;const s=this.state;s.tick=i.tick;s.campaign.step=Math.max(s.campaign.step,i.tick);s.campaign.cycles++;s.stats.decisions++;this.reconcileClaims(i);
    const c=this.contract(i);s.behaviorContract=c;s.lastContractHash=this.contractHash(c);const world=this.world(i);const qid=this.researchSelect(i);const sid=this.curriculumSelect();const h=this.homeostasis(i);const mem=Object.fromEntries(ACTIONS.map(a=>[a,this.memoryScore(i.context01,a)])) as Record<ActionKind,number>;
    const complexity=clamp((i.uncertainty01+i.predictionError01+i.novelty01+i.cognitiveLoad01+h)/5);const mode:Mode=complexity>.82?'research':complexity>.62?'deep':complexity>.34?'normal':'fast';const actionBias=zero(),predictiveBias=zero();
    for(const a of ACTIONS){const neural=this.neuralReadout(a,v48(i.context01));const exploration=(a==='explore'?i.novelty01*.018:0)+(a==='verify'?i.uncertainty01*.014:0);const skill=this.skillFor(a);const skillBias=(skill.mastery01-.5)*.025;const worldBias=world.bias[a];const memoryBias=(mem[a]-.5)*.04;actionBias[a]=clamp((i.priorBias?.[a]??0)*.52+worldBias+memoryBias+neural+exploration+skillBias+(h>.67&&a==='rest'?.028:0),-.15,.15);predictiveBias[a]=clamp(worldBias*.8+memoryBias*.45+neural*.3,-.08,.08);}
    const continuity=clamp(.55*s.continuity01+.20*i.identityContinuity01+.15*s.causalContinuity01+.10*s.migrationContinuity01);const behavior=clamp(.55*s.behaviorContinuity01+.25*(s.lastAcceptedContractHash===s.lastContractHash?1:.62)+.20*i.identityContinuity01);const research=clamp(s.researchPressure01);const curriculum=clamp(s.curriculumPressure01);const confidence=clamp(.42*i.confidence01+.18*world.quality+.12*(1-i.uncertainty01)+.10*continuity+.10*behavior+.08*(1-s.worldUncertainty01));
    s.stats.lastLatencyMs=performance.now()-t;s.stats.last={mode,continuity,behavior,causal:s.causalContinuity01,neural:s.neuralCausal01,world:world.quality,research,curriculum,homeostasis:h};
    return {actionBias,predictiveBias,confidence01:confidence,mode,continuity01:continuity,behaviorContinuity01:behavior,causalContinuity01:s.causalContinuity01,neuralCausal01:s.neuralCausal01,worldModel01:world.quality,researchPressure01:research,curriculumPressure01:curriculum,homeostaticPressure01:h,sleepPressure01:s.sleepPressure01,selectedResearchId:qid,selectedCurriculumSkillId:sid,stateHash:this.stateHash(i,c),headSeq:s.headSeq};
  }
  afterOutcome(i:{tick:number;at?:number;action:ActionKind;context01:number[];nextContext01:number[];reward01:number;predictionError01:number;success01:number;verified01:number;causeIds?:string[];goalIds?:string[];memoryIds?:string[]}):{receipt:LifeContinuityReceipt|null;behaviorContinuity01:number;neuralCausal01:number}{
    if(!this.state.enabled)return {receipt:null,behaviorContinuity01:this.state.behaviorContinuity01,neuralCausal01:this.state.neuralCausal01};
    const reward=clamp(i.reward01),error=clamp(i.predictionError01),ctx=v48(i.context01),s=this.state;const neural=this.neural(ctx,i.action,error,reward);const skill=this.updateSkills(i.action,reward,error,i.tick);this.learnMemory({...this.lastInput!,tick:i.tick,context01:ctx,reward01:reward},i.action,reward,clamp(.3*error+.25*Math.abs(reward-.5)+.25*(i.verified01)+.20*(skill.mastery01<.5?1:0)));
    const next=v48(i.nextContext01);for(let j=0;j<48;j++)s.worldDelta[j]=clamp(.97*s.worldDelta[j]+.03*(next[j]-ctx[j]),-1,1);const worldError=dist(next,ctx);s.worldUncertainty01=clamp(.97*s.worldUncertainty01+.03*worldError);s.worldCalibration01=clamp(.97*s.worldCalibration01+.03*(1-worldError));
    const contract=s.behaviorContract;const candidateHash=this.contractHash(contract);const unchanged=candidateHash===s.lastContractHash||!s.lastContractHash;const identitySafe01=(i.verified01>.45||reward>.58)?1:0;const behaviorStep=clamp(.55*(unchanged?1:.7)+.25*identitySafe01+.20*(1-error));s.behaviorContinuity01=clamp(.96*s.behaviorContinuity01+.04*behaviorStep);s.identityContinuity01=clamp(.98*s.identityContinuity01+.02*clamp(this.lastInput?.identityContinuity01??.5));
    const causalGain=clamp(.38*Math.abs(reward-.5)+.26*(1-error)+.18*i.verified01+.18*(s.memory.length?1:.5));s.causalContinuity01=clamp(.965*s.causalContinuity01+.035*causalGain);s.continuity01=clamp(.97*s.continuity01+.03*mean([s.identityContinuity01,s.behaviorContinuity01,s.causalContinuity01]));s.stats.updates++;s.campaign.transferEvents+=skill.mastery01>.72&&i.verified01>.6?1:0;
    const c=s.behaviorContract;const fullStateHash=hash({subjectId:s.subjectId,tick:i.tick,contract:c,world:s.worldDelta.slice(0,24),neural:s.neuralVector.slice(0,64),continuity:s.continuity01});
    const parent=s.headStateHash;const seq=s.headSeq+1;const receiptBase={id:randomUUID(),seq,tick:i.tick,sessionId:s.sessionId,subjectId:s.subjectId,parentStateHash:parent,stateHash:fullStateHash,causeIds:uniq(i.causeIds??[]),goalIds:uniq(i.goalIds??c.activeGoalIds),memoryIds:uniq(i.memoryIds??[]),skillIds:[skill.id],policyAction:i.action,neuralContribution01:neural,worldEvidence01:s.worldCalibration01,confidence01:clamp(.4*(1-error)+.3*i.verified01+.3*skill.stability01),reason:reward>.62?'reinforce':'adapt'};
    const receiptHash=hash(receiptBase);const receipt:LifeContinuityReceipt={...receiptBase,eventHash:receiptHash};s.hotReceipts=[...s.hotReceipts,receipt].slice(-s.hotWindowSize);s.headSeq=seq;s.headStateHash=fullStateHash;s.headReceiptHash=receiptHash;s.headTick=i.tick;s.headAt=i.at??Date.now();s.stats.commits++;
    if(seq%s.segmentSize===0){const first=s.hotReceipts[Math.max(0,s.hotReceipts.length-s.segmentSize)]??receipt;const parentRoot=s.segments.at(-1)?.rootHash??'';const segRoot=hash({index:Math.floor(seq/s.segmentSize),firstSeq:first.seq,lastSeq:receipt.seq,firstHash:first.eventHash,lastHash:receipt.eventHash,lastStateHash:receipt.stateHash,parentRoot,count:s.segmentSize,sealedAt:s.headAt});s.segments=[...s.segments,{index:Math.floor(seq/s.segmentSize),firstSeq:first.seq,lastSeq:receipt.seq,firstHash:first.eventHash,lastHash:receipt.eventHash,lastStateHash:receipt.stateHash,parentRoot,rootHash:segRoot,commits:s.segmentSize,sealedAt:s.headAt}].slice(-512);s.stats.segmentsSealed++;if(s.hotReceipts.length>s.hotWindowSize) s.hotReceipts=s.hotReceipts.slice(-s.hotWindowSize);}
    s.lastAcceptedContractHash=candidateHash;s.stats.last={...s.stats.last,continuity:s.continuity01,behavior:s.behaviorContinuity01,causal:s.causalContinuity01,neural:s.neuralCausal01,world:s.worldCalibration01};return {receipt,behaviorContinuity01:s.behaviorContinuity01,neuralCausal01:neural};
  }
  verify(){
    const s=this.state;let hot=true,monotonic=true;
    let seq=Math.max(0,s.headSeq-s.hotReceipts.length);
    const prevSegment=s.segments.find(g=>g.lastSeq===seq);
    let prevStateHash=prevSegment?.lastStateHash??'';
    for(const r of s.hotReceipts){
      if(r.parentStateHash!==prevStateHash&&prevStateHash!=='')hot=false;
      if(r.seq<=seq)monotonic=false;
      const base:any={id:r.id,seq:r.seq,tick:r.tick,sessionId:r.sessionId,subjectId:r.subjectId,parentStateHash:r.parentStateHash,stateHash:r.stateHash,causeIds:r.causeIds,goalIds:r.goalIds,memoryIds:r.memoryIds,skillIds:r.skillIds,policyAction:r.policyAction,neuralContribution01:r.neuralContribution01,worldEvidence01:r.worldEvidence01,confidence01:r.confidence01,reason:r.reason};
      if(hash(base)!==r.eventHash)hot=false;
      prevStateHash=r.stateHash;seq=r.seq;
    }
    let segments=true;let prevRoot='';let prevSeq=0;for(const g of s.segments){const expected=hash({index:g.index,firstSeq:g.firstSeq,lastSeq:g.lastSeq,firstHash:g.firstHash,lastHash:g.lastHash,lastStateHash:g.lastStateHash,parentRoot:g.parentRoot,count:g.commits,sealedAt:g.sealedAt});if(expected!==g.rootHash||g.parentRoot!==prevRoot||g.firstSeq<=prevSeq)segments=false;prevRoot=g.rootHash;prevSeq=g.lastSeq;}
    const lastSegmentSeq=s.segments.length?s.segments.at(-1)!.lastSeq:0;const tailOk=!s.hotReceipts.length||s.hotReceipts.at(-1)!.eventHash===s.headReceiptHash;const headOk=!s.headSeq||(tailOk&&s.headSeq>=lastSegmentSeq); s.stats.chainChecks++;if(!hot||!segments||!headOk){s.stats.tamperRejects++;}
    const ok=hot&&segments&&Boolean(headOk);return {verified:ok,hotChain:hot,segments,headOk,headSeq:s.headSeq,segmentsCount:s.segments.length};
  }
  commitCheckpoint(reason='durable-checkpoint'){const v=this.verify();return {accepted:v.verified,headSeq:this.state.headSeq,headStateHash:this.state.headStateHash,headReceiptHash:this.state.headReceiptHash,reason};}
  exportTransferEnvelope(runtime='termux'):Record<string,unknown>{this.state.stats.migrations++;return {protocol:'B1701-RUNTIME-INDEPENDENT-CONTINUITY',version:1,subjectId:this.state.subjectId,branchId:this.state.branchId,headSeq:this.state.headSeq,headStateHash:this.state.headStateHash,headReceiptHash:this.state.headReceiptHash,segments:this.state.segments.slice(-32),behaviorContract:this.state.behaviorContract,selfClaims:this.state.selfClaims.slice(-32),skills:this.state.skills.slice(-64),runtime};}
  importTransferEnvelope(env:any){if(!env||env.protocol!=='B1701-RUNTIME-INDEPENDENT-CONTINUITY')return {accepted:false,error:'protocol'};if(env.subjectId!==this.state.subjectId&&this.state.headSeq>0)return {accepted:false,error:'subject'};if(Number(env.headSeq??0)<this.state.headSeq)return {accepted:false,error:'rollback'};this.state.headSeq=Number(env.headSeq??this.state.headSeq);this.state.headStateHash=clean(env.headStateHash,128);this.state.headReceiptHash=clean(env.headReceiptHash,128);this.state.segments=Array.isArray(env.segments)?env.segments.slice(-512):this.state.segments;this.state.stats.migrations++;this.state.migrationContinuity01=clamp(.98*this.state.migrationContinuity01+.02);return {accepted:true,headSeq:this.state.headSeq};}
  setLesions(v:Record<string,boolean>){this.state.lesions={...this.state.lesions,...v};this.state.stats.neuralLesionChecks++;}
  evaluateLesion(input:B1701Input,lesion:Record<string,boolean>){const saved=this.snapshot();const on=this.beforeDecision(input);this.restore(saved);this.setLesions(lesion);const off=this.beforeDecision(input);this.restore(saved);const effect=mean(ACTIONS.map(a=>Math.abs(on.actionBias[a]-off.actionBias[a])));return {effect01:effect,confidenceDelta01:on.confidence01-off.confidence01,behaviorDelta01:on.behaviorContinuity01-off.behaviorContinuity01};}
  diagnosticsExtended(){return {headSeq:this.state.headSeq,segments:this.state.segments.length,hotReceipts:this.state.hotReceipts.length,continuity01:this.state.continuity01,behaviorContinuity01:this.state.behaviorContinuity01,causalContinuity01:this.state.causalContinuity01,neuralCausal01:this.state.neuralCausal01,worldCalibration01:this.state.worldCalibration01,homeostaticPressure01:this.state.homeostaticPressure01,researchPressure01:this.state.researchPressure01,curriculumPressure01:this.state.curriculumPressure01,migrationContinuity01:this.state.migrationContinuity01,behaviorContractHash:this.state.lastAcceptedContractHash};}
}
