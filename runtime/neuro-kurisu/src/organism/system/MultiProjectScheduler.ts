import type { SelfProject } from '../cognition/evolution/SelfProjectEngine.ts';

export interface ProjectScheduleContext {
  tick: number;
  energy01: number;
  cognitiveLoad01: number;
  uncertainty01: number;
  goalPressure01: number;
  budget01: number;
  selectedProjectId?: string | null;
  at?: number;
}

export interface ProjectScheduleDecision {
  projectId: string | null;
  scoreByProject: Record<string, number>;
  switched: boolean;
  reason: string;
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const ageBoost=(at:number,lastWorkedAt:number)=>clamp(Math.min(1,Math.max(0,(at-(lastWorkedAt||0))/86_400_000)));

/** BIG PASS 46: deterministic, resource-aware multi-project arbitration.
 * Pure scoring layer: it does not mutate project state and therefore remains cheap enough for phone hot-path use.
 */
export class MultiProjectScheduler {
  private lastDecision: ProjectScheduleDecision | null = null;
  choose(projects: readonly SelfProject[], ctx: ProjectScheduleContext): ProjectScheduleDecision {
    const eligible=projects.filter(p=>p.status==='active'||p.status==='proposed');
    if(!eligible.length) { const result={projectId:null,scoreByProject:{},switched:false,reason:'no-eligible-projects'} as ProjectScheduleDecision; this.lastDecision=result; return result; }
    const scoreByProject:Record<string,number>={};
    for(const project of eligible){
      const progressRoom=1-clamp(project.progress);
      const urgency=clamp(project.priority*.46 + project.commitment*.24 + progressRoom*.12);
      const identity=clamp(project.identityRelevance)*.10;
      const evidenceNeed=clamp((1-clamp(project.validatedEvidenceCount/2))*0.04 + (1-clamp(project.replicatedEvidenceCount/4))*0.04);
      const recency=ageBoost(ctx.at ?? Date.now(),project.lastWorkedAt)*.06;
      const selectedBonus=project.id===ctx.selectedProjectId?0.06:0;
      const pressure=clamp(ctx.goalPressure01*.04 + ctx.uncertainty01*.03);
      const resourcePenalty=clamp(ctx.cognitiveLoad01*.05 + (1-clamp(ctx.energy01))*0.03 + (1-clamp(ctx.budget01))*0.04);
      const score=clamp(urgency+identity+evidenceNeed+recency+selectedBonus+pressure-resourcePenalty);
      scoreByProject[project.id]=score;
    }
    const ranked=eligible.slice().sort((a,b)=>(scoreByProject[b.id]-scoreByProject[a.id]) || (b.priority-a.priority) || (a.createdAt-b.createdAt));
    const winner=ranked[0]!;
    const current=ctx.selectedProjectId ? eligible.find(p=>p.id===ctx.selectedProjectId) : undefined;
    const currentScore=current ? scoreByProject[current.id] : -Infinity;
    const chosen=current && currentScore >= scoreByProject[winner.id] - 0.04 ? current : winner;
    const switched=chosen.id!==ctx.selectedProjectId;
    const result={projectId:chosen.id,scoreByProject,switched,reason:switched?'resource-aware-project-switch':chosen.id===winner.id?'selected-project-remains-best':'continuity-hysteresis'} as ProjectScheduleDecision;
    this.lastDecision=result;
    return result;
  }
  snapshot(){ return this.lastDecision ? structuredClone(this.lastDecision) : null; }
  restore(raw?:ProjectScheduleDecision|null){ this.lastDecision=raw ? structuredClone(raw) : null; }
}
