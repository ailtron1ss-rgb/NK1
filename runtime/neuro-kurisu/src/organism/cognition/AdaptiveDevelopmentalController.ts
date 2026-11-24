import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const deep=<T>(x:T):T=>structuredClone(x);
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:.5;
const cosine=(a:number[],b:number[])=>{let d=0,aa=0,bb=0;for(let i=0;i<Math.min(a.length,b.length);i++){const x=Number(a[i])||0,y=Number(b[i])||0;d+=x*y;aa+=x*x;bb+=y*y;}return d/(Math.sqrt(aa*bb)+1e-9);};
const sim01=(a:number[],b:number[])=>clamp((cosine(a,b)+1)*.5);

export interface DevelopmentalGoal { id:string; vector:number[]; pressure01:number; confidence01:number; persistence01:number; selfAuthored01:number; value01:number; age:number; uses:number; lastOutcome01:number; }
export interface DevelopmentalPrototype { id:string; centroid:number[]; count:number; reward01:number; confidence01:number; transfer01:number; negativeTransfer01:number; lastTick:number; }
export interface AdaptiveDevelopmentalControllerState {
  version:1; tick:number; decisions:number; outcomes:number; goalCreations:number; goalRevisions:number; goalAbstentions:number;
  causalUpdates:number; skillConsolidations:number; faultTests:number; recoveries:number;
  goalAutonomy01:number; goalPersistence01:number; causalCredit01:number; transferReadiness01:number; recoveryReadiness01:number;
  identityHysteresis01:number; developmentalCoherence01:number; externalTransfer01:number; learningEfficiency01:number;
  selectedGoalId:string|null; selectedPrototypeId:string|null; selectedAction:ActionKind|null; recoveryAction:ActionKind|null;
  actionValues:number[]; actionCounts:number[]; actionCredit:number[]; prototypes:DevelopmentalPrototype[]; goals:DevelopmentalGoal[];
}
const defaultState=():AdaptiveDevelopmentalControllerState=>({
  version:1,tick:0,decisions:0,outcomes:0,goalCreations:0,goalRevisions:0,goalAbstentions:0,causalUpdates:0,skillConsolidations:0,faultTests:0,recoveries:0,
  goalAutonomy01:.35,goalPersistence01:.4,causalCredit01:.35,transferReadiness01:.35,recoveryReadiness01:.35,identityHysteresis01:.92,developmentalCoherence01:.4,externalTransfer01:.25,learningEfficiency01:.4,
  selectedGoalId:null,selectedPrototypeId:null,selectedAction:null,recoveryAction:null,actionValues:new Array(ACTIONS.length).fill(.5),actionCounts:new Array(ACTIONS.length).fill(0),actionCredit:new Array(ACTIONS.length).fill(.5),prototypes:[],goals:[]
});

export class AdaptiveDevelopmentalController {
  private state=defaultState();
  readonly maxGoals=24; readonly maxPrototypes=48;
  snapshot(){return deep(this.state);}
  restore(raw?:Partial<AdaptiveDevelopmentalControllerState>|null){const d=defaultState(),r:any=raw??{};this.state={...d,...deep(r),version:1,
    actionValues:Array.isArray(r.actionValues)?r.actionValues.slice(0,ACTIONS.length).map((x:any)=>clamp(Number(x))):d.actionValues,
    actionCounts:Array.isArray(r.actionCounts)?r.actionCounts.slice(0,ACTIONS.length).map((x:any)=>Math.max(0,Number(x)||0)):d.actionCounts,
    actionCredit:Array.isArray(r.actionCredit)?r.actionCredit.slice(0,ACTIONS.length).map((x:any)=>clamp(Number(x))):d.actionCredit,
    goals:Array.isArray(r.goals)?r.goals.slice(-this.maxGoals).map((g:any)=>({id:String(g.id??'goal'),vector:Array.isArray(g.vector)?g.vector.slice(0,24):[],pressure01:clamp(Number(g.pressure01??.5)),confidence01:clamp(Number(g.confidence01??.3)),persistence01:clamp(Number(g.persistence01??.3)),selfAuthored01:clamp(Number(g.selfAuthored01??.3)),value01:clamp(Number(g.value01??.5)),age:Math.max(0,Number(g.age)||0),uses:Math.max(0,Number(g.uses)||0),lastOutcome01:clamp(Number(g.lastOutcome01??.5))})):d.goals,
    prototypes:Array.isArray(r.prototypes)?r.prototypes.slice(-this.maxPrototypes).map((p:any)=>({id:String(p.id??'proto'),centroid:Array.isArray(p.centroid)?p.centroid.slice(0,24):[],count:Math.max(0,Number(p.count)||0),reward01:clamp(Number(p.reward01??.5)),confidence01:clamp(Number(p.confidence01??.3)),transfer01:clamp(Number(p.transfer01??.2)),negativeTransfer01:clamp(Number(p.negativeTransfer01??0)),lastTick:Math.max(0,Number(p.lastTick)||0)})):d.prototypes};}

