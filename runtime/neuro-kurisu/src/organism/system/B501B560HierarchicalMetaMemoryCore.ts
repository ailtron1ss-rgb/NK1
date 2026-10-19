import type { ActionKind } from '../core/types.ts';


type Mode='minimal'|'normal'|'deep'|'research';

type Strategy='temporal-retrieval'|'causal-retrieval'|'skill-transfer'|'prediction-repair'|'information-seeking'|'identity-check';

type Variant='hierarchical-memory'|'temporal-consolidation'|'meta-router'|'confidence-calibration'|'world-counterfactual'|'skill-transfer'|'experiment-selection'|'compute-scheduler';


const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];

const VARIANTS:Variant[]=['hierarchical-memory','temporal-consolidation','meta-router','confidence-calibration','world-counterfactual','skill-transfer','experiment-selection','compute-scheduler'];

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:.5));

const mean=(x:number[])=>x.length?x.reduce((a,b)=>a+b,0)/x.length:.5;

const dot=(a:number[],b:number[])=>{let s=0;
for(let i=0;
i<Math.min(a.length,b.length);
i++)s+=(a[i]??0)*(b[i]??0);
return s;
};

const norm=(a:number[])=>Math.sqrt(Math.max(1e-9,dot(a,a)));

const cos=(a:number[],b:number[])=>clamp((dot(a,b)/(norm(a)*norm(b))+1)/2);

const dist=(a:number[],b:number[])=>mean(Array.from({length:Math.min(a.length,b.length)},(_,i)=>Math.abs((a[i]??0)-(b[i]??0))));

const v8=(x:number[])=>Array.from({length:8},(_,i)=>clamp(x[i%x.length]??.5));


export interface B501Input {tick:number;
context01:number[];
actionUtilities:Record<ActionKind,number>;
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
export interface B501Output {actionBias:Record<ActionKind,number>;
predictiveBias:Record<ActionKind,number>;
mode:Mode;
strategy:Strategy;
memoryRecall01:number;
temporalContinuity01:number;
transfer01:number;
worldCounterfactual01:number;
calibratedConfidence01:number;
experimentScore01:number;
computeBudget01:number;
informationGain01:number;
}
export interface B501Episode {tick:number;
context:number[];
action:ActionKind;
next:number[];
reward01:number;
error01:number;
verified01:number;
success01:number;
tier:0|1|2|3;
strategy:Strategy;
confidenceBefore01:number;
confidenceAfter01:number;
}
export interface B501Node {id:string;
parent:string|null;
tier:0|1|2|3;
vector:number[];
utility01:number;
confidence01:number;
count:number;
firstTick:number;
lastTick:number;
children:number;
}
export interface B501StrategyStat {uses:number;
reward01:number;
calibration01:number;
uncertainty01:number;
}
export interface B501State {
 version:2;
enabled:boolean;
tick:number;
lesions:Record<Variant,boolean>;
weights:Record<Variant,number>;
nodes:B501Node[];
episodes:B501Episode[];
strategies:Record<Strategy,B501StrategyStat>;
calibration:{samples:number;
brier01:number;
bias01:number};
transitions:Array<{action:ActionKind;
state:number[];
next:number[];
reward01:number;
error01:number}>;
diagnostics:{decisions:number;
updates:number;
retrievals:number;
consolidations:number;
experiments:number;
counterfactuals:number;
strategySwitches:number;
holdouts:number;
restartCount:number;
lastCausalDelta01:number;
lastRecall01:number;
lastMode:Mode;
lastStrategy:Strategy;
lastComputeBudget01:number;
holdoutScore01:number;
developmentalGain01:number;
compression01:number;
};
last:{context:number[];
strategy:Strategy;
mode:Mode;
computeBudget01:number;
recall01:number;
continuity01:number;
transfer01:number;
counterfactual01:number;
confidence01:number;
};

}
const strategyDefault=()=>({uses:0,reward01:.5,calibration01:.5,uncertainty01:.5});

const defaultWeights:Record<Variant,number>={'hierarchical-memory':.16,'temporal-consolidation':.14,'meta-router':.17,'confidence-calibration':.10,'world-counterfactual':.12,'skill-transfer':.11,'experiment-selection':.10,'compute-scheduler':.10};

export const defaultB501B560State=():B501State=>({version:2,
  enabled:true,
  tick:0,
  lesions:Object.fromEntries(VARIANTS.map(v=>[v,
  false])) as Record<Variant,
  boolean>,
  weights:{...defaultWeights},
  nodes:[],
  episodes:[],
  strategies:{'temporal-retrieval':strategyDefault(),
  'causal-retrieval':strategyDefault(),
  'skill-transfer':strategyDefault(),
  'prediction-repair':strategyDefault(),
  'information-seeking':strategyDefault(),
  'identity-check':strategyDefault()},
  calibration:{samples:0,
  brier01:.25,
  bias01:0},
  transitions:[],
  diagnostics:{decisions:0,
  updates:0,
  retrievals:0,
  consolidations:0,
  experiments:0,
  counterfactuals:0,
  strategySwitches:0,
  holdouts:0,
  restartCount:0,
  lastCausalDelta01:0,
  lastRecall01:.5,
  lastMode:'normal',
  lastStrategy:'temporal-retrieval',
  lastComputeBudget01:.3,
  holdoutScore01:0,
  developmentalGain01:0.5,
  compression01:0},
  last:{context:Array(8).fill(.5),
  strategy:'temporal-retrieval',
  mode:'normal',
  computeBudget01:.3,
  recall01:.5,
  continuity01:.5,
  transfer01:.5,
  counterfactual01:.5,
  confidence01:.5}});


export class B501B560HierarchicalMetaMemoryCore {
 private state:B501State=defaultB501B560State();

