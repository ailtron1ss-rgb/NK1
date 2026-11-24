import type { ActionKind } from '../core/types.ts';

type Variant='memory-abstraction'|'negative-transfer-guard'|'skill-library'|'world-ensemble'|'meta-controller'|'experiment-policy'|'compute-governor'|'identity-consolidator';
type Mode='minimal'|'normal'|'deep'|'research';
const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const VARIANTS:Variant[]=['memory-abstraction','negative-transfer-guard','skill-library','world-ensemble','meta-controller','experiment-policy','compute-governor','identity-consolidator'];
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:.5));
const signed=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const mean=(x:number[])=>x.length?x.reduce((a,b)=>a+b,0)/x.length:.5;
const dot=(a:number[],b:number[])=>{let s=0;for(let i=0;i<Math.min(a.length,b.length);i++)s+=(a[i]??0)*(b[i]??0);return s;};
const norm=(a:number[])=>Math.sqrt(Math.max(1e-9,dot(a,a)));
const cos=(a:number[],b:number[])=>clamp((dot(a,b)/(norm(a)*norm(b))+1)/2);
const d=(a:number[],b:number[])=>mean(Array.from({length:Math.min(a.length,b.length)},(_,i)=>Math.abs((a[i]??0)-(b[i]??0))));
const c8=(x:number[])=>Array.from({length:8},(_,i)=>clamp(x[i%x.length]??.5));

export interface MetaEpisode {tick:number;context:number[];action:ActionKind;reward01:number;surprise01:number;success01:number;verified01:number;abstractTier:0|1|2|3;transfer01:number;error01:number;}
export interface SkillNode {key:string;action:ActionKind;context:number[];value01:number;confidence01:number;uses:number;successes:number;failures:number;transfer01:number;age:number;}
export interface B451Input {
  tick:number;context01:number[];baseUtilities:Record<ActionKind,number>;b421Predictive:Record<ActionKind,number>;b421Bias:Record<ActionKind,number>;
  confidence01:number;uncertainty01:number;predictionError01:number;novelty01:number;surprise01:number;goalVector?:number[];selfVector?:number[];memoryStrength01?:number;motivation01?:number;complexity01?:number;
}
export interface B451Output {
  actionBias:Record<ActionKind,number>;predictiveBias:Record<ActionKind,number>;mode:Mode;computeBudget01:number;strategy:string;memoryAbstraction01:number;negativeTransferGuard01:number;skillTransfer01:number;worldAgreement01:number;experimentPressure01:number;identityCoherence01:number;confidence01:number;expectedInformationGain01:number;
}
export interface B451State {
 version:1;enabled:boolean;tick:number;lesions:Record<Variant,boolean>;weights:Record<Variant,number>;losses:Record<Variant,number>;uses:Record<Variant,number>;
 episodes:MetaEpisode[];skills:SkillNode[];abstractions:Array<{key:string;vector:number[];utility01:number;confidence01:number;count:number;lastTick:number}>;
 transitions:Array<{action:ActionKind;state:number[];next:number[];reward01:number;count:number;loss01:number}>;
 diagnostics:{decisions:number;updates:number;abstractions:number;skills:number;experiments:number;guardEvents:number;holdouts:number;restartCount:number;lastCausalDelta01:number;lastComputeBudget01:number;lastMode:Mode;bestStrategy:Variant;holdoutScore01:number;developmentalGain01:number;memoryCompression01:number;strategySwitches:number;};
 last:{context:number[];actionScore:Record<ActionKind,number>;mode:Mode;computeBudget01:number;strategy:string;memoryAbstraction01:number;negativeTransferGuard01:number;skillTransfer01:number;worldAgreement01:number;experimentPressure01:number;identityCoherence01:number;confidence01:number;};
}