  private actionIndex(a:ActionKind){return ACTIONS.indexOf(a);}
  private ensureGoal(i:{tick:number;context:number[];goalPressure01:number;identityGap01:number;novelty01:number;uncertainty01:number;identityVector?:number[]}):DevelopmentalGoal|null{
    const pressure=clamp(.46*i.goalPressure01+.20*i.novelty01+.18*i.identityGap01+.16*i.uncertainty01);
    const identity=i.identityVector?.slice(0,24)??i.context.slice(0,24);
    const existing=this.state.goals.map(g=>({g,s:sim01(g.vector,identity)*.55+g.persistence01*.25+g.value01*.20})).sort((a,b)=>b.s-a.s)[0];
    if(existing&&existing.s>.68){existing.g.age++;existing.g.pressure01=clamp(existing.g.pressure01*.92+pressure*.08);return existing.g;}
    if(pressure<.57&&this.state.goals.length>0){this.state.goalAbstentions++;return this.state.goals.sort((a,b)=>b.value01-a.value01)[0]??null;}
    const goal:DevelopmentalGoal={id:`devgoal:${i.tick}:${this.state.goalCreations+1}`,vector:identity.length?identity:[...i.context.slice(0,24)],pressure01:pressure,confidence01:clamp(.28+.36*(1-i.uncertainty01)+.18*i.novelty01),persistence01:.34,selfAuthored01:clamp(.52+.22*i.identityGap01+.16*i.goalPressure01),value01:clamp(.42+.32*pressure+.18*i.novelty01+.08*(1-i.uncertainty01)),age:0,uses:0,lastOutcome01:.5};
    this.state.goals.push(goal);this.state.goalCreations++;if(this.state.goals.length>this.maxGoals)this.state.goals.sort((a,b)=>(b.value01*b.persistence01)-(a.value01*a.persistence01)).splice(this.maxGoals);return goal;
  }

