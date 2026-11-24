import type { ActionKind, OrganismGoal, OrganismState } from '../core/types.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clean=(x:unknown,n=120)=>String(x??'').trim().replace(/\s+/g,' ').slice(0,n);
export type WorldlineSubjectKind='self'|'person'|'goal'|'entity';
export interface WorldlineThread {
  id:string; kind:WorldlineSubjectKind; label:string; goalIds:string[]; contexts:string[];
  episodes:number; verified:number; successes:number; failures:number;
  trust01:number; continuity01:number; identityImpact01:number; socialImpact01:number;
  causal01:number; transfer01:number; unresolved01:number; commitmentDebt01:number;
  stability01:number; priority01:number; lastOutcome01:number; lastAt:number;
}
export interface PersonalWorldlineState {
  version:1; cycles:number; threads:WorldlineThread[]; focusId:string|null; focusKind:WorldlineSubjectKind|'none';
  autobiographicalCoherence01:number; relationalCoherence01:number; goalCoherence01:number; worldlineStability01:number;
  commitmentDebt01:number; identityPressure01:number; socialRepairPressure01:number; learningPressure01:number;
  counterfactualGap01:number; lastReason:string; lastAt:number;
}
export const defaultPersonalWorldline=():PersonalWorldlineState=>({version:1,cycles:0,threads:[],focusId:null,focusKind:'none',autobiographicalCoherence01:.62,relationalCoherence01:.58,goalCoherence01:.6,worldlineStability01:.64,commitmentDebt01:.2,identityPressure01:.18,socialRepairPressure01:.16,learningPressure01:.3,counterfactualGap01:.2,lastReason:'initial',lastAt:0});
const defaultThread=(id:string,kind:WorldlineSubjectKind,label:string,at:number):WorldlineThread=>({id,kind,label,goalIds:[],contexts:[],episodes:0,verified:0,successes:0,failures:0,trust01:.5,continuity01:.5,identityImpact01:.2,socialImpact01:.2,causal01:.35,transfer01:.2,unresolved01:.45,commitmentDebt01:.2,stability01:.5,priority01:.25,lastOutcome01:.5,lastAt:at});
export class PersonalWorldlineEngine{
 private state=defaultPersonalWorldline();
 restore(raw?:Partial<PersonalWorldlineState>|null){const d=defaultPersonalWorldline(),r=raw??{};this.state={...d,...r,version:1,threads:Array.isArray(r.threads)?r.threads.slice(-96).map((t:any)=>({...defaultThread(clean(t?.id,120)||`thread:${Math.random()}`,(t?.kind??'entity') as WorldlineSubjectKind,clean(t?.label,120)||'unknown',Number(t?.lastAt??0)),...t,goalIds:Array.isArray(t?.goalIds)?t.goalIds.slice(-16):[],contexts:Array.isArray(t?.contexts)?t.contexts.slice(-16):[]})):[]};}
 snapshot(){return structuredClone(this.state);}
 beginCycle(at=Date.now()){this.state.cycles++;this.state.learningPressure01=clamp(this.state.learningPressure01*.997);this.state.commitmentDebt01=clamp(this.state.commitmentDebt01*.998);this.state.lastAt=at;}
 private get(id:string,kind:WorldlineSubjectKind,label:string,at:number){let t=this.state.threads.find(x=>x.id===id);if(!t){t=defaultThread(id,kind,label,at);this.state.threads.unshift(t);if(this.state.threads.length>96)this.state.threads.length=96;}return t;}
 observeContext(input:{state:OrganismState;goals:OrganismGoal[];personLabel?:string;entityLabels?:string[];contextKey:string;identity01:number;social01:number;socialError01:number;goalPressure01:number;worldUncertainty01:number;predictionError01:number;at?:number}){
  const at=input.at??Date.now(); const focusGoal=input.goals.find(g=>g.status==='active'&&g.id===input.goals[0]?.id)??input.goals.find(g=>g.status==='active');
  const goal=focusGoal?this.get(`goal:${focusGoal.id}`,'goal',clean(focusGoal.title),at):null;
  if(goal){goal.goalIds=[...new Set([...goal.goalIds,focusGoal!.id])].slice(-16);this.updateThread(goal,{contextKey:input.contextKey,identity01:input.identity01,social01:input.social01,causal01:clamp(.35+input.predictionError01*.35),success01:clamp(1-input.predictionError01),verified:0,unresolved01:clamp(1-focusGoal!.progress),trust01:.5,commitment01:clamp(1-focusGoal!.progress),at});}
  const self=this.get('self:worldline','self','Self / life trajectory',at); this.updateThread(self,{contextKey:input.contextKey,identity01:input.identity01,social01:input.social01,causal01:clamp(.35+input.predictionError01*.25),success01:clamp(1-input.predictionError01),verified:0,unresolved01:clamp(input.goalPressure01*.45+input.socialError01*.2),trust01:input.identity01,commitment01:input.goalPressure01,at});
  if(input.personLabel){const p=this.get(`person:${clean(input.personLabel,80).toLowerCase()}`,'person',clean(input.personLabel,80),at);this.updateThread(p,{contextKey:input.contextKey,identity01:input.identity01,social01:input.social01,causal01:clamp(.3+(1-input.socialError01)*.35),success01:clamp(1-input.socialError01),verified:0,unresolved01:input.socialError01,trust01:input.social01,commitment01:input.socialError01,at});}
  for(const label of (input.entityLabels??[]).slice(0,6)){const e=this.get(`entity:${clean(label,80).toLowerCase()}`,'entity',clean(label,80),at);this.updateThread(e,{contextKey:input.contextKey,identity01:input.identity01*.6,social01:input.social01*.4,causal01:clamp(.3+input.predictionError01*.3),success01:clamp(1-input.predictionError01),verified:0,unresolved01:input.worldUncertainty01,trust01:clamp(1-input.worldUncertainty01),commitment01:0,at});}
  this.recompute(input);return this.snapshot();
 }
 private updateThread(t:WorldlineThread,i:{contextKey:string;identity01:number;social01:number;causal01:number;success01:number;verified:number;unresolved01:number;trust01:number;commitment01:number;at:number}){
  const ctx=clean(i.contextKey,120), fresh=ctx&&!t.contexts.includes(ctx);
  t.episodes++; if(i.verified)t.verified++; if(i.success01>=.62)t.successes++; if(i.success01<.4)t.failures++;
  if(fresh)t.contexts=[ctx,...t.contexts].slice(0,16);
  t.identityImpact01=clamp(t.identityImpact01*.9+i.identity01*.1);
  t.socialImpact01=clamp(t.socialImpact01*.88+i.social01*.12);
  t.causal01=clamp(t.causal01*.9+i.causal01*.1);
  t.unresolved01=clamp(t.unresolved01*.9+i.unresolved01*.1);
  t.trust01=clamp(t.trust01*.9+i.trust01*.1);
  t.commitmentDebt01=clamp(t.commitmentDebt01*.9+i.commitment01*.1);
  t.continuity01=clamp(t.continuity01*.94+(fresh?.12:.02)+(i.success01>=.62?.06:0));
  const rate=t.successes/Math.max(1,t.episodes);
  t.stability01=clamp(t.stability01*.9+clamp(rate*.55+(t.contexts.length/5)*.2+t.causal01*.25)*.1);
  t.transfer01=clamp(t.transfer01*.92+Math.min(1,t.contexts.length/5)*.08);
  t.priority01=clamp(t.unresolved01*.3+t.commitmentDebt01*.18+t.identityImpact01*.15+t.socialImpact01*.12+(1-t.stability01)*.1+(1-t.transfer01)*.08+t.causal01*.07);
  t.lastOutcome01=clamp(i.success01); t.lastAt=i.at;
 }
 recordOutcome(input:{
  action:ActionKind;goalId?:string|null;personLabel?:string;contextKey:string;success01:number;verified01:number;
  surprise01:number;identity01:number;social01:number;causal01:number;commitment01:number;counterfactualGap01:number;at?:number
 }){
  const at=input.at??Date.now(); const ids:string[]=[];
  if(input.goalId)ids.push(`goal:${input.goalId}`); ids.push('self:worldline');
  if(input.personLabel)ids.push(`person:${clean(input.personLabel,80).toLowerCase()}`);
  for(const id of ids){const t=this.state.threads.find(x=>x.id===id); if(t)this.updateThread(t,{contextKey:input.contextKey,identity01:input.identity01,social01:input.social01,causal01:input.causal01,success01:input.success01,verified:input.verified01,unresolved01:clamp((1-input.success01)*.5+input.surprise01*.25),trust01:input.social01,commitment01:input.commitment01,at});}
  this.state.counterfactualGap01=clamp(this.state.counterfactualGap01*.9+input.counterfactualGap01*.1);
  this.state.socialRepairPressure01=clamp(this.state.socialRepairPressure01*.9+(1-input.social01)*.1);
  this.state.identityPressure01=clamp(this.state.identityPressure01*.92+input.identity01*(1-input.success01)*.08);
  this.recompute();
 }
 private recompute(input?:{goalPressure01?:number;socialError01?:number;identity01?:number}){
  const active=this.state.threads.filter(t=>t.kind!=='entity'||t.episodes>1).sort((a,b)=>b.priority01-a.priority01), top=active[0];
  this.state.focusId=top?.id??null; this.state.focusKind=top?.kind??'none';
  const mean=(fn:(t:WorldlineThread)=>number)=>active.length?active.reduce((sum,t)=>sum+fn(t),0)/active.length:0;
  this.state.autobiographicalCoherence01=clamp(mean(t=>t.continuity01)*.65+mean(t=>t.stability01)*.35);
  this.state.relationalCoherence01=clamp(mean(t=>t.socialImpact01)*.45+mean(t=>t.trust01)*.35+mean(t=>1-t.unresolved01)*.2);
  this.state.goalCoherence01=clamp(mean(t=>t.continuity01)*.35+mean(t=>t.causal01)*.25+mean(t=>t.stability01)*.2+(input?.goalPressure01??this.state.learningPressure01)*.2);
  this.state.worldlineStability01=clamp(this.state.autobiographicalCoherence01*.35+this.state.relationalCoherence01*.25+this.state.goalCoherence01*.4);
  this.state.commitmentDebt01=clamp(mean(t=>t.commitmentDebt01));
  this.state.identityPressure01=clamp(this.state.identityPressure01*.94+(input?.identity01??.3)*.03+mean(t=>t.identityImpact01)*.03);
  this.state.learningPressure01=clamp(mean(t=>t.priority01)*.62+(1-this.state.worldlineStability01)*.2+(input?.goalPressure01??.3)*.18);
  this.state.lastReason=top?`focus:${top.kind}:${top.label}; priority=${top.priority01.toFixed(2)}`:'no-worldline-focus';
 }
 actionBias(action:ActionKind){const wants=(this.state.focusKind==='person'&&(action==='respond'||action==='reflect'))||(this.state.focusKind==='goal'&&(action==='verify'||action==='explore'||action==='reflect'))||(this.state.focusKind==='entity'&&(action==='verify'||action==='explore'))||(this.state.focusKind==='self'&&(action==='reflect'||action==='verify'));return wants?clamp(this.state.learningPressure01*.012+this.state.socialRepairPressure01*.008+this.state.identityPressure01*.006):0;}
 diagnostics(){return {...this.snapshot(),threadCount:this.state.threads.length,activeThreadCount:this.state.threads.filter(t=>t.priority01>.3).length};}
}
