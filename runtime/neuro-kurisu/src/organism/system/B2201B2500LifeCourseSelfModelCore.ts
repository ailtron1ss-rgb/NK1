import { createHash, randomUUID } from 'node:crypto';
import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:.5;
const clean=(x:unknown,n=160)=>String(x??'').replace(/\s+/g,' ').trim().slice(0,n);
const stable=(x:unknown):string=>JSON.stringify(x,(k,val)=>Array.isArray(val)?val:val&&typeof val==='object'?Object.keys(val).sort().reduce((o,key)=>{o[key]=val[key];return o;},{} as any):val);
const hash=(x:unknown)=>createHash('sha256').update(stable(x)).digest('hex');
const zero=()=>Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;
const v32=(x:number[]|undefined)=>Array.from({length:32},(_,i)=>clamp(x?.[i%(x?.length||1)]??.5));
const sim=(a:number[],b:number[])=>1-mean(Array.from({length:Math.min(a.length,b.length)},(_,i)=>Math.abs((a[i]??.5)-(b[i]??.5))));

export type CommitmentStatus='open'|'paused'|'completed'|'abandoned';
export interface LifeCommitment {id:string;kind:'goal'|'intention'|'project'|'relationship';title:string;createdTick:number;lastTick:number;progress01:number;confidence01:number;importance01:number;evidenceCount:number;status:CommitmentStatus;provenance:string[];}
export interface LifeEvent {id:string;tick:number;action:ActionKind;reward01:number;success01:number;surprise01:number;context:number[];commitmentIds:string[];impact01:number;parentId:string|null;eventHash:string;}
export interface SelfBelief {id:string;kind:'trait'|'preference'|'value'|'belief'|'habit';key:string;value01:number;confidence01:number;stability01:number;firstTick:number;lastTick:number;evidence:number;contradictions:number;}
export interface B2201B2500State {
 version:1; enabled:boolean; subjectId:string; tick:number; lifeSeq:number; headHash:string; birthTick:number; phase:'genesis'|'learning'|'consolidating'|'reorienting'|'mature';
 commitments:LifeCommitment[]; events:LifeEvent[]; selfBeliefs:SelfBelief[]; behavioralFingerprint:number[]; fingerprintAnchor:number[]; narrativeVector:number[]; narrativeHash:string;
 unfinishedPressure01:number; identityCoherence01:number; behavioralCoherence01:number; developmentalMomentum01:number; selfKnowledge01:number; selfConsistency01:number; causalSelfImpact01:number; activeCommitmentId:string|null;
 stats:{decisions:number;updates:number;commitmentCreates:number;commitmentCompletions:number;commitmentRecoveries:number;events:number;beliefUpdates:number;contradictions:number;consolidations:number;forgetEvents:number;identityChecks:number;behaviorChecks:number;lifeHashUpdates:number;causalReadouts:number;lesionChecks:number;lastLatencyMs:number;};
 lesions:Record<string,boolean>;
}

export interface B2201Input {tick:number;context01:number[];baseUtilities:Record<ActionKind,number>;priorBias?:Record<ActionKind,number>;subjectId:string;identityFingerprint:string;activeGoalIds?:string[];intentionIds?:string[];activeProjectId?:string;preferenceKeys?:string[];valueKeys?:string[];reward01?:number|null;uncertainty01:number;novelty01:number;predictionError01:number;confidence01:number;energy01:number;cognitiveLoad01:number;}

export interface B2201Output {actionBias:Record<ActionKind,number>;selfBias01:number;unfinishedPressure01:number;identityCoherence01:number;behavioralCoherence01:number;developmentalMomentum01:number;activeCommitmentId:string|null;continuityHash:string;lifeSeq:number;phase:B2201B2500State['phase'];}

const lesionNames=['commitments','autobiography','self-beliefs','behavioral-fingerprint','narrative','causal-self'];

