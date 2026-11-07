const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface CurriculumTask{ id:string;skill:string;difficulty01:number;reason:string;priority01:number; }
export interface SelfGeneratedCurriculumState{version:1;cycles:number;tasksCreated:number;tasksCompleted:number;meanDifficulty01:number;lastSkill:string;queue:CurriculumTask[];}
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const str=(v:unknown,f:string,n=160):string=>typeof v==='string'&&v?v.slice(0,n):f;
const sanTask=(x:unknown):CurriculumTask|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;return {id:str(r.id,'curr-0'),skill:str(r.skill,'none'),difficulty01:clamp(finN(r.difficulty01,0)),reason:str(r.reason,'exploration'),priority01:clamp(finN(r.priority01,0))};};
export const defaultSelfGeneratedCurriculum=():SelfGeneratedCurriculumState=>({version:1,cycles:0,tasksCreated:0,tasksCompleted:0,meanDifficulty01:.35,lastSkill:'none',queue:[]});
export class SelfGeneratedCurriculumEngine{
 private state=defaultSelfGeneratedCurriculum();
 restore(raw?:Partial<SelfGeneratedCurriculumState>|null){const d=defaultSelfGeneratedCurriculum();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};const qRaw=read('queue');this.state={version:1,cycles:cnt(read('cycles'),d.cycles),tasksCreated:cnt(read('tasksCreated'),d.tasksCreated),tasksCompleted:cnt(read('tasksCompleted'),d.tasksCompleted),meanDifficulty01:clamp(finN(read('meanDifficulty01'),d.meanDifficulty01)),lastSkill:str(read('lastSkill'),d.lastSkill),queue:Array.isArray(qRaw)?(qRaw as unknown[]).slice(0,64).map(sanTask).filter((x):x is CurriculumTask=>x!==null):[]};}
 snapshot(){return structuredClone(this.state);}
 generate(input:{skill:string;gap01:number;novelty01:number;uncertainty01:number;energy01:number;goalPressure01:number}){
  const s=this.state,g=clamp(input.gap01),n=clamp(input.novelty01),u=clamp(input.uncertainty01),en=clamp(input.energy01),goal=clamp(input.goalPressure01);
  const difficulty=clamp(.2+g*.55+u*.2+n*.1);const priority=clamp(g*.45+goal*.3+u*.15+n*.1);
  const task={id:`curr-${Date.now()}-${s.tasksCreated}`,skill:input.skill,difficulty01:difficulty,reason:g>.65?'capability-gap':u>.55?'uncertainty-reduction':'exploration',priority01:priority};
  s.queue.push(task);s.queue.sort((a,b)=>b.priority01-a.priority01);s.queue=s.queue.slice(0,64);s.tasksCreated++;s.cycles++;s.meanDifficulty01=clamp((s.meanDifficulty01*(s.tasksCreated-1)+difficulty)/s.tasksCreated);s.lastSkill=input.skill;
  return structuredClone(task);
 }
 complete(taskId:string,success01:number){const idx=this.state.queue.findIndex(t=>t.id===taskId);if(idx>=0)this.state.queue.splice(idx,1);if(success01>.55)this.state.tasksCompleted++;this.state.cycles++;return {remaining:this.state.queue.length,success01:clamp(success01)};}
 summary(){return structuredClone(this.state);}
}
