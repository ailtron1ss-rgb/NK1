import type { ActionKind } from '../core/types.ts';

type Mode='minimal'|'normal'|'deep'|'research';
type Strategy='recall'|'plan'|'reflect'|'experiment'|'skill-transfer'|'identity'|'stabilize';
type Variant='meta-policy'|'dual-memory'|'world-model'|'skill-evolution'|'neural-code'|'experiment-selector'|'compute-governor'|'confidence'|'provenance';
const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const STRATEGIES:Strategy[]=['recall','plan','reflect','experiment','skill-transfer','identity','stabilize'];
const VARIANTS:Variant[]=['meta-policy','dual-memory','world-model','skill-evolution','neural-code','experiment-selector','compute-governor','confidence','provenance'];
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:.5));
const mean=(x:number[])=>x.length?x.reduce((a,b)=>a+b,0)/x.length:.5;
const dist=(a:number[],b:number[])=>mean(Array.from({length:Math.min(a.length,b.length)},(_,i)=>Math.abs((a[i]??.5)-(b[i]??.5))));
const dot=(a:number[],b:number[])=>{let s=0;for(let i=0;i<Math.min(a.length,b.length);i++)s+=(a[i]??0)*(b[i]??0);return s;};
const norm=(a:number[])=>Math.sqrt(Math.max(1e-9,dot(a,a)));
const cos=(a:number[],b:number[])=>clamp((dot(a,b)/(norm(a)*norm(b))+1)/2);
const v8=(x:number[])=>Array.from({length:8},(_,i)=>clamp(x[i%x.length]??.5));
const zeroActions=()=>Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;