const DEFAULT:Record<Variant,number>={'memory-abstraction':.14,'negative-transfer-guard':.12,'skill-library':.14,'world-ensemble':.15,'meta-controller':.16,'experiment-policy':.10,'compute-governor':.09,'identity-consolidator':.10};
export const defaultB451B500State=():B451State=>({
 version:1,enabled:true,tick:0,lesions:Object.fromEntries(VARIANTS.map(v=>[v,false])) as Record<Variant,boolean>,weights:{...DEFAULT},losses:Object.fromEntries(VARIANTS.map(v=>[v,.25])) as Record<Variant,number>,uses:Object.fromEntries(VARIANTS.map(v=>[v,0])) as Record<Variant,number>,
 episodes:[],skills:[],abstractions:[],transitions:[],diagnostics:{decisions:0,updates:0,abstractions:0,skills:0,experiments:0,guardEvents:0,holdouts:0,restartCount:0,lastCausalDelta01:0,lastComputeBudget01:.3,lastMode:'normal',bestStrategy:'meta-controller',holdoutScore01:0,developmentalGain01:0,memoryCompression01:0,strategySwitches:0},last:{context:Array(8).fill(.5),actionScore:Object.fromEntries(ACTIONS.map(a=>[a,.5])) as Record<ActionKind,number>,mode:'normal',computeBudget01:.3,strategy:'meta-controller',memoryAbstraction01:.5,negativeTransferGuard01:.5,skillTransfer01:.5,worldAgreement01:.5,experimentPressure01:0,identityCoherence01:.5,confidence01:.5}
});

