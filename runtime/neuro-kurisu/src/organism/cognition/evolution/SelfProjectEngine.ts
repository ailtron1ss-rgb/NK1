import type { OrganismGoal } from '../../core/types.ts';

export type ProjectOrigin = 'intrinsic' | 'learned' | 'identity' | 'unresolved';
export type ProjectStatus = 'proposed' | 'active' | 'paused' | 'completed' | 'abandoned';

export type ProjectEvidenceClass='internal'|'external'|'replicated';
export interface SelfProjectMilestone { id:string; title:string; targetProgress:number; evidenceRequired:number; requiredEvidenceClass:ProjectEvidenceClass; completed:boolean; completedAt:number; }
const evidenceRank=(value:ProjectEvidenceClass)=>value==='replicated'?2:value==='external'?1:0;
export interface SelfProject {
  id: string;
  title: string;
  /** Source description/reason supplied when a reviewed imported project is materialized. */
  reason?: string;
  origin: ProjectOrigin;
  status: ProjectStatus;
  commitment: number;
  priority: number;
  identityRelevance: number;
  progress: number;
  setbacks: number;
  successes: number;
  evidenceCount: number;
  validatedEvidenceCount: number;
  replicatedEvidenceCount: number;
  skillGain01: number;
  milestones: SelfProjectMilestone[];
  nextMilestone: string;
  linkedGoalId?: string;
  createdAt: number;
  lastWorkedAt: number;
  updatedAt: number;
  lastOutcomeId?: string;
  lastEvidenceAt?: number;
  pausedAt?: number;
  pauseReason?: string;
  completionReason?: string;
  planRevision: number;
  /** Stable origin binding for an explicitly reviewed Hexis goal import. */
  hexisProposalId?: string;
  hexisSourceLineageId?: string;
  hexisSourceRef?: string;
}

export interface SelfProjectState {
  version: 2;
  projects: SelfProject[];
  selectedProjectId: string | null;
  completedProjects: number;
  abandonedProjects: number;
  ownProjectContinuity: number;
  authorshipScore: number;
  lastCreatedAt: number;
  lastOutcomeAt: number;
  projectEvents: number;
}

