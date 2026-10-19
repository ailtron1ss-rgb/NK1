import type { ActionKind, IntentCandidate } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const softmax=(xs:number[])=>{const m=Math.max(...xs);const es=xs.map(x=>Math.exp(Math.max(-20,Math.min(20,x-m))));const s=es.reduce((a,b)=>a+b,0)||1;return es.map(x=>x/s);};
const dot=(a:number[],b:number[])=>{let s=0;for(let i=0;i<Math.min(a.length,b.length);i++)s+=a[i]*b[i];return s;};
const cosine=(a:number[],b:number[])=>{const na=Math.sqrt(dot(a,a)+1e-9),nb=Math.sqrt(dot(b,b)+1e-9);return clamp11(dot(a,b)/(na*nb));};
const hash=(parts:string[])=>{let h=2166136261;for(const p of parts){for(let i=0;i<p.length;i++){h^=p.charCodeAt(i);h=Math.imul(h,16777619);}}return (h>>>0).toString(16);};

type PolicyWeights=Record<ActionKind,number[]>;
export interface B275ComposedSkill { id:string; sourceSkillIds:string[]; actions:ActionKind[]; featureAnchor:number[]; reliability01:number; transferCount:number; createdTick:number; lastUsedTick:number; status:'experimental'|'verified'|'rejected'|'retired'; }
export interface B275State {
  version:1; tick:number; decisions:number; learningUpdates:number; imaginedCompositions:number; verifiedPolicies:number; rejectedPolicies:number; transfers:number;
  previousAction:ActionKind|null; previousReward01:number; value01:number; policyEntropy01:number; exploration01:number; compositionDiversity01:number; neuralGrounding01:number; selfAlignment01:number; personalityAlignment01:number;
  weights:PolicyWeights; recurrent:Record<ActionKind,number[]>; bias:number[]; eligibility:PolicyWeights; composedSkills:B275ComposedSkill[]; activePolicyId:string|null; lastSelected:ActionKind|null; lastContext:number[]; lastFeature:number[];
}
export interface B275DecisionInput { tick:number; candidates:IntentCandidate[]; context:number[]; selfLatent:number[]; worldLatent:number[]; neuralAssembly:number[]; goalVector:number[]; autonomy01:number; personalityBias:Record<string,number>; exploration01:number; }
export interface B275DecisionResult { rankings:Array<{action:ActionKind;score01:number;probability01:number;composedSkillId?:string;}>; selected:ActionKind|null; policyGain01:number; entropy01:number; exploration01:number; }

function freshWeights():PolicyWeights{ return Object.fromEntries(ACTIONS.map((a,ai)=>[a,Array.from({length:32},(_,i)=>Math.sin((ai+1)*(i+3)*.071)*.028)])) as PolicyWeights; }
function freshEligibility():PolicyWeights{ return Object.fromEntries(ACTIONS.map(a=>[a,Array.from({length:32},()=>0)])) as PolicyWeights; }
function freshRecurrent():Record<ActionKind,number[]>{ return Object.fromEntries(ACTIONS.map((a,ai)=>[a,ACTIONS.map((_,j)=>Math.sin((ai+1)*(j+2)*.17)*.012)])) as Record<ActionKind,number[]>; }
export function defaultB275State():B275State{
  return {version:1,tick:0,decisions:0,learningUpdates:0,imaginedCompositions:0,verifiedPolicies:0,rejectedPolicies:0,transfers:0,previousAction:null,previousReward01:.5,value01:.5,policyEntropy01:1,exploration01:.35,compositionDiversity01:0,neuralGrounding01:.4,selfAlignment01:.5,personalityAlignment01:.5,weights:freshWeights(),recurrent:freshRecurrent(),bias:Array.from({length:32},(_,i)=>Math.cos(i*.31)*.01),eligibility:freshEligibility(),composedSkills:[],activePolicyId:null,lastSelected:null,lastContext:[],lastFeature:[]};
}

