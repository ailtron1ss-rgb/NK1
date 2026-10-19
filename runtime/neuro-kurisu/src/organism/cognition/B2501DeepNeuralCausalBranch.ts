import type { ActionKind } from '../core/types.ts';
const A:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer']; const N=48; const D=4;
const c=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
 const s=(x:number)=>c(x,-1,1);
 const m=(x:number[])=>x.length?x.reduce((a,b)=>a+b,0)/x.length:.5;
 const dot=(a:number[],b:number[])=>a.reduce((z,x,i)=>z+x*(b[i]??0),0);
 const cos=(a:number[],b:number[])=>{let aa=0,bb=0,ab=0;
for(let i=0;
i<Math.min(a.length,b.length);
i++){aa+=a[i]!*a[i]!;
bb+=b[i]!*b[i]!;
ab+=a[i]!*b[i]!;
}return aa&&bb?c((ab/Math.sqrt(aa*bb)+1)/2):.5};
 const sm=(x:number[],t=.16)=>{const q=Math.max(.03,t),z=Math.max(...x),e=x.map(v=>Math.exp((v-z)/q)),q2=e.reduce((a,b)=>a+b,0)||1;
return e.map(v=>v/q2)};
export interface B2501Synapse{pre:number;post:number;weight:number;delay:number;eligibility01:number;timing01:number;active:boolean;age:number}
export interface B2501State{version:1;
enabled:boolean;
mode:'mobile'|'balanced'|'quality';
tick:number;
cycles:number;
learningUpdates:number;
delayUpdates:number;
replayUpdates:number;
compositions:number;
predictionUpdates:number;
causalChecks:number;
causalEffect01:number;
temporalPlasticity01:number;
precision01:number;
predictionError01:number;
worldError01:number;
bodyError01:number;
selfError01:number;
computeDepth:number;
actionBias:number[];
actionUtility:number[];
actionGate:number[];
predictedWorld:number[][];
predictedBody:number[][];
predictedSelf:number[][];
readout:number[][];
synapses:B2501Synapse[];
primitives:Array<{vector:number[];
utility:number[];
reward01:number;
mass01:number;
tick:number}>;
history:number[][];
lastLatent:number[];
lastSpikes:number[];
lastContext:number[];
lastAction:ActionKind|null;
lesion:boolean}
export interface B2501Input{tick:number;context01:number[];baseUtilities:Record<ActionKind,number>;b365Latent?:number[];b365Confidence01?:number;b365PredictionError01?:number;goalVector01?:number[];selfVector01?:number[];bodyVector01?:number[];worldVector01?:number[];uncertainty01:number;novelty01:number;predictionError01:number;motivation01:number;energy01:number;cognitiveLoad01:number;autonomous01:number}
export interface B2501Output{actionBias:Record<ActionKind,number>;neuralUtility:Record<ActionKind,number>;actionGate:Record<ActionKind,number>;confidence01:number;precision01:number;computeDepth:number;predictionError01:number;worldPrediction01:number;bodyPrediction01:number;selfPrediction01:number;causalLoad01:number;compositionGain01:number;bottleneckGain01:number;selectedAction:ActionKind}
const seed=(x:number)=>{x|=0;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);return (x^(x>>>13))>>>0}; const rnd=(x:number,k=.06)=>((seed(x)/0xffffffff)*2-1)*k;
export const defaultB2501State=():B2501State=>({version:1,enabled:true,mode:'mobile',tick:0,cycles:0,learningUpdates:0,delayUpdates:0,replayUpdates:0,compositions:0,predictionUpdates:0,causalChecks:0,causalEffect01:0,temporalPlasticity01:.28,precision01:.45,predictionError01:.45,worldError01:.4,bodyError01:.4,selfError01:.4,computeDepth:1,actionBias:A.map(()=>0),actionUtility:A.map(()=>.5),actionGate:A.map(()=>.5),predictedWorld:A.map(()=>Array(8).fill(.5)),predictedBody:A.map(()=>Array(6).fill(.5)),predictedSelf:A.map(()=>Array(8).fill(.5)),readout:A.map((_,a)=>Array.from({length:N},(_,i)=>rnd(2501000+a*79+i,.10))),synapses:Array.from({length:N*6},(_,i)=>{const post=i%N;
return{pre:(post*17+Math.floor(i/N)*7+3)%N,post,weight:rnd(2507000+i,.06),delay:1+(i%D),eligibility01:0,timing01:0,active:true,age:0}}),primitives:[],history:Array.from({length:D+1},()=>Array(N).fill(0)),lastLatent:Array(N).fill(0),lastSpikes:Array(N).fill(0),lastContext:Array(48).fill(0),lastAction:null,lesion:false});
export class B2501DeepNeuralCausalBranch{readonly systemName='cognition:b2501-deep-neural-causal-branch' as const;
private state=defaultB2501State();
snapshot(){return structuredClone(this.state)} restore(raw?:Partial<B2501State>|null){const d=defaultB2501State(),r:any=raw??{};
this.state={...d,...structuredClone(r),version:1,readout:Array.isArray(r.readout)?r.readout.slice(0,A.length):d.readout,synapses:Array.isArray(r.synapses)?r.synapses:d.synapses,primitives:Array.isArray(r.primitives)?r.primitives.slice(-72):d.primitives,history:Array.isArray(r.history)?r.history.slice(-(D+1)):d.history,lastLatent:Array.from({length:N},(_,i)=>s(r.lastLatent?.[i]??0)),lastSpikes:Array.from({length:N},(_,i)=>c(r.lastSpikes?.[i]??0)),lastContext:Array.from({length:48},(_,i)=>s(r.lastContext?.[i]??0))};
}
setMode(x:'mobile'|'balanced'|'quality'){this.state.mode=x} setEnabled(x:boolean){this.state.enabled=!!x}
private depth(i:B2501Input){const p=(i.uncertainty01+i.novelty01+i.predictionError01+i.cognitiveLoad01)/4;return this.state.mode==='quality'?(p>.5?3:2):this.state.mode==='balanced'?(p>.65?3:p>.3?2:1):(p>.78?3:p>.52?2:1)}
private compose(ctx:number[],ai:number){const q=this.state.primitives.map(p=>({p,q:cos(ctx,p.vector)})).sort((a,b)=>b.q-a.q).slice(0,4);if(!q.length)return{gain:0,u:.5};const w=q.reduce((z,x)=>z+Math.max(0,x.q)*x.p.mass01,0);return{gain:c(w/4),u:w?q.reduce((z,x)=>z+x.q*x.p.utility[ai]!,0)/w:.5}}
beforeDecision(i:B2501Input):B2501Output{const base=A.map(a=>c(i.baseUtilities[a]??.5));
if(!this.state.enabled){return{actionBias:Object.fromEntries(A.map(a=>[a,0])) as any,neuralUtility:Object.fromEntries(A.map((a,k)=>[a,base[k]])) as any,actionGate:Object.fromEntries(A.map(a=>[a,.5])) as any,confidence01:.5,precision01:.5,computeDepth:0,predictionError01:.5,worldPrediction01:.5,bodyPrediction01:.5,selfPrediction01:.5,causalLoad01:0,compositionGain01:0,bottleneckGain01:0,selectedAction:A[base.indexOf(Math.max(...base))]??'wait'}};
const ctx=Array.from({length:48},(_,k)=>s(((i.context01[k%i.context01.length]??.5)-.5)*2));
const dep=this.depth(i);
this.state.computeDepth=dep;
let mem=this.state.lastLatent.slice(),sp=this.state.lastSpikes.slice(),err=0;
for(let pass=0;
pass<dep;
pass++){const nm=new Array(N).fill(0),ns=new Array(N).fill(0);
for(let n=0;
n<N;
n++){let z=.10+ctx[n]*.24+ctx[(n*7+3)%48]*.12;
if(!this.state.lesion)for(const x of this.state.synapses)if(x.active&&x.post===n){const d=this.state.history[Math.max(0,this.state.history.length-x.delay)]?.[x.pre]??sp[x.pre]??0;
z+=x.weight*d*2.0}nm[n]=s(mem[n]*.55+z);
if(nm[n]>.20){ns[n]=1;
nm[n]*=.08}}err+=Math.abs(m(nm)-m(mem));
mem=nm;
sp=ns;
this.state.history.push(sp.slice());
if(this.state.history.length>D+1)this.state.history.shift()}
const conf=c(.24+.22*(1-err)+.18*(i.b365Confidence01??.5)+.14*(1-i.uncertainty01)+.12*(1-m(sp))+.10*(1-i.cognitiveLoad01));
const prec=c(.20+.48*conf+.16*(1-i.predictionError01)+.16*(1-this.state.predictionError01));
const util=A.map((a,k)=>{const neural=c(.5+dot(sp,this.state.readout[k]!)/(N*.045));
const rec=c(.5+dot(mem,this.state.readout[k]!)/(N*.065));
const co=this.compose(ctx,k);
const pref=.5+(a==='rest'?(1-i.energy01)*.08:0)+(a==='verify'?i.uncertainty01*.07:0)+(a==='explore'?i.novelty01*.06:0);
return c(.58*neural+.25*rec+.10*co.u+.03*m(this.state.predictedWorld[k]!)+.02*m(this.state.predictedBody[k]!)+.02*pref)});
const p=sm(util.map((u,k)=>(u-.5)*(1+1.7*prec)+(base[k]-.5)*.42),.17-.05*prec);
const chosen=A[p.indexOf(Math.max(...p))]??'wait';
const bias=util.map((u,k)=>c((u-base[k])*.44,-.18,.18));
const gate=p.map((q,k)=>c(.54*prec+.46*(.55+(.5-Math.abs(q-1/7))*1.8)));
this.state={...this.state,tick:i.tick,cycles:this.state.cycles+1,actionBias:bias,actionUtility:util,actionGate:gate,precision01:prec,predictionError01:c(this.state.predictionError01*.92+.08*(.5+err*.35+i.predictionError01*.65)),lastLatent:mem,lastSpikes:sp,lastContext:ctx,lastAction:chosen};
return{actionBias:Object.fromEntries(A.map((a,k)=>[a,bias[k]!])) as any,neuralUtility:Object.fromEntries(A.map((a,k)=>[a,util[k]!])) as any,actionGate:Object.fromEntries(A.map((a,k)=>[a,gate[k]!])) as any,confidence01:conf,precision01:prec,computeDepth:dep,predictionError01:this.state.predictionError01,worldPrediction01:.5,bodyPrediction01:.5,selfPrediction01:.5,causalLoad01:c(.25+.4*prec),compositionGain01:c(m(A.map((_,k)=>this.compose(ctx,k).gain))),bottleneckGain01:c(.25+.4*prec),selectedAction:chosen}}
afterOutcome(i:{tick:number;
action:ActionKind;
reward01:number;
predictionError01:number;
verified01:number;
nextContext01?:number[];
world01?:number[];
body01?:number[];
self01?:number[];
salience01?:number}){if(!this.state.enabled)return;
const ai=A.indexOf(i.action),r=c(i.reward01),pe=c(i.predictionError01),v=c(i.verified01),pred=this.state.actionUtility[ai]??.5,teach=(r-pred)*(1-pe*.55)*(.35+.65*v);
let up=0,du=0;
for(const x of this.state.synapses){if(!x.active||this.state.lesion)continue;
const pre=this.state.lastSpikes[x.pre]??0,post=this.state.lastSpikes[x.post]??0,del=this.state.history[Math.max(0,this.state.history.length-x.delay)]?.[x.pre]??pre,pair=pre*post*1.35-del*post*.82;
x.timing01=c(x.timing01*.86+pair*.14,-1,1);
x.eligibility01=c(x.eligibility01*.88+Math.abs(pair)*.12);
const d=.0052*teach*(.45+.35*(r-.5)*2+.20*v)*(x.eligibility01*.72+x.timing01*.28);
if(Math.abs(d)>1e-7){x.weight=s(x.weight+d);
up++}if(Math.abs(teach)>.06&&(x.age+x.pre+x.post)%9===0){const nd=Math.max(1,Math.min(D,x.delay+(teach*x.timing01>0?-1:teach*x.timing01<0?1:0)));
if(nd!==x.delay){x.delay=nd;
du++}}x.age++}const vec=this.state.lastContext.slice(0,32);
const hit=this.state.primitives.map(p=>({p,q:cos(p.vector,vec)})).sort((a,b)=>b.q-a.q)[0];
if(!hit||hit.q<.83)this.state.primitives.push({vector:vec,utility:this.state.actionUtility.slice(),reward01:r,mass01:.35+.65*v,tick:i.tick});
else{hit.p.mass01=c(hit.p.mass01*.94+.04+.06*v);
hit.p.utility[ai]=c(hit.p.utility[ai]!* .92+(.35+.65*r)*.08)}this.state.primitives=this.state.primitives.slice(-72);
this.state.learningUpdates+=up;
this.state.delayUpdates+=du;
this.state.replayUpdates+=this.state.primitives.length>3?1:0;
this.state.compositions+=this.state.primitives.length>3?1:0;
this.state.predictionUpdates+=8;
this.state.temporalPlasticity01=c(this.state.temporalPlasticity01*.94+Math.abs(teach)*.06+m(this.state.synapses.map(x=>x.timing01))* .04);
this.state.precision01=c(this.state.precision01*.96+.04*(1-pe)*(.4+.6*v));
this.state.causalEffect01=c(this.state.causalEffect01*.92+Math.abs(teach)*(.55+.45*v)*.08)}
diagnostics(){return structuredClone(this.state)} evaluateLesion(i:B2501Input){const snap=this.snapshot();const on=this.beforeDecision(i);this.restore(snap);this.state.lesion=true;const off=this.beforeDecision(i);this.restore(snap);const e=m(A.map(a=>Math.abs(on.neuralUtility[a]-off.neuralUtility[a])));this.state.causalEffect01=c(e);this.state.causalChecks++;return{effect01:e,on,off}}
}