  beforeDecision(i:{tick:number;context:number[];identityVector?:number[];goalPressure01:number;identityGap01:number;novelty01:number;uncertainty01:number;predictionError01:number;computeBudget01:number;baseUtilities:Record<ActionKind,number>;taskFreeCoverage01?:number;negativeTransfer01?:number;risk01?:number;recoveryAction?:ActionKind|null}):{
    actionBias:Record<ActionKind,number>; goalId:string|null; prototypeId:string|null; goalPressure01:number; goalAutonomy01:number; transfer01:number; recoveryAction:ActionKind|null;
  }{
    this.state.tick=i.tick;this.state.decisions++;this.state.recoveryAction=i.recoveryAction??null;
    const goal=this.ensureGoal(i);this.state.selectedGoalId=goal?.id??null;if(goal){goal.uses++;goal.age++;}
    const ctx=i.context.slice(0,24);const ranked=this.state.prototypes.map(p=>({p,s:sim01(p.centroid,ctx)*.60+p.confidence01*.20+p.transfer01*.20-p.negativeTransfer01*.18})).sort((a,b)=>b.s-a.s);const top=ranked[0];
    if(top&&top.s>.58)this.state.selectedPrototypeId=top.p.id;else this.state.selectedPrototypeId=null;
    const transfer=clamp((top?.s??.25)*.65+(i.taskFreeCoverage01??.25)*.35-(i.negativeTransfer01??0)*.28);this.state.transferReadiness01=clamp(this.state.transferReadiness01*.94+transfer*.06);this.state.externalTransfer01=clamp(this.state.externalTransfer01*.96+transfer*.04);
    const bias=Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;
    for(const a of ACTIONS){const k=this.actionIndex(a);const learned=(this.state.actionValues[k]??.5)-.5;const credit=(this.state.actionCredit[k]??.5)-.5;const recovery=(i.recoveryAction===a?.08:0);const verify=(a==='verify'?i.uncertainty01*.045:0);const explore=(a==='explore'?i.novelty01*.035:0);const reflect=(a==='reflect'?i.identityGap01*.04:0);const rest=(a==='rest'?(1-i.computeBudget01)*.03:0);bias[a]=clamp(learned*.12+credit*.08+recovery+verify+explore+reflect+rest,-.09,.09);}
    if(goal){bias.reflect=clamp(bias.reflect+goal.selfAuthored01*.018);bias.explore=clamp(bias.explore+goal.pressure01*.012);}
    if(i.predictionError01>.72||i.uncertainty01>.82){bias.verify=clamp(bias.verify+.035);bias.defer=clamp(bias.defer+.018);}
    this.state.selectedAction=null;this.state.goalAutonomy01=clamp(this.state.goalAutonomy01*.95+(goal?.selfAuthored01??.3)*.05);this.state.goalPersistence01=clamp(this.state.goalPersistence01*.96+(goal?.persistence01??.3)*.04);
    return {actionBias:bias,goalId:goal?.id??null,prototypeId:top?.p.id??null,goalPressure01:goal?.pressure01??0,goalAutonomy01:this.state.goalAutonomy01,transfer01:transfer,recoveryAction:this.state.recoveryAction};
  }

  commitAction(action:ActionKind){this.state.selectedAction=action;}

  afterOutcome(i:{tick:number;context:number[];nextContext?:number[];identityVector?:number[];action:ActionKind;reward01:number;predictionError01:number;verified01:number;goalPressure01:number;identityGap01:number;autonomous01:number;external01?:number;fault01?:number;recovery01?:number}){
    this.state.tick=i.tick;this.state.outcomes++;const k=this.actionIndex(i.action),reward=clamp(i.reward01),error=clamp(i.predictionError01),verified=clamp(i.verified01);const quality=clamp(reward*.42+(1-error)*.28+verified*.18+i.autonomous01*.07+(1-i.identityGap01)*.05);
    const old=this.state.actionValues[k]??.5;const n=this.state.actionCounts[k]??0;const eta=1/Math.max(10,n+1);this.state.actionValues[k]=clamp(old+eta*.55*(quality-old));this.state.actionCounts[k]=n+1;
    const credit=clamp(reward*.38+(1-error)*.32+verified*.18+i.autonomous01*.12);this.state.actionCredit[k]=clamp((this.state.actionCredit[k]??.5)*.88+credit*.12);this.state.causalCredit01=clamp(this.state.causalCredit01*.94+credit*.06);this.state.causalUpdates++;
    const ctx=i.context.slice(0,24),existing=this.state.prototypes.map(p=>({p,s:sim01(p.centroid,ctx)})).sort((a,b)=>b.s-a.s)[0];
    if(existing&&existing.s>.67){const p=existing.p;const lr=1/Math.max(8,p.count+1);p.centroid=p.centroid.map((v,j)=>v*(1-lr)+(ctx[j]??v)*lr);p.reward01=clamp(p.reward01*(1-lr)+reward*lr);p.confidence01=clamp(p.confidence01*.96+quality*.04);p.transfer01=clamp(p.transfer01*.95+((i.external01??0)+quality)*.025);p.negativeTransfer01=clamp(p.negativeTransfer01*.92+(reward<.32?1:0)*.08);p.count++;p.lastTick=i.tick;
    }else{this.state.prototypes.push({id:`proto:${i.tick}:${this.state.prototypes.length+1}`,centroid:ctx,reward01:reward,confidence01:clamp(.25+quality*.5),transfer01:clamp((i.external01??0)*.5+quality*.25),negativeTransfer01:reward<.32?.15:0,lastTick:i.tick,count:1});}
    if(this.state.prototypes.length>this.maxPrototypes)this.state.prototypes.sort((a,b)=>(b.confidence01*b.count)-(a.confidence01*a.count)).splice(this.maxPrototypes);
    const goal=this.state.goals.find(g=>g.id===this.state.selectedGoalId);if(goal){const change=Math.abs(quality-goal.lastOutcome01);goal.lastOutcome01=clamp(goal.lastOutcome01*.86+quality*.14);goal.value01=clamp(goal.value01*.92+quality*.08);goal.persistence01=clamp(goal.persistence01*.985+(quality>.62?.015:-.008));goal.confidence01=clamp(goal.confidence01*.94+(1-error)*.06);if(change>.28){goal.vector=(i.nextContext??ctx).slice(0,24);this.state.goalRevisions++;}}
    const fault=clamp(i.fault01??0),recovery=clamp(i.recovery01??(fault>0?quality:.5));if(fault>.05){this.state.faultTests++;if(recovery>.62)this.state.recoveries++;this.state.recoveryReadiness01=clamp(this.state.recoveryReadiness01*.9+recovery*.1);}
    const external=clamp(i.external01??0);this.state.externalTransfer01=clamp(this.state.externalTransfer01*.94+external*.06);this.state.learningEfficiency01=clamp(this.state.learningEfficiency01*.94+quality*.06);
    this.state.identityHysteresis01=clamp(this.state.identityHysteresis01*.995+.005*(1-i.identityGap01));this.state.developmentalCoherence01=clamp(this.state.developmentalCoherence01*.93+mean([this.state.goalAutonomy01,this.state.goalPersistence01,this.state.causalCredit01,this.state.transferReadiness01,this.state.recoveryReadiness01])*.07);
    if(this.state.outcomes%24===0)this.consolidate();
  }

