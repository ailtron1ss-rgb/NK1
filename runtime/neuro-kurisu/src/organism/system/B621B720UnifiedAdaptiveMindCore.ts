import type { ActionKind } from '../core/types.ts';

type Mode='minimal'|'normal'|'deep'|'research';
type Strategy='recall'|'predict'|'plan'|'explore'|'verify'|'reflect'|'identity'|'stabilize';
const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const STRATEGIES:Strategy[]=['recall','predict','plan','explore','verify','reflect','identity','stabilize'];
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:.5));
const mean=(x:number[])=>x.length?x.reduce((a,b)=>a+b,0)/x.length:.5;
const dist=(a:number[],b:number[])=>mean(Array.from({length:Math.min(a.length,b.length)},(_,i)=>Math.abs((a[i]??.5)-(b[i]??.5))));
const dot=(a:number[],b:number[])=>{let s=0;for(let i=0;i<Math.min(a.length,b.length);i++)s+=(a[i]??0)*(b[i]??0);return s;};
const norm=(a:number[])=>Math.sqrt(Math.max(1e-9,dot(a,a)));
const cos=(a:number[],b:number[])=>clamp((dot(a,b)/(norm(a)*norm(b))+1)/2);
const v8=(x:number[])=>Array.from({length:8},(_,i)=>clamp(x[i%x.length]??.5));
const zeroActions=()=>Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;

export interface B621Input {tick:number;
context01:number[];
baseUtilities:Record<ActionKind,number>;
priorBias?:Record<ActionKind,number>;
priorPredictiveBias?:Record<ActionKind,number>;
uncertainty01:number;
predictionError01:number;
novelty01:number;
surprise01:number;
confidence01:number;
goalVector?:number[];
selfVector?:number[];
complexity01?:number;
modeHint?:Mode;
}
export interface B621Output {actionBias:Record<ActionKind,number>;
predictiveBias:Record<ActionKind,number>;
strategy:Strategy;
mode:Mode;
computeBudget01:number;
confidence01:number;
memory01:number;
world01:number;
identity01:number;
neural01:number;
regimeShift01:number;
informationGain01:number;
metaValue01:number;
}
export interface B621Episode {tick:number;context:number[];action:ActionKind;reward01:number;error01:number;verified01:number;confidence01:number;strategy:Strategy;mode:Mode;nextContext:number[];regime01:number;}
export interface B621Memory {id:string;kind:'fast'|'slow'|'identity';vector:number[];prototype:number[];importance01:number;causal01:number;confidence01:number;createdTick:number;lastTick:number;uses:number;revisions:number;}
export interface B621World {action:ActionKind;state:number[];next:number[];reward01:number;error01:number;confidence01:number;uses:number;}
export interface B621Skill {id:string;action:ActionKind;vector:number[];utility01:number;confidence01:number;uses:number;successes:number;lastTick:number;}
export interface B621State {version:1;
enabled:boolean;
tick:number;
lesions:Record<string,boolean>;
strategy:Record<Strategy,{weights:number[];
value01:number;
uncertainty01:number;
uses:number;
successes:number}>;
regimeAction:Record<ActionKind,{weights:number[];bias01:number;uses:number}>;
episodes:B621Episode[];
memory:B621Memory[];
world:B621World[];
skills:B621Skill[];
identityCode:number[];
eligibility:number[];
regime:{emaError01:number;
shift01:number;
cusum01:number;
changes:number};
calibration:{samples:number;
brier01:number;
bias01:number};
diagnostics:{decisions:number;
updates:number;
retrievals:number;
consolidations:number;
worldUpdates:number;
skillUpdates:number;
neuralUpdates:number;
strategySwitches:number;
experiments:number;
counterfactuals:number;
restartCount:number;
lastStrategy:Strategy;
lastMode:Mode;
lastCompute01:number;
lastLatencyMs:number;
lastHoldout01:number;
lastCausalDelta01:number;
lastOOD01:number;
lastCalibration01:number;
}};