export const defaultB2201B2500State=():B2201B2500State=>({
 version:1,enabled:true,subjectId:randomUUID(),tick:0,lifeSeq:0,headHash:'',birthTick:0,phase:'genesis',
 commitments:[],events:[],selfBeliefs:[],behavioralFingerprint:Array.from({length:32},(_,i)=>.5+Math.sin(i*.17)*.02),fingerprintAnchor:Array(32).fill(.5),narrativeVector:Array.from({length:32},(_,i)=>Math.cos(i*.13)*.02),narrativeHash:'',
 unfinishedPressure01:.2,identityCoherence01:1,behavioralCoherence01:1,developmentalMomentum01:.2,selfKnowledge01:.15,selfConsistency01:.9,causalSelfImpact01:.5,activeCommitmentId:null,
 stats:{decisions:0,updates:0,commitmentCreates:0,commitmentCompletions:0,commitmentRecoveries:0,events:0,beliefUpdates:0,contradictions:0,consolidations:0,forgetEvents:0,identityChecks:0,behaviorChecks:0,lifeHashUpdates:0,causalReadouts:0,lesionChecks:0,lastLatencyMs:0},
 lesions:Object.fromEntries(lesionNames.map(k=>[k,false])),
});

export class B2201B2500LifeCourseSelfModelCore {
 readonly systemName='system:b2201-b2500-life-course-self-model' as const;
 private state=B2201B2500LifeCourseSelfModelCore.defaultState();
 private lastInput:B2201Input|null=null;
 static defaultState(){return defaultB2201B2500State();}
 snapshot(){return structuredClone(this.state);}
 restore(raw?:Partial<B2201B2500State>|null){
  const d=defaultB2201B2500State(),r:any=raw??{};
  this.state={...d,...structuredClone(r),commitments:Array.isArray(r.commitments)?r.commitments.slice(-256):d.commitments,events:Array.isArray(r.events)?r.events.slice(-2048):d.events,selfBeliefs:Array.isArray(r.selfBeliefs)?r.selfBeliefs.slice(-192):d.selfBeliefs,behavioralFingerprint:Array.isArray(r.behavioralFingerprint)?r.behavioralFingerprint.slice(0,32):d.behavioralFingerprint,fingerprintAnchor:Array.isArray(r.fingerprintAnchor)?r.fingerprintAnchor.slice(0,32):d.fingerprintAnchor,narrativeVector:Array.isArray(r.narrativeVector)?r.narrativeVector.slice(0,32):d.narrativeVector,stats:{...d.stats,...(r.stats??{})},lesions:{...d.lesions,...(r.lesions??{})}};
 }
 private commitmentKey(kind:string,title:string){return `${kind}:${clean(title,96).toLowerCase()}`;}
 private reconcileCommitments(i:B2201Input){
  if(this.state.lesions.commitments)return;
  const rows:[string,string][]=[...(i.activeGoalIds??[]).map(x=>['goal',x] as [string,string]),...(i.intentionIds??[]).map(x=>['intention',x] as [string,string]),...(i.activeProjectId?[['project',i.activeProjectId] as [string,string]]:[])];
  for(const [kind,title] of rows){const key=this.commitmentKey(kind,title);let c=this.state.commitments.find(x=>this.commitmentKey(x.kind,x.title)===key&&x.status!=='abandoned');if(!c){c={id:`lc:${randomUUID().slice(0,12)}`,kind:kind as LifeCommitment['kind'],title:clean(title,96),createdTick:i.tick,lastTick:i.tick,progress01:.08,confidence01:.65,importance01:kind==='project'?0.9:kind==='goal'?.82:.74,evidenceCount:1,status:'open',provenance:[`tick:${i.tick}`]};this.state.commitments.push(c);this.state.stats.commitmentCreates++;}else{c.lastTick=i.tick;c.evidenceCount++;c.confidence01=clamp(.985*c.confidence01+.015*.86);if((c.status==='paused'||c.status==='completed')&&i.novelty01<.62){c.status='open';c.progress01=Math.min(c.progress01,.82);this.state.stats.commitmentRecoveries++;}}
  }
  this.state.commitments=this.state.commitments.slice(-256);
 }
 private activeCommitment(i:B2201Input){if(this.state.lesions.commitments)return null;const active=this.state.commitments.filter(c=>c.status==='open').sort((a,b)=>(b.importance01*(1-b.progress01)-a.importance01*(1-a.progress01))||(b.lastTick-a.lastTick));return active[0]??null;}
 private updateSelfBeliefs(i:B2201Input,action:ActionKind,reward:number,success:number){if(this.state.lesions['self-beliefs'])return;
  const evidence=[...(i.preferenceKeys??[]).map(x=>['preference',x] as const),...(i.valueKeys??[]).map(x=>['value',x] as const),['habit',`action:${action}`] as const];
  for(const [kind,key] of evidence){let b=this.state.selfBeliefs.find(x=>x.kind===kind&&x.key===key);if(!b){b={id:`sb:${randomUUID().slice(0,12)}`,kind,key,value01:.5,confidence01:.45,stability01:.4,firstTick:i.tick,lastTick:i.tick,evidence:0,contradictions:0};this.state.selfBeliefs.push(b);}const target=kind==='habit'?(success*.72+reward*.28):reward;b.value01=clamp(.97*b.value01+.03*target);b.confidence01=clamp(.985*b.confidence01+.015*(.55+.35*success));b.stability01=clamp(.985*b.stability01+.015*(1-i.predictionError01));b.lastTick=i.tick;b.evidence++;if(target<.3)b.contradictions+=1;if(b.contradictions>8)this.state.stats.contradictions++;this.state.stats.beliefUpdates++;}
  this.state.selfBeliefs=this.state.selfBeliefs.sort((a,b)=>(b.confidence01*b.stability01)-(a.confidence01*a.stability01)).slice(0,192);
 }
 private updateFingerprint(i:B2201Input,action:ActionKind,reward:number){if(this.state.lesions['behavioral-fingerprint'])return .5;const f=this.state.behavioralFingerprint;const a=ACTIONS.indexOf(action);const x=[i.uncertainty01,i.novelty01,i.predictionError01,i.confidence01,i.energy01,i.cognitiveLoad01,reward,.5+((a-3)/6)];for(let j=0;j<32;j++){const target=clamp(.5+.45*(x[j%8]-.5)+.12*Math.sin((i.tick+j)*.03));f[j]=clamp(.992*f[j]+.008*target);}return 1-sim(f,this.state.fingerprintAnchor);}
 private updateNarrative(i:B2201Input,action:ActionKind,reward:number,success:number,c:LifeCommitment|null){if(this.state.lesions.narrative)return;
  for(let j=0;j<32;j++){const signal=clamp(.48+(reward-.5)*.65+(success-.5)*.25+(i.predictionError01-.2)*.18+.10*Math.sin((i.tick+j)*.01));this.state.narrativeVector[j]=clamp(.995*this.state.narrativeVector[j]+.005*(signal-.5),-1,1);}
  const parent=this.state.events.at(-1)?.eventHash??null;const impact=clamp(.35*Math.abs(reward-.5)+.30*success+.20*i.predictionError01+.15*(c?.importance01??.3));const body={id:randomUUID(),tick:i.tick,action,reward01:reward,success01:success,surprise01:i.predictionError01,context:i.context01.slice(0,32),commitmentIds:c?[c.id]:[],impact01:impact,parentId:parent};const eventHash=hash(body);this.state.events=[...this.state.events,{...body,eventHash}].slice(-2048);this.state.stats.events++;this.state.stats.lifeHashUpdates++;this.state.narrativeHash=hash({previous:this.state.narrativeHash,eventHash,subjectId:this.state.subjectId,commitment:c?.id??null});
 }
 private updateCommitment(c:LifeCommitment|null,i:B2201Input,reward:number,success:number){if(!c||this.state.lesions.commitments)return;const gain=clamp(.018+.055*success+.032*reward+.018*(1-i.predictionError01));c.progress01=clamp(c.progress01+gain*(1-.45*c.progress01));c.lastTick=i.tick;c.evidenceCount++;c.confidence01=clamp(.985*c.confidence01+.015*(.6+.4*success));if(c.progress01>.94&&success>.72){c.status='completed';this.state.stats.commitmentCompletions++;}}
 private development(i:B2201Input,c:LifeCommitment|null){const open=this.state.commitments.filter(x=>x.status==='open');this.state.unfinishedPressure01=clamp(.93*this.state.unfinishedPressure01+.07*mean(open.map(x=>x.importance01*(1-x.progress01))) );this.state.developmentalMomentum01=clamp(.94*this.state.developmentalMomentum01+.06*(.5*i.novelty01+.3*i.predictionError01+.2*(1-i.confidence01)));this.state.selfKnowledge01=clamp(.985*this.state.selfKnowledge01+.015*mean(this.state.selfBeliefs.map(b=>b.confidence01)));this.state.selfConsistency01=clamp(.98*this.state.selfConsistency01+.02*(1-Math.abs(this.state.developmentalMomentum01-.5)));
  const age=i.tick-this.state.birthTick;this.state.phase=age<100?'genesis':age<1500?'learning':age<5000?'consolidating':age<12000?'reorienting':'mature';this.state.activeCommitmentId=c?.id??null;return c;
 }
 private causalReadout(c:LifeCommitment|null,i:B2201Input){if(this.state.lesions['causal-self'])return .5;const commitmentEffect=c?c.importance01*(1-c.progress01):0;const memoryContinuity=this.state.events.length?Math.min(1,this.state.events.length/128):0;const selfEvidence=this.state.selfBeliefs.length?this.state.selfKnowledge01:.2;const out=clamp(.35*commitmentEffect+.30*memoryContinuity+.20*selfEvidence+.15*(1-i.identityFingerprint.length%17/17));this.state.causalSelfImpact01=clamp(.96*this.state.causalSelfImpact01+.04*out);this.state.stats.causalReadouts++;return this.state.causalSelfImpact01;}
 beforeDecision(i:B2201Input):B2201Output{const t=performance.now();this.lastInput=i;this.state.tick=i.tick;if(this.state.birthTick===0)this.state.birthTick=i.tick;this.state.stats.decisions++;this.reconcileCommitments(i);const c=this.activeCommitment(i);this.development(i,c);const actionBias=zero();if(c&&!this.state.lesions.commitments){actionBias.respond+=.082*c.importance01*(1-c.progress01);actionBias.reflect+=.030*c.importance01;actionBias.verify+=.026*c.importance01;actionBias.wait-=.014*(c.status==='open'?1:0);}
  if(i.novelty01>.65)actionBias.explore+=.018*(1-i.confidence01);
  if(i.uncertainty01>.62)actionBias.verify+=.022;
  if(this.state.unfinishedPressure01>.68)actionBias.respond+=.020;
  const verifyBelief=this.state.selfBeliefs.filter(b=>b.kind==='preference'&&b.key.includes('verify')).reduce((a,b)=>a+b.confidence01*(b.value01-.5),0);
  const coherenceValue=this.state.selfBeliefs.filter(b=>b.kind==='value'&&b.key.includes('coherence')).reduce((a,b)=>a+b.confidence01*(b.value01-.5),0);
  const habitRespond=this.state.selfBeliefs.find(b=>b.kind==='habit'&&b.key==='action:respond');
  actionBias.verify+=Math.max(-.03,Math.min(.03,verifyBelief*.09));
  actionBias.reflect+=Math.max(-.02,Math.min(.02,coherenceValue*.07));
  actionBias.respond+=habitRespond?Math.max(-.018,Math.min(.018,(habitRespond.value01-.5)*habitRespond.confidence01*.08)):0;
  const selfBias=this.causalReadout(c,i);
  this.state.identityCoherence01=clamp(.55*this.state.identityCoherence01+.25*this.state.selfConsistency01+.20*(1-Math.min(1,Math.abs(this.state.behavioralFingerprint[0]-(this.state.fingerprintAnchor[0]??.5))*2)));
  this.state.behavioralCoherence01=clamp(1-(sim(this.state.behavioralFingerprint,this.state.fingerprintAnchor)-.5));
  this.state.stats.identityChecks++;
  this.state.stats.behaviorChecks++;
  this.state.stats.lastLatencyMs=performance.now()-t;
  return {actionBias,selfBias01:selfBias,unfinishedPressure01:this.state.unfinishedPressure01,identityCoherence01:this.state.identityCoherence01,behavioralCoherence01:this.state.behavioralCoherence01,developmentalMomentum01:this.state.developmentalMomentum01,activeCommitmentId:c?.id??null,continuityHash:this.state.narrativeHash,lifeSeq:this.state.lifeSeq,phase:this.state.phase};
 }
 afterOutcome(i:{tick:number;action:ActionKind;reward01:number;success01:number;predictionError01:number;verified01:number}):void{
  if(!this.state.enabled)return;
  const reward=clamp(i.reward01),success=clamp(i.success01);
  this.state.tick=i.tick;this.state.stats.updates++;
  const input=this.lastInput;if(!input)return;
  this.reconcileCommitments(input);
  const c=this.activeCommitment(input);
  this.updateCommitment(c,input,reward,success);
  this.updateSelfBeliefs(input,i.action,reward,success);
  this.updateFingerprint(input,i.action,reward);
  this.updateNarrative(input,i.action,reward,success,c);
  this.causalReadout(c,input);
  this.state.lifeSeq++;
  this.state.headHash=hash({previous:this.state.headHash,lifeSeq:this.state.lifeSeq,tick:i.tick,narrative:this.state.narrativeHash,commitments:this.state.commitments.filter(x=>x.status==='open').slice(-16).map(x=>[x.id,x.progress01]),fingerprint:this.state.behavioralFingerprint.slice(0,16)});
  this.state.stats.consolidations+=(i.verified01>.6&&success>.6)?1:0;
  if(this.state.stats.updates%97===0){const before=this.state.selfBeliefs.length;this.state.selfBeliefs=this.state.selfBeliefs.filter(b=>b.confidence01>.18||b.stability01>.28);this.state.stats.forgetEvents+=Math.max(0,before-this.state.selfBeliefs.length);}
 }
 verify(){const s=this.state;let events=true;let prev='';for(const e of s.events){const body={id:e.id,tick:e.tick,action:e.action,reward01:e.reward01,success01:e.success01,surprise01:e.surprise01,context:e.context,commitmentIds:e.commitmentIds,impact01:e.impact01,parentId:e.parentId};if(hash(body)!==e.eventHash)events=false;if(prev&&e.parentId!==prev)events=false;prev=e.eventHash;}const headOk=s.events.length===0||s.narrativeHash.length>0;return {verified:events&&headOk,events,headOk,lifeSeq:s.lifeSeq,eventsCount:s.events.length};}
 diagnostics(){return structuredClone(this.state.stats);}
 diagnosticsExtended(){return {lifeSeq:this.state.lifeSeq,phase:this.state.phase,unfinishedPressure01:this.state.unfinishedPressure01,identityCoherence01:this.state.identityCoherence01,behavioralCoherence01:this.state.behavioralCoherence01,developmentalMomentum01:this.state.developmentalMomentum01,selfKnowledge01:this.state.selfKnowledge01,selfConsistency01:this.state.selfConsistency01,causalSelfImpact01:this.state.causalSelfImpact01,activeCommitmentId:this.state.activeCommitmentId,narrativeHash:this.state.narrativeHash,commitmentsOpen:this.state.commitments.filter(c=>c.status==='open').length,events:this.state.events.length};}
 setLesions(v:Record<string,boolean>){this.state.lesions={...this.state.lesions,...v};this.state.stats.lesionChecks++;}
 evaluateLesion(i:B2201Input,lesion:Record<string,boolean>){const saved=this.snapshot();const on=this.beforeDecision(i);this.restore(saved);this.setLesions(lesion);const off=this.beforeDecision(i);this.restore(saved);return {effect01:mean(ACTIONS.map(a=>Math.abs(on.actionBias[a]-off.actionBias[a]))),selfBiasDelta01:on.selfBias01-off.selfBias01};}
}
