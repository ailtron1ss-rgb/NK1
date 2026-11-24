import type { ActionKind } from '../core/types.ts';
const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const deep=<T>(x:T):T=>structuredClone(x);
export interface GoalIdentitySkillModulatorState{version:1;tick:number;updates:number;goalConditioning01:number;identityConditioning01:number;personalityStability01:number;traitPlasticity01:number;drift01:number;coherence01:number;actionPreference:Record<ActionKind,number>;traitVector:number[];lastGoalPressure01:number;lastIdentityGap01:number;}
const defaultState=():GoalIdentitySkillModulatorState=>({version:1,tick:0,updates:0,goalConditioning01:.2,identityConditioning01:.2,personalityStability01:.7,traitPlasticity01:.12,drift01:0,coherence01:.6,actionPreference:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,traitVector:[.55,.55,.55,.55,.55,.55,.55,.55],lastGoalPressure01:.5,lastIdentityGap01:.5});
export class GoalIdentitySkillModulator{
 private state=defaultState();snapshot(){return deep(this.state);}
 restore(raw?:Partial<GoalIdentitySkillModulatorState>|null){const d=defaultState(),r:any=raw??{};this.state={...d,...deep(r),version:1,goalConditioning01:clamp(Number(r.goalConditioning01??.2)),identityConditioning01:clamp(Number(r.identityConditioning01??.2)),personalityStability01:clamp(Number(r.personalityStability01??.7)),traitPlasticity01:clamp(Number(r.traitPlasticity01??.12)),drift01:clamp(Number(r.drift01??0)),coherence01:clamp(Number(r.coherence01??.6)),traitVector:Array.isArray(r.traitVector)?r.traitVector.slice(0,8).concat(new Array(Math.max(0,8-(r.traitVector?.length??0))).fill(.55)).slice(0,8):d.traitVector};}
 beforeDecision(args:{tick:number;goalPressure01:number;identityGap01:number;novelty01:number;uncertainty01:number;baseUtilities:Record<ActionKind,number>;traitVector?:number[]}):{actionBias:Record<ActionKind,number>;goalConditioning01:number;identityConditioning01:number;coherence01:number;traitVector:number[]}{
  this.state.tick=args.tick;this.state.lastGoalPressure01=clamp(args.goalPressure01);this.state.lastIdentityGap01=clamp(args.identityGap01);
  if(args.traitVector){const incoming=args.traitVector.slice(0,8);for(let i=0;i<8;i++){const x=clamp(incoming[i]??.55);this.state.traitVector[i]=clamp(this.state.traitVector[i]!* (1-this.state.traitPlasticity01)+x*this.state.traitPlasticity01);}}
  const curiosity=this.state.traitVector[0]!,persistence=this.state.traitVector[1]!,caution=this.state.traitVector[2]!,social=this.state.traitVector[3]!,reflection=this.state.traitVector[4]!,novelty=clamp(args.novelty01),uncertainty=clamp(args.uncertainty01);
  const bias:Object=Object.fromEntries(ACTIONS.map(a=>[a,0]));
  (bias as any).explore=clamp((novelty*.035*curiosity + args.goalPressure01*.014*persistence - uncertainty*.018*caution));
  (bias as any).verify=clamp((uncertainty*.038*caution + args.identityGap01*.014*persistence));
  (bias as any).reflect=clamp((args.identityGap01*.024*reflection + args.goalPressure01*.010));
  (bias as any).respond=clamp((social*.014 + (1-args.identityGap01)*.012));
  (bias as any).rest=clamp(-(args.goalPressure01*.010)+(1-novelty)*.008);
  (bias as any).wait=clamp(uncertainty*.008-(args.goalPressure01*.006));
  (bias as any).defer=clamp(uncertainty*.012*(1-caution));
  this.state.actionPreference=ACTIONS.reduce((o,a)=>{o[a]=clamp((args.baseUtilities[a]??.5)-.5);return o;},{} as Record<ActionKind,number>);
  const goalSignal=clamp(.55*args.goalPressure01+.45*(1-args.identityGap01));this.state.goalConditioning01=clamp(this.state.goalConditioning01*.95+goalSignal*.05);this.state.identityConditioning01=clamp(this.state.identityConditioning01*.95+(1-args.identityGap01)*.05);
  const variance=this.state.traitVector.reduce((s,x)=>s+(x-.55)**2,0)/8;this.state.drift01=clamp(Math.sqrt(variance)*1.8);this.state.personalityStability01=clamp(this.state.personalityStability01*.97+(1-this.state.drift01)*.03);this.state.coherence01=clamp(this.state.coherence01*.94+(1-Math.abs(args.goalPressure01-(1-args.identityGap01)))*.06);this.state.updates++;
  return {actionBias:bias as Record<ActionKind,number>,goalConditioning01:this.state.goalConditioning01,identityConditioning01:this.state.identityConditioning01,coherence01:this.state.coherence01,traitVector:this.state.traitVector.slice()};
 }
 afterOutcome(args:{reward01:number;verified01:number;identityGap01:number;goalPressure01:number;selectedAction:ActionKind}){
  const congruence=clamp(args.reward01*.5+args.verified01*.25+(1-args.identityGap01)*.15+args.goalPressure01*.10);const eta=this.state.traitPlasticity01*.08;
  const idx=ACTIONS.indexOf(args.selectedAction);if(idx>=0)this.state.traitVector[idx%8]=clamp(this.state.traitVector[idx%8]!+(congruence-.5)*eta);
  this.state.coherence01=clamp(this.state.coherence01*.94+congruence*.06);
 }
 metrics(){return deep(this.state);}
}
export const defaultGoalIdentitySkillModulator=():GoalIdentitySkillModulatorState=>defaultState();