 snapshot(){return structuredClone(this.state);
} diagnostics(){return structuredClone(this.state.diagnostics);
}
 restore(source?:Partial<B501State>){const d=defaultB501B560State();
const s:any=source??{};
this.state={...d,...structuredClone(s),lesions:{...d.lesions,...(s.lesions??{})},weights:{...d.weights,...(s.weights??{})},strategies:{...d.strategies,...(s.strategies??{})},calibration:{...d.calibration,...(s.calibration??{})},nodes:Array.isArray(s.nodes)?structuredClone(s.nodes).slice(-384):[],episodes:Array.isArray(s.episodes)?structuredClone(s.episodes).slice(-1024):[],transitions:Array.isArray(s.transitions)?structuredClone(s.transitions).slice(-512):[],diagnostics:{...d.diagnostics,...(s.diagnostics??{})},last:{...d.last,...(s.last??{})}};
}
 markRestart(){this.state.diagnostics.restartCount++;
}
 setEnabled(v:boolean){this.state.enabled=Boolean(v);
} setLesions(v:Partial<Record<Variant,boolean>>){this.state.lesions={...this.state.lesions,...v};
}
 private compute(input:B501Input){const c=clamp(.24*input.uncertainty01+.22*input.predictionError01+.18*input.novelty01+.14*input.surprise01+.12*(input.complexity01??.5)+.10*(1-input.confidence01));
const budget=clamp(.08+.92*c);
const mode:Mode=input.modeHint??(budget>.82?'research':budget>.60?'deep':budget>.34?'normal':'minimal');
return {budget,mode};
}
 private route(input:B501Input,recall:number,transfer:number,world:number):Strategy{if(this.state.lesions['meta-router'])return 'temporal-retrieval';
const pressure=clamp(.36*input.novelty01+.28*input.uncertainty01+.20*(1-input.confidence01)+.16*(1-recall));
if(input.predictionError01>.64&&!this.state.lesions['world-counterfactual'])return 'prediction-repair';
if(pressure>.72&&!this.state.lesions['experiment-selection'])return 'information-seeking';
if(transfer>.72&&!this.state.lesions['skill-transfer'])return 'skill-transfer';
if(input.selfVector&&input.goalVector&&cos(v8(input.selfVector),v8(input.goalVector))<.48&&!this.state.lesions['confidence-calibration'])return 'identity-check';
if(world>.68)return 'causal-retrieval';
return 'temporal-retrieval';
}
 private recall(ctx:number[],depth:number){if(this.state.lesions['hierarchical-memory']||!this.state.nodes.length)return {recall:.5,continuity:.5,transfer:.5};
const nodes=this.state.nodes.filter(n=>n.count>0).map(n=>({...n,score:clamp(.55*(1-dist(ctx,n.vector))+.18*n.utility01+.17*n.confidence01+.10*(1-Math.min(1,n.tier/3)))})).sort((a,b)=>b.score-a.score).slice(0,Math.max(2,depth*2));
this.state.diagnostics.retrievals++;
return {recall:mean(nodes.map(n=>n.score)),continuity:mean(nodes.map(n=>clamp(1-dist(ctx,n.vector)+.15*(n.tier/3)))),transfer:mean(nodes.map(n=>clamp(.55*(1-dist(ctx,n.vector))+.45*n.confidence01)))};
}
 private predict(ctx:number[],action:ActionKind,limit:number){if(this.state.lesions['world-counterfactual'])return .5;
const rows=this.state.transitions.filter(t=>t.action===action);
if(!rows.length)return .5;
const best=rows.slice(-96).sort((a,b)=>dist(ctx,a.state)-dist(ctx,b.state)).slice(0,Math.max(2,limit));
const next=Array.from({length:8},(_,i)=>mean(best.map(r=>r.next[i]??.5)));
const dispersion=mean(best.map(r=>dist(r.next,next)));
const reward=mean(best.map(r=>r.reward01));
return clamp(.60*(1-dispersion)+.40*reward);
}
 private calibrate(conf:number,actual:number){if(this.state.lesions['confidence-calibration'])return conf;
const err=conf-actual;
this.state.calibration.samples++;
this.state.calibration.bias01=Math.max(-1,Math.min(1,this.state.calibration.bias01*.96+err*.04));
this.state.calibration.brier01=this.state.calibration.brier01*.96+Math.pow(conf-actual,2)*.04;
return clamp(conf-this.state.calibration.bias01*.45);
}
 beforeDecision(input:B501Input):B501Output{if(!this.state.enabled){return {actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,predictiveBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,mode:'minimal',strategy:'temporal-retrieval',memoryRecall01:.5,temporalContinuity01:.5,transfer01:.5,worldCounterfactual01:.5,calibratedConfidence01:.5,experimentScore01:0,computeBudget01:.05,informationGain01:0};
}
 this.state.tick=input.tick;
this.state.diagnostics.decisions++;
const ctx=v8(input.context01);
const {budget,mode}=this.compute(input);
const depth=mode==='research'?4:mode==='deep'?3:mode==='normal'?2:1;
const previousStrategy=this.state.diagnostics.lastStrategy;
const r=this.recall(ctx,depth);
const world=mean(ACTIONS.map(a=>this.predict(ctx,a,depth)));
const strategy=this.route(input,r.recall,r.transfer,world);
const info=clamp(.46*input.uncertainty01+.24*input.novelty01+.18*(1-r.recall)+.12*(1-input.confidence01));
const experiment=this.state.lesions['experiment-selection']?0:info;
const rawConfidence=clamp(.24*input.confidence01+.20*r.recall+.16*r.continuity+.16*r.transfer+.14*world+.10*(1-input.predictionError01));
const confidence=this.state.lesions['confidence-calibration']?rawConfidence:clamp(rawConfidence-this.state.calibration.bias01*.45);

 const actionBias=Object.fromEntries(ACTIONS.map(a=>{const skill=this.state.lesions['skill-transfer'] ? .5 : this.skillScore(ctx,a);
const pred=this.predict(ctx,a,depth);
let x=.010*(r.recall-.5)+.008*(r.continuity-.5)+.008*(confidence-.5);
if(strategy==='information-seeking'&&a==='verify')x+=.026*experiment;
if(strategy==='prediction-repair'&&a==='reflect')x+=.022*(1-pred);
if(strategy==='skill-transfer')x+=.022*(skill-.5);
if(strategy==='identity-check'&&a==='reflect')x+=.020*(1-confidence);
if(strategy==='causal-retrieval')x+=.016*(pred-.5);
return [a,Math.max(-.05,Math.min(.05,x))] as const;
})) as Record<ActionKind,number>;

 const predictiveBias=Object.fromEntries(ACTIONS.map(a=>[a,Math.max(-.035,Math.min(.035,.018*(this.predict(ctx,a,depth)-.5)+.014*(r.transfer-.5)))])) as Record<ActionKind,number>;

 const infoGain=clamp(info*.70+world*(1-confidence)*.30);
this.state.last={context:ctx,strategy,mode,computeBudget01:budget,recall01:r.recall,continuity01:r.continuity,transfer01:r.transfer,counterfactual01:world,confidence01:confidence};
this.state.diagnostics.lastRecall01=r.recall;
this.state.diagnostics.lastMode=mode;
this.state.diagnostics.lastStrategy=strategy;
if(strategy!==previousStrategy)this.state.diagnostics.strategySwitches++;
 this.state.diagnostics.lastComputeBudget01=budget;
this.state.diagnostics.developmentalGain01=clamp(this.state.diagnostics.developmentalGain01*.98+(confidence*(1-input.predictionError01))*.02);
this.state.diagnostics.compression01=clamp(.92*this.state.diagnostics.compression01+.08*(1-Math.min(1,this.state.nodes.length/384)));

 return {actionBias,predictiveBias,mode,strategy,memoryRecall01:r.recall,temporalContinuity01:r.continuity,transfer01:r.transfer,worldCounterfactual01:world,calibratedConfidence01:confidence,experimentScore01:experiment,computeBudget01:budget,informationGain01:infoGain};
}
 private skillScore(ctx:number[],action:ActionKind){const rows=this.state.episodes.filter(e=>e.action===action).slice(-48);
if(!rows.length)return .5;
return mean(rows.map(e=>clamp(.52*(1-dist(ctx,e.context))+.24*e.success01+.24*(clamp(1-e.error01)))));
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
confidenceBefore01?:number}){if(!this.state.enabled)return;
const ctx=v8(input.context01),next=v8(input.nextContext01??input.context01),r=clamp(input.reward01),err=clamp(input.predictionError01),s=clamp(input.success01),verified=clamp(input.verified01);
const tier:(0|1|2|3)=s>.84&&verified>.8&&err<.22?3:s>.66?2:r>.45?1:0;
const strategy=input.strategy??this.state.last.strategy;
const confBefore=clamp(input.confidenceBefore01??this.state.last.confidence01);
const confAfter=this.calibrate(confBefore,s);
this.state.episodes.push({tick:input.tick,context:ctx,action:input.action,next,reward01:r,error01:err,verified01:verified,success01:s,tier,strategy,confidenceBefore01:confBefore,confidenceAfter01:confAfter});
this.state.transitions.push({action:input.action,state:ctx,next,reward01:r,error01:err});
this.consolidate(ctx,tier,r,verified,s,input.tick);
const st=this.state.strategies[strategy];
st.uses++;
st.reward01=clamp(st.reward01*.90+r*.10);
st.calibration01=clamp(st.calibration01*.92+(1-Math.abs(confAfter-s))*.08);
st.uncertainty01=clamp(st.uncertainty01*.90+err*.10);
this.state.diagnostics.updates++;
if(strategy==='information-seeking')this.state.diagnostics.experiments++;
if(strategy==='prediction-repair' || err>.64)this.state.diagnostics.counterfactuals++;
this.state.diagnostics.developmentalGain01=clamp(this.state.diagnostics.developmentalGain01*.97+(1-err)*.03);
if(this.state.episodes.length>1024)this.state.episodes.splice(0,this.state.episodes.length-1024);
if(this.state.transitions.length>512)this.state.transitions.splice(0,this.state.transitions.length-512);
}
 private consolidate(ctx:number[],tier:0|1|2|3,reward01:number,verified01:number,success01:number,tick:number){if(this.state.lesions['temporal-consolidation'])return;
const parent=tier>0?(this.state.nodes.filter(n=>n.tier===tier-1).sort((a,b)=>dist(ctx,a.vector)-dist(ctx,b.vector))[0]??null):null;
let node=this.state.nodes.find(n=>n.tier===tier&&dist(ctx,n.vector)<.20);
const alpha=tier===3?.20:tier===2?.14:tier===1?.09:.05;
if(!node){node={id:`b501-${tick}-${this.state.nodes.length}`,parent:parent?.id??null,tier,vector:ctx,utility01:reward01,confidence01:.45,count:0,firstTick:tick,lastTick:tick,children:0};
this.state.nodes.push(node);
this.state.diagnostics.consolidations++;
if(parent)parent.children++;
}node.vector=node.vector.map((v,i)=>clamp(v*(1-alpha)+ctx[i]!*alpha));
node.utility01=clamp(node.utility01*(1-alpha)+reward01*alpha);
node.confidence01=clamp(node.confidence01*.90+.10*Math.max(verified01,success01));
node.count++;
node.lastTick=tick;
}
 evaluateLesion(input:B501Input,lesion:Partial<Record<Variant,boolean>>){const snap=this.snapshot();
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
 markHoldout(score01:number){this.state.diagnostics.holdouts++;
this.state.diagnostics.holdoutScore01=clamp(this.state.diagnostics.holdoutScore01*.9+clamp(score01)*.1);
}
}