  consolidate(){const before=this.state.prototypes.length;this.state.prototypes=this.state.prototypes.filter(p=>p.count>=2||p.confidence01>.62).sort((a,b)=>(b.confidence01*b.count+b.transfer01)-(a.confidence01*a.count+a.transfer01)).slice(0,this.maxPrototypes);for(const g of this.state.goals)g.persistence01=clamp(g.persistence01+(g.uses>3?.01:0));this.state.skillConsolidations++;this.state.learningEfficiency01=clamp(this.state.learningEfficiency01+.008);return {before,after:this.state.prototypes.length};}

  runFaultTest(args:{tick:number;context:number[];baseUtilities:Record<ActionKind,number>;goalPressure01:number;identityGap01:number;novelty01:number;uncertainty01:number;computeBudget01:number;faultAction:ActionKind;faultSeverity01:number}){
    const pre=this.beforeDecision({...args,predictionError01:args.faultSeverity01,baseUtilities:args.baseUtilities});const expected=pre.actionBias[args.faultAction]??0;const recovery=pre.recoveryAction??(args.faultSeverity01>.7?'verify':'reflect');this.state.faultTests++;if(recovery&&recovery!==args.faultAction)this.state.recoveries++;this.state.recoveryReadiness01=clamp(this.state.recoveryReadiness01*.92+(recovery!==args.faultAction?.82:.25)*.08);return {faultAction:args.faultAction,recoveryAction:recovery,avoidance01:clamp((recovery!==args.faultAction?1:0)*.65+Math.abs(expected)*3),severity01:args.faultSeverity01};
  }
  metrics(){return {...deep(this.state),goalCount:this.state.goals.length,prototypeCount:this.state.prototypes.length,goalAutonomy01:this.state.goalAutonomy01,causalCredit01:this.state.causalCredit01,transferReadiness01:this.state.transferReadiness01,recoveryReadiness01:this.state.recoveryReadiness01,developmentalCoherence01:this.state.developmentalCoherence01};}
}
export const defaultAdaptiveDevelopmentalController=():AdaptiveDevelopmentalControllerState=>defaultState();
