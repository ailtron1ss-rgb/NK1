import type { ActionKind } from '../core/types.ts';

type Phase = 'infer'|'recall'|'adapt'|'plan'|'verify'|'explore'|'consolidate'|'recover';
const ACTIONS: ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const PHASES: Phase[]=['infer','recall','adapt','plan','verify','explore','consolidate','recover'];
const LESIONS=['task-inference','replay-scheduler','gradient-alignment','modular-policy','consolidation','counterfactual','selective-foresight','curriculum','neural-plasticity','verifier'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const mean=(a:number[])=>a.length?a.reduce((x,y)=>x+y,0)/a.length:.5;
const dot=(a:number[],b:number[])=>{let s=0;for(let i=0;i<Math.min(a.length,b.length);i++)s+=(a[i]??0)*(b[i]??0);return s;};
const norm=(a:number[])=>Math.sqrt(Math.max(1e-9,dot(a,a)));
const cosineSigned=(a:number[],b:number[])=>dot(a,b)/(norm(a)*norm(b));
const dist=(a:number[],b:number[])=>mean(Array.from({length:Math.min(a.length,b.length)},(_,i)=>Math.abs((a[i]??.5)-(b[i]??.5))));
const v=(x:number[]|undefined,n=16)=>Array.from({length:n},(_,i)=>clamp(x?.[i%(x?.length||1)]??.5));
const sig=(x:number)=>1/(1+Math.exp(-Math.max(-8,Math.min(8,x))));
const zero=()=>Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;
const phaseMap=()=>Object.fromEntries(PHASES.map(p=>[p,{value01:.5,uses:0,wins:0}])) as Record<Phase,PhaseStats>;

export interface B901Input{
 tick:number; context01:number[]; baseUtilities:Record<ActionKind,number>; priorBias?:Record<ActionKind,number>;
 uncertainty01:number; predictionError01:number; novelty01:number; confidence01:number; goalVector?:number[];
 selfVector?:number[]; complexity01?:number; modeHint?:string; currentAction?:ActionKind;
}
export interface B901Output{
 actionBias:Record<ActionKind,number>; predictiveBias:Record<ActionKind,number>; phase:Phase; budget01:number;
 confidence01:number; taskSeparation01:number; reversal01:number; replay01:number; gradientAlignment01:number;
 planning01:number; foresight01:number; counterfactual01:number; consolidation01:number; curriculum01:number;
}
interface Episode{tick:number;context:number[];action:ActionKind;reward01:number;error01:number;verified01:number;surprise01:number;taskId:number;signal01:number;interference01:number;priority01:number;uses:number;}
interface TaskProto{ id:number;centroid:number[];mass:number;stability01:number;rewardEMA01:number;drift01:number;lastTick:number; }
interface PolicyHead{weights:number[];bias:number;uses:number;value01:number;importance:number[];anchor:number[];}
interface PhaseStats{value01:number;uses:number;wins:number;}
export interface B901State{
 version:1;enabled:boolean;tick:number;lesions:Record<string,boolean>;phases:Record<Phase,PhaseStats>;
 tasks:TaskProto[]; episodes:Episode[]; policy:Record<ActionKind,PolicyHead>; taskAdapters:Record<string,Record<ActionKind,PolicyHead>>; failureHeat:Record<string,number>;
 identity:number[]; eligibility:number[]; regime01:number; reversal01:number; activeTaskId:number; activeTaskConfidence01:number;
 stats:{decisions:number;updates:number;taskAssignments:number;newTasks:number;replays:number;alignmentChecks:number;alignmentRejects:number;policyUpdates:number;
 counterfactuals:number;foresightCalls:number;verifications:number;consolidations:number;curriculumSelections:number;neuralUpdates:number;phaseSwitches:number;restarts:number;
 lastLatencyMs:number;lastReversal01:number;lastTaskConfidence01:number;lastSeparation01:number;lastAlignment01:number;lastReplay01:number;lastForesight01:number;lastCounterfactual01:number;lastConsolidation01:number;lastCurriculum01:number;};
}

const seedWeights=(seed:number,n=16)=>Array.from({length:n},(_,i)=>Math.sin((i+1)*(seed+1)*.377)*.025);
const defaultHead=(seed:number):PolicyHead=>({weights:seedWeights(seed),bias:0,uses:0,value01:.5,importance:Array(16).fill(.01),anchor:seedWeights(seed)});
export const defaultB901B1100State=():B901State=>({
 version:1,enabled:true,tick:0,lesions:Object.fromEntries(LESIONS.map(x=>[x,false])),phases:phaseMap(),tasks:[],episodes:[],
 policy:Object.fromEntries(ACTIONS.map((a,i)=>[a,defaultHead(31+i)])) as Record<ActionKind,PolicyHead>,taskAdapters:{},failureHeat:{},
 identity:Array.from({length:384},(_,i)=>Math.sin(i*.113)*.012),eligibility:Array(384).fill(0),regime01:0,reversal01:0,activeTaskId:-1,activeTaskConfidence01:.5,
 stats:{decisions:0,updates:0,taskAssignments:0,newTasks:0,replays:0,alignmentChecks:0,alignmentRejects:0,policyUpdates:0,counterfactuals:0,foresightCalls:0,verifications:0,consolidations:0,curriculumSelections:0,neuralUpdates:0,phaseSwitches:0,restarts:0,lastLatencyMs:0,lastReversal01:0,lastTaskConfidence01:.5,lastSeparation01:0,lastAlignment01:.5,lastReplay01:0,lastForesight01:.5,lastCounterfactual01:.5,lastConsolidation01:.5,lastCurriculum01:.5}
});

export class B901B1100CausalDevelopmentalMetaLearner{
 private state=defaultB901B1100State();
 snapshot(){return structuredClone(this.state);} diagnostics(){return structuredClone(this.state.stats);}
 restore(src?:Partial<B901State>){const d=defaultB901B1100State(),s:any=src??{};this.state={...d,...structuredClone(s),lesions:{...d.lesions,...(s.lesions??{})},phases:{...d.phases,...(s.phases??{})},tasks:Array.isArray(s.tasks)?structuredClone(s.tasks).slice(-24):[],episodes:Array.isArray(s.episodes)?structuredClone(s.episodes).slice(-4096):[],policy:{...d.policy,...(s.policy??{})},taskAdapters:structuredClone(s.taskAdapters??{}),failureHeat:structuredClone(s.failureHeat??{}),identity:Array.isArray(s.identity)?s.identity.slice(0,384):d.identity,eligibility:Array.isArray(s.eligibility)?s.eligibility.slice(0,384):d.eligibility,stats:{...d.stats,...(s.stats??{})}};}
 markRestart(){this.state.stats.restarts++;}
 setLesions(v:Record<string,boolean>){this.state.lesions={...this.state.lesions,...v};}
 private assignTask(ctx:number[],tick:number){
   if(this.state.lesions['task-inference']) return {id:0,conf:.5,sep:0.0};
   let best:TaskProto|undefined,bd=1,second=1;
   for(const t of this.state.tasks){const d=dist(ctx,t.centroid);if(d<bd){second=bd;bd=d;best=t;}else if(d<second)second=d;}
   const conf=clamp(.65*(1-bd)+.35*(best?.stability01??.5));
   if(!best||bd>.27){const id=this.state.tasks.length;best={id,centroid:v(ctx),mass:1,stability01:.5,rewardEMA01:.5,drift01:0,lastTick:tick};this.state.tasks.push(best);this.state.stats.newTasks++;this.state.stats.taskAssignments++;return {id,conf:.62,sep:.38};}
   const old=best.centroid.slice();best.centroid=best.centroid.map((x,i)=>clamp(.93*x+.07*(ctx[i%ctx.length]??.5)));best.mass++;best.lastTick=tick;best.drift01=clamp(.94*best.drift01+.06*dist(old,best.centroid));best.stability01=clamp(.96*best.stability01+.04*(1-bd));this.state.stats.taskAssignments++;
   return {id:best.id,conf,sep:clamp((second-bd)*3)};
 }
 private head(action:ActionKind,taskId:number){
   if(this.state.lesions['modular-policy']||taskId<0)return this.state.policy[action];
   const key=String(taskId); if(!this.state.taskAdapters[key])this.state.taskAdapters[key]=Object.fromEntries(ACTIONS.map((a,i)=>[a,defaultHead(80+taskId*7+i)])) as Record<ActionKind,PolicyHead>;
   return this.state.taskAdapters[key][action]??this.state.policy[action];
 }
 private score(head:PolicyHead,ctx:number[]){const x=v(ctx);let z=head.bias;for(let i=0;i<16;i++)z+=head.weights[i]*(x[i]-.5);return Math.tanh(z)*.055;}
 private replay(ctx:number[],taskId:number,signal:number,alignment:number,budget:number){
   if(this.state.lesions['replay-scheduler'])return [];
   const k=budget>.82?12:budget>.58?7:budget>.32?3:1;
   const rows=this.state.episodes.map(e=>({...e,score:clamp(.30*e.signal01+.20*e.priority01+.18*e.surprise01+.15*(e.taskId===taskId?1:0)+.10*e.verified01+.07*(1-e.interference01)+(1-alignment)*.08)})).sort((a,b)=>b.score-a.score).slice(0,k);
   this.state.stats.replays+=rows.length;rows.forEach(r=>r.uses++);return rows;
 }
 private alignment(replay:Episode[],candidate:number[]){
   if(this.state.lesions['gradient-alignment'])return 1;
   const old:number[]=[]; for(const r of replay.slice(0,8)){for(let i=0;i<16;i++)old.push((r.reward01-.5)*(r.context[i%r.context.length]-.5)*(r.action==='wait'?-.3:1));}
   const avg=old.length?old.slice(0,Math.min(candidate.length,old.length)):Array(candidate.length).fill(0);
   this.state.stats.alignmentChecks++;const c=cosineSigned(candidate,avg);if(c<-.12)this.state.stats.alignmentRejects++;return clamp((c+1)/2);
 }
 private counterfactual(ctx:number[],goal:number[]|undefined,taskId:number){
   if(this.state.lesions['counterfactual'])return {bias:zero(),quality:.5};
   const g=v(goal,16),out=zero(),vals=ACTIONS.map(a=>{const h=this.head(a,taskId),policy=this.score(h,ctx),goalFit=clamp(1-dist(ctx,g));const actionVal=.50+policy+.16*goalFit;return [a,actionVal] as [ActionKind,number]}).sort((a,b)=>b[1]-a[1]);
   const best=vals[0]?.[1]??.5,second=vals[1]?.[1]??.5;for(const [a,s] of vals.slice(0,3))out[a]=clamp((s-.5)*.07,-.07,.07);this.state.stats.counterfactuals++;return {bias:out,quality:clamp(.65*best+.35*(best-second+.5))};
 }
 private foresight(ctx:number[],taskId:number,goal:number[]|undefined,uncertainty:number,budget:number){
   if(this.state.lesions['selective-foresight']||budget<.35)return {bias:zero(),q:.5};
   const g=v(goal,16),out=zero(),depth=budget>.82?4:budget>.58?3:2;let used=0;
   for(const a of ACTIONS){const h=this.head(a,taskId),s=this.score(h,ctx),gfit=1-dist(ctx,g);const penalty=uncertainty*.08*(1-depth*.12);out[a]=clamp((s+.03*gfit-penalty),-.07,.07);used++;}
   this.state.stats.foresightCalls+=used;return {bias:out,q:clamp(.48+.14*depth-.20*uncertainty)};
 }
 private phase(i:B901Input,taskConf:number){
   const complexity=clamp((i.uncertainty01+i.predictionError01+i.novelty01+(i.complexity01??.5))/4);let p:Phase=complexity>.82?'verify':complexity>.66?'plan':complexity>.48?'adapt':complexity>.30?'recall':'consolidate';
   if(this.state.reversal01>.64)p='recover'; if(i.novelty01>.76&&i.uncertainty01>.52)p='explore'; if(taskConf<.46&&i.uncertainty01>.45)p='infer';
   const budget=clamp(.10+.90*complexity+.12*(1-taskConf));return {p,budget:clamp(budget)};
 }
 private plastic(ctx:number[],reward:number,error:number,taskConf:number){if(this.state.lesions['neural-plasticity'])return .5;const x=v(ctx,24),drive=clamp(.25+.75*Math.abs(reward-.5)+.35*error+.25*(1-taskConf));let s=0;for(let i=0;i<384;i++){const z=Math.tanh((x[i%24]-.5)*1.4+this.state.identity[i]*1.15);this.state.eligibility[i]=clamp(.972*this.state.eligibility[i]+.028*Math.abs(z));const lr=.00085*(.45+.55*this.state.eligibility[i])*drive;this.state.identity[i]=clamp(this.state.identity[i]*(1-lr)+z*lr,-1,1);s+=Math.abs(z);}this.state.stats.neuralUpdates++;return clamp(s/384);}
 private consolidate(taskId:number,intensity:number){
   if(this.state.lesions['consolidation'])return .5;let touched=0,stable=0;for(const a of ACTIONS){const h=this.head(a,taskId);for(let i=0;i<16;i++){const imp=clamp(.97*h.importance[i]+.03*Math.abs(h.weights[i]-h.anchor[i]));h.importance[i]=imp;const protect=clamp(.02+intensity*imp*.08);h.weights[i]=clamp(h.weights[i]*(1-protect)+h.anchor[i]*protect,-1.2,1.2);if(imp>.35)touched++;}if(h.uses>20){h.anchor=h.weights.slice();stable++;}}this.state.stats.consolidations++;return clamp((touched/(ACTIONS.length*16)+stable/ACTIONS.length)/2);}
 private curriculum(taskConf:number,novelty:number,error:number,regime:number){
   if(this.state.lesions['curriculum'])return .5;const score=clamp(.32*(1-taskConf)+.26*novelty+.24*error+.18*regime);this.state.stats.curriculumSelections+=score>.62?1:0;return score;
 }
 private verifier(ctx:number[],taskId:number,action:ActionKind,predicted:number){
   if(this.state.lesions['verifier']) return .5;
   const rows=this.state.episodes.filter(e=>e.taskId===taskId&&e.action===action).slice(-24);
   if(!rows.length)return .56;
   const empirical=mean(rows.map(e=>e.reward01)),evidence=mean(rows.map(e=>e.verified01));
   this.state.stats.verifications++;
   return clamp(.50*(1-Math.abs(empirical-predicted))+.30*evidence+.20*(1-dist(ctx,rows.at(-1)?.context??ctx)));
 }
 beforeDecision(i:B901Input):B901Output{
   const t0=performance.now();if(!this.state.enabled){return {actionBias:zero(),predictiveBias:zero(),phase:'recall',budget01:.25,confidence01:i.confidence01,taskSeparation01:0,reversal01:this.state.reversal01,replay01:0,gradientAlignment01:.5,planning01:.5,foresight01:.5,counterfactual01:.5,consolidation01:.5,curriculum01:.5};}
   this.state.tick=i.tick;this.state.stats.decisions++;const ctx=v(i.context01);if(i.predictionError01>.55){const fastReversal=clamp(.68*i.predictionError01+.32*this.state.regime01);this.state.reversal01=clamp(.76*this.state.reversal01+.24*fastReversal);}const task=this.assignTask(ctx,i.tick);this.state.activeTaskId=task.id;this.state.activeTaskConfidence01=task.conf;
   const ph=this.phase(i,task.conf);this.state.phases[ph.p].uses++;this.state.stats.phaseSwitches += ph.p==='recover'||ph.p==='infer'?1:0;
   const replay=this.replay(ctx,task.id,clamp(i.predictionError01+i.novelty01),.5,ph.budget),align=this.alignment(replay,seedWeights(task.id+5));
   const cf=this.counterfactual(ctx,i.goalVector,task.id);const fs=this.foresight(ctx,task.id,i.goalVector,i.uncertainty01,ph.budget);
   const verifier=mean(ACTIONS.map(a=>this.verifier(ctx,task.id,a,.5)));
   const actionBias=zero(),predictiveBias=zero();let baseConf=i.confidence01;
   for(const a of ACTIONS){const h=this.head(a,task.id);const heat=this.state.failureHeat[`${task.id}:${a}`]??0;const recoveryBoost=this.state.reversal01>.45?clamp((heat*.60),0,.08):0;const alternativeRecovery=this.state.reversal01>.45?clamp((1-clamp(heat*1.5))*.10,0,.10):0;actionBias[a]=clamp((this.score(h,ctx)+cf.bias[a]+fs.bias[a]-recoveryBoost+alternativeRecovery)*(this.state.reversal01>.45?.50:1)*(.62+.38*task.conf)*(0.88+0.12*verifier),-.10,.10);const p=clamp(.5+h.value01*.35+task.conf*.2-i.predictionError01*.18);predictiveBias[a]=clamp((p-.5)*.055+fs.bias[a]*.35+recoveryBoost*.25+(verifier-.5)*.028,-.065,.065);baseConf=.92*baseConf+.08*p;}
   const curriculum=this.curriculum(task.conf,i.novelty01,i.predictionError01,this.state.regime01);const consolidation=ph.p==='consolidate'?this.consolidate(task.id,.65):.5;const plasticity=this.plastic(ctx,.5,i.predictionError01,task.conf);
   this.state.stats.lastTaskConfidence01=task.conf;this.state.stats.lastSeparation01=task.sep;this.state.stats.lastAlignment01=align;this.state.stats.lastReplay01=clamp(replay.length/12);this.state.stats.lastForesight01=fs.q;this.state.stats.lastCounterfactual01=cf.quality;this.state.stats.lastConsolidation01=consolidation;this.state.stats.lastCurriculum01=curriculum;this.state.stats.lastLatencyMs=performance.now()-t0;
   this.state.stats.lastReversal01=this.state.reversal01;return {actionBias,predictiveBias,phase:ph.p,budget01:ph.budget,confidence01:clamp(baseConf*.72+task.conf*.28),taskSeparation01:task.sep,reversal01:this.state.reversal01,replay01:clamp(replay.length/12),gradientAlignment01:align,planning01:cf.quality,foresight01:fs.q,counterfactual01:cf.quality,consolidation01:consolidation,curriculum01:curriculum};
 }
 afterOutcome(i:{tick:number;action:ActionKind;context01:number[];nextContext01:number[];reward01:number;predictionError01:number;verified01:number;success01:number;phase?:Phase}){
   if(!this.state.enabled)return;const ctx=v(i.context01),next=v(i.nextContext01);const task=this.assignTask(ctx,i.tick),r=clamp(i.reward01),e=clamp(i.predictionError01),ver=clamp(i.verified01),taskConf=this.state.activeTaskConfidence01;
   const surprise=clamp(.55*e+.25*dist(ctx,next)+.20*this.state.regime01),signal=clamp(.35*Math.abs(r-.5)+.30*e+.20*ver+.15*surprise),interference=clamp(dist(ctx,next)*.6+this.state.reversal01*.4),priority=clamp(.35*signal+.25*surprise+.20*(1-interference)+.15*ver+.05*(task.id===this.state.activeTaskId?1:0));
   this.state.episodes.push({tick:i.tick,context:ctx,action:i.action,reward01:r,error01:e,verified01:ver,surprise01:surprise,taskId:task.id,signal01:signal,interference01:interference,priority01:priority,uses:0});this.state.episodes=this.state.episodes.slice(-4096);this.state.stats.updates++;
   const h=this.head(i.action,task.id),x=v(ctx),old=h.weights.slice(),lr=.012*(1+.65*this.state.reversal01+.45*surprise)/(1+h.uses*.0015),delta=x.map((z,j)=>(r-.5)*(z-.5)*lr);const align=this.alignment(this.state.episodes.slice(-8),delta);
   if(align>=.46){for(let j=0;j<16;j++){h.weights[j]=clamp(h.weights[j]+delta[j]*(.55+.45*align),-1.2,1.2);h.importance[j]=clamp(.985*h.importance[j]+.015*Math.abs(delta[j]));}h.bias=clamp(h.bias+(r-.5)*lr*.7,-1.5,1.5);this.state.stats.policyUpdates++;}else{h.weights=old;}
   h.value01=clamp(.97*h.value01+.03*r);h.uses++;
   if(r<.42){
     const alternatives=ACTIONS.filter(a=>a!==i.action).map(a=>({a,s:this.score(this.head(a,task.id),ctx)})).sort((x,y)=>y.s-x.s).slice(0,2);
     for(const alt of alternatives){
       const ah=this.head(alt.a,task.id),alr=lr*.42*(1-r); for(let j=0;j<16;j++){ah.weights[j]=clamp(ah.weights[j]+(ctx[j]-0.5)*alr,-1.2,1.2);ah.importance[j]=clamp(.985*ah.importance[j]+.015*Math.abs((ctx[j]-0.5)*alr));} ah.bias=clamp(ah.bias+alr*.55,-1.5,1.5);ah.uses++;
     }
   }
   const base=this.state.policy[i.action],blend=.08;if(h!==base){for(let j=0;j<16;j++)base.weights[j]=clamp(base.weights[j]*(1-blend)+h.weights[j]*blend,-1.2,1.2);base.bias=clamp(base.bias*(1-blend)+h.bias*blend,-1.5,1.5);}
   for(const a of ACTIONS){const key=`${task.id}:${a}`;const oldHeat=this.state.failureHeat[key]??0;this.state.failureHeat[key]=clamp(.94*oldHeat+(a===i.action&&r<.48?.30:0));}
   const recent=this.state.episodes.slice(-32),a=mean(recent.slice(-8).map(z=>z.reward01)),b=mean(recent.slice(-16,-8).map(z=>z.reward01));this.state.regime01=clamp(.90*this.state.regime01+.38*Math.abs(a-b)+.12*e+.08*(task.id!==this.state.activeTaskId?1:0));
   const reversal=clamp(.55*this.state.regime01+.25*e+.20*(1-taskConf));this.state.reversal01=clamp(.91*this.state.reversal01+.09*reversal);
   const p=this.state.phases[i.phase??'adapt'];p.value01=clamp(.97*p.value01+.03*clamp(.55*r+.25*ver+.20*(1-e)));if(p.value01>.64)p.wins++;
   this.state.stats.lastReversal01=this.state.reversal01;this.state.stats.lastAlignment01=align;this.state.stats.lastTaskConfidence01=taskConf;this.plastic(ctx,r,e,taskConf);
 }
 evaluate(input:B901Input,lesion:Record<string,boolean>){const saved=this.snapshot();this.setLesions(lesion);const on=this.beforeDecision(input);this.restore(saved);const off=this.beforeDecision(input);this.restore(saved);return {effect01:mean(ACTIONS.map(a=>Math.abs(on.actionBias[a]-off.actionBias[a]))),confidenceDelta01:on.confidence01-off.confidence01};}
}