export interface B561Input {tick:number;
context01:number[];
baseUtilities:Record<ActionKind,number>;
b501Bias?:Record<ActionKind,number>;
b501PredictiveBias?:Record<ActionKind,number>;
uncertainty01:number;
predictionError01:number;
novelty01:number;
surprise01:number;
confidence01:number;
goalVector?:number[];
selfVector?:number[];
motivation01?:number;
complexity01?:number;
modeHint?:Mode;
}
export interface B561Output {actionBias:Record<ActionKind,number>;
predictiveBias:Record<ActionKind,number>;
strategy:Strategy;
mode:Mode;
computeBudget01:number;
confidence01:number;
memoryRecall01:number;
worldForecast01:number;
skillTransfer01:number;
neuralSignal01:number;
informationGain01:number;
experimentPressure01:number;
identityCoherence01:number;
metaPolicyEntropy01:number;
}
export interface B561Episode {tick:number;
context:number[];
action:ActionKind;
reward01:number;
error01:number;
verified01:number;
success01:number;
strategy:Strategy;
confidence01:number;
outcomeVector:number[];
}
export interface B561Skill {id:string;
action:ActionKind;
prototype:number[];
utility01:number;
confidence01:number;
uses:number;
successes:number;
failures:number;
createdTick:number;
lastUsedTick:number;
}
export interface B561State {version:2;
enabled:boolean;
tick:number;
lesions:Record<Variant,boolean>;
policy:Record<Strategy,{uses:number;
value01:number;
uncertainty01:number;
featureWeights:number[]}>;
actionPolicy:Record<ActionKind,{weights:number[];bias01:number;uses:number}>;
regime:{shift01:number;recentError01:number;stableError01:number;changeCount:number};
episodes:B561Episode[];
skills:B561Skill[];
events:Array<{tick:number;
context:number[];
action:ActionKind;
reward01:number;
verified01:number;
provenance01:number}>;
beliefs:Array<{id:string;
vector:number[];
confidence01:number;
revision:number;
lastTick:number}>;
world:Array<{action:ActionKind;
state:number[];
next:number[];
reward01:number;
error01:number;
uses:number}>;
population:{weights:number[];
activity:number[];
plasticity01:number;
cycles:number};
calibration:{samples:number;
brier01:number;
bias01:number};
diagnostics:{decisions:number;
updates:number;
retrievals:number;
consolidations:number;
skillUpdates:number;
strategySwitches:number;
experiments:number;
counterfactuals:number;
neuralUpdates:number;
holdouts:number;
restartCount:number;
lastCausalDelta01:number;
lastHoldout01:number;
lastStrategy:Strategy;
lastMode:Mode;
lastCompute01:number;
lastGain01:number;
lastEntropy01:number;
lastLatencyMs:number;
};
last:{context:number[];
strategy:Strategy;
mode:Mode;
confidence01:number;
recall01:number;
world01:number;
skill01:number;
neural01:number;
infoGain01:number;
};
}
const defaultPolicy=():Record<Strategy,{uses:number;
value01:number;
uncertainty01:number;
featureWeights:number[]}>=>(Object.fromEntries(STRATEGIES.map((s,i)=>[s,{uses:0,value01:.5,uncertainty01:.5,featureWeights:Array.from({length:6},(_,j)=>.42+((i*3+j)%5)*.035)}])) as any);
export const defaultB561B620State=():B561State=>({version:2,
enabled:true,
tick:0,
lesions:Object.fromEntries(VARIANTS.map(v=>[v,
false])) as Record<Variant,
boolean>,
policy:defaultPolicy(),
actionPolicy:Object.fromEntries(ACTIONS.map((a,i)=>[a,{weights:Array.from({length:8},(_,j)=>Math.sin((i+1)*(j+2))*.015),bias01:0,uses:0}])) as Record<ActionKind,{weights:number[];
bias01:number;
uses:number}>,
regime:{shift01:0,recentError01:.2,stableError01:.2,changeCount:0},
episodes:[],
skills:[],
events:[],
beliefs:[],
world:[],
population:{weights:Array.from({length:64},
(_,
i)=>Math.sin(i*.71)*.06),
activity:Array(64).fill(.5),
plasticity01:.055,
cycles:0},
calibration:{samples:0,
brier01:.25,
bias01:0},
diagnostics:{decisions:0,
updates:0,
retrievals:0,
consolidations:0,
skillUpdates:0,
strategySwitches:0,
experiments:0,
counterfactuals:0,
neuralUpdates:0,
holdouts:0,
restartCount:0,
lastCausalDelta01:0,
lastHoldout01:0,
lastStrategy:'recall',
lastMode:'normal',
lastCompute01:.25,
lastGain01:.5,
lastEntropy01:1,
lastLatencyMs:0},
last:{context:Array(8).fill(.5),
strategy:'recall',
mode:'normal',
confidence01:.5,
recall01:.5,
world01:.5,
skill01:.5,
neural01:.5,
infoGain01:.5}});

