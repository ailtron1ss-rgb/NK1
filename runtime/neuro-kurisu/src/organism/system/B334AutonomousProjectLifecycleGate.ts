export type B334LifecycleStage = 'genesis'|'commitment'|'execution'|'progress'|'interruption'|'resume'|'revision'|'completion'|'abandonment';
export type B334LifecycleStatus = 'active'|'completed'|'abandoned'|'paused'|'blocked';

export interface B334ProjectLifecycleRecord {
  id:string;
  domain:string;
  source:string;
  autonomous:boolean;
  createdAt:number;
  updatedAt:number;
  status:B334LifecycleStatus;
  stage:B334LifecycleStage;
  progress01:number;
  revisions:number;
  executions:number;
  verifiedOutcomes:number;
  failures:number;
  interruptions:number;
  resumes:number;
  lastAction:string|null;
  lastOutcome01:number|null;
  history:B334LifecycleStage[];
}

export interface B334State {
  version:1;
  cycles:number;
  externalInputCycles:number;
  autonomousCycles:number;
  projectsStarted:number;
  projectsCompleted:number;
  projectsAbandoned:number;
  projectsPaused:number;
  revisions:number;
  verifiedOutcomes:number;
  interruptionEvents:number;
  resumeEvents:number;
  autonomousContinuity01:number;
  projectPersistence01:number;
  recent:B334ProjectLifecycleRecord[];
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const stageStatus=(status:string):B334LifecycleStatus => status==='completed'?'completed':status==='abandoned'?'abandoned':status==='paused'?'paused':status==='active'?'active':'blocked';
export const defaultB334State=():B334State=>({version:1,cycles:0,externalInputCycles:0,autonomousCycles:0,projectsStarted:0,projectsCompleted:0,projectsAbandoned:0,projectsPaused:0,revisions:0,verifiedOutcomes:0,interruptionEvents:0,resumeEvents:0,autonomousContinuity01:0,projectPersistence01:0,recent:[]});

export class B334AutonomousProjectLifecycleGate {
  private state=defaultB334State();
  restore(raw?:Partial<B334State>|null){
    const d=defaultB334State(),r=raw??{};
    this.state={...d,...r,version:1,recent:Array.isArray(r.recent)?structuredClone(r.recent).slice(-64).map((p:any)=>({...p,progress01:clamp(Number(p?.progress01??0)),history:Array.isArray(p?.history)?p.history.slice(-32):[]})):[]};
  }
  snapshot(){return structuredClone(this.state);}

  observeCycle(input:{tick:number;at:number;externalInput:boolean;autonomous:boolean;commitments:Array<{id:string;domain:string;source:string;createdAt:number;updatedAt:number;status:string;progress01:number;revisions:number}>;selectedAction:string|null;outcome01:number|null;verifiedOutcome:boolean;pausedId?:string|null;resumedIds?:string[]}):void{
    this.state.cycles++;
    if(input.externalInput)this.state.externalInputCycles++; else if(input.autonomous)this.state.autonomousCycles++;
    const activeById=new Map(this.state.recent.map(p=>[p.id,p] as const));
    const currentIds=new Set(input.commitments.map(c=>c.id));
    for(const c of input.commitments){
      const status=stageStatus(c.status);
      let p=activeById.get(c.id);
      if(!p){
        p={id:c.id,domain:c.domain,source:c.source,autonomous:input.autonomous&&!input.externalInput,createdAt:c.createdAt,updatedAt:c.updatedAt,status,stage:'genesis',progress01:clamp(c.progress01),revisions:Math.max(0,Math.floor(c.revisions||0)),executions:0,verifiedOutcomes:0,failures:0,interruptions:0,resumes:0,lastAction:null,lastOutcome01:null,history:['genesis']};
        activeById.set(c.id,p); this.state.projectsStarted++;
      }
      const prevStatus=p.status; const prevRevisions=p.revisions; p.updatedAt=c.updatedAt;p.progress01=clamp(c.progress01);p.status=status;p.autonomous=p.autonomous||(!input.externalInput&&input.autonomous);
      if(!p.history.includes('commitment'))p.history.push('commitment');
      if(input.selectedAction){p.executions++;p.lastAction=input.selectedAction;if(p.stage==='commitment'||p.stage==='genesis')p.stage='execution'; if(!p.history.includes('execution'))p.history.push('execution');}
      if(input.outcome01!=null){p.lastOutcome01=clamp(input.outcome01); if(input.verifiedOutcome){p.verifiedOutcomes++;this.state.verifiedOutcomes++;if(!p.history.includes('progress'))p.history.push('progress');} if(input.outcome01<.12){p.failures++;}}
      if(c.revisions>prevRevisions){p.revisions=c.revisions;this.state.revisions++;p.stage='revision';p.history.push('revision');}
      if(status==='paused'){if(prevStatus!=='paused')this.state.projectsPaused++; p.stage='interruption';if(!p.history.includes('interruption')){p.interruptions++;p.history.push('interruption');this.state.interruptionEvents++;}}
      if(status==='completed'){if(prevStatus!=='completed'){this.state.projectsCompleted++;} p.stage='completion';if(!p.history.includes('completion'))p.history.push('completion');}
      if(status==='abandoned'){if(prevStatus!=='abandoned'){this.state.projectsAbandoned++;} p.stage='abandonment';if(!p.history.includes('abandonment'))p.history.push('abandonment');}
    }
    for(const id of input.resumedIds??[]){const p=activeById.get(id);if(p){p.resumes++;p.stage='resume';p.history.push('resume');this.state.resumeEvents++;}}
    const autonomousProjects=[...activeById.values()].filter(p=>p.autonomous && (p.status==='active'||p.status==='paused'||p.status==='completed'||p.status==='abandoned'));
    const durable=autonomousProjects.filter(p=>p.executions>=2 || p.progress01>.08 || p.history.includes('resume') || p.history.includes('revision')).length;
    this.state.autonomousContinuity01=clamp(this.state.autonomousCycles/Math.max(1,this.state.cycles));
    this.state.projectPersistence01=clamp(durable/Math.max(1,autonomousProjects.length));
    this.state.recent=[...activeById.values()].slice(-64);
    void currentIds;
  }

  evaluate():{eligible:boolean;reason:string;autonomousContinuity01:number;projectPersistence01:number;started:number;completed:number;revised:number;verifiedOutcomes:number}{
    const eligible=this.state.autonomousCycles>=12 && this.state.projectsStarted>0 && this.state.projectPersistence01>=.5;
    return {eligible,reason:eligible?'autonomous-project-lifecycle-observed':this.state.projectsStarted===0?'no-autonomous-project':'insufficient-project-continuity',autonomousContinuity01:this.state.autonomousContinuity01,projectPersistence01:this.state.projectPersistence01,started:this.state.projectsStarted,completed:this.state.projectsCompleted,revised:this.state.revisions,verifiedOutcomes:this.state.verifiedOutcomes};
  }
  diagnostics(){return {...this.snapshot(),evaluation:this.evaluate()};}
}
