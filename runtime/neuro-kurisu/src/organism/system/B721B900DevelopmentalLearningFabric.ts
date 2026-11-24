import type { ActionKind } from '../core/types.ts';

type Phase='observe'|'replay'|'plan'|'verify'|'explore'|'consolidate'|'identity'|'recover';
const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const PHASES:Phase[]=['observe','replay','plan','verify','explore','consolidate','identity','recover'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const mean=(a:number[])=>a.length?a.reduce((x,y)=>x+y,0)/a.length:.5;
const dot=(a:number[],b:number[])=>{let s=0;for(let i=0;i<Math.min(a.length,b.length);i++)s+=(a[i]??0)*(b[i]??0);return s;};
const norm=(a:number[])=>Math.sqrt(Math.max(1e-9,dot(a,a)));
const cos=(a:number[],b:number[])=>clamp((dot(a,b)/(norm(a)*norm(b))+1)/2);
const dist=(a:number[],b:number[])=>mean(Array.from({length:Math.min(a.length,b.length)},(_,i)=>Math.abs((a[i]??.5)-(b[i]??.5))));
const sigmoid=(x:number)=>1/(1+Math.exp(-x));
const v=(x:number[],n=12)=>Array.from({length:n},(_,i)=>clamp(x[i%x.length]??.5));
const zero=()=>Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;

export interface B721Input{tick:number;context01:number[];baseUtilities:Record<ActionKind,number>;priorBias?:Record<ActionKind,number>;uncertainty01:number;predictionError01:number;novelty01:number;confidence01:number;goalVector?:number[];selfVector?:number[];complexity01?:number;modeHint?:string;}
export interface B721Output{actionBias:Record<ActionKind,number>;predictiveBias:Record<ActionKind,number>;phase:Phase;budget01:number;confidence01:number;ood01:number;reversal01:number;memory01:number;planning01:number;verifier01:number;plasticity01:number;experiment01:number;}
interface Replay{tick:number;context:number[];action:ActionKind;reward01:number;error01:number;surprise01:number;verified01:number;phase:Phase;priority01:number;uses:number;}
interface Node{id:string;level:0|1|2;centroid:number[];count:number;importance01:number;confidence01:number;lastTick:number;}
interface Model{action:ActionKind;weights:number[];bias:number;variance01:number;uses:number;successes:number;revision:number;}
interface Policy{weights:number[];bias:number;uses:number;value01:number;}
interface Subgoal{vector:number[];value01:number;confidence01:number;depth:number;action:ActionKind;}
export interface B721State{version:1;enabled:boolean;tick:number;lesions:Record<string,boolean>;phase:Record<Phase,{value01:number;uses:number;wins:number}>;replay:Replay[];tree:Node[];models:Model[];policy:Record<ActionKind,Policy>;subgoals:Subgoal[];identity:number[];eligibility:number[];regimeShift01:number;reversal01:number;ood01:number;lastPhase?:Phase;stats:{decisions:number;updates:number;replays:number;treeUpdates:number;modelUpdates:number;plans:number;verifications:number;experiments:number;phaseSwitches:number;neuralUpdates:number;reversalDetections:number;restarts:number;lastLatencyMs:number;lastHoldout01:number;lastOOD01:number;lastReversal01:number;lastPlanning01:number;lastVerifier01:number;lastPlasticity01:number;};}
const LESIONS=['replay','temporal-tree','world-model','subgoal-planner','verifier','ood-detector','adaptive-compute','identity-plasticity','experiment-selector','phase-policy'];
const weights=(seed:number)=>Array.from({length:12},(_,i)=>Math.sin((i+1)*(seed+1)*.73)*.035);
const phases=()=>Object.fromEntries(PHASES.map(p=>[p,{value01:.5,uses:0,wins:0}])) as B721State['phase'];
export const defaultB721B900State=():B721State=>({
 version:1,
 enabled:true,
 tick:0,
 lesions:Object.fromEntries(LESIONS.map(x=>[x,false])),
 phase:phases(), replay:[], tree:[],
 models:ACTIONS.flatMap((a,ai)=>Array.from({length:3},(_,j)=>({action:a,weights:weights(ai*3+j),bias:0,variance01:.25,uses:0,successes:0,revision:0}))),
 policy:Object.fromEntries(ACTIONS.map((a,i)=>[a,{weights:weights(i+11),bias:0,uses:0,value01:.5}])) as Record<ActionKind,Policy>,
 subgoals:[], identity:Array.from({length:256},(_,i)=>Math.sin(i*.19)*.02), eligibility:Array(256).fill(0),
 regimeShift01:0,reversal01:0,ood01:0,
 stats:{decisions:0,updates:0,replays:0,treeUpdates:0,modelUpdates:0,plans:0,verifications:0,experiments:0,phaseSwitches:0,neuralUpdates:0,reversalDetections:0,restarts:0,lastLatencyMs:0,lastHoldout01:0,lastOOD01:0,lastReversal01:0,lastPlanning01:0,lastVerifier01:0,lastPlasticity01:0}
});

export class B721B900DevelopmentalLearningFabric{
 private state=defaultB721B900State();
 snapshot(){return structuredClone(this.state);}
 diagnostics(){return structuredClone(this.state.stats);}
 restore(src?:Partial<B721State>){const d=defaultB721B900State(),s:any=src??{};this.state={...d,...structuredClone(s),lesions:{...d.lesions,...(s.lesions??{})},phase:{...d.phase,...(s.phase??{})},replay:Array.isArray(s.replay)?structuredClone(s.replay).slice(-2048):[],tree:Array.isArray(s.tree)?structuredClone(s.tree).slice(-512):[],models:Array.isArray(s.models)?structuredClone(s.models).slice(-96):d.models,policy:{...d.policy,...(s.policy??{})},subgoals:Array.isArray(s.subgoals)?structuredClone(s.subgoals).slice(-64):[],identity:Array.isArray(s.identity)?s.identity.slice(0,256):d.identity,eligibility:Array.isArray(s.eligibility)?s.eligibility.slice(0,256):d.eligibility,stats:{...d.stats,...(s.stats??{})}};}
 markRestart(){this.state.stats.restarts++;}
 setLesions(vv:Record<string,boolean>){this.state.lesions={...this.state.lesions,...vv};}
 private phaseFor(i:B721Input){const c=clamp(.28*i.uncertainty01+.24*i.predictionError01+.18*i.novelty01+.12*(1-i.confidence01)+.10*(i.complexity01??.5)+.08*this.state.ood01);let p:Phase=c>.84?'verify':c>.70?'plan':c>.55?'replay':c>.38?'observe':'consolidate';if(this.state.reversal01>.58&&c>.25)p='recover';if(i.novelty01>.78&&i.uncertainty01>.52)p='explore';return {phase:this.state.lesions['adaptive-compute']?'observe':p,budget:this.state.lesions['adaptive-compute']?.30:clamp(.08+.92*c)};}
 private ood(ctx:number[]){if(this.state.lesions['ood-detector'])return 0;const d=this.state.tree.length?Math.min(...this.state.tree.map(n=>dist(ctx,n.centroid))):.5;this.state.ood01=this.state.ood01*.86+clamp(d*.92+this.state.regimeShift01*.35)*.14;return this.state.ood01;}
 private reversal(err:number){const r=clamp(Math.abs(err-.5)*1.5+this.state.ood01*.35+this.state.regimeShift01*.45);this.state.reversal01=this.state.reversal01*.90+r*.10;if(this.state.reversal01>.64)this.state.stats.reversalDetections++;return this.state.reversal01;}
 private tree(ctx:number[],tick:number,importance:number,confidence:number){
  if(this.state.lesions['temporal-tree']) return .5;
  let best:Node|undefined; let bd=1;
  for(const n of this.state.tree){const d=dist(ctx,n.centroid);if(d<bd){bd=d;best=n;}}
  if(!best||bd>.22){
   this.state.tree.push({id:`t-${tick}-${this.state.tree.length}`,level:this.state.tree.length%3 as 0|1|2,centroid:v(ctx),count:1,importance01:clamp(.5+.4*importance),confidence01:clamp(.45+.4*confidence),lastTick:tick});
   this.state.stats.treeUpdates++; return confidence;
  }
  best.centroid=best.centroid.map((x,i)=>clamp(.92*x+.08*(ctx[i%ctx.length]??.5))); best.count++;
  best.importance01=clamp(.96*best.importance01+.04*importance); best.confidence01=clamp(.95*best.confidence01+.05*confidence); best.lastTick=tick;
  this.state.stats.treeUpdates++; return clamp(.58*(1-bd)+.42*best.confidence01);
 }
 private replay(ctx:number[],budget:number){if(this.state.lesions['replay'])return [];const k=budget>.8?10:budget>.56?6:budget>.3?3:1;const rows=this.state.replay.map(r=>({...r,score:clamp(.40*(1-dist(ctx,r.context))+.25*r.priority01+.20*r.error01+.15*r.verified01)})).sort((a,b)=>b.score-a.score).slice(0,k);this.state.stats.replays+=rows.length;return rows;}
 private pred(ctx:number[],m:Model){let z=m.bias;const x=v(ctx);for(let i=0;i<12;i++)z+=m.weights[i]*(x[i]-.5);return sigmoid(z*2.4);}
 private policyScore(action:ActionKind,ctx:number[]){if(this.state.lesions['phase-policy'])return 0;const p=this.state.policy[action];const x=v(ctx);let z=p.bias;for(let i=0;i<12;i++)z+=p.weights[i]*(x[i]-.5);return clamp(Math.tanh(z)*.065,-.065,.065);}
 private world(action:ActionKind,ctx:number[]){if(this.state.lesions['world-model'])return .5;const ms=this.state.models.filter(m=>m.action===action),ps=ms.map(m=>this.pred(ctx,m)),mu=mean(ps),spread=mean(ps.map(x=>Math.abs(x-mu)));return clamp(.62*mu+.23*(1-spread*2)+.15*(1-mean(ms.map(m=>m.variance01))));}
 private plan(ctx:number[],goal:number[]|undefined,budget:number){if(this.state.lesions['subgoal-planner'])return {bias:zero(),quality:.5};const g=v(goal??ctx);const ss=ACTIONS.map(a=>[a,this.world(a,ctx)*.58+cos(ctx,g)*.25+(1-dist(ctx,g))*.17] as [ActionKind,number]).sort((a,b)=>b[1]-a[1]);const best=ss[0]??['wait',.5] as [ActionKind,number],second=ss[1]??best,q=clamp(.72*best[1]+.28*(best[1]-second[1]+.5)),out=zero();for(const [a,s] of ss.slice(0,3))out[a]=clamp((s-.5)*.06,-.06,.06);this.state.subgoals.push({vector:g,value01:best[1],confidence01:q,depth:budget>.7?3:budget>.4?2:1,action:best[0]});this.state.subgoals=this.state.subgoals.slice(-64);this.state.stats.plans++;return {bias:out,quality:q};}
 private verify(ctx:number[],action:ActionKind,pred:number,conf:number){if(this.state.lesions['verifier'])return .5;const past=this.state.replay.filter(r=>r.action===action&&dist(ctx,r.context)<.22).slice(-24);if(!past.length)return clamp(.5+.25*conf);this.state.stats.verifications++;const emp=mean(past.map(r=>r.reward01));return clamp(.50*clamp(1-Math.abs(emp-pred))+.30*conf+.20*(1-mean(past.map(r=>r.error01))));}
 private plastic(ctx:number[],reward:number,error:number,conf:number){if(this.state.lesions['identity-plasticity'])return .5;const x=v(ctx);let sum=0;for(let i=0;i<256;i++){const z=Math.tanh((x[i%12]-.5)*1.7+this.state.identity[i]*1.35);this.state.eligibility[i]=clamp(.965*this.state.eligibility[i]+.035*Math.abs(z));const lr=.0012*(.35+.65*this.state.eligibility[i])*(.4+reward)*(1+.8*error)*(.55+conf);this.state.identity[i]=clamp(this.state.identity[i]*(1-lr)+z*lr,-1,1);sum+=z;}this.state.stats.neuralUpdates++;return clamp(.5+sum/(256*2));}
 beforeDecision(i:B721Input):B721Output{
  const st=performance.now();
  if(!this.state.enabled)return {actionBias:zero(),predictiveBias:zero(),phase:'observe',budget01:.05,confidence01:.5,ood01:.5,reversal01:0,memory01:.5,planning01:.5,verifier01:.5,plasticity01:.5,experiment01:0};
  this.state.tick=i.tick; this.state.stats.decisions++;
  const ctx=v(i.context01),o=this.ood(ctx),r=this.reversal(i.predictionError01),pc=this.phaseFor(i);
  if(pc.phase!==this.state.lastPhase)this.state.stats.phaseSwitches++; this.state.lastPhase=pc.phase;
  const rr=this.replay(ctx,pc.budget); const mem=rr.length?mean(rr.map(x=>clamp(.52*(1-dist(ctx,x.context))+.28*x.verified01+.20*x.priority01))):this.tree(ctx,i.tick,i.novelty01,i.confidence01);
  const pl=this.plan(ctx,i.goalVector,pc.budget);
  const ex=this.state.lesions['experiment-selector']?0:clamp(.32*o+.27*r+.21*i.predictionError01+.20*i.novelty01);
  const conf=clamp(.24*i.confidence01+.20*mem+.18*pl.quality+.18*(1-o)+.12*(1-i.predictionError01)+.08*this.state.phase[pc.phase].value01);
  const b=zero(),pb=zero(); let verSum=0;
  for(const a of ACTIONS){
   const w=this.world(a,ctx),p=mean(this.state.models.filter(m=>m.action===a).map(m=>this.pred(ctx,m))),q=this.verify(ctx,a,p,conf); verSum+=q;
   let x=(w-.5)*.038+(mem-.5)*.024+(pl.bias[a]??0)+(q-.5)*.030+this.policyScore(a,ctx)+(this.state.phase[pc.phase].value01-.5)*.018;
   if(r>.58&&a==='verify')x+=.018; if(ex>.65&&(a==='explore'||a==='verify'))x+=.014; if(pc.phase==='recover'&&a==='reflect')x+=.016; if(pc.phase==='consolidate'&&a==='respond')x+=.008;
   b[a]=clamp(x,-.075,.075); pb[a]=clamp(.05*(p-.5)+.02*(q-.5)+(pl.bias[a]??0)*.55,-.06,.06);
  }
  const plastic=this.plastic(ctx,.5,i.predictionError01,conf),vq=clamp(verSum/ACTIONS.length),eb=clamp(ex*(.45+.55*pc.budget));
  this.state.stats.experiments+=eb>.65?1:0; this.state.stats.lastLatencyMs=performance.now()-st;
  this.state.stats.lastOOD01=o; this.state.stats.lastReversal01=r; this.state.stats.lastPlanning01=pl.quality; this.state.stats.lastVerifier01=vq; this.state.stats.lastPlasticity01=plastic;
  return {actionBias:b,predictiveBias:pb,phase:pc.phase,budget01:pc.budget,confidence01:conf,ood01:o,reversal01:r,memory01:mem,planning01:pl.quality,verifier01:vq,plasticity01:plastic,experiment01:eb};
 }
 afterOutcome(i:{tick:number;action:ActionKind;context01:number[];nextContext01:number[];reward01:number;predictionError01:number;verified01:number;success01:number;phase?:Phase;}){
  if(!this.state.enabled)return;
  const ctx=v(i.context01),r=clamp(i.reward01),e=clamp(i.predictionError01),ver=clamp(i.verified01);
  this.state.stats.updates++; this.ood(ctx); this.reversal(e); this.tree(ctx,i.tick,.45+.45*i.success01,.45+.45*ver);
  const pr=clamp(.28*e+.25*(1-ver)+.22*this.state.ood01+.15*this.state.reversal01+.10*i.success01);
  this.state.replay.push({tick:i.tick,context:ctx,action:i.action,reward01:r,error01:e,surprise01:clamp(.5*e+.5*this.state.ood01),verified01:ver,phase:i.phase??'observe',priority01:pr,uses:0});
  this.state.replay=this.state.replay.sort((a,b)=>b.priority01-a.priority01).slice(-2048);
  for(const m of this.state.models.filter(m=>m.action===i.action)){
   const pred=this.pred(ctx,m),err=r-pred,rate=.008*(1+.8*this.state.ood01+.6*this.state.reversal01)/(1+m.uses*.002);
   for(let j=0;j<12;j++)m.weights[j]=clamp(m.weights[j]+err*(ctx[j]-.5)*rate,-1.2,1.2);
   m.bias=clamp(m.bias+err*rate,-2,2); m.variance01=clamp(.96*m.variance01+.04*Math.abs(err)); m.uses++; m.revision++; if(Math.abs(err)<.2)m.successes++; this.state.stats.modelUpdates++;
  }
  const pp=this.state.policy[i.action],pe=r-.5,lr=.018*(1+.75*this.state.reversal01+.5*this.state.ood01)/(1+pp.uses*.0015);
  for(let j=0;j<12;j++)pp.weights[j]=clamp(pp.weights[j]+pe*(ctx[j]-.5)*lr,-1.2,1.2);
  pp.bias=clamp(pp.bias+pe*lr,-1.5,1.5); pp.value01=clamp(.97*pp.value01+.03*r); pp.uses++;
  if(ver>.75){
   const contrast=r-.5;
   for(const a of ACTIONS){if(a===i.action)continue; const q=this.state.policy[a],cLR=lr*.22;
    for(let j=0;j<12;j++)q.weights[j]=clamp(q.weights[j]-contrast*(ctx[j]-.5)*cLR,-1.2,1.2);
    q.bias=clamp(q.bias-contrast*cLR,-1.5,1.5); q.uses++;
   }
  }
  const recent=this.state.replay.slice(-24);
  if(recent.length>=8)this.state.regimeShift01=clamp(.90*this.state.regimeShift01+.45*Math.abs(mean(recent.slice(-8).map(x=>x.reward01))-mean(recent.slice(-8,-4).map(x=>x.reward01)))+.12*e);
  const p=this.state.phase[i.phase??'observe']; const u=clamp(.55*r+.25*ver+.20*(1-e));
  p.uses++; p.value01=clamp(.97*p.value01+.03*u); if(u>.62)p.wins++;
  this.state.stats.lastHoldout01=clamp(.55*r+.45*(1-e));
 }
 evaluate(input:B721Input,lesion:Record<string,boolean>){const s=this.snapshot();this.setLesions(lesion);const on=this.beforeDecision(input);this.restore(s);const off=this.beforeDecision(input);this.restore(s);return {effect01:mean(ACTIONS.map(a=>Math.abs(on.actionBias[a]-off.actionBias[a]))),meanOn:mean(Object.values(on.actionBias)),meanOff:mean(Object.values(off.actionBias))};}
}
