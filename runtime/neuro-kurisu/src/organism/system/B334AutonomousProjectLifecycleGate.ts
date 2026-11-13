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

export interface B334PendingDecision{tick:number;action:string;at:number;projectIds:string[];}
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
  pendingDecisions:B334PendingDecision[];
  outcomeReceipts:string[];
  lastOutcomeTick:number;
  recent:B334ProjectLifecycleRecord[];
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const stageStatus=(status:string):B334LifecycleStatus => status==='completed'?'completed':status==='abandoned'?'abandoned':status==='paused'?'paused':status==='active'?'active':'blocked';
export const defaultB334State=():B334State=>({version:1,cycles:0,externalInputCycles:0,autonomousCycles:0,projectsStarted:0,projectsCompleted:0,projectsAbandoned:0,projectsPaused:0,revisions:0,verifiedOutcomes:0,interruptionEvents:0,resumeEvents:0,autonomousContinuity01:0,projectPersistence01:0,pendingDecisions:[],outcomeReceipts:[],lastOutcomeTick:-1,recent:[]});

export class B334AutonomousProjectLifecycleGate {
  private state=defaultB334State();
  restore(raw?:Partial<B334State>|null){
    const d=defaultB334State(),r=raw??{};
    const pendingDecisions=Array.isArray(r.pendingDecisions)
      ? r.pendingDecisions.filter((entry):entry is B334PendingDecision=>Boolean(entry)
        &&Number.isSafeInteger(entry.tick)&&entry.tick>=0
        &&typeof entry.action==='string'&&entry.action.length>0&&entry.action.length<=64
        &&typeof entry.at==='number'&&Number.isFinite(entry.at)&&entry.at>=0
        &&Array.isArray(entry.projectIds)&&entry.projectIds.length<=8
        &&entry.projectIds.every(id=>typeof id==='string'&&id.length>0&&id.length<=160))
        .slice(-32).map(entry=>({...entry,projectIds:[...entry.projectIds]}))
      : [];
    const outcomeReceipts=Array.isArray(r.outcomeReceipts)
      ? r.outcomeReceipts.filter((entry):entry is string=>typeof entry==='string'&&entry.length>0&&entry.length<=160).slice(-128)
      : [];
    this.state={...d,...r,version:1,
      pendingDecisions,outcomeReceipts,
      lastOutcomeTick:Number.isSafeInteger(r.lastOutcomeTick)&&Number(r.lastOutcomeTick)>=-1?Number(r.lastOutcomeTick):-1,
      recent:Array.isArray(r.recent)?structuredClone(r.recent).slice(-64).map((p:any)=>({...p,progress01:clamp(Number(p?.progress01??0)),history:Array.isArray(p?.history)?p.history.slice(-32):[]})):[]};
  }
  snapshot(){return structuredClone(this.state);}