export class B451B500MetaCognitiveDevelopmentCore {
 private state:B451State=defaultB451B500State();
 snapshot(){return structuredClone(this.state);}
 diagnostics(){return structuredClone(this.state.diagnostics);}
 restore(source?:Partial<B451State>){const d0=defaultB451B500State();const s:any=source??{};this.state={...d0,...structuredClone(s),lesions:{...d0.lesions,...(s.lesions??{})},weights:{...d0.weights,...(s.weights??{})},losses:{...d0.losses,...(s.losses??{})},uses:{...d0.uses,...(s.uses??{})},episodes:Array.isArray(s.episodes)?structuredClone(s.episodes).slice(-768):[],skills:Array.isArray(s.skills)?structuredClone(s.skills).slice(-192):[],abstractions:Array.isArray(s.abstractions)?structuredClone(s.abstractions).slice(-192):[],transitions:Array.isArray(s.transitions)?structuredClone(s.transitions).slice(-384):[],diagnostics:{...d0.diagnostics,...(s.diagnostics??{})},last:{...d0.last,...(s.last??{}),actionScore:{...d0.last.actionScore,...(s.last?.actionScore??{})}}};}
 markRestart(){this.state.diagnostics.restartCount++;}
 setLesions(v:Partial<Record<Variant,boolean>>){this.state.lesions={...this.state.lesions,...v};}
 setEnabled(v:boolean){this.state.enabled=Boolean(v);}
 private normWeights(){const sum=VARIANTS.reduce((s,k)=>s+(this.state.lesions[k]?0:(this.state.weights[k]??0)),0)||1;for(const k of VARIANTS)this.state.weights[k]=this.state.lesions[k]?0:(this.state.weights[k]??DEFAULT[k])/sum;}
 private chooseMode(input:B451Input):{mode:Mode;budget:number}{if(this.state.lesions['compute-governor'])return {mode:'normal',budget:.36};const c=clamp(.22*input.uncertainty01+.22*input.predictionError01+.18*input.novelty01+.16*input.surprise01+.12*(input.complexity01??.5)+.10*(1-input.confidence01));const b=clamp(.10+.90*c);return {mode:b>.80?'research':b>.58?'deep':b>.34?'normal':'minimal',budget:b};}
 private retrieveAbstract(ctx:number[],action:ActionKind,limit:number){if(this.state.lesions['memory-abstraction'])return {strength:.5,transfer:.5,coherence:.5};const candidates=this.state.abstractions.filter(a=>a.count>0).map(a=>({...a,score:clamp(.62*(1-d(ctx,a.vector))+.20*a.utility01+.18*a.confidence01)})).sort((a,b)=>b.score-a.score).slice(0,limit);if(!candidates.length)return {strength:.5,transfer:.5,coherence:.5};return {strength:mean(candidates.map(x=>x.score)),transfer:mean(candidates.map(x=>Math.max(0,1-d(ctx,x.vector)))),coherence:mean(candidates.map(x=>x.confidence01))};}
 private negativeGuard(ctx:number[],action:ActionKind){if(this.state.lesions['negative-transfer-guard'])return .5;const near=this.state.episodes.filter(e=>e.action===action).slice(-48);if(!near.length)return .5;const mismatch=mean(near.map(e=>d(ctx,e.context)));const contradictions=mean(near.map(e=>e.reward01<.35?1:0));const guard=clamp(.15+.65*mismatch+.20*contradictions);if(guard>.62)this.state.diagnostics.guardEvents++;return guard;}
 private skillTransfer(ctx:number[],action:ActionKind){if(this.state.lesions['skill-library'])return .5;const rows=this.state.skills.filter(s=>s.action===action).map(s=>({...s,score:clamp(.56*(1-d(ctx,s.context))+.22*s.confidence01+.22*s.transfer01)})).sort((a,b)=>b.score-a.score).slice(0,4);return rows.length?mean(rows.map(r=>r.score)):.5;}
 private worldAgreement(ctx:number[],action:ActionKind,depth:number){if(this.state.lesions['world-ensemble'])return .5;const rows=this.state.transitions.filter(t=>t.action===action);if(!rows.length)return .5;const nearest=rows.slice(-Math.min(64,rows.length)).sort((a,b)=>d(ctx,a.state)-d(ctx,b.state)).slice(0,Math.max(2,depth));const nextMean=Array.from({length:8},(_,i)=>mean(nearest.map(r=>r.next[i]??.5)));const var01=mean(Array.from({length:8},(_,i)=>mean(nearest.map(r=>Math.abs((r.next[i]??.5)-nextMean[i]!)))));return clamp(.82*(1-var01)+.18*mean(nearest.map(r=>clamp(r.reward01))));}
 private identityCoherence(input:B451Input){if(this.state.lesions['identity-consolidator'])return .5;const self=input.selfVector?c8(input.selfVector):c8(input.context01);const goal=input.goalVector?c8(input.goalVector):c8(input.context01);return clamp(.48*cos(self,goal)+.32*(1-input.predictionError01)+.20*(1-input.novelty01*.35));}
 private experimentPressure(input:B451Input,confidence:number,guard:number){if(this.state.lesions['experiment-policy'])return 0;return clamp(.40*input.novelty01+.30*input.uncertainty01+.20*(1-confidence)+.10*(1-guard));}
 private strategy(input:B451Input,ctx:number[],mode:Mode){if(this.state.lesions['meta-controller'])return 'conservative-memory';const guard=this.negativeGuard(ctx,'verify');const info=this.experimentPressure(input,.5,guard);const skill=this.skillTransfer(ctx,'explore');if(info>.72&&guard<.65)return 'information-seeking';if(skill>.70)return 'skill-transfer';if(input.predictionError01>.62)return 'world-repair';if(input.novelty01<.25)return 'procedural-reuse';if(mode==='research')return 'deep-counterfactual';return 'balanced-development';}
 beforeDecision(input:B451Input):B451Output {
  if (!this.state.enabled) {
    return {
      actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,
      predictiveBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,
      mode:'minimal',computeBudget01:0.05,strategy:'disabled',memoryAbstraction01:.5,
      negativeTransferGuard01:.5,skillTransfer01:.5,worldAgreement01:.5,experimentPressure01:0,
      identityCoherence01:.5,confidence01:.5,expectedInformationGain01:.5,
    };
  }
  this.state.tick=input.tick;
  this.state.diagnostics.decisions++;
  const ctx=c8(input.context01);
  const {mode,budget}=this.chooseMode(input);
  const depth=mode==='research'?4:mode==='deep'?3:mode==='normal'?2:1;
  const mem=this.retrieveAbstract(ctx,'verify',mode==='research'?8:mode==='deep'?5:mode==='normal'?3:1);
  const guard=this.negativeGuard(ctx,'verify');
  const skill=mean(ACTIONS.map(a=>this.skillTransfer(ctx,a)));
  const world=mean(ACTIONS.map(a=>this.worldAgreement(ctx,a,depth)));
  const identity=this.identityCoherence(input);
  const experiment=this.experimentPressure(input,.5,guard);
  const strategy=this.strategy(input,ctx,mode);
  const confidence=clamp(
    .22*input.confidence01+.17*mem.coherence+.16*(1-input.predictionError01)+
    .15*world+.12*identity+.10*skill+.08*(1-guard),
  );
  const actionBias=Object.fromEntries(ACTIONS.map(a=>{
    const causal=(input.b421Predictive[a]??.5)-.5;
    const inherited=input.b421Bias[a]??0;
    const skillA=this.skillTransfer(ctx,a);
    const worldA=this.worldAgreement(ctx,a,depth);
    let score=.35*inherited+.012*signed(identity-.5)+.010*signed(causal);
    if(strategy==='information-seeking'&&a==='verify') score+=.035*experiment;
    if(strategy==='skill-transfer') score+=.028*signed(skillA-.5);
    if(strategy==='world-repair') score+=.025*signed(worldA-.5);
    if(strategy==='procedural-reuse') score+=.022*signed(mem.strength-.5);
    if(strategy==='deep-counterfactual'&&(a==='reflect'||a==='explore')) score+=.020*input.uncertainty01;
    return [a,signed(score)] as const;
  })) as Record<ActionKind,number>;
  const predictiveBias=Object.fromEntries(ACTIONS.map(a=>{
    const worldA=this.worldAgreement(ctx,a,depth);
    const skillA=this.skillTransfer(ctx,a);
    let x=.035*signed(worldA-.5)+.022*signed(skillA-.5);
    if(guard>.68&&a!=='verify') x*=.65;
    return [a,signed(x)] as const;
  })) as Record<ActionKind,number>;
  const expectedInfo=clamp(
    .42*input.novelty01+.28*input.uncertainty01+.18*(1-input.confidence01)+.12*(1-mem.strength),
  );
  this.state.last={
    context:ctx,actionScore:input.b421Predictive,mode,computeBudget01:budget,strategy,
    memoryAbstraction01:mem.strength,negativeTransferGuard01:guard,skillTransfer01:skill,
    worldAgreement01:world,experimentPressure01:experiment,identityCoherence01:identity,confidence01:confidence,
  };
  this.state.diagnostics.lastComputeBudget01=budget;
  this.state.diagnostics.lastMode=mode;
  this.state.diagnostics.bestStrategy=(strategy==='skill-transfer'?'skill-library':strategy==='procedural-reuse'?'memory-abstraction':strategy==='world-repair'?'world-ensemble':strategy==='information-seeking'?'experiment-policy':'meta-controller') as Variant;
  this.state.diagnostics.developmentalGain01=clamp(
    this.state.diagnostics.developmentalGain01*.98+(confidence*(1-input.predictionError01))*.02,
  );
  this.normWeights();
  return {
    actionBias,predictiveBias,mode,computeBudget01:budget,strategy,memoryAbstraction01:mem.strength,
    negativeTransferGuard01:guard,skillTransfer01:skill,worldAgreement01:world,experimentPressure01:experiment,
    identityCoherence01:identity,confidence01:confidence,expectedInformationGain01:expectedInfo,
  };
 }

