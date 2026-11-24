import type { ActionKind, OrganismGoal, OrganismState } from '../core/types.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export type LifeHorizon='immediate'|'near'|'long'|'identity';
export interface LifeCourseGoalProjection {goalId:string; horizon:LifeHorizon; value01:number; friction01:number; continuity01:number; socialImpact01:number; learningReturn01:number; resourceCost01:number; score01:number;}
export interface LifeCourseConflict {a:string;b:string;conflict01:number;reason:string;}
export interface LifeCourseNavigatorState {
  version:1;
  cycles:number;
  projections:LifeCourseGoalProjection[];
  conflicts:LifeCourseConflict[];
  focusGoalId:string|null;
  focusHorizon:LifeHorizon|'none';
  immediate01:number;
  near01:number;
  long01:number;
  identity01:number;
  social01:number;
  learning01:number;
  continuityDebt01:number;
  resourceFriction01:number;
  revisionPressure01:number;
  lastReason:string;
  lastAt:number;
}

const horizons:LifeHorizon[]=['immediate','near','long','identity'];
function horizonForGoal(g:OrganismGoal):LifeHorizon{
  const text=`${g.title} ${g.reason} ${g.source}`.toLowerCase();
  if(/identity|self|personhood|continuity|development|autonomy/.test(text)) return 'identity';
  if(/research|learn|skill|habit|project|build|develop/.test(text)) return 'long';
  if(g.urgency>.72) return 'immediate';
  return 'near';
}
function tokenSet(text:string){return new Set(text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(x=>x.length>3));}
function overlap(a:string,b:string){const A=tokenSet(a),B=tokenSet(b);let n=0;for(const x of A)if(B.has(x))n++;return n/Math.max(1,Math.min(A.size,B.size));}

export const defaultLifeCourseNavigator=():LifeCourseNavigatorState=>({version:1,cycles:0,projections:[],conflicts:[],focusGoalId:null,focusHorizon:'none',immediate01:0.3,near01:0.3,long01:0.3,identity01:0.3,social01:0.2,learning01:0.3,continuityDebt01:0.2,resourceFriction01:0.2,revisionPressure01:0.15,lastReason:'initial',lastAt:0});

