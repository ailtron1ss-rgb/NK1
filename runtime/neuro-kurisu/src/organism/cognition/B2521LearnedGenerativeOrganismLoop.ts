import type { ActionKind } from '../core/types.ts';
const A:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const key=(v:number[])=>v.slice(0,16).map(x=>Math.round(clamp(Number(x))*7)).join('');
export interface B2521Transition{n:number;action:ActionKind;fromKey:string;toKey:string;reward01:number;error01:number;verified01:number;confidence01:number;lastTick:number;delta:number[];from?:number[];to?:number[];}
export interface B2521State{version:2;enabled:boolean;tick:number;cycles:number;rollouts:number;learningUpdates:number;modelUpdates:number;modelCoverage01:number;localCoverage01:number;prototypeCoverage01:number;globalCoverage01:number;transitionConfidence01:number;generativeAccuracy01:number;counterfactualUse01:number;transitions:number;recoveryCount:number;transitionsTransferred:number;actionBias:Record<ActionKind,number>;model:Record<string,B2521Transition>;lastKey:string;lastPredicted:number[];lesionFraction01:number;}
export const defaultB2521State=():B2521State=>({version:2,enabled:true,tick:0,cycles:0,rollouts:0,learningUpdates:0,modelUpdates:0,modelCoverage01:0,localCoverage01:0,prototypeCoverage01:0,globalCoverage01:0,transitionConfidence01:.2,generativeAccuracy01:.2,counterfactualUse01:0,transitions:0,recoveryCount:0,transitionsTransferred:0,actionBias:Object.fromEntries(A.map(a=>[a,0])) as Record<ActionKind,number>,model:{},lastKey:'root',lastPredicted:[],lesionFraction01:0});
export class B2521LearnedGenerativeOrganismLoop{
 private state=defaultB2521State(); readonly systemName='cognition:b2521-learned-generative-organism-loop' as const;
 snapshot(){return structuredClone(this.state)}
 restore(raw?:Partial<B2521State>|null){const d=defaultB2521State(),r:any=raw??{};this.state={...d,...structuredClone(r),version:2,actionBias:{...d.actionBias,...(r.actionBias??{})},model:{...r.model},localCoverage01:clamp(Number(r.localCoverage01??0)),prototypeCoverage01:clamp(Number(r.prototypeCoverage01??0)),globalCoverage01:clamp(Number(r.globalCoverage01??0)),recoveryCount:Number(r.recoveryCount??0),transitionsTransferred:Number(r.transitionsTransferred??0)};}
 setEnabled(v:boolean){this.state.enabled=!!v} setLesion(v:number){this.state.lesionFraction01=clamp(v)}
 private predict(from:number[],action:ActionKind){
  const k=key(from), exact=Object.values(this.state.model).filter(e=>e.fromKey===k&&e.action===action);
  if(exact.length){
    const e=exact.sort((a,b)=>b.n-a.n||b.lastTick-a.lastTick)[0]!;const next=from.slice(0,16);
    for(let j=0;j<next.length;j++)next[j]=clamp(next[j]+(e.delta[j]??0));
    return {next,reward:e.reward01,confidence:e.confidence01,matched:1,mode:'local',similarity:1};
  }
  const typed=Object.values(this.state.model).filter(e=>e.action===action&&Array.isArray(e.from)&&e.from.length>0);
  if(typed.length){
    const ranked=typed.map(e=>{let s=0,n=0;for(let j=0;j<Math.min(16,from.length,e.from!.length);j++){const d=(from[j]??0)-(e.from![j]??0);s+=d*d;n++;}return {e,sim:1-Math.min(1,Math.sqrt(s/Math.max(1,n)))};}).sort((a,b)=>b.sim-a.sim).slice(0,4);
    const w=ranked.reduce((z,x)=>z+Math.max(.05,x.sim),0);const next=from.slice(0,16);let reward=0,conf=0;
    for(const x of ranked){const ww=Math.max(.05,x.sim)/w;for(let j=0;j<next.length;j++)next[j]=clamp(next[j]+(x.e.delta[j]??0)*ww);reward+=x.e.reward01*ww;conf+=x.e.confidence01*ww;}
    return {next,reward:clamp(reward),confidence:clamp(conf*.92),matched:ranked.length,mode:'prototype',similarity:ranked[0]?.sim??0};
  }
  const priors=Object.values(this.state.model).filter(e=>e.action===action);
  if(priors.length){
    const w=Math.max(1,priors.reduce((s,e)=>s+e.n,0));const next=from.slice(0,16);let reward=0,conf=0;
    for(const e of priors){const ww=e.n/w;for(let j=0;j<next.length;j++)next[j]=clamp(next[j]+(e.delta[j]??0)*ww);reward+=e.reward01*ww;conf+=e.confidence01*ww;}
    return {next,reward:clamp(reward),confidence:clamp(conf*.8),matched:priors.length,mode:'global',similarity:.28};
  }
  return {next:from.slice(0,16),reward:.5,confidence:0,matched:0,mode:'none',similarity:0};
 }
 beforeDecision(i:{tick:number;latent:number[];baseUtilities:Partial<Record<ActionKind,number>>;goalPressure01:number;uncertainty01:number;predictionError01:number;horizon:number;verified01?:number}){
  this.state.tick=i.tick;if(!this.state.enabled)return {actionBias:{...this.state.actionBias},generativeAccuracy01:this.state.generativeAccuracy01,modelCoverage01:this.state.modelCoverage01};
  const from=i.latent.slice(0,16);
  const bias=Object.fromEntries(A.map(a=>[a,0])) as Record<ActionKind,number>;
  let totalConf=0,used=0;
  const h=Math.max(1,Math.min(7,Math.round(i.horizon)));
  for(const a of A){
    let cur=from.slice(),score=i.baseUtilities[a]??.5,discount=1;
    for(let d=0;d<h;d++){
      const p=this.predict(cur,a);
      if(!p.matched)break;
      used++; totalConf+=p.confidence;
      if(p.mode==='local')this.state.localCoverage01=clamp(this.state.localCoverage01*.995+.005);
      else if(p.mode==='prototype')this.state.prototypeCoverage01=clamp(this.state.prototypeCoverage01*.995+.03*p.similarity);
      else if(p.mode==='global')this.state.globalCoverage01=clamp(this.state.globalCoverage01*.995+.02);
      score=clamp(score*.76+(p.reward*.18+(i.goalPressure01-.45)*.035+(a==='explore'||a==='verify'?i.uncertainty01*.025:0))*discount*.24);
      cur=p.next; discount*=.88;
    }
    const modelLift=score-(i.baseUtilities[a]??.5);
    bias[a]=clamp(modelLift*.34*(1-this.state.lesionFraction01),-.10,.10);
  }
  this.state.cycles++;
  this.state.rollouts+=A.length*h;
  const coverage=used/(A.length*h||1);
  this.state.counterfactualUse01=clamp(this.state.counterfactualUse01*.94+coverage*.06);
  this.state.modelCoverage01=clamp(this.state.localCoverage01*.45+this.state.prototypeCoverage01*.40+this.state.globalCoverage01*.15);
  this.state.modelCoverage01=clamp(this.state.modelCoverage01*.96+Math.min(1,coverage)*.04);
  this.state.transitionConfidence01=clamp(this.state.transitionConfidence01*.94+(used?totalConf/used:0)*.06);
  this.state.actionBias=bias; this.state.lastKey=key(from); this.state.lastPredicted=from.slice(0,16);
  return {actionBias:{...bias},generativeAccuracy01:this.state.generativeAccuracy01,modelCoverage01:this.state.modelCoverage01,transitionConfidence01:this.state.transitionConfidence01,counterfactualUse01:this.state.counterfactualUse01};
 }
 afterOutcome(i:{tick:number;latent:number[];nextLatent:number[];action:ActionKind;reward01:number;predictionError01:number;verified01:number}){
  if(!this.state.enabled)return;
  const from=i.latent.slice(0,16),to=i.nextLatent.slice(0,16);
  const p=this.predict(from,i.action);
  const delta=from.map((x,j)=>clamp((to[j]??x)-x,-1,1));
  const predictedError=to.reduce((s,x,j)=>s+Math.abs(x-(p.next[j]??x)),0)/(to.length||1);
  const id=`${key(from)}|${i.action}|${key(to)}`;
  const old=this.state.model[id];
  const lr=i.verified01>.5?.20:.055;
  const e:B2521Transition=old??{n:0,action:i.action,fromKey:key(from),toKey:key(to),reward01:.5,error01:.5,verified01:0,confidence01:.15,lastTick:i.tick,delta:delta.slice(),from:from.slice(),to:to.slice()};
  e.n++; e.reward01=clamp(e.reward01*(1-lr)+i.reward01*lr);
  e.error01=clamp(e.error01*(1-lr)+predictedError*lr);
  e.verified01=clamp(e.verified01*.93+i.verified01*.07);
  e.confidence01=clamp(e.confidence01*.90+((1-e.error01)*.65+e.verified01*.35)*.10);
  e.delta=e.delta.map((x,j)=>clamp(x*(1-lr)+(delta[j]??0)*lr,-1,1)); e.from=(e.from??from.slice()).map((x,j)=>clamp(x*(1-lr)+(from[j]??0)*lr)); e.to=(e.to??to.slice()).map((x,j)=>clamp(x*(1-lr)+(to[j]??0)*lr)); e.lastTick=i.tick;
  this.state.model[id]=e; this.state.learningUpdates++; this.state.modelUpdates++;
  this.state.generativeAccuracy01=clamp(this.state.generativeAccuracy01*.90+(1-predictedError)*.10);
  if(p.mode!=='local' && p.matched>0)this.state.transitionsTransferred++;
  if(predictedError>.55){this.state.recoveryCount++;}
  this.state.transitionConfidence01=clamp(this.state.transitionConfidence01*.94+e.confidence01*.06);
  this.state.transitions=Object.keys(this.state.model).length; this.state.tick=i.tick;
  if(Object.keys(this.state.model).length>512){
    const keep=Object.entries(this.state.model).sort((a,b)=>b[1].lastTick-a[1].lastTick).slice(0,512);
    this.state.model=Object.fromEntries(keep); this.state.transitions=keep.length;
  }
 }
 diagnostics(){return structuredClone(this.state)}
 lesion(f=.5){const args={tick:this.state.tick+1,latent:this.state.lastPredicted.length?this.state.lastPredicted:Array(16).fill(.5),baseUtilities:Object.fromEntries(A.map(a=>[a,.5])),goalPressure01:.85,uncertainty01:.65,predictionError01:.2,horizon:5};this.setLesion(0);const on=this.beforeDecision(args).actionBias;this.setLesion(f);const off=this.beforeDecision({...args,tick:args.tick+1}).actionBias;this.setLesion(0);const effect=A.reduce((s,a)=>s+Math.abs((on[a]??0)-(off[a]??0)),0);return {causalDrop01:clamp(effect*3),before01:this.state.generativeAccuracy01,after01:clamp(this.state.generativeAccuracy01-effect)};}
}
