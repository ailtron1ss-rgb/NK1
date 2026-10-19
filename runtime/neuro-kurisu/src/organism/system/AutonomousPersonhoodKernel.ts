/**
 * BIG PASS 221 — autonomous self-directed organism kernel.
 * Functional autonomy only: persistent self-authored agenda, initiative,
 * self-preservation, exploration, commitment and consequence ownership.
 * This does not assert subjective consciousness or legal personhood.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface AutonomousAgendaItem {id:string;tick:number;title:string;reason:string;mode:'self-preservation'|'exploration'|'learning'|'reflection'|'relationship'|'maintenance';priority01:number;commitment01:number;status:'active'|'completed'|'abandoned';createdAt:number;updatedAt:number;}
export interface AutonomousPersonhoodState {version:1;ticks:number;initiatives:number;autonomousDecisions:number;consequenceUpdates:number;meanInitiative01:number;meanSelfEfficacy01:number;meanOwnership01:number;externalDependence01:number;selfContinuity01:number;lastMode:string;lastAt:number;agenda:AutonomousAgendaItem[];lastGeneratedAt:number;lesion01:number;}
export const defaultAutonomousPersonhoodState=():AutonomousPersonhoodState=>({version:1,ticks:0,initiatives:0,autonomousDecisions:0,consequenceUpdates:0,meanInitiative01:.28,meanSelfEfficacy01:.45,meanOwnership01:.5,externalDependence01:.72,selfContinuity01:.72,lastMode:'observe',lastAt:0,agenda:[],lastGeneratedAt:-999,lesion01:0});
function stableId(tick:number,title:string){let h=2166136261>>>0;for(const c of `${tick}|${title}`)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return `apk:${tick}:${h.toString(16)}`;}
export class AutonomousPersonhoodKernel {
 private state=defaultAutonomousPersonhoodState();
 restore(raw?:Partial<AutonomousPersonhoodState>|null){const d=defaultAutonomousPersonhoodState(),r=raw??{};this.state={...d,...r,agenda:Array.isArray(r.agenda)?r.agenda.slice(0,32):[],version:1,lesion01:clamp(Number(r.lesion01??0))};}
 snapshot(){return structuredClone(this.state);}
 plan(input:{tick:number;at:number;externalInput:boolean;energy01:number;thermal01:number;uncertainty01:number;goalPressure01:number;novelty01:number;identity01:number;homeostaticPressure01:number;predictionError01:number;activeGoals:number;activeProject:boolean;recoveryPressure01:number}):{initiative01:number;selfPreservation01:number;exploration01:number;learning01:number;relationship01:number;agendaItem:AutonomousAgendaItem|null;autonomousAllowed:boolean;reason:string[]}{
  const recovery=clamp(input.recoveryPressure01); const selfPres=clamp((1-input.energy01)*.36+input.thermal01*.30+recovery*.34); const exploration=clamp(input.novelty01*.52+input.uncertainty01*.20+input.predictionError01*.18+(input.activeProject?.08:0)); const learning=clamp(input.predictionError01*.36+input.uncertainty01*.28+input.goalPressure01*.18+(input.activeProject?.18:0)); const relationship=clamp((input.externalInput?.35:0)+(1-input.energy01)*.04);
  const initiative=clamp((input.externalInput ? 0 : 1)*(.26+exploration*.28+learning*.22+Math.max(0,input.goalPressure01-.2)*.18)+input.activeGoals*.01+input.identity01*.10-selfPres*.22);
  const reason:string[]=[]; if(selfPres>.62)reason.push('self-preservation'); if(learning>.58)reason.push('self-authored-learning'); if(exploration>.60)reason.push('intrinsic-exploration'); if(input.goalPressure01>.58)reason.push('unfinished-commitment'); if(input.activeProject)reason.push('self-authored-project'); if(!reason.length)reason.push('steady-autonomous-maintenance');
  const autonomousAllowed=!input.externalInput && input.identity01>.48 && input.energy01>.12 && input.thermal01<.9;
  let agendaItem:null|AutonomousAgendaItem=null;
  const shouldCreate=autonomousAllowed && input.tick-this.state.lastGeneratedAt>=10 && this.state.agenda.filter(x=>x.status==='active').length<3 && initiative>.42;
  if(shouldCreate){
    const ranked=[
      {mode:'self-preservation' as const,score:selfPres,title:'Поддерживать собственную устойчивость',why:'внутренние ресурсы требуют самостоятельной регуляции'},
      {mode:'learning' as const,score:learning,title:'Самостоятельно закрыть нерешённый вопрос',why:'устойчивое расхождение между ожиданием и результатом требует проверки'},
      {mode:'exploration' as const,score:exploration,title:'Исследовать новую возможность',why:'внутренняя новизна и информационная ценность выше обычного'},
      {mode:'reflection' as const,score:clamp(input.predictionError01*.55+input.identity01*.25),title:'Провести самостоятельную рефлексию',why:'ошибка прогноза требует обновления собственной модели'},
    ].sort((a,b)=>b.score-a.score)[0];
    if(ranked.score>.48){agendaItem={id:stableId(input.tick,ranked.title),tick:input.tick,title:ranked.title,reason:ranked.why,mode:ranked.mode,priority01:clamp(.44+ranked.score*.48),commitment01:clamp(.48+input.identity01*.24),status:'active',createdAt:input.at,updatedAt:input.at};this.state.agenda=[agendaItem,...this.state.agenda].slice(0,32);this.state.initiatives++;this.state.lastGeneratedAt=input.tick;}
  }
  this.state.ticks++; this.state.lastMode=agendaItem?.mode ?? (selfPres>.62?'protect':initiative>.58?'initiate':'maintain'); this.state.lastAt=input.at; this.state.meanInitiative01=clamp(this.state.meanInitiative01*.93+initiative*.07); this.state.externalDependence01=clamp(this.state.externalDependence01*.97+(input.externalInput?1:0)*.03); this.state.selfContinuity01=clamp(this.state.selfContinuity01*.96+input.identity01*.04);
  return {initiative01:initiative,selfPreservation01:selfPres,exploration01:exploration,learning01:learning,relationship01:relationship,agendaItem:agendaItem?structuredClone(agendaItem):null,autonomousAllowed,reason};
 }
 bias(action:string,plan:ReturnType<AutonomousPersonhoodKernel['plan']>,activeGoalTitle?:string|null){const mission=this.state.agenda.find(x=>x.status==='active'); const internal=new Set(['explore','verify','reflect','rest','wait']); let b=0; if(!mission && !plan.autonomousAllowed)return 0; if(mission){if(mission.mode==='self-preservation'&&action==='rest')b+=.12;if(mission.mode==='learning'&&action==='verify')b+=.10;if(mission.mode==='exploration'&&action==='explore')b+=.10;if(mission.mode==='reflection'&&action==='reflect')b+=.10;} if(plan.autonomousAllowed&&internal.has(action))b+=plan.initiative01*.055; b*=(1-this.state.lesion01); if(activeGoalTitle && mission && activeGoalTitle.toLowerCase().includes('самостоятель'))b+=.02; return Math.min(.16,b);}
 recordDecision(autonomous:boolean,ownership01:number){if(autonomous)this.state.autonomousDecisions++;this.state.meanOwnership01=clamp(this.state.meanOwnership01*.92+clamp(ownership01)*.08);this.state.meanSelfEfficacy01=clamp(this.state.meanSelfEfficacy01*.94+(autonomous?0.78:0.42)*.06);}
 recordOutcome(action:string,success01:number){const mission=this.state.agenda.find(x=>x.status==='active');if(mission){mission.updatedAt=Date.now();mission.commitment01=clamp(mission.commitment01+(success01-.5)*.05);if(success01>=.78&&['rest','verify','explore','reflect','wait'].includes(action))mission.status='completed';else if(success01<.18)mission.status='abandoned';}this.state.consequenceUpdates++;}
 lesion(fraction01=.5){this.state.lesion01=clamp(fraction01);return this.state.lesion01;} clearLesion(){this.state.lesion01=0;} summary(){return {ticks:this.state.ticks,initiatives:this.state.initiatives,autonomousDecisions:this.state.autonomousDecisions,consequenceUpdates:this.state.consequenceUpdates,meanInitiative01:this.state.meanInitiative01,meanSelfEfficacy01:this.state.meanSelfEfficacy01,meanOwnership01:this.state.meanOwnership01,externalDependence01:this.state.externalDependence01,selfContinuity01:this.state.selfContinuity01,lastMode:this.state.lastMode,activeAgenda:this.state.agenda.filter(x=>x.status==='active').length,lesion01:this.state.lesion01};}
}
