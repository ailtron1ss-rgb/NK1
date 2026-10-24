/**
 * P68 — Goal Ecology.
 *
 * Goals are treated as a living population rather than an ever-growing list.
 * P68 does not invent goals; it evaluates the lifecycle of existing goals:
 * progress, vitality, staleness, conflict and completion/abandonment pressure.
 * New goals may only enter through P67, so creation and maintenance remain
 * separate concerns.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

type GoalStatus='candidate'|'active'|'paused'|'completed'|'abandoned';
export interface P68Goal {id:string;title:string;reason:string;source:string;status:GoalStatus;importance:number;urgency:number;confidence:number;progress:number;createdAt:number;updatedAt:number;parentId?:string;activationApproved?:boolean;}
export interface P68GoalView {id:string;title:string;status:GoalStatus;vitality01:number;staleness01:number;conflict01:number;progress01:number;}
export interface P68State {
  version:1;cycles:number;completed:number;abandoned:number;paused:number;reactivated:number;pruned:number;
  meanVitality01:number;meanStaleness01:number;meanConflict01:number;goalPressure01:number;
  activeCount:number;lastTopGoalId:string|null;lastMode:string;history:P68GoalView[];
}
export const defaultP68=():P68State=>({version:1,cycles:0,completed:0,abandoned:0,paused:0,reactivated:0,pruned:0,meanVitality01:.62,meanStaleness01:.18,meanConflict01:.12,goalPressure01:.32,activeCount:0,lastTopGoalId:null,lastMode:'observe',history:[]});
function words(value:string){return new Set((String(value).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)??[]));}
function overlap(a:Set<string>,b:Set<string>){let common=0;for(const x of a)if(b.has(x))common++;return common/Math.max(1,Math.min(a.size,b.size));}
export class P68GoalEcology {
 private state=defaultP68();
 restore(raw?:Partial<P68State>|null){const d=defaultP68(),r=raw??{};this.state={...d,...r,history:Array.isArray(r.history)?r.history.slice(-128):[]};}
 snapshot(){return structuredClone(this.state);}
 persistenceSnapshot(){
  return {...this.state,history:this.state.history.slice(0,64).map(view=>({...view}))};
 }
 tick(input:{tick:number;at:number;goals:P68Goal[];lastAction:string;lastSuccess:number|null;mode:string;homeostaticPressure01:number;identity01:number}):{goalPressure01:number;conflictPressure01:number;staleness01:number;topGoalId:string|null;activeCount:number} {
  const goals=input.goals;
  const active=goals.filter(g=>g.status==='active');
  const views:P68GoalView[]=[];
  const tokenSets=new Map<string,Set<string>>();
  for(const g of active)tokenSets.set(g.id,words(g.title+' '+g.reason));
  for(const g of active){
    const age=clamp((input.at-g.createdAt)/Math.max(1,1000*60*60*24*14));
    const sinceUpdate=clamp((input.at-g.updatedAt)/Math.max(1,1000*60*60*24*3));
    const progress=clamp(g.progress); const confidence=clamp(g.confidence); const importance=clamp(g.importance); const urgency=clamp(g.urgency);
    const stale=clamp(age*.25+sinceUpdate*.55+(progress<.08?.2:0));
    let conflict=0;
    const own=tokenSets.get(g.id)??new Set<string>();
    for(const other of active){if(other.id===g.id)continue; const ov=overlap(own,tokenSets.get(other.id)??new Set<string>()); if(ov>.35) conflict=Math.max(conflict,ov);}
    const outcomeLift=input.lastSuccess==null?0:clamp(input.lastSuccess*.12);
    const vitality=clamp(importance*.34+urgency*.24+confidence*.22+progress*.16+outcomeLift-stale*.24-conflict*.12);
    if(progress>=.92 && (input.lastAction==='respond'||input.lastAction==='verify'||input.lastAction==='reflect'||input.lastAction==='explore'||input.lastAction==='rest') && (input.lastSuccess??0)>=.72){g.progress=1;g.status='completed';g.updatedAt=input.at;this.state.completed++;views.push({id:g.id,title:g.title,status:g.status,vitality01:1,staleness01:0,conflict01:conflict,progress01:1});continue;}
    if(stale>.88 && confidence<.48 && vitality<.34){g.status='abandoned';g.updatedAt=input.at;this.state.abandoned++;views.push({id:g.id,title:g.title,status:g.status,vitality01:vitality,staleness01:stale,conflict01:conflict,progress01:progress});continue;}
    if(stale>.72 && input.homeostaticPressure01>.58){if(g.status==='active'){g.status='paused';g.updatedAt=input.at;this.state.paused++;}}
    else if(g.status==='paused' && g.activationApproved!==false && stale<.42 && input.identity01>.72){g.status='active';g.updatedAt=input.at;this.state.reactivated++;}
    if(g.status==='active' && input.lastAction!=='none' && input.lastSuccess!=null){const relevance=clamp(importance*.45+urgency*.3+confidence*.25);g.progress=clamp(progress+(input.lastSuccess>=.65?relevance*.045:input.lastSuccess<.35?-relevance*.018:0));g.updatedAt=input.at;}
    views.push({id:g.id,title:g.title,status:g.status,vitality01:vitality,staleness01:stale,conflict01:conflict,progress01:clamp(g.progress)});
  }
  const currentActive=goals.filter(g=>g.status==='active');
  const sorted=views.filter(v=>v.status==='active').sort((a,b)=>(b.vitality01+b.progress01*.08)-(a.vitality01+a.progress01*.08));
  const top=sorted[0]??null;
  const conflict=sorted.length>1?clamp(sorted.slice(0,6).reduce((s,v)=>s+v.conflict01,0)/Math.max(1,Math.min(6,sorted.length))):0;
  const stale=sorted.length?clamp(sorted.reduce((s,v)=>s+v.staleness01,0)/sorted.length):0;
  const pressure=clamp((top?.vitality01??0)*.48+Math.min(1,currentActive.length/4)*.12+input.homeostaticPressure01*.16+conflict*.12+stale*.12);
  const MAX_GOAL_RECORDS=15;
  if(goals.length>MAX_GOAL_RECORDS){
    const removable=[...goals].filter(g=>g.status!=='active').sort((a,b)=>{
      const statusRank=(g:GoalStatus)=>g==='abandoned'?0:g==='completed'?1:g==='paused'?2:3;
      return statusRank(a.status)-statusRank(b.status) || a.importance-b.importance || a.updatedAt-b.updatedAt;
    });
    const excess=goals.length-MAX_GOAL_RECORDS;
    const removeIds=new Set(removable.slice(0,excess).map(g=>g.id));
    for(let i=goals.length-1;i>=0&&removeIds.size;i--){const id=goals[i].id;if(removeIds.has(id)){goals.splice(i,1);removeIds.delete(id);this.state.pruned++;}}
  }
  this.state.cycles++; this.state.activeCount=currentActive.length; this.state.goalPressure01=clamp(this.state.goalPressure01*.94+pressure*.06); this.state.meanVitality01=clamp(this.state.meanVitality01*.95+(top?.vitality01??0)*.05); this.state.meanStaleness01=clamp(this.state.meanStaleness01*.95+stale*.05); this.state.meanConflict01=clamp(this.state.meanConflict01*.95+conflict*.05); this.state.lastTopGoalId=top?.id??null; this.state.lastMode=input.mode; this.state.history=[...views,...this.state.history].slice(0,128);
  return {goalPressure01:pressure,conflictPressure01:conflict,staleness01:stale,topGoalId:top?.id??null,activeCount:currentActive.length};
 }
 summary(){return {cycles:this.state.cycles,completed:this.state.completed,abandoned:this.state.abandoned,paused:this.state.paused,reactivated:this.state.reactivated,pruned:this.state.pruned,meanVitality01:this.state.meanVitality01,meanStaleness01:this.state.meanStaleness01,meanConflict01:this.state.meanConflict01,goalPressure01:this.state.goalPressure01,activeCount:this.state.activeCount,lastTopGoalId:this.state.lastTopGoalId,lastMode:this.state.lastMode};}
}