const LESIONS=['meta-policy','hierarchical-memory','world-ensemble','skill-transfer','neural-identity','regime-detector','experiment-selector','compute-governor','calibration','counterfactual'];
const defaultStrategy=()=>Object.fromEntries(STRATEGIES.map((s,i)=>[s,{weights:Array.from({length:8},(_,j)=>.30+((i+j)%4)*.04),value01:.5,uncertainty01:.5,uses:0,successes:0}])) as Record<Strategy,{weights:number[];
value01:number;
uncertainty01:number;
uses:number;
successes:number}>;

export const defaultB621B720State=():B621State=>({version:1,enabled:true,tick:0,lesions:Object.fromEntries(LESIONS.map(x=>[x,false])),strategy:defaultStrategy(),regimeAction:Object.fromEntries(ACTIONS.map((a,i)=>[a,{weights:Array.from({length:8},(_,j)=>Math.sin((i+2)*(j+1))*.01),bias01:0,uses:0}])) as Record<ActionKind,{weights:number[];
bias01:number;
uses:number}>,episodes:[],memory:[],world:[],skills:[],identityCode:Array.from({length:128},(_,i)=>Math.sin(i*.37)*.04),eligibility:Array(128).fill(0),regime:{emaError01:.25,shift01:0,cusum01:0,changes:0},calibration:{samples:0,brier01:.25,bias01:0},diagnostics:{decisions:0,updates:0,retrievals:0,consolidations:0,worldUpdates:0,skillUpdates:0,neuralUpdates:0,strategySwitches:0,experiments:0,counterfactuals:0,restartCount:0,lastStrategy:'recall',lastMode:'normal',lastCompute01:.2,lastLatencyMs:0,lastHoldout01:0,lastCausalDelta01:0,lastOOD01:0,lastCalibration01:.5}});

