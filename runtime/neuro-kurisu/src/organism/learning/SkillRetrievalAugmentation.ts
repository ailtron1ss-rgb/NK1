/**
 * Skill Retrieval Augmentation for Neuro-Kurisu.
 * Mechanism adapted from Voyager's reusable skill library and 2026 SRA/SR-Agents
 * research: retrieve a small, evidence-ranked capability set rather than exposing
 * the whole library. This module ranks existing skills; it never executes code.
 */
export type SkillStatus = 'candidate' | 'promoted' | 'rejected';
export interface RetrievableSkill {
  id: string; contextKey: string; action: string; status: SkillStatus;
  validationSuccess01: number; validationUses: number; confidence01: number;
  updatedAt: number; totalUses: number;
}
export interface SkillRetrievalQuery { contextKey: string; action?: string; now?: number; limit?: number }
export interface RetrievedSkill extends RetrievableSkill {
  similarity01: number; evidenceStrength01: number; recency01: number;
  score01: number; transferBias01: number; reasons: string[];
}
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const n=(x:number,d=0)=>Number.isFinite(x)?x:d;

/** Six-bucket organism contexts are compared by feature position, not substring. */
export function contextSimilarity01(a:string,b:string):number {
  const left=String(a).split('|'), right=String(b).split('|');
  if(left.length!==6||right.length!==6) return a===b?1:0;
  let distance=0, valid=0;
  for(let i=0;i<6;i++){
    const av=Number(left[i].slice(1)),bv=Number(right[i].slice(1));
    if(!Number.isFinite(av)||!Number.isFinite(bv)) continue;
    distance+=Math.min(1,Math.abs(av-bv)/3);valid++;
  }
  return valid===6?clamp(1-distance/6):0;
}
export function retrieveSkills(query:SkillRetrievalQuery, skills:readonly RetrievableSkill[]):RetrievedSkill[]{
  const now=n(query.now,Date.now()),limit=Math.max(1,Math.min(12,Math.floor(n(query.limit,5))));
  const ranked=skills.filter(s=>s.status!=='candidate'&&s.validationUses>=3&&s.confidence01>=.25)
    .map(s=>{
      const similarity01=contextSimilarity01(query.contextKey,s.contextKey);
      const evidenceStrength01=clamp(1-Math.exp(-Math.max(0,s.validationUses)/6));
      const recency01=clamp(Math.exp(-Math.max(0,now-n(s.updatedAt,now))/(45*86400000)));
      const outcome=s.status==='promoted'?clamp(s.validationSuccess01):1-clamp(s.validationSuccess01);
      const actionMatch=query.action===undefined||query.action===s.action;
      const score01=clamp(.30*similarity01+.24*outcome+.18*evidenceStrength01+
        .14*clamp(s.confidence01)+.09*recency01+.05*clamp(Math.log1p(Math.max(0,s.totalUses))/5))*(actionMatch?1:.82);
      // A retrieved alternative may be useful to inspect, but evidence for a
      // different action must never bias execution of the requested action.
      // This prevents a rejected "delete" skill, for example, from penalizing
      // an unrelated "summarize" decision merely because their contexts overlap.
      const transferBias01=actionMatch
        ? (s.status==='promoted'?1:-1)*score01*(s.status==='promoted'?.025:.009)*similarity01
        : 0;
      const reasons:string[]=[];
      if(similarity01>=.8)reasons.push('context-neighbor');
      if(evidenceStrength01>=.65)reasons.push('repeat-validated');
      if(s.status==='promoted'&&s.validationSuccess01>=.7)reasons.push('positive-transfer');
      if(s.status==='rejected'&&s.validationSuccess01<=.42)reasons.push('negative-transfer-warning');
      if(!recency01||recency01<.35)reasons.push('stale-evidence');
      return {...s,similarity01,evidenceStrength01,recency01,score01,transferBias01,reasons};
    }).filter(s=>s.similarity01>=.6&&s.score01>=.3)
    .sort((a,b)=>b.score01-a.score01||a.id.localeCompare(b.id));
  // Greedy diversity penalty avoids returning many near-duplicate contexts.
  const selected:RetrievedSkill[]=[];
  for(const candidate of ranked){
    if(selected.length>=limit)break;
    const redundancy=selected.some(s=>s.action===candidate.action&&s.contextKey===candidate.contextKey);
    if(!redundancy)selected.push(candidate);
  }
  return selected;
}
export function retrievedSkillBias(query:SkillRetrievalQuery,skills:readonly RetrievableSkill[]):number{
  const rows=retrieveSkills({...query,limit:5},skills);
  if(!rows.length)return 0;
  // Do not let the mere presence of one successful skill erase contradictory
  // same-action failure evidence. Aggregate only qualified, action-matched
  // evidence and clamp the result so retrieval can nudge, never dominate policy.
  const relevant=rows.filter(s=>
    (query.action===undefined||s.action===query.action) &&
    ((s.status==='promoted'&&s.validationSuccess01>=.7) ||
     (s.status==='rejected'&&s.validationSuccess01<=.42)));
  const net=relevant.reduce((sum,s)=>sum+s.transferBias01,0);
  return Math.max(-.025,Math.min(.025,net));
}
