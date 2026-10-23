import { snapshotPlainData } from '../core/PlainDataSnapshot.ts';
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
export interface P68Goal {id:string;title:string;reason:string;source:string;status:GoalStatus;importance:number;urgency:number;confidence:number;progress:number;createdAt:number;updatedAt:number;parentId?:string;}
export interface P68GoalView {id:string;title:string;status:GoalStatus;vitality01:number;staleness01:number;conflict01:number;progress01:number;}
export interface P68State {
  version:1;cycles:number;completed:number;abandoned:number;paused:number;reactivated:number;pruned:number;
  meanVitality01:number;meanStaleness01:number;meanConflict01:number;goalPressure01:number;
  activeCount:number;lastTopGoalId:string|null;lastMode:string;history:P68GoalView[];
}
export const defaultP68=():P68State=>({version:1,cycles:0,completed:0,abandoned:0,paused:0,reactivated:0,pruned:0,meanVitality01:.62,meanStaleness01:.18,meanConflict01:.12,goalPressure01:.32,activeCount:0,lastTopGoalId:null,lastMode:'observe',history:[]});
const safeCount=(value:unknown)=>Number.isSafeInteger(value)&&Number(value)>=0?Number(value):0;
const safeUnit=(value:unknown,fallback:number)=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1?value:fallback;
const GOAL_STATUSES=new Set<GoalStatus>(['candidate','active','paused','completed','abandoned']);
function normalizeGoalView(value:unknown):P68GoalView|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const r=value as Record<string,unknown>;
 if(typeof r.id!=='string'||!r.id.trim()||r.id.length>180||typeof r.title!=='string'||r.title.length>240||
    !GOAL_STATUSES.has(r.status as GoalStatus)||!['vitality01','staleness01','conflict01','progress01'].every(key=>typeof r[key]==='number'&&Number.isFinite(r[key])&&(r[key] as number)>=0&&(r[key] as number)<=1))return null;
 return {id:r.id,title:r.title,status:r.status as GoalStatus,vitality01:r.vitality01 as number,staleness01:r.staleness01 as number,conflict01:r.conflict01 as number,progress01:r.progress01 as number};
}
function words(value:string){return new Set((String(value).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)??[]));}
function overlap(a:Set<string>,b:Set<string>){let common=0;for(const x of a)if(b.has(x))common++;return common/Math.max(1,Math.min(a.size,b.size));}
export class P68GoalEcology {
 private state=defaultP68();
 restore(raw?:Partial<P68State>|null){
  const d=defaultP68();let detached:unknown;
  try{detached=snapshotPlainData<unknown>(raw??{},{maxDepth:12,maxNodes:4096,maxStringUnits:512*1024});}
  catch{this.state=d;return;}
  if(!detached||typeof detached!=='object'||Array.isArray(detached)){this.state=d;return;}
  const r=detached as Record<string,unknown>;
  if(r.version!==undefined&&r.version!==1){this.state=d;return;}
  const history=(Array.isArray(r.history)?r.history:[]).slice(-128).map(normalizeGoalView).filter((v):v is P68GoalView=>v!==null);
  this.state={
   version:1,cycles:safeCount(r.cycles),completed:safeCount(r.completed),abandoned:safeCount(r.abandoned),
   paused:safeCount(r.paused),reactivated:safeCount(r.reactivated),pruned:safeCount(r.pruned),
   meanVitality01:safeUnit(r.meanVitality01,d.meanVitality01),meanStaleness01:safeUnit(r.meanStaleness01,d.meanStaleness01),
   meanConflict01:safeUnit(r.meanConflict01,d.meanConflict01),goalPressure01:safeUnit(r.goalPressure01,d.goalPressure01),
   activeCount:safeCount(r.activeCount),lastTopGoalId:typeof r.lastTopGoalId==='string'&&r.lastTopGoalId.length<=180?r.lastTopGoalId:null,
   lastMode:typeof r.lastMode==='string'&&r.lastMode.length<=96?r.lastMode:d.lastMode,history,
  };
 }
 snapshot(){return structuredClone(this.state);}
 persistenceSnapshot(){
  return {...this.state,history:this.state.history.slice(0,64).map(view=>({...view}))};
 }
 tick(rawInput:{tick:number;at:number;goals:P68Goal[];lastAction:string;lastSuccess:number|null;mode:string;homeostaticPressure01:number;identity01:number}):{goalPressure01:number;conflictPressure01:number;staleness01:number;topGoalId:string|null;activeCount:number} {
  let detached:unknown;
  try{detached=snapshotPlainData<unknown>(rawInput,{maxDepth:12,maxNodes:8192,maxStringUnits:512*1024});}
  catch{throw new TypeError('p68-goal-input-invalid');}
  if(!detached||typeof detached!=='object'||Array.isArray(detached))throw new TypeError('p68-goal-input-invalid');
  const safe=detached as Record<string,unknown>;
  if(!Number.isSafeInteger(safe.tick)||Number(safe.tick)<0||typeof safe.at!=='number'||!Number.isFinite(safe.at)||safe.at<0||
     !Array.isArray(safe.goals)||safe.goals.length>256||typeof safe.lastAction!=='string'||safe.lastAction.length>96||
     (safe.lastSuccess!=null&&(typeof safe.lastSuccess!=='number'||!Number.isFinite(safe.lastSuccess)||safe.lastSuccess<0||safe.lastSuccess>1))||
     typeof safe.mode!=='string'||safe.mode.length>96||
     typeof safe.homeostaticPressure01!=='number'||!Number.isFinite(safe.homeostaticPressure01)||safe.homeostaticPressure01<0||safe.homeostaticPressure01>1||
     typeof safe.identity01!=='number'||!Number.isFinite(safe.identity01)||safe.identity01<0||safe.identity01>1||
     safe.goals.some((g:unknown)=>{
      if(!g||typeof g!=='object'||Array.isArray(g))return true;
      const row=g as Record<string,unknown>;
      return typeof row.id!=='string'||!row.id.trim()||row.id.length>180||
       typeof row.title!=='string'||row.title.length>240||typeof row.reason!=='string'||row.reason.length>512||
       typeof row.source!=='string'||row.source.length>96||!GOAL_STATUSES.has(row.status as GoalStatus)||
       !['importance','urgency','confidence','progress'].every(key=>typeof row[key]==='number'&&Number.isFinite(row[key])&&(row[key] as number)>=0&&(row[key] as number)<=1)||
       !['createdAt','updatedAt'].every(key=>typeof row[key]==='number'&&Number.isFinite(row[key])&&(row[key] as number)>=0);
     }))throw new TypeError('p68-goal-input-invalid');
  // Snapshot validation rejects accessors and cycles before lifecycle state changes.
  // Keep the original objects after validation so core receives valid transitions.
  const input=rawInput;
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
    else if(g.status==='paused' && stale<.42 && input.identity01>.72){g.status='active';g.updatedAt=input.at;this.state.reactivated++;}
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