 afterOutcome(input:{tick:number;action:ActionKind;context01:number[];nextContext01?:number[];reward01:number;surprise01:number;verified01:number;success01?:number;predictionError01:number}) {
  if(!this.state.enabled) return;
  const ctx=c8(input.context01),next=c8(input.nextContext01??input.context01);
  const r=clamp(input.reward01),s=clamp(input.success01??r),err=clamp(input.predictionError01);
  const tier:(0|1|2|3)=s>.82&&input.verified01>.8&&err<.25?3:s>.65?2:r>.45?1:0;
  const transfer=clamp(.55*(1-err)+.25*input.verified01+.20*(1-d(ctx,next)));
  this.state.episodes.push({tick:input.tick,context:ctx,action:input.action,reward01:r,surprise01:clamp(input.surprise01),success01:s,verified01:clamp(input.verified01),abstractTier:tier,transfer01:transfer,error01:err});
  const key=`${input.action}:${Math.round(mean(ctx)*32)}`;
  let skill=this.state.skills.find(x=>x.key===key);
  if(!skill){
    skill={key,action:input.action,context:ctx,value01:r,confidence01:.42,uses:0,successes:0,failures:0,transfer01:transfer,age:0};
    this.state.skills.push(skill);this.state.diagnostics.skills++;
  }
  skill.uses++;skill.age=0;
  skill.value01=clamp(skill.value01*.82+r*.18);
  skill.confidence01=clamp(skill.confidence01*.86+.14*s);
  skill.transfer01=clamp(skill.transfer01*.84+.16*transfer);
  if(s>.6) skill.successes++; else skill.failures++;
  this.state.transitions.push({action:input.action,state:ctx,next,reward01:r,count:1,loss01:err});
  const abstractionKey=`${tier}:${Math.round(mean(ctx)*24)}`;
  let abs=this.state.abstractions.find(a=>a.key===abstractionKey);
  if(!abs){
    abs={key:abstractionKey,vector:ctx,utility01:r,confidence01:.45,count:0,lastTick:input.tick};
    this.state.abstractions.push(abs);this.state.diagnostics.abstractions++;
  }
  const alpha=tier===3?.18:tier===2?.12:.06;
  abs.vector=abs.vector.map((v,i)=>clamp(v*(1-alpha)+ctx[i]!*alpha));
  abs.utility01=clamp(abs.utility01*.86+r*.14);
  abs.confidence01=clamp(abs.confidence01*.88+.12*Math.max(input.verified01,s));
  abs.count++;abs.lastTick=input.tick;
  for(const v of VARIANTS){
    this.state.uses[v]=(this.state.uses[v]??0)+1;
    const target=v==='memory-abstraction'?(1-(this.state.abstractions.at(-1)?.confidence01??.5)):
      v==='negative-transfer-guard'?(err>.55?.9:.2):
      v==='skill-library'?(1-(skill.confidence01??.5)):
      v==='world-ensemble'?err:
      v==='experiment-policy'?Math.abs(.5-this.state.last.experimentPressure01):
      v==='identity-consolidator'?Math.abs(.5-this.state.last.identityCoherence01):
      v==='compute-governor'?Math.abs(this.state.last.computeBudget01-.5):
      Math.abs(.5-this.state.last.confidence01);
    this.state.losses[v]=clamp((this.state.losses[v]??.25)*.92+target*.08);
    if(this.state.losses[v]<.30) this.state.weights[v]=clamp((this.state.weights[v]??DEFAULT[v])*(1+.02*(.30-this.state.losses[v])));
  }
  this.normWeights();
  if(this.state.episodes.length>768) this.state.episodes.splice(0,this.state.episodes.length-768);
  if(this.state.skills.length>192) this.state.skills.splice(0,this.state.skills.length-192);
  if(this.state.abstractions.length>192) this.state.abstractions.splice(0,this.state.abstractions.length-192);
  if(this.state.transitions.length>384) this.state.transitions.splice(0,this.state.transitions.length-384);
  this.state.diagnostics.updates++;
  this.state.diagnostics.developmentalGain01=clamp(this.state.diagnostics.developmentalGain01*.985+(1-err)*.015);
  this.state.diagnostics.memoryCompression01=clamp(
    .55*this.state.diagnostics.memoryCompression01+.45*(1-Math.min(1,this.state.abstractions.length/192)),
  );
  if(this.state.last.experimentPressure01>.72) this.state.diagnostics.experiments++;
 }

 evaluateLesion(input:B451Input,lesion:Partial<Record<Variant,boolean>>){
  const snap=this.snapshot();
  const on=this.beforeDecision(input);
  this.restore(snap);this.setLesions(lesion);
  const off=this.beforeDecision(input);
  const delta=mean(ACTIONS.map(a=>
    Math.abs((on.actionBias[a]??0)-(off.actionBias[a]??0))+Math.abs((on.predictiveBias[a]??0)-(off.predictiveBias[a]??0)),
  ));
  this.restore(snap);this.state.diagnostics.holdouts++;this.state.diagnostics.lastCausalDelta01=delta;
  return {delta01:delta,on,off};
 }
 markHoldout(score01:number){this.state.diagnostics.holdouts++;this.state.diagnostics.holdoutScore01=clamp(this.state.diagnostics.holdoutScore01*.9+clamp(score01)*.1);}
}