  observeCycle(input:{tick:number;at:number;externalInput:boolean;autonomous:boolean;commitments:Array<{id:string;domain:string;source:string;createdAt:number;updatedAt:number;status:string;progress01:number;revisions:number}>;selectedAction:string|null;pausedId?:string|null;resumedIds?:string[]}):void{
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

      if(c.revisions>prevRevisions){p.revisions=c.revisions;this.state.revisions++;p.stage='revision';p.history.push('revision');}
      if(status==='paused'){if(prevStatus!=='paused')this.state.projectsPaused++; p.stage='interruption';if(!p.history.includes('interruption')){p.interruptions++;p.history.push('interruption');this.state.interruptionEvents++;}}
      if(status==='completed'){if(prevStatus!=='completed'){this.state.projectsCompleted++;} p.stage='completion';if(!p.history.includes('completion'))p.history.push('completion');}
      if(status==='abandoned'){if(prevStatus!=='abandoned'){this.state.projectsAbandoned++;} p.stage='abandonment';if(!p.history.includes('abandonment'))p.history.push('abandonment');}
    }
    if(input.selectedAction&&input.autonomous&&!input.externalInput){
      const projectIds=input.commitments
        .filter(c=>c.status==='active')
        .map(c=>c.id)
        .filter(id=>activeById.get(id)?.autonomous)
        .slice(0,8);
      if(projectIds.length){
        const pending:B334PendingDecision={tick:input.tick,action:input.selectedAction,at:input.at,projectIds};
        this.state.pendingDecisions=[...this.state.pendingDecisions.filter(item=>item.tick!==pending.tick||item.action!==pending.action),pending].slice(-32);
      }
    }
    for(const id of input.resumedIds??[]){const p=activeById.get(id);if(p){p.resumes++;p.stage='resume';p.history.push('resume');this.state.resumeEvents++;}}
    const autonomousProjects=[...activeById.values()].filter(p=>p.autonomous && (p.status==='active'||p.status==='paused'||p.status==='completed'||p.status==='abandoned'));
    const durable=autonomousProjects.filter(p=>p.executions>=2 || p.progress01>.08 || p.history.includes('resume') || p.history.includes('revision')).length;
    this.state.autonomousContinuity01=clamp(this.state.autonomousCycles/Math.max(1,this.state.cycles));
    this.state.projectPersistence01=clamp(durable/Math.max(1,autonomousProjects.length));
    this.state.recent=[...activeById.values()].slice(-64);
    void currentIds;
  }

  recordVerifiedOutcome(input:{tick:number;action:string;success01:number;at:number;verified:boolean}):boolean{
    if(input.verified!==true||!Number.isSafeInteger(input.tick)||input.tick<0
      ||typeof input.action!=='string'||input.action.length===0||input.action.length>64
      ||typeof input.success01!=='number'||!Number.isFinite(input.success01)||input.success01<0||input.success01>1
      ||typeof input.at!=='number'||!Number.isFinite(input.at)||input.at<0)return false;
    const pending=this.state.pendingDecisions.find(item=>item.tick===input.tick&&item.action===input.action);
    if(!pending)return false;
    const receiptKey=`${input.tick}:${input.action}`;
    if(input.tick<=this.state.lastOutcomeTick||this.state.outcomeReceipts.includes(receiptKey))return false;
    const projects=pending.projectIds.map(id=>this.state.recent.find(project=>project.id===id&&project.autonomous));
    const activeProjects=projects.filter((project):project is B334ProjectLifecycleRecord=>Boolean(project));
    if(!activeProjects.length)return false;
    for(const project of activeProjects){
      project.executions++;
      project.lastAction=input.action;
      project.lastOutcome01=clamp(input.success01);
      project.verifiedOutcomes++;
      project.updatedAt=input.at;
      if(project.stage==='commitment'||project.stage==='genesis')project.stage='execution';
      if(!project.history.includes('execution'))project.history.push('execution');
      if(!project.history.includes('progress'))project.history.push('progress');
      if(input.success01<.12)project.failures++;
      this.state.verifiedOutcomes++;
    }
    this.state.pendingDecisions=this.state.pendingDecisions.filter(item=>item!==pending);
    this.state.outcomeReceipts=[...this.state.outcomeReceipts,receiptKey].slice(-128);
    this.state.lastOutcomeTick=input.tick;
    const autonomousProjects=this.state.recent.filter(project=>project.autonomous);
    const durable=autonomousProjects.filter(project=>project.executions>=2||project.progress01>.08||project.history.includes('resume')||project.history.includes('revision')).length;
    this.state.projectPersistence01=clamp(durable/Math.max(1,autonomousProjects.length));
    return true;
  }

  evaluate():{eligible:boolean;reason:string;autonomousContinuity01:number;projectPersistence01:number;started:number;completed:number;revised:number;verifiedOutcomes:number}{
    const eligible=this.state.autonomousCycles>=12 && this.state.projectsStarted>0 && this.state.projectPersistence01>=.5;
    return {eligible,reason:eligible?'autonomous-project-lifecycle-observed':this.state.projectsStarted===0?'no-autonomous-project':'insufficient-project-continuity',autonomousContinuity01:this.state.autonomousContinuity01,projectPersistence01:this.state.projectPersistence01,started:this.state.projectsStarted,completed:this.state.projectsCompleted,revised:this.state.revisions,verifiedOutcomes:this.state.verifiedOutcomes};
  }
  diagnostics(){return {...this.snapshot(),evaluation:this.evaluate()};}
}