export class LifeCourseNavigator{
  private state=defaultLifeCourseNavigator();
  restore(raw?:Partial<LifeCourseNavigatorState>|null){const d=defaultLifeCourseNavigator(),r=raw??{};this.state={...d,...r,version:1,projections:Array.isArray(r.projections)?r.projections.slice(0,96):[],conflicts:Array.isArray(r.conflicts)?r.conflicts.slice(0,64):[]};}
  snapshot(){return structuredClone(this.state);}
  beginCycle(at=Date.now()){
    this.state.cycles++;
    this.state.revisionPressure01=clamp(this.state.revisionPressure01*.996);
    this.state.continuityDebt01=clamp(this.state.continuityDebt01*.998);
    this.state.resourceFriction01=clamp(this.state.resourceFriction01*.999);
    this.state.lastAt=at;
  }
  assess(input:{state:OrganismState;goals:OrganismGoal[];identity01:number;identityDrift01:number;social01:number;socialError01:number;learningNeed01:number;transfer01:number;portfolioAllocation01:number;historyUnresolved01:number;futureMismatch01:number;resource01:number;novelty01:number;uncertainty01:number;at?:number}){
    const at=input.at??Date.now();
    const active=input.goals.filter(g=>g.status==='active').slice(0,16);
    const horizonLoads:Record<LifeHorizon,number>={immediate:0,near:0,long:0,identity:0};
    const rows=active.map(g=>{
      const horizon=horizonForGoal(g);
      const progress=clamp(g.progress), confidence=clamp(g.confidence);
      const continuity=clamp(input.identity01*.5+(1-input.identityDrift01)*.25+confidence*.25);
      const socialImpact=clamp(input.social01*.55+(g.source==='intrinsic'?.15:.05)+(horizon==='near'?.10:0));
      const learningReturn=clamp((1-progress)*.34+input.learningNeed01*.28+input.transfer01*.18+input.portfolioAllocation01*.12+input.novelty01*.08);
      const horizonWeight=horizon==='immediate'?clamp(.62+g.urgency*.28):horizon==='near'?clamp(.48+g.importance*.18):horizon==='long'?clamp(.52+learningReturn*.2):clamp(.54+continuity*.2);
      const friction=clamp(input.resource01*.34+input.uncertainty01*.20+input.socialError01*.12+input.historyUnresolved01*.18+(1-confidence)*.16);
      const score=clamp(g.importance*.19+g.urgency*.16+(1-progress)*.11+confidence*.08+continuity*.13+socialImpact*.07+learningReturn*.14+horizonWeight*.08-friction*.12);
      horizonLoads[horizon]+=score;
      return {goalId:g.id,horizon,value01:clamp(g.importance*.55+g.urgency*.25+progress*.2),friction01:friction,continuity01:continuity,socialImpact01:socialImpact,learningReturn01:learningReturn,resourceCost01:clamp(input.resource01*.5+(1-learningReturn)*.3+input.uncertainty01*.2),score01:score};
    }).sort((a,b)=>b.score01-a.score01);
    const conflicts:LifeCourseConflict[]=[];
    for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
      const a=rows[i]!,b=rows[j]!, ga=active.find(g=>g.id===a.goalId)!,gb=active.find(g=>g.id===b.goalId)!;
      const textual=overlap(`${ga.title} ${ga.reason}`,`${gb.title} ${gb.reason}`);
      const timeConflict=a.horizon==='immediate'&&b.horizon==='immediate' ? .22 : a.horizon==='long'&&b.horizon==='immediate' ? .12 : 0;
      const resourceConflict=clamp((a.resourceCost01+b.resourceCost01-0.9)*.55);
      const conflict=clamp(textual*.48+resourceConflict*.34+timeConflict+Math.abs(a.score01-b.score01)*.08);
      if(conflict>.18) conflicts.push({a:a.goalId,b:b.goalId,conflict01:conflict,reason:`resource=${resourceConflict.toFixed(2)};semantic=${textual.toFixed(2)};horizon=${timeConflict.toFixed(2)}`});
    }
    const conflictPenalty=conflicts.reduce((s,c)=>s+c.conflict01,0)/Math.max(1,conflicts.length);
    const top=rows[0];
    this.state.projections=rows.slice(0,96);
    this.state.conflicts=conflicts.slice(0,64);
    this.state.focusGoalId=top?.goalId??null;
    this.state.focusHorizon=top?.horizon??'none';
    this.state.immediate01=clamp(horizonLoads.immediate/Math.max(1,rows.length));
    this.state.near01=clamp(horizonLoads.near/Math.max(1,rows.length));
    this.state.long01=clamp(horizonLoads.long/Math.max(1,rows.length));
    this.state.identity01=clamp(horizonLoads.identity/Math.max(1,rows.length)+input.identity01*.25);
    this.state.social01=clamp(input.social01*.55+input.socialError01*.25+conflictPenalty*.2);
    this.state.learning01=clamp(input.learningNeed01*.52+input.transfer01*.18+input.portfolioAllocation01*.18+(1-this.state.long01)*.12);
    this.state.continuityDebt01=clamp(input.historyUnresolved01*.48+input.futureMismatch01*.24+input.identityDrift01*.18+conflictPenalty*.10);
    this.state.resourceFriction01=clamp(input.resource01*.55+input.uncertainty01*.20+conflictPenalty*.25);
    this.state.revisionPressure01=clamp(input.futureMismatch01*.35+input.historyUnresolved01*.24+input.socialError01*.12+conflictPenalty*.18+this.state.continuityDebt01*.11);
    this.state.lastReason=top?`focus:${top.goalId}; horizon=${top.horizon}; conflict=${conflictPenalty.toFixed(2)}`:'no-active-goal';
    this.state.lastAt=at;
    return {focus:top?{goalId:top.goalId,horizon:top.horizon,score01:top.score01}:null,projections:structuredClone(rows),conflicts:structuredClone(conflicts),diagnostics:this.diagnostics()};
  }
  actionBias(action:ActionKind){
    const h=this.state.focusHorizon;
    const wants=(h==='immediate'&&(action==='respond'||action==='verify'))||(h==='near'&&(action==='explore'||action==='respond'))||(h==='long'&&(action==='explore'||action==='verify'||action==='reflect'))||(h==='identity'&&(action==='reflect'||action==='verify'));
    const penalty=this.state.resourceFriction01>.78&&(action==='explore'||action==='verify')?.012:0;
    return wants?clamp(this.state.learning01*.018+this.state.revisionPressure01*.016+this.state.identity01*.010-penalty):0;
  }
  recordOutcome(input:{goalId?:string|null;success01:number;surprise01:number;verified01:number;futureMismatch01:number;social01:number;at?:number}){
    const at=input.at??Date.now();
    const gain=clamp(input.success01*.42+input.verified01*.2+input.social01*.08+(1-input.surprise01)*.1+(1-input.futureMismatch01)*.2);
    this.state.revisionPressure01=clamp(this.state.revisionPressure01*.91+(1-gain)*.09);
    this.state.continuityDebt01=clamp(this.state.continuityDebt01*.94+input.futureMismatch01*.06);
    this.state.resourceFriction01=clamp(this.state.resourceFriction01*.95+input.surprise01*.03+(1-gain)*.02);
    const p=this.state.projections.find(x=>x.goalId===input.goalId);
    if(p){p.score01=clamp(p.score01*.92+gain*.08);p.friction01=clamp(p.friction01*.94+(1-gain)*.06);}
    this.state.lastAt=at;
  }
  diagnostics(){return {...structuredClone(this.state),projectionCount:this.state.projections.length,conflictCount:this.state.conflicts.length};}
}