const clamp = (n:number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const stamp = () => Date.now();

export function defaultSelfProjectState(): SelfProjectState {
  return { version:2, projects:[], selectedProjectId:null, completedProjects:0, abandonedProjects:0, ownProjectContinuity:0.5, authorshipScore:0.15, lastCreatedAt:0, lastOutcomeAt:0, projectEvents:0 };
}

export class SelfProjectEngine {
  private state = defaultSelfProjectState();
  restore(value: SelfProjectState | undefined): void {
    const defaultState = defaultSelfProjectState();
    const rawProjects = value?.projects ?? [];
    const projects = rawProjects.map((p:any) => ({
      ...p,
      planRevision: Math.max(1, Math.floor(Number(p.planRevision ?? 1))),
      validatedEvidenceCount: Number(p.validatedEvidenceCount ?? 0),
      replicatedEvidenceCount: Number(p.replicatedEvidenceCount ?? 0),
      skillGain01: clamp(Number(p.skillGain01 ?? 0)),
      milestones: Array.isArray(p.milestones)
        ? p.milestones.map((m:any) => {
            const fallback = String(m.id) === 'm3' ? 'replicated' : String(m.id) === 'm2' ? 'external' : 'internal';
            const requiredEvidenceClass = m.requiredEvidenceClass === 'replicated' || m.requiredEvidenceClass === 'external' || m.requiredEvidenceClass === 'internal'
              ? m.requiredEvidenceClass
              : fallback;
            return {
              id: String(m.id),
              title: String(m.title),
              targetProgress: clamp(Number(m.targetProgress ?? 1)),
              evidenceRequired: Math.max(1, Math.floor(Number(m.evidenceRequired ?? 1))),
              requiredEvidenceClass,
              completed: Boolean(m.completed),
              completedAt: Number(m.completedAt ?? 0),
            };
          })
        : [],
    }));
    this.state = { ...defaultState, ...(value ?? {}), version:2, lastOutcomeAt:Number((value as any)?.lastOutcomeAt ?? 0), projectEvents:Math.max(0, Math.floor(Number((value as any)?.projectEvents ?? 0))), projects, authorshipScore:clamp(Number((value as any)?.authorshipScore ?? defaultState.authorshipScore)) };
  }
  snapshot(): SelfProjectState { return structuredClone(this.state); }

  /**
   * Materialize an explicitly approved Hexis proposal as a quarantined/paused
   * NK1 project. It is deliberately not 'proposed': ensureActiveProject() may
   * auto-promote proposed projects, so that status would bypass the second gate.
   */
  materializeApprovedHexisGoal(input:{
    proposalId:string;
    sourceLineageId:string;
    sourceRef:string;
    title:string;
    description:string;
    importance:number;
    urgency:number;
    confidence:number;
    approvedAt?:number;
  }):SelfProject {
    const proposalId=String(input.proposalId??'').trim();
    const sourceLineageId=String(input.sourceLineageId??'').trim();
    const sourceRef=String(input.sourceRef??'').trim();
    const title=String(input.title??'').trim();
    const description=String(input.description??'').trim();
    if(!/^hexgoal:[a-f0-9]{32}$/.test(proposalId)) throw new Error('hexis-project-proposal-id-invalid');
    if(!sourceLineageId || sourceLineageId.length>512) throw new Error('hexis-project-lineage-invalid');
    if(!sourceRef || sourceRef.length>512) throw new Error('hexis-project-source-ref-invalid');
    if(!title || title.length>300 || /[\x00-\x1f\x7f]/.test(title)) throw new Error('hexis-project-title-invalid');
    if(description.length>2000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(description)) throw new Error('hexis-project-description-invalid');
    const id='hexis-project:'+proposalId.slice('hexgoal:'.length);
    const existing=this.state.projects.find(project=>project.hexisProposalId===proposalId || project.id===id);
    if(existing){
      if(existing.hexisProposalId!==proposalId || existing.hexisSourceLineageId!==sourceLineageId || existing.hexisSourceRef!==sourceRef) {
        throw new Error('hexis-project-stable-id-collision');
      }
      return structuredClone(existing);
    }
    if(this.state.projects.length>=24) throw new Error('hexis-project-capacity-reached');
    const now=stamp();
    const project:SelfProject={
      id,title,reason:description || 'Reviewed goal imported from Hexis; independent execution evidence required.',origin:'learned',status:'paused',
      commitment:clamp(.34+clamp(input.confidence)*.3),
      priority:clamp(input.importance),identityRelevance:.24,
      progress:0,setbacks:0,successes:0,evidenceCount:0,validatedEvidenceCount:0,
      replicatedEvidenceCount:0,skillGain01:0,
      milestones:[
        {id:'m1',title:'Разложить импортированную цель на проверяемые шаги',targetProgress:.30,evidenceRequired:1,requiredEvidenceClass:'internal',completed:false,completedAt:0},
        {id:'m2',title:'Проверить результат независимым наблюдением',targetProgress:.62,evidenceRequired:2,requiredEvidenceClass:'external',completed:false,completedAt:0},
        {id:'m3',title:'Повторить улучшение на независимой попытке',targetProgress:.94,evidenceRequired:4,requiredEvidenceClass:'replicated',completed:false,completedAt:0},
      ],
      nextMilestone:'Разложить импортированную цель на проверяемые шаги',
      linkedGoalId:proposalId,createdAt:Number.isFinite(input.approvedAt)?Number(input.approvedAt):now,
      lastWorkedAt:0,updatedAt:now,planRevision:1,
      hexisProposalId:proposalId,hexisSourceLineageId:sourceLineageId,hexisSourceRef:sourceRef,
      pausedAt:now,pauseReason:'hexis-approved-awaiting-explicit-activation',
    };
    this.state.projects=[project,...this.state.projects];
    this.state.projectEvents++;
    this.recomputeAuthorship();
    return structuredClone(project);
  }

  /** Second, explicit gate: only the reviewed Hexis project may leave its paused state. */
  activateApprovedHexisGoal(projectId:string,proposalId:string):SelfProject|null {
    const project=this.state.projects.find(item=>item.id===String(projectId));
    if(!project) return null;
    if(project.hexisProposalId!==String(proposalId) || project.origin!=='learned') throw new Error('hexis-project-origin-binding-mismatch');
    if(project.status==='active') return structuredClone(project);
    if(project.status!=='paused' || project.pauseReason!=='hexis-approved-awaiting-explicit-activation') {
      throw new Error('hexis-project-must-be-materialized-and-paused');
    }
    const activeLoad=this.state.projects.filter(item=>item.status==='active'||item.status==='proposed').length;
    if(activeLoad>=4) throw new Error('hexis-project-active-capacity-reached');
    project.status='active';project.pauseReason=undefined;project.pausedAt=undefined;
    project.lastWorkedAt=0;project.updatedAt=stamp();project.planRevision++;
    this.state.selectedProjectId=project.id;
    this.touchProject(project);
    this.recomputeAuthorship();
    return structuredClone(project);
  }

  private recomputeAuthorship(): void {
    const owned = this.state.projects.filter(p => p.origin === 'intrinsic' || p.origin === 'identity' || p.origin === 'unresolved');
    const active = owned.filter(p => p.status === 'active' || p.status === 'proposed');
    const meanCommitment = active.length ? active.reduce((s,p)=>s+p.commitment,0)/active.length : 0;
    const evidenceDensity = clamp(owned.reduce((s,p)=>s+Math.min(4,p.evidenceCount),0)/Math.max(4,owned.length*4));
    const completed = this.state.completedProjects + this.state.abandonedProjects;
    const completionSignal = clamp(this.state.completedProjects / Math.max(1, completed + active.length));
    const identitySignal = active.length ? active.reduce((s,p)=>s+p.identityRelevance,0)/active.length : 0;
    this.state.authorshipScore = clamp(0.22*this.state.ownProjectContinuity + 0.26*meanCommitment + 0.22*evidenceDensity + 0.15*completionSignal + 0.15*identitySignal);
  }

  propose(input:{ intrinsicOverall:number; dominant:string; uncertainty:number; predictionError:number; identityDrift:number; unresolvedExperiments:number; activeGoals:OrganismGoal[] }): SelfProject | null {
    const projectLoad = this.state.projects.filter(p=>p.status==='active' || p.status==='proposed').length;
    if (projectLoad >= 4) return null;
    const trigger = Math.max(input.intrinsicOverall, input.predictionError, input.uncertainty, input.identityDrift, input.unresolvedExperiments > 0 ? 0.58 : 0);
    if (trigger < 0.58) return null;

    const dominant = input.dominant;
    const existing = this.state.projects.find(p => p.status === 'active' && p.title.includes(dominant));
    if (existing) return null;

    let title = 'Построить собственный эксперимент и уменьшить неизвестность';
    let milestone = 'получить одно новое наблюдение и проверить гипотезу';
    let origin:ProjectOrigin = 'intrinsic';
    let identityRelevance = 0.68;
    if (input.identityDrift > 0.6) { title='Восстановить согласованность собственной модели и недавнего опыта'; milestone='выделить источник расхождения и сформировать обновлённое правило'; origin='identity'; identityRelevance=0.92; }
    else if (input.predictionError > input.uncertainty && input.predictionError > 0.62) { title='Проверить ошибочный прогноз и понять причину расхождения'; milestone='провести контрфактическую проверку и получить новый исход'; origin='unresolved'; identityRelevance=0.78; }
    else if (input.dominant === 'social') { title='Лучше понять значимую социальную связь через наблюдение и диалог'; milestone='сформировать и проверить один социальный прогноз'; origin='learned'; identityRelevance=0.74; }
    else if (input.dominant === 'competence') { title='Повысить собственную точность через серию измеримых экспериментов'; milestone='улучшить calibration на серии наблюдений'; }

    const project:SelfProject={
      id:`project-${stamp()}-${Math.random().toString(16).slice(2)}`,
      title, origin, status:'proposed', commitment:clamp(0.52 + trigger*0.28), priority:clamp(0.52 + trigger*0.35), identityRelevance:clamp(identityRelevance), progress:0, setbacks:0, successes:0, evidenceCount:0, validatedEvidenceCount:0, replicatedEvidenceCount:0, skillGain01:0,
      milestones:[
        {id:'m1',title:milestone,targetProgress:.30,evidenceRequired:1,requiredEvidenceClass:'internal',completed:false,completedAt:0},
        {id:'m2',title:'повторить результат независимо от первого исхода',targetProgress:.62,evidenceRequired:2,requiredEvidenceClass:'external',completed:false,completedAt:0},
        {id:'m3',title:'показать устойчивое улучшение на новой попытке',targetProgress:.94,evidenceRequired:4,requiredEvidenceClass:'replicated',completed:false,completedAt:0},
      ],
      nextMilestone:milestone, linkedGoalId:input.activeGoals.find(g=>g.source==='intrinsic' || g.source==='learned')?.id,
      createdAt:stamp(), lastWorkedAt:0, updatedAt:stamp(), planRevision:1,
    };
    this.state.projects=[project,...this.state.projects].slice(0,24);
    this.state.selectedProjectId=project.id;
    this.state.lastCreatedAt=project.createdAt;
    this.recomputeAuthorship();
    return structuredClone(project);
  }

  linkGoal(projectId:string, goalId:string): void { const p=this.state.projects.find(x=>x.id===projectId); if(p){ p.linkedGoalId=goalId; p.updatedAt=stamp(); } }

  activeProjects(options:{clone?:boolean}={clone:true}): SelfProject[] {
    const projects=this.state.projects.filter(p=>p.status==='active'||p.status==='proposed');
    return options.clone===false ? projects : projects.map(p=>structuredClone(p));
  }

  selectProject(projectId:string|null): SelfProject | null {
    if(!projectId){ this.state.selectedProjectId=null; return null; }
    const p=this.state.projects.find(x=>x.id===projectId && (x.status==='active'||x.status==='proposed'));
    if(!p) return null;
    if(p.status==='proposed') p.status='active';
    this.state.selectedProjectId=p.id;
    p.updatedAt=stamp();
    return structuredClone(p);
  }

  ensureActiveProject(): SelfProject | null {
    const active=this.state.projects.find(p=>p.status==='active');
    if (active) { this.state.selectedProjectId=active.id; return structuredClone(active); }
    const proposed=this.state.projects.find(p=>p.status==='proposed');
    if (!proposed) return null;
    proposed.status='active'; proposed.updatedAt=stamp(); this.state.selectedProjectId=proposed.id;
    return structuredClone(proposed);
  }

  score(project:SelfProject):number {
    return clamp(project.priority*0.42 + project.commitment*0.28 + project.identityRelevance*0.18 + (1-project.progress)*0.12);
  }


  private touchProject(p:SelfProject): void {
    p.updatedAt=stamp();
    this.state.projectEvents++;
  }

  recordEvidence(input:{projectId:string; evidenceClass:ProjectEvidenceClass; externalEvidence01:number; independentSource:boolean; at?:number}): SelfProject | null {
    const p=this.state.projects.find(x=>x.id===input.projectId);
    if(!p || (p.status!=='active' && p.status!=='proposed')) return null;
    const external=clamp(input.externalEvidence01);
    p.evidenceCount += 1;
    if(input.evidenceClass!=='internal' && external>=.65) p.validatedEvidenceCount += 1;
    if(input.evidenceClass==='replicated' && external>=.65 && input.independentSource) p.replicatedEvidenceCount += 1;
    p.lastEvidenceAt=input.at ?? stamp();
    p.updatedAt=p.lastEvidenceAt;
    p.planRevision += 1;
    const before=p.progress;
    p.progress=clamp(p.progress + (input.evidenceClass==='replicated' ? .055 : input.evidenceClass==='external' ? .035 : .018));
    for(const m of p.milestones){
      const evidenceForMilestone = m.requiredEvidenceClass==='replicated' ? p.replicatedEvidenceCount : m.requiredEvidenceClass==='external' ? p.validatedEvidenceCount : p.evidenceCount;
      if(!m.completed && p.progress>=m.targetProgress && evidenceForMilestone>=m.evidenceRequired && evidenceRank(input.evidenceClass)>=evidenceRank(m.requiredEvidenceClass)){m.completed=true;m.completedAt=p.updatedAt;}
    }
    const remaining=p.milestones.find(m=>!m.completed); if(remaining) p.nextMilestone=remaining.title;
    if(p.milestones.length>0 && p.milestones.every(m=>m.completed) && p.replicatedEvidenceCount>=4){
      p.progress=1; p.status='completed'; p.completionReason='replicated-evidence-complete'; this.state.completedProjects+=1;
    }
    this.state.lastOutcomeAt=p.updatedAt;
    this.state.projectEvents++;
    this.recomputeAuthorship();
    return structuredClone(p);
  }

  syncGoalProgress(projectId:string, goal:{progress:number;status:string;updatedAt:number;reason:string}): SelfProject | null {
    const p=this.state.projects.find(x=>x.id===projectId); if(!p) return null;
    goal.progress=clamp(p.progress);
    goal.updatedAt=p.updatedAt;
    if(p.status==='completed') { if(goal.status!=='completed'){ goal.status='completed'; goal.reason += '; project-completed'; } }
    else if(p.status==='abandoned') goal.status='abandoned';
    else if(p.status==='paused') goal.status='paused';
    else if(goal.status==='candidate') goal.status='active';
    return structuredClone(p);
  }

  pause(projectId:string, reason:string): SelfProject | null {
    const p=this.state.projects.find(x=>x.id===projectId && (x.status==='active'||x.status==='proposed')); if(!p) return null;
    p.status='paused'; p.pausedAt=stamp(); p.pauseReason=String(reason).slice(0,180); p.planRevision+=1; this.touchProject(p); this.recomputeAuthorship(); return structuredClone(p);
  }

  resume(projectId:string, reason='new-evidence'): SelfProject | null {
    const p=this.state.projects.find(x=>x.id===projectId && x.status==='paused'); if(!p) return null;
    p.status='active'; p.pauseReason=undefined; p.pausedAt=undefined; p.planRevision+=1; p.lastEvidenceAt=stamp(); p.updatedAt=p.lastEvidenceAt; p.lastOutcomeId=`resume:${p.updatedAt}`; this.state.selectedProjectId=p.id; this.touchProject(p); this.recomputeAuthorship(); return structuredClone(p);
  }

  observeOutcome(input:{ projectId?:string|null; success:number; surprise:number; actionWasRelevant:boolean; evidenceClass?:ProjectEvidenceClass; externalEvidence01?:number; skillGain01?:number }): void {
    if (!input.projectId) return;
    const p=this.state.projects.find(x=>x.id===input.projectId); if (!p || (p.status!=='active' && p.status!=='proposed')) return;
    const success=clamp(input.success), surprise=clamp(input.surprise), external=clamp(input.externalEvidence01??0);
    const outcomeId=`outcome:${p.id}:${this.state.lastOutcomeAt+1}:${p.successes+p.setbacks+1}`;
    const evidenceClass=input.evidenceClass??'internal';
    const evidenceGain=input.actionWasRelevant ? 1 : 0;
    p.evidenceCount+=evidenceGain;
    if (input.actionWasRelevant && evidenceRank(evidenceClass)>=1 && external>=.65) p.validatedEvidenceCount += 1;
    if (input.actionWasRelevant && evidenceClass==='replicated' && external>=.65) p.replicatedEvidenceCount += 1;
    p.skillGain01=clamp(p.skillGain01*.92 + clamp(input.skillGain01??(success>=.65?0.08:0))*0.08);
    p.lastWorkedAt=stamp(); p.updatedAt=p.lastWorkedAt; p.lastOutcomeId=outcomeId; p.planRevision+=1; this.state.lastOutcomeAt=p.updatedAt; this.state.projectEvents++;
    p.progress=clamp(p.progress + (success-0.38)*0.11 + external*.018 + p.skillGain01*.012);
    p.priority=clamp(p.priority + (success-0.5)*0.035 - surprise*0.01);
    p.commitment=clamp(p.commitment + (success-0.5)*0.03 - (success<0.25 ? 0.015 : 0));
    if(success>=0.65) p.successes+=1; else if(success<=0.3) p.setbacks+=1;
    for(const m of p.milestones){ const evidenceForMilestone = m.requiredEvidenceClass==='replicated' ? p.replicatedEvidenceCount : m.requiredEvidenceClass==='external' ? p.validatedEvidenceCount : p.evidenceCount;
    if(!m.completed && p.progress>=m.targetProgress && evidenceForMilestone>=m.evidenceRequired && evidenceRank(evidenceClass)>=evidenceRank(m.requiredEvidenceClass)){m.completed=true;m.completedAt=p.updatedAt;} }
    const remaining=p.milestones.find(m=>!m.completed); if(remaining) p.nextMilestone=remaining.title;
    if(p.milestones.length>0 && p.milestones.every(m=>m.completed) && p.replicatedEvidenceCount>=4){ p.progress=1; p.status='completed'; p.completionReason='replicated-evidence-complete'; this.state.completedProjects+=1; }
    else if(p.commitment<0.18 && p.setbacks>=4){ p.status='abandoned'; p.completionReason='commitment-collapse-after-repeated-setbacks'; this.state.abandonedProjects+=1; }
    const active=this.state.projects.filter(x=>x.status==='active');
    const prior=this.state.ownProjectContinuity;
    this.state.ownProjectContinuity=clamp(prior*0.9 + Math.min(1, active.length/2 + (p.status==='completed'?0.2:0))*0.1);
    this.state.selectedProjectId=p.status==='completed'||p.status==='abandoned' ? active[0]?.id ?? null : p.id;
    this.recomputeAuthorship();
  }

  activeProject(): SelfProject | null {
    const p=this.state.projects.find(x=>x.id===this.state.selectedProjectId && (x.status==='active'||x.status==='proposed')) || this.state.projects.find(x=>x.status==='active');
    return p ? structuredClone(p) : null;
  }
}