export class B275NeuralCompositionalPolicy{
  private state=defaultB275State();
  restore(raw?:Partial<B275State>|null){const d=defaultB275State(),r=raw??{};this.state={...d,...r,weights:this.sanitizeWeights(r.weights,d.weights),eligibility:this.sanitizeWeights(r.eligibility,d.eligibility),recurrent:this.sanitizeRecurrent(r.recurrent,d.recurrent),bias:Array.isArray(r.bias)?r.bias.slice(0,32):d.bias,composedSkills:Array.isArray(r.composedSkills)?r.composedSkills.slice(-96):[],lastContext:Array.isArray(r.lastContext)?r.lastContext.slice(0,32):[],lastFeature:Array.isArray(r.lastFeature)?r.lastFeature.slice(0,32):[]};}
  snapshot(){return structuredClone(this.state);}
  private sanitizeWeights(raw:any,fallback:PolicyWeights){const out=freshWeights();for(const a of ACTIONS){const v=raw?.[a];out[a]=Array.from({length:32},(_,i)=>Number.isFinite(v?.[i])?clamp11(v[i]):fallback[a][i]);}return out;}
  private sanitizeRecurrent(raw:any,fallback:Record<ActionKind,number[]>){const out=freshRecurrent();for(const a of ACTIONS)out[a]=ACTIONS.map((_,i)=>Number.isFinite(raw?.[a]?.[i])?clamp11(raw[a][i]):fallback[a][i]);return out;}
  private features(input:B275DecisionInput){
    const c=input.context.slice(0,16), s=input.selfLatent.slice(0,8), w=input.worldLatent.slice(0,8), n=input.neuralAssembly.slice(0,8), g=input.goalVector.slice(0,8);
    const f=[...c,...s,...w,...n,...g,input.autonomy01,input.exploration01];
    while(f.length<32)f.push(0);
    return f.slice(0,32).map(x=>clamp11(Number(x)||0));
  }
  private composedBias(action:ActionKind,feature:number[]){let best=-Infinity;let bestId:string|undefined;for(const skill of this.state.composedSkills){if(skill.status!=='verified')continue;const idx=skill.actions.indexOf(action);if(idx<0)continue;const sim=clamp01(.5+.5*cosine(feature.slice(0,8),skill.featureAnchor.slice(0,8)));const b=.055*skill.reliability01*sim/(1+idx);if(b>best){best=b;bestId=skill.id;}}return {bias:Number.isFinite(best)?best:0,id:bestId};}
  decide(input:B275DecisionInput):B275DecisionResult{
    const allowed=input.candidates.length?input.candidates:ACTIONS.map((action,i)=>({id:`b275-${i}`,action,score:0,predictedUtility:.5,predictedNeedRelief:.5,predictedCost:.5,confidence:.5,generatedAt:input.tick}));
    const f=this.features(input);this.state.tick=input.tick;this.state.lastFeature=f;this.state.lastContext=input.context.slice(0,32);
    const raw=allowed.map(c=>{const rec=this.state.previousAction?this.state.recurrent[this.state.previousAction]?.[ACTIONS.indexOf(c.action)]??0:0;const base=dot(this.state.weights[c.action],f)+dot(this.state.bias,f)+rec;const comp=this.composedBias(c.action,f);const personality=input.personalityBias[c.action]??0;const utility=.46*c.predictedUtility+.18*c.confidence+.12*(1-c.predictedCost)+.10*input.autonomy01+.08*personality+.06*(c.score??0);return {c,raw:base+.35*utility+comp.bias,compId:comp.id};});
    const probs=softmax(raw.map(x=>x.raw*(.78+.55*input.exploration01)));
    const rankings=raw.map((x,i)=>({action:x.c.action,score01:clamp01(.5+.16*x.raw),probability01:probs[i],composedSkillId:x.compId})).sort((a,b)=>b.probability01-a.probability01);
    const selected=rankings[0]?.action??null;const entropy=probs.length?(-probs.reduce((s,p)=>s+(p>0?p*Math.log(p):0),0)/Math.log(Math.max(2,probs.length))):1;
    this.state.decisions++;this.state.lastSelected=selected;this.state.activePolicyId=rankings[0]?.composedSkillId??null;this.state.policyEntropy01=clamp01(entropy);this.state.exploration01=clamp01(input.exploration01*.7+entropy*.3);this.state.neuralGrounding01=clamp01(this.state.neuralGrounding01*.92+clamp01(.5+.5*cosine(input.neuralAssembly,input.selfLatent))*0.08);this.state.selfAlignment01=clamp01(this.state.selfAlignment01*.92+clamp01(.5+.5*cosine(input.goalVector,input.selfLatent))*.08);this.state.personalityAlignment01=clamp01(this.state.personalityAlignment01*.92+(Object.values(input.personalityBias).length?.5+.5*Math.tanh(Object.values(input.personalityBias).reduce((a,b)=>a+b,0)):0.5)*.08);
    return {rankings,selected,policyGain01:clamp01(.5+(rankings[0]?.score01??.5)-.5),entropy01:entropy,exploration01:this.state.exploration01};
  }
  learnFromOutcome(input:{tick:number;reward01:number;predictionError01:number;selectedAction:ActionKind;context?:number[];goalVector?:number[];selfLatent?:number[];worldLatent?:number[];neuralAssembly?:number[];externalEvidence01?:number}){
    const f=(input.context?.slice(0,32)??this.state.lastFeature).concat().slice(0,32);while(f.length<32)f.push(0);
    const target=clamp11((input.reward01-.5)*2);const pred=this.state.lastSelected===input.selectedAction?clamp11((this.state.value01-.5)*2):0;const delta=clamp11(target-pred-.25*clamp01(input.predictionError01));
    const trace=this.state.eligibility[input.selectedAction]??Array.from({length:32},()=>0);for(let i=0;i<32;i++)trace[i]=clamp11(trace[i]*.82+f[i]);this.state.eligibility[input.selectedAction]=trace;
    const lr=.018*(.6+.4*(input.externalEvidence01??.5));for(const a of ACTIONS){for(let i=0;i<32;i++){const t=this.state.eligibility[a][i]??0;this.state.weights[a][i]=clamp11(this.state.weights[a][i]+lr*delta*t);this.state.eligibility[a][i]*=.96;}}
    const prev=this.state.previousAction;if(prev){const j=ACTIONS.indexOf(input.selectedAction);if(j>=0)this.state.recurrent[prev][j]=clamp11(this.state.recurrent[prev][j]+.012*delta);}
    this.state.value01=clamp01(this.state.value01*.9+input.reward01*.1);this.state.previousAction=input.selectedAction;this.state.previousReward01=input.reward01;this.state.learningUpdates++;
    if(input.selfLatent&&input.neuralAssembly)this.state.neuralGrounding01=clamp01(this.state.neuralGrounding01*.9+(0.5+.5*cosine(input.selfLatent,input.neuralAssembly))*.1);
    return {delta01:delta,learningRate:lr,value01:this.state.value01,learningUpdates:this.state.learningUpdates};
  }
  imagineComposition(input:{tick:number;sourceSkills:Array<{id:string;actions:ActionKind[];reliability01:number}>;context:number[];goalVector:number[];selfLatent:number[];neuralAssembly:number[]}):B275ComposedSkill|null{
    const sources=input.sourceSkills.filter(s=>s.actions.length).slice(0,5);if(sources.length<1)return null;
    const selected=sources.slice().sort((a,b)=>b.reliability01-a.reliability01).slice(0,3);const actions:Array<ActionKind>=[];for(const s of selected)for(const a of s.actions)if(!actions.includes(a))actions.push(a);if(!actions.length)return null;
    const anchor=Array.from({length:8},(_,i)=>clamp11(((input.context[i]??0)+(input.selfLatent[i]??0)+(input.neuralAssembly[i]??0))/3));
    const id=`policy275-${hash([selected.map(s=>s.id).join('|'),actions.join('>'),anchor.map(x=>x.toFixed(3)).join(',')])}`;
    const existing=this.state.composedSkills.find(s=>s.id===id);if(existing)return structuredClone(existing);
    const comp:B275ComposedSkill={id,sourceSkillIds:selected.map(s=>s.id),actions:actions.slice(0,6),featureAnchor:anchor,reliability01:clamp01(selected.reduce((s,x)=>s+x.reliability01,0)/selected.length*.92),transferCount:0,createdTick:input.tick,lastUsedTick:input.tick,status:'experimental'};
    this.state.composedSkills=[...this.state.composedSkills.slice(-95),comp];this.state.imaginedCompositions++;this.state.compositionDiversity01=clamp01(new Set(this.state.composedSkills.filter(s=>s.status!=='rejected').map(s=>s.actions.join('>'))).size/12);return structuredClone(comp);
  }
  evaluateComposedPolicy(input:{policyId:string;gain01:number;robustness01:number;neuralGrounding01:number;selfAlignment01:number;personalityAlignment01:number;predictionError01:number}){
    const p=this.state.composedSkills.find(s=>s.id===input.policyId);if(!p)return {verified:false,rejected:false,confidence01:0};
    const conf=clamp01(.26*clamp01(.5+input.gain01)+.20*input.robustness01+.16*input.neuralGrounding01+.16*input.selfAlignment01+.12*input.personalityAlignment01+.10*(1-input.predictionError01));
    if(input.gain01>.035&&input.robustness01>.56&&conf>.61){p.status='verified';p.reliability01=clamp01(p.reliability01*.7+conf*.3);this.state.verifiedPolicies++;return {verified:true,rejected:false,confidence01:conf};}
    if(input.gain01<-.04||input.robustness01<.42||conf<.42){p.status='rejected';this.state.rejectedPolicies++;return {verified:false,rejected:true,confidence01:conf};}
    return {verified:false,rejected:false,confidence01:conf};
  }
  transferPolicy(input:{policyId:string;context:number[];goalVector:number[];neuralAssembly:number[];independentGain01:number;robustness01:number}){
    const p=this.state.composedSkills.find(s=>s.id===input.policyId&&s.status==='verified');if(!p)return {transfer:false,gain01:0};const sim=clamp01(.5+.5*cosine(input.goalVector.slice(0,8),p.featureAnchor.slice(0,8)));const neural=clamp01(.5+.5*cosine(input.neuralAssembly.slice(0,8),p.featureAnchor.slice(0,8)));const gain=clamp01(.44+.28*input.independentGain01+.18*sim+.10*neural)*input.robustness01;if(gain>.57){p.transferCount++;p.lastUsedTick=this.state.tick;this.state.transfers++;this.state.transfers=Math.min(this.state.transfers,4096);return {transfer:true,gain01:gain};}return {transfer:false,gain01:gain};
  }
  actionBias(action:ActionKind){const p=this.state.composedSkills.find(s=>s.status==='verified');const idx=p?.actions.indexOf(action)??-1;const recurrent=this.state.previousAction?this.state.recurrent[this.state.previousAction]?.[ACTIONS.indexOf(action)]??0:0;return clamp11((idx>=0?.028*(p?.reliability01??.5)/(idx+1):0)+recurrent*.015+(this.state.value01-.5)*.01);}
  diagnostics(){return {version:1,tick:this.state.tick,decisions:this.state.decisions,learningUpdates:this.state.learningUpdates,imaginedCompositions:this.state.imaginedCompositions,verifiedPolicies:this.state.verifiedPolicies,rejectedPolicies:this.state.rejectedPolicies,transfers:this.state.transfers,policyEntropy01:this.state.policyEntropy01,exploration01:this.state.exploration01,compositionDiversity01:this.state.compositionDiversity01,neuralGrounding01:this.state.neuralGrounding01,selfAlignment01:this.state.selfAlignment01,personalityAlignment01:this.state.personalityAlignment01,activePolicyId:this.state.activePolicyId,lastSelected:this.state.lastSelected,verifiedSkills:this.state.composedSkills.filter(s=>s.status==='verified').map(s=>s.id)};}
}