export class B561B620MetaCognitiveEvolutionCore {
 private state=defaultB561B620State();
 snapshot(){return structuredClone(this.state);
} diagnostics(){return structuredClone(this.state.diagnostics);
} restore(source?:Partial<B561State>){const d=defaultB561B620State(),s:any=source??{};
this.state={...d,
...structuredClone(s),
lesions:{...d.lesions,
...(s.lesions??{})},
policy:{...d.policy,
...(s.policy??{})},
episodes:Array.isArray(s.episodes)?structuredClone(s.episodes).slice(-1024):[],
skills:Array.isArray(s.skills)?structuredClone(s.skills).slice(-96):[],
events:Array.isArray(s.events)?structuredClone(s.events).slice(-512):[],
beliefs:Array.isArray(s.beliefs)?structuredClone(s.beliefs).slice(-256):[],
world:Array.isArray(s.world)?structuredClone(s.world).slice(-768):[],
population:{...d.population,
...(s.population??{}),
weights:Array.isArray(s.population?.weights)?s.population.weights.slice(0,
64):d.population.weights,
activity:Array.isArray(s.population?.activity)?s.population.activity.slice(0,
64):d.population.activity},
calibration:{...d.calibration,
...(s.calibration??{})},
diagnostics:{...d.diagnostics,
...(s.diagnostics??{})},
last:{...d.last,
...(s.last??{})}};
}
 markRestart(){this.state.diagnostics.restartCount++;}
 setEnabled(v:boolean){this.state.enabled=Boolean(v);} setLesions(v:Partial<Record<Variant,boolean>>){this.state.lesions={...this.state.lesions,...v};}
 private compute(input:B561Input){const c=clamp(.25*input.uncertainty01+.24*input.predictionError01+.19*input.novelty01+.12*input.surprise01+.10*(input.complexity01??.5)+.10*(1-input.confidence01));
let mode:Mode=c>.82?'research':c>.62?'deep':c>.34?'normal':'minimal';
if(input.modeHint&&mode!=='research')mode=input.modeHint;
const budget=clamp(.06+.94*c);
if(this.state.lesions['compute-governor'])return {mode:'normal' as Mode,budget:.35};
return {mode,budget};
}
 private featureVector(input:B561Input,recall:number,world:number,skill:number,identity:number){return [clamp(input.uncertainty01),clamp(input.predictionError01),clamp(input.novelty01),clamp(1-input.confidence01),clamp(recall),clamp(.5+.5*(world-skill)+.25*(identity-.5))];
}
 private chooseStrategy(input:B561Input,features:number[]):{strategy:Strategy;
entropy:number}{const scores=STRATEGIES.map(s=>{if(this.state.lesions['meta-policy'])return [s,.5] as const;
const p=this.state.policy[s];
const prior=p.featureWeights.reduce((a,w,i)=>a+w*(features[i]??.5),0)/p.featureWeights.length;
const u=Math.sqrt(Math.log(2+this.state.diagnostics.decisions)/(1+p.uses));
const contextual=0.45*prior+0.35*p.value01+0.20*u;
return [s,contextual] as const;
});
scores.sort((a,b)=>b[1]-a[1]);
const ex=scores.map(([,v])=>Math.exp(v*4));
const z=ex.reduce((a,b)=>a+b,0);
const probs=ex.map(v=>v/z);
const entropy=-probs.reduce((a,p)=>a+(p>1e-9?p*Math.log(p):0),0)/Math.log(probs.length);
return {strategy:scores[0][0],entropy:clamp(entropy)};
}
 private recall(ctx:number[],budget:number){if(this.state.lesions['dual-memory'])return {recall:.5,belief:.5,continuity:.5};
const depth=budget>.82?4:budget>.58?3:budget>.32?2:1;
const cand=this.state.beliefs.map(b=>({...b,score:clamp(.62*(1-dist(ctx,b.vector))+.23*b.confidence01+.15*(1-Math.min(1,Math.abs(b.revision)/8)))})).sort((a,b)=>b.score-a.score).slice(0,Math.max(2,depth*2));
this.state.diagnostics.retrievals++;
return {recall:mean(cand.map(x=>x.score)),belief:mean(cand.map(x=>x.confidence01)),continuity:mean(cand.map(x=>clamp(1-dist(ctx,x.vector)+.12*Math.min(1,x.revision/5))))};
}
 private worldPredict(ctx:number[],action:ActionKind,limit:number){if(this.state.lesions['world-model'])return .5;
const rows=this.state.world.filter(r=>r.action===action).slice(-96).sort((a,b)=>dist(ctx,a.state)-dist(ctx,b.state)).slice(0,Math.max(2,limit));
if(!rows.length)return .5;
const avg=Array.from({length:8},(_,i)=>mean(rows.map(r=>r.next[i]??.5)));
const dispersion=mean(rows.map(r=>dist(r.next,avg)));
const reward=mean(rows.map(r=>r.reward01));
return clamp(.58*(1-dispersion)+.30*reward+.12*mean(rows.map(r=>clamp(1-r.error01))));
}
 private skillTransfer(ctx:number[],action:ActionKind){if(this.state.lesions['skill-evolution'])return .5;
const rows=this.state.skills.filter(s=>s.action===action).slice(-12);
if(!rows.length)return .5;
return mean(rows.map(s=>clamp(.55*(1-dist(ctx,s.prototype))+.30*s.utility01+.15*s.confidence01)));
}
 private neuralSignal(ctx:number[]){if(this.state.lesions['neural-code'])return .5;
const pop=this.state.population;
let signal=.5;
for(let i=0;
i<64;
i++){const x=Math.tanh((ctx[i%8]??.5)*2-1+pop.weights[i]*1.7);
pop.activity[i]=clamp(.94*pop.activity[i]+.06*(x+1)/2);
signal+=((pop.activity[i]-.5)*.01);
 }pop.cycles++;
this.state.diagnostics.neuralUpdates++;
return clamp(signal);
}
 private calibrate(conf:number,actual:number){if(this.state.lesions['confidence'])return conf;
const err=conf-actual;
this.state.calibration.samples++;
this.state.calibration.bias01=this.state.calibration.bias01*.96+err*.04;
this.state.calibration.brier01=this.state.calibration.brier01*.96+err*err*.04;
return clamp(conf-this.state.calibration.bias01*.40);
}
 private actionPolicySignal(ctx:number[],action:ActionKind){if(this.state.lesions['meta-policy'])return 0;
const p=this.state.actionPolicy[action];
const z=p.weights.reduce((sum,w,i)=>sum+w*((ctx[i]??.5)-.5),p.bias01);
const adaptive=this.state.regime.shift01>.55?1.35:1;
return Math.max(-.028,Math.min(.028,Math.tanh(z*adaptive)*.028));
}
 beforeDecision(input:B561Input):B561Output{const start=performance.now();
if(!this.state.enabled)return {actionBias:zeroActions(),predictiveBias:zeroActions(),strategy:'stabilize',mode:'minimal',computeBudget01:.05,confidence01:.5,memoryRecall01:.5,worldForecast01:.5,skillTransfer01:.5,neuralSignal01:.5,informationGain01:0,experimentPressure01:0,identityCoherence01:.5,metaPolicyEntropy01:1};
this.state.tick=input.tick;
this.state.diagnostics.decisions++;
const ctx=v8(input.context01);
const c=this.compute(input);
const r=this.recall(ctx,c.budget);
const world=mean(ACTIONS.map(a=>this.worldPredict(ctx,a,c.mode==='research'?4:c.mode==='deep'?3:c.mode==='normal'?2:1)));
const skill=mean(ACTIONS.map(a=>this.skillTransfer(ctx,a)));
const identity=input.selfVector&&input.goalVector?cos(v8(input.selfVector),v8(input.goalVector)):.5;
const features=this.featureVector(input,r.recall,world,skill,identity);
const chosen=this.chooseStrategy(input,features);
const neural=this.neuralSignal(ctx);
const info=clamp(.46*input.uncertainty01+.22*input.novelty01+.18*(1-r.recall)+.14*(1-input.confidence01));
const experiment=this.state.lesions['experiment-selector']?0:clamp(info*(1+.4*(1-world)));
const rawConf=clamp(.27*input.confidence01+.18*r.recall+.16*r.belief+.15*world+.10*skill+.08*neural+.06*identity);
const confidence=this.calibrate(rawConf,clamp(1-input.predictionError01));
const actionBias=Object.fromEntries(ACTIONS.map(a=>{let x=0;
const base=input.baseUtilities[a]??.5;
const local=(base-.5)*.035;
const b501=input.b501Bias?.[a]??0;
x+=local+b501*.20;
if(chosen.strategy==='experiment'&&(a==='verify'||a==='explore'))x+=.024;
if(chosen.strategy==='reflect'&&a==='reflect')x+=.022;
if(chosen.strategy==='skill-transfer'&&a==='verify')x+=.018;
if(chosen.strategy==='identity'&&a==='reflect')x+=.020;
if(chosen.strategy==='stabilize'&&a==='rest')x+=.018;
if(input.predictionError01>.66&&a==='verify')x+=.016;
if(info>.72&&a==='explore')x+=.012;
if(neural>.58&&a==='explore')x+=.006;
return [a,Math.max(-.055,Math.min(.055,x))] as const;
})) as Record<ActionKind,number>;
const predictiveBias=Object.fromEntries(ACTIONS.map(a=>{const wp=this.worldPredict(ctx,a,c.mode==='research'?4:1);
let x=.020*(wp-.5)+.012*(skill-.5)+.010*(neural-.5);
if(input.b501PredictiveBias)x+=(input.b501PredictiveBias[a]??0)*.18;
return [a,Math.max(-.042,Math.min(.042,x))] as const;
})) as Record<ActionKind,number>;
this.state.last={context:ctx,strategy:chosen.strategy,mode:c.mode,confidence01:confidence,recall01:r.recall,world01:world,skill01:skill,neural01:neural,infoGain01:info};
if(chosen.strategy!==this.state.diagnostics.lastStrategy)this.state.diagnostics.strategySwitches++;
this.state.diagnostics.lastStrategy=chosen.strategy;
this.state.diagnostics.lastMode=c.mode;
this.state.diagnostics.lastCompute01=c.budget;
this.state.diagnostics.lastEntropy01=chosen.entropy;
this.state.diagnostics.lastGain01=clamp(.94*this.state.diagnostics.lastGain01+.06*(info+.5*(1-input.predictionError01)));
this.state.diagnostics.experiments+=experiment>.65?1:0;
this.state.diagnostics.lastLatencyMs=performance.now()-start;
return {actionBias,predictiveBias,strategy:chosen.strategy,mode:c.mode,computeBudget01:c.budget,confidence01:confidence,memoryRecall01:r.recall,worldForecast01:world,skillTransfer01:skill,neuralSignal01:neural,informationGain01:info,experimentPressure01:experiment,identityCoherence01:identity,metaPolicyEntropy01:chosen.entropy};
}
 afterOutcome(input:{tick:number;
action:ActionKind;
context01:number[];
nextContext01?:number[];
reward01:number;
predictionError01:number;
verified01:number;
success01:number;
strategy?:Strategy;
confidence01?:number}){if(!this.state.enabled)return;
const ctx=v8(input.context01),next=v8(input.nextContext01??input.context01),r=clamp(input.reward01),err=clamp(input.predictionError01),ver=clamp(input.verified01),success=clamp(input.success01),strategy=input.strategy??this.state.last.strategy,conf=this.calibrate(clamp(input.confidence01??this.state.last.confidence01),success);
const surprise=clamp(Math.abs(err-this.state.regime.stableError01));
 const wasShifted=this.state.regime.shift01>.72;
 this.state.regime.recentError01=this.state.regime.recentError01*.82+err*.18;
 this.state.regime.shift01=clamp(this.state.regime.shift01*.88+surprise*.30);
 if(!wasShifted&&this.state.regime.shift01>.72&&err<.35){this.state.regime.changeCount++;
} if(this.state.regime.shift01>.55)this.state.regime.shift01=clamp(this.state.regime.shift01*.94+.08);
 else this.state.regime.stableError01=this.state.regime.stableError01*.97+err*.03;
if(!this.state.lesions['meta-policy']){const centered=r-.5;
 const lr=this.state.regime.shift01>.55?.12:.035;
 const p=this.state.actionPolicy[input.action];
 for(let i=0;
i<8;
i++){const f=(ctx[i]??.5)-.5;
 p.weights[i]=Math.max(-.16,Math.min(.16,p.weights[i]+lr*centered*f));
} p.bias01=Math.max(-.12,Math.min(.12,p.bias01+lr*centered));
 p.uses++;
}
this.state.episodes.push({tick:input.tick,context:ctx,action:input.action,reward01:r,error01:err,verified01:ver,success01:success,strategy,confidence01:conf,outcomeVector:next});
this.state.events.push({tick:input.tick,context:ctx,action:input.action,reward01:r,verified01:ver,provenance01:clamp(ver*(.55+.45*(1-err)))});
if(!this.state.lesions['dual-memory']){const belief=this.state.beliefs.find(b=>dist(b.vector,next)<.18);
if(belief){belief.vector=belief.vector.map((v,i)=>clamp(v*.90+next[i]!*0.10));
belief.confidence01=clamp(belief.confidence01*.92+Math.max(ver,success)*.08);
belief.revision+=1;
belief.lastTick=input.tick;
}else{this.state.beliefs.push({id:`b561-${input.tick}-${this.state.beliefs.length}`,vector:next,confidence01:clamp(.45+.35*Math.max(ver,success)-.20*err),revision:0,lastTick:input.tick});
this.state.diagnostics.consolidations++;
}}
if(!this.state.lesions['world-model']){const row=this.state.world.find(w=>w.action===input.action&&dist(w.state,ctx)<.18);
if(row){row.next=row.next.map((v,i)=>clamp(v*.88+next[i]!*0.12));
row.reward01=clamp(row.reward01*.88+r*.12);
row.error01=clamp(row.error01*.90+err*.10);
row.uses++;
}else{this.state.world.push({action:input.action,state:ctx,next,reward01:r,error01:err,uses:1});
}}
if(!this.state.lesions['skill-evolution']&&ver>.78){const skill=this.state.skills.find(s=>s.action===input.action&&dist(s.prototype,ctx)<.20);
if(skill){skill.prototype=skill.prototype.map((v,i)=>clamp(v*.86+ctx[i]!*0.14));
skill.utility01=clamp(skill.utility01*.88+r*.12);
skill.confidence01=clamp(skill.confidence01*.90+.10);
skill.uses++;
skill.successes+=success>.55?1:0;
skill.lastUsedTick=input.tick;
}else{this.state.skills.push({id:`skill-${input.tick}-${this.state.skills.length}`,action:input.action,prototype:ctx,utility01:clamp(.45+.35*r),confidence01:.55,uses:1,successes:success>.55?1:0,failures:success<=.55?1:0,createdTick:input.tick,lastUsedTick:input.tick});
}this.state.diagnostics.skillUpdates++;
}
if(!this.state.lesions['meta-policy']){const p=this.state.policy[strategy];
const target=clamp(.55*r+.25*success+.20*(1-err));
const lr=.035*(ver>.7?1.2:.7);
p.value01=clamp(p.value01*(1-lr)+target*lr);
p.uncertainty01=clamp(p.uncertainty01*.96+err*.04);
const f=[ctx[0]??.5,ctx[1]??.5,ctx[2]??.5,1-conf, this.state.last.recall01,this.state.last.world01];
p.featureWeights=p.featureWeights.map((w,i)=>clamp(w*(1-lr*.5)+f[i]*lr*.5));
p.uses++;
}
if(!this.state.lesions['neural-code']){const rewardCentered=r-.5;
for(let i=0;
i<64;
i++){const target=((ctx[i%8]??.5)-.5)*2*rewardCentered;
this.state.population.weights[i]=Math.max(-.25,Math.min(.25,this.state.population.weights[i]+this.state.population.plasticity01*target));
}this.state.diagnostics.neuralUpdates++;
}
this.state.diagnostics.updates++;
if(err>.6)this.state.diagnostics.counterfactuals++;
this.state.diagnostics.lastGain01=clamp(this.state.diagnostics.lastGain01*.97+(1-err)*.03);
if(this.state.episodes.length>1024)this.state.episodes.splice(0,this.state.episodes.length-1024);
if(this.state.events.length>512)this.state.events.splice(0,this.state.events.length-512);
if(this.state.beliefs.length>256)this.state.beliefs.splice(0,this.state.beliefs.length-256);
if(this.state.world.length>768)this.state.world.splice(0,this.state.world.length-768);
if(this.state.skills.length>96)this.state.skills.splice(0,this.state.skills.length-96);
}
 evaluateLesion(input:B561Input,lesion:Partial<Record<Variant,boolean>>){const snap=this.snapshot();
this.setLesions({});
const on=this.beforeDecision(input);
this.restore(snap);
this.setLesions(lesion);
const off=this.beforeDecision(input);
this.restore(snap);
const delta=mean(ACTIONS.map(a=>Math.abs((on.actionBias[a]??0)-(off.actionBias[a]??0))+Math.abs((on.predictiveBias[a]??0)-(off.predictiveBias[a]??0))));
this.state.diagnostics.holdouts++;
this.state.diagnostics.lastCausalDelta01=delta;
return {delta01:delta,on,off};
}
 markHoldout(score01:number){this.state.diagnostics.holdouts++;this.state.diagnostics.lastHoldout01=clamp(.9*this.state.diagnostics.lastHoldout01+.1*clamp(score01));}
}
