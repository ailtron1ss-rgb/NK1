import type { ActionKind } from '../core/types.ts';
const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const keyFor=(v:number[],a:ActionKind)=>`${v.slice(0,6).map(x=>Math.round(clamp(Number(x)||0)*2)).join('')}:${a}`;
interface Rule{key:string;action:ActionKind;strength11:number;evidence01:number;stability01:number;uses:number;verified:number;lastTick:number;}
export interface B2517State{version:1;enabled:boolean;tick:number;cycles:number;learningUpdates:number;consolidations:number;rulesCompiled:number;rules:Record<string,Rule>;selfAuthorship01:number;ruleReliability01:number;identitySafety01:number;actionBias:Record<ActionKind,number>;lesionFraction01:number;}
export const defaultB2517State=():B2517State=>({version:1,enabled:true,tick:0,cycles:0,learningUpdates:0,consolidations:0,rulesCompiled:0,rules:{},selfAuthorship01:.35,ruleReliability01:.45,identitySafety01:1,actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,lesionFraction01:0});
export class B2517SelfAuthoredRuleCompiler{
 readonly systemName='cognition:b2517-self-authored-rule-compiler' as const;private state=defaultB2517State();
 snapshot(){return structuredClone(this.state)} restore(raw?:Partial<B2517State>|null){const d=defaultB2517State(),r:any=raw??{};this.state={...d,...structuredClone(r),version:1,actionBias:{...d.actionBias,...(r.actionBias??{})},rules:{...d.rules,...(r.rules??{})}};}
 setEnabled(x:boolean){this.state.enabled=!!x} setLesion(x:number){this.state.lesionFraction01=clamp(x)}
 beforeDecision(i:{tick:number;latent:number[];goalLatent?:number[];uncertainty01:number;predictionError01:number;goalPressure01:number;autonomy01:number;identity01:number;}){
  const bias=Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;let matched=0; const stableContext=i.goalLatent?.length?i.goalLatent:i.latent;
  if(this.state.enabled){for(const a of ACTIONS){const exact=this.state.rules[keyFor(stableContext,a)];const candidates=exact?[exact]:Object.values(this.state.rules).filter(r=>r.action===a).sort((x,y)=>(y.evidence01*y.stability01)-(x.evidence01*x.stability01)).slice(0,2);for(const r of candidates){const gate=r.evidence01*r.stability01*this.state.ruleReliability01*(1-this.state.lesionFraction01);bias[a]=clamp(bias[a]+r.strength11*0.080*gate,-.075,.075);r.uses++;r.lastTick=i.tick;matched++;}}}
  this.state.tick=i.tick;this.state.cycles++;this.state.actionBias=bias;return {actionBias:{...bias},matchedRules:matched,selfAuthorship01:this.state.selfAuthorship01,ruleReliability01:this.state.ruleReliability01,identitySafety01:this.state.identitySafety01};
 }
 afterOutcome(i:{tick:number;latent:number[];goalLatent?:number[];action:ActionKind;reward01:number;predictionError01:number;verified01:number;autonomous01:number;identityContinuity01:number;goalConsistency01:number}){
    if(!this.state.enabled)return;
    const verified=clamp(i.verified01),quality=clamp((1-i.predictionError01)*.42+verified*.33+i.autonomous01*.15+i.goalConsistency01*.10);
    if(verified<.55||quality<.60)return;
    const key=keyFor(i.goalLatent?.length?i.goalLatent:i.latent,i.action),old=this.state.rules[key];
    const r:Rule=old??{key,action:i.action,strength11:0,evidence01:.25,stability01:.25,uses:0,verified:0,lastTick:i.tick};
    const lr=.06+.08*verified;r.strength11=clamp(r.strength11*(1-lr)+(i.reward01-.5)*2*lr,-1,1);
    r.evidence01=clamp(r.evidence01*.94+quality*.06);r.stability01=clamp(r.stability01*.96+(.5+.5*clamp(i.identityContinuity01))*.04);r.verified+=1;r.lastTick=i.tick;this.state.rules[key]=r;
    this.state.learningUpdates++;if(!old)this.state.rulesCompiled++;this.state.ruleReliability01=clamp(this.state.ruleReliability01*.97+quality*.03);
    this.state.selfAuthorship01=clamp(this.state.selfAuthorship01*.985+(.35+.65*quality)*.015);this.state.identitySafety01=clamp(this.state.identitySafety01*.99+clamp(i.identityContinuity01)*.01);this.state.tick=i.tick;
  if(this.state.learningUpdates%16===0)this.consolidate();
 }
 consolidate(){const entries=Object.entries(this.state.rules).filter(([,r])=>r.evidence01>.52).sort((a,b)=>(b[1].evidence01*b[1].stability01)-(a[1].evidence01*a[1].stability01));this.state.consolidations++;const keep=entries.slice(0,96);this.state.rules=Object.fromEntries(keep);this.state.ruleReliability01=clamp(this.state.ruleReliability01+.012);}
 diagnostics(){return structuredClone(this.state)}
}