export class B621B720UnifiedAdaptiveMindCore {
 private state=defaultB621B720State();
 snapshot(){return structuredClone(this.state);}
 diagnostics(){return structuredClone(this.state.diagnostics);}
 restore(source?:Partial<B621State>){const d=defaultB621B720State(),s:any=source??{};
this.state={...d,...structuredClone(s),lesions:{...d.lesions,...(s.lesions??{})},strategy:{...d.strategy,...(s.strategy??{})},regimeAction:{...d.regimeAction,...(s.regimeAction??{})},episodes:Array.isArray(s.episodes)?structuredClone(s.episodes).slice(-1536):[],memory:Array.isArray(s.memory)?structuredClone(s.memory).slice(-384):[],world:Array.isArray(s.world)?structuredClone(s.world).slice(-1024):[],skills:Array.isArray(s.skills)?structuredClone(s.skills).slice(-192):[],identityCode:Array.isArray(s.identityCode)?s.identityCode.slice(0,128):d.identityCode,eligibility:Array.isArray(s.eligibility)?s.eligibility.slice(0,128):d.eligibility,regime:{...d.regime,...(s.regime??{})},calibration:{...d.calibration,...(s.calibration??{})},diagnostics:{...d.diagnostics,...(s.diagnostics??{})}};

}
 markRestart(){this.state.diagnostics.restartCount++;}
 setEnabled(v:boolean){this.state.enabled=Boolean(v);}
 setLesions(v:Record<string,boolean>){this.state.lesions={...this.state.lesions,...v};}
 private mode(i:B621Input){const c=clamp(.24*i.uncertainty01+.23*i.predictionError01+.18*i.novelty01+.14*i.surprise01+.10*(i.complexity01??.5)+.11*(1-i.confidence01));
let m:Mode=c>.80?'research':c>.61?'deep':c>.34?'normal':'minimal';
if(i.modeHint&&m!=='research')m=i.modeHint;
let budget=clamp(.05+.95*c);
if(this.state.lesions['compute-governor']){m='normal';
budget=.34;
}return {mode:m,budget};
}
 private detectRegime(err:number){const r=this.state.regime;
const surprise=Math.abs(err-r.emaError01);
r.emaError01=r.emaError01*.93+err*.07;
r.cusum01=clamp(r.cusum01*.90+(surprise-.045));
r.shift01=clamp(r.shift01*.86+Math.max(0,r.cusum01)*.28);
if(r.shift01>.72){r.changes++;
r.shift01=.46;
r.cusum01=.12;
}return r.shift01;
}
 private retrieve(ctx:number[],budget:number){if(this.state.lesions['hierarchical-memory'])return {fast:.5,slow:.5,identity:.5};
const depth=budget>.82?12:budget>.58?8:budget>.32?5:2;
const rank=(kind:string)=>this.state.memory.filter(m=>m.kind===kind).map(m=>({...m,score:.48*(1-dist(ctx,m.prototype))+.22*m.importance01+.18*m.causal01+.12*m.confidence01})).sort((a,b)=>b.score-a.score).slice(0,depth);
const fast=rank('fast'),slow=rank('slow'),identity=rank('identity');
this.state.diagnostics.retrievals++;
return {fast:mean(fast.map(x=>x.score)),slow:mean(slow.map(x=>x.score)),identity:mean(identity.map(x=>x.score))};
}
 private worldScore(ctx:number[],a:ActionKind,budget:number){if(this.state.lesions['world-ensemble'])return .5;
const rows=this.state.world.filter(w=>w.action===a).slice(-192).sort((x,y)=>dist(ctx,x.state)-dist(ctx,y.state)).slice(0,budget>.75?6:budget>.4?3:1);
if(!rows.length)return .5;
const pred=Array.from({length:8},(_,i)=>mean(rows.map(r=>r.next[i]??.5)));
const disagreement=mean(rows.map(r=>dist(r.next,pred)));
return clamp(.56*(1-disagreement)+.30*mean(rows.map(r=>r.reward01))+.14*mean(rows.map(r=>r.confidence01)));
}
 private skillScore(ctx:number[],a:ActionKind){if(this.state.lesions['skill-transfer'])return .5;
const s=this.state.skills.filter(x=>x.action===a).slice(-24);
if(!s.length)return .5;
return mean(s.map(x=>clamp(.56*(1-dist(ctx,x.vector))+.26*x.utility01+.18*x.confidence01)));
}
 private neuralScore(ctx:number[]){if(this.state.lesions['neural-identity'])return .5;
let acc=0;
for(let i=0;
i<128;
i++){const drive=(ctx[i%8]-.5)*1.8;
const v=Math.tanh(drive+this.state.identityCode[i]*1.4);
this.state.identityCode[i]=this.state.identityCode[i]*.985+v*.015;
this.state.eligibility[i]=clamp(this.state.eligibility[i]*.96+Math.abs(v)*.04);
acc+=this.state.identityCode[i];
}this.state.diagnostics.neuralUpdates++;
return clamp(.5+acc/(128*2));
}
 private regimeActionSignal(ctx:number[],action:ActionKind){if(this.state.lesions['regime-detector'])return 0;
const p=this.state.regimeAction[action];
const z=p.weights.reduce((sum:number,w:number,i:number)=>sum+w*((ctx[i]??.5)-.5),p.bias01);
return Math.max(-.05,Math.min(.05,Math.tanh(z)*.05));
}
 private choose(ctx:number[],inputs:B621Input,features:number[]){const scored=STRATEGIES.map(s=>{const p=this.state.strategy[s];
const u=Math.sqrt(Math.log(2+this.state.diagnostics.decisions)/(1+p.uses));
const z=p.weights.reduce((sum,w,j)=>sum+w*(features[j]??.5),0)/p.weights.length;
const score=this.state.lesions['meta-policy']?.5:(.43*z+.35*p.value01+.22*u);
return [s,score] as const;
});
scored.sort((a,b)=>b[1]-a[1]);
const ex=scored.map(x=>Math.exp(x[1]*4));
const z=ex.reduce((a,b)=>a+b,0);
const probs=ex.map(x=>x/z);
const entropy=-probs.reduce((a,p)=>a+(p>1e-9?p*Math.log(p):0),0)/Math.log(probs.length);
return {strategy:scored[0][0],entropy:clamp(entropy)};
}
 private calibrate(conf:number,truth:number){if(this.state.lesions['calibration'])return conf;
const e=conf-truth;
const c=this.state.calibration;
c.samples++;
c.bias01=c.bias01*.97+e*.03;
c.brier01=c.brier01*.97+e*e*.03;
return clamp(conf-c.bias01*.45);
}
 beforeDecision(i:B621Input):B621Output{const start=performance.now();
if(!this.state.enabled)return {actionBias:zeroActions(),predictiveBias:zeroActions(),strategy:'stabilize',mode:'minimal',computeBudget01:.05,confidence01:.5,memory01:.5,world01:.5,identity01:.5,neural01:.5,regimeShift01:0,informationGain01:0,metaValue01:.5};

this.state.tick=i.tick;
this.state.diagnostics.decisions++;
const ctx=v8(i.context01),m=this.mode(i);
const rr=this.retrieve(ctx,m.budget);
const identity=i.selfVector&&i.goalVector?cos(v8(i.selfVector),v8(i.goalVector)):.5;
const world=mean(ACTIONS.map(a=>this.worldScore(ctx,a,m.budget)));
const skill=mean(ACTIONS.map(a=>this.skillScore(ctx,a)));
const neural=this.neuralScore(ctx);
const regime=this.state.lesions['regime-detector']?0:this.state.regime.shift01;
const features=[clamp(i.uncertainty01),clamp(i.predictionError01),clamp(i.novelty01),clamp(1-i.confidence01),clamp((rr.fast+rr.slow)/2),clamp(world*.55+skill*.25+identity*.20)];
const choice=this.choose(ctx,i,features);
const info=clamp(.38*i.uncertainty01+.22*i.novelty01+.18*(1-rr.fast)+.12*regime+.10*(1-i.confidence01));
const exp=this.state.lesions['experiment-selector']?0:clamp(info*(1+.5*(1-world)));
const rawConf=clamp(.22*i.confidence01+.22*rr.fast+.12*rr.slow+.12*rr.identity+.13*world+.09*skill+.06*neural+.04*identity);
const conf=this.calibrate(rawConf,clamp(1-i.predictionError01));
const b=Object.fromEntries(ACTIONS.map(a=>{let x=(i.baseUtilities[a]-.5)*.02+(i.priorBias?.[a]??0)*.14;
const actionSkill=this.skillScore(ctx,a);
const actionWorld=this.worldScore(ctx,a,m.budget);
x+=((rr.fast+rr.slow)/2-.5)*.010+(identity-.5)*.012+(neural-.5)*.010+(actionSkill-.5)*.045+(actionWorld-.5)*.018;
x+=(choice.strategy==='explore'&&(a==='explore'||a==='verify'))?.013:0;
x+=(choice.strategy==='predict'&&a==='verify')?.010:0;
x+=(choice.strategy==='plan'&&a==='explore')?.009:0;
x+=(choice.strategy==='reflect'&&a==='reflect')?.012:0;
x+=(choice.strategy==='identity'&&a==='reflect')?.014:0;
x+=(choice.strategy==='stabilize'&&a==='rest')?.012:0;
if(regime>.62&&a==='verify')x+=.014;
if(exp>.70&&a==='explore')x+=.010;
return [a,Math.max(-.055,Math.min(.055,x))] as const;
})) as Record<ActionKind,number>;
const pb=Object.fromEntries(ACTIONS.map(a=>{const wp=this.worldScore(ctx,a,m.budget);
let x=.042*(wp-.5)+.014*(skill-.5)+.009*(neural-.5)+(i.priorPredictiveBias?.[a]??0)*.14;
if(regime>.65&&a==='verify')x+=.008;
return [a,Math.max(-.042,Math.min(.042,x))] as const;
})) as Record<ActionKind,number>;
if(choice.strategy!==this.state.diagnostics.lastStrategy)this.state.diagnostics.strategySwitches++;
this.state.diagnostics.lastStrategy=choice.strategy;
this.state.diagnostics.lastMode=m.mode;
this.state.diagnostics.lastCompute01=m.budget;
this.state.diagnostics.lastLatencyMs=performance.now()-start;
this.state.diagnostics.experiments+=exp>.70?1:0;
return {actionBias:b,predictiveBias:pb,strategy:choice.strategy,mode:m.mode,computeBudget01:m.budget,confidence01:conf,memory01:clamp((rr.fast+rr.slow+rr.identity)/3),world01:world,identity01:identity,neural01:neural,regimeShift01:regime,informationGain01:info,metaValue01:clamp(.35*features[4]+.25*features[5]+.25*conf+.15*(1-choice.entropy))};

}
 afterOutcome(i:{tick:number;
action:ActionKind;
context01:number[];
nextContext01:number[];
reward01:number;
predictionError01:number;
verified01:number;
success01:number;
strategy?:Strategy;
confidence01?:number}){if(!this.state.enabled)return;
const ctx=v8(i.context01),next=v8(i.nextContext01),r=clamp(i.reward01),err=clamp(i.predictionError01),ver=clamp(i.verified01),succ=clamp(i.success01),shift=this.detectRegime(err),strategy=i.strategy??this.state.diagnostics.lastStrategy;
const conf=this.calibrate(clamp(i.confidence01??.5),succ);
const fast=this.state.memory.find(m=>m.kind==='fast'&&dist(m.vector,ctx)<.16);
if(fast){fast.vector=fast.vector.map((v,j)=>clamp(v*.82+ctx[j]!*0.18));
fast.prototype=fast.prototype.map((v,j)=>clamp(v*.90+next[j]!*0.10));
fast.importance01=clamp(fast.importance01*.92+r*.08);
fast.causal01=clamp(fast.causal01*.90+(1-err)*.10);
fast.confidence01=clamp(fast.confidence01*.92+ver*.08);
fast.lastTick=i.tick;
fast.uses++;
fast.revisions++;
}else{this.state.memory.push({id:`fast-${i.tick}-${this.state.memory.length}`,kind:'fast',vector:ctx,prototype:next,importance01:clamp(.45+.3*r),causal01:clamp(1-err),confidence01:clamp(.45+.35*ver),createdTick:i.tick,lastTick:i.tick,uses:1,revisions:0});

}
if(ver>.72||succ>.75){const slow=this.state.memory.find(m=>m.kind==='slow'&&dist(m.vector,ctx)<.22);
if(slow){slow.vector=slow.vector.map((v,j)=>clamp(v*.93+ctx[j]!*0.07));
slow.prototype=slow.prototype.map((v,j)=>clamp(v*.92+next[j]!*0.08));
slow.importance01=clamp(slow.importance01*.96+r*.04);
slow.causal01=clamp(slow.causal01*.96+(1-err)*.04);
slow.confidence01=clamp(slow.confidence01*.95+.05);
slow.lastTick=i.tick;
slow.revisions++;
}else{this.state.memory.push({id:`slow-${i.tick}-${this.state.memory.length}`,kind:'slow',vector:ctx,prototype:next,importance01:clamp(.55+.2*r),causal01:clamp(.65+(1-err)*.25),confidence01:.62,createdTick:i.tick,lastTick:i.tick,uses:1,revisions:0});

this.state.diagnostics.consolidations++;
}}
const id= this.state.memory.find(m=>m.kind==='identity'&&dist(m.vector,next)<.28);
if(ver>.78&&id){id.vector=id.vector.map((v,j)=>clamp(v*.97+next[j]!*0.03));
id.importance01=clamp(id.importance01*.98+r*.02);
id.causal01=clamp(id.causal01*.98+(1-err)*.02);
id.confidence01=clamp(id.confidence01*.98+.02);
id.lastTick=i.tick;
id.revisions++;
}else if(ver>.88&&this.state.memory.filter(m=>m.kind==='identity').length<24){this.state.memory.push({id:`identity-${i.tick}-${this.state.memory.length}`,kind:'identity',vector:next,prototype:ctx,importance01:.62,causal01:.68,confidence01:.64,createdTick:i.tick,lastTick:i.tick,uses:1,revisions:0});

}
if(!this.state.lesions['world-ensemble']){const row=this.state.world.find(w=>w.action===i.action&&dist(w.state,ctx)<.18);
if(row){row.next=row.next.map((v,j)=>clamp(v*.86+next[j]!*0.14));
row.reward01=clamp(row.reward01*.88+r*.12);
row.error01=clamp(row.error01*.90+err*.10);
row.confidence01=clamp(row.confidence01*.92+ver*.08);
row.uses++;
}else this.state.world.push({action:i.action,state:ctx,next,reward01:r,error01:err,confidence01:clamp(.45+ver*.4),uses:1});
this.state.diagnostics.worldUpdates++;
}
if(!this.state.lesions['skill-transfer']&&ver>.72){const sk=this.state.skills.find(s=>s.action===i.action&&dist(s.vector,ctx)<.2);
const fb=shift>.55?.55:.86; const ub=shift>.55?.70:.90; const cb=shift>.55?.80:.92;
if(sk){sk.vector=sk.vector.map((v,j)=>clamp(v*fb+ctx[j]!*(1-fb)));
sk.utility01=clamp(sk.utility01*ub+r*(1-ub));
sk.confidence01=clamp(sk.confidence01*cb+(1-cb)*ver);
sk.uses++;
sk.successes+=succ>.6?1:0;
sk.lastTick=i.tick;
}else this.state.skills.push({id:`skill-${i.tick}-${this.state.skills.length}`,action:i.action,vector:ctx,utility01:clamp(.45+.35*r),confidence01:.60,uses:1,successes:succ>.6?1:0,lastTick:i.tick});
this.state.diagnostics.skillUpdates++;
}
if(!this.state.lesions['regime-detector']&&shift>.35){const p=this.state.regimeAction[i.action];
const lr=shift>.65?.14:.06;
const centered=r-.5;
for(let j=0;
j<8;
j++){const f=(ctx[j]??.5)-.5;
p.weights[j]=Math.max(-.22,Math.min(.22,p.weights[j]+lr*centered*f));
}p.bias01=Math.max(-.14,Math.min(.14,p.bias01+lr*centered));
p.uses++;
}
if(!this.state.lesions['meta-policy']){const target=clamp(.55*r+.25*succ+.20*(1-err));
const lr=shift>.55?.09:.028;
const p=this.state.strategy[strategy];
p.value01=clamp(p.value01*(1-lr)+target*lr);
p.uncertainty01=clamp(p.uncertainty01*.95+err*.05);
p.uses++;
p.successes+=succ>.65?1:0;
for(let j=0;
j<8;
j++){const f=ctx[j]??.5;
p.weights[j]=clamp(p.weights[j]*(1-lr*.35)+f*(lr*.35));
}}
if(!this.state.lesions['neural-identity']){const td=(r-.5)*(ver>.7?1:0.55);
for(let i2=0;
i2<128;
i2++){const f=(ctx[i2%8]-.5);
this.state.identityCode[i2]=Math.max(-.30,Math.min(.30,this.state.identityCode[i2]+.02*td*f*this.state.eligibility[i2]));
this.state.eligibility[i2]=clamp(this.state.eligibility[i2]*.97+Math.abs(f)*.03);
 }this.state.diagnostics.neuralUpdates++;
}
this.state.episodes.push({tick:i.tick,context:ctx,action:i.action,reward01:r,error01:err,verified01:ver,confidence01:conf,strategy,mode:this.state.diagnostics.lastMode,nextContext:next,regime01:shift});
this.state.diagnostics.updates++;
if(err>.62)this.state.diagnostics.counterfactuals++;
this.state.diagnostics.lastCalibration01=clamp(1-this.state.calibration.brier01);
if(this.state.episodes.length>1536)this.state.episodes.splice(0,this.state.episodes.length-1536);
if(this.state.memory.length>384)this.state.memory.splice(0,this.state.memory.length-384);
if(this.state.world.length>1024)this.state.world.splice(0,this.state.world.length-1024);
if(this.state.skills.length>192)this.state.skills.splice(0,this.state.skills.length-192);
}
 evaluateLesion(input:B621Input,lesion:Record<string,boolean>){const snap=this.snapshot();
this.setLesions(Object.fromEntries(LESIONS.map(x=>[x,false])));
const on=this.beforeDecision(input);
this.restore(snap);
this.setLesions(lesion);
const off=this.beforeDecision(input);
this.restore(snap);
const delta=mean(ACTIONS.map(a=>Math.abs(on.actionBias[a]-off.actionBias[a])+Math.abs(on.predictiveBias[a]-off.predictiveBias[a])));
this.state.diagnostics.lastCausalDelta01=delta;
return {delta01:delta,on,off};
}
 markHoldout(score:number,ood:number){this.state.diagnostics.lastHoldout01=clamp(score);this.state.diagnostics.lastOOD01=clamp(ood);}
}
