export interface QuorumVote{member:string;score01:number;weight01:number;reason:string;}
export interface QuorumDecision{action:string;accepted:boolean;score01:number;threshold01:number;votes:QuorumVote[];dissent01:number;reason:string;}
export interface CognitiveQuorumState{version:1;decisions:number;accepted:number;rejected:number;meanScore01:number;meanDissent01:number;last?:QuorumDecision;}
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
export const defaultCognitiveQuorum=():CognitiveQuorumState=>({version:1,decisions:0,accepted:0,rejected:0,meanScore01:.5,meanDissent01:0});
export class CognitiveQuorumEngine{
 private state=defaultCognitiveQuorum();
 restore(raw?:Partial<CognitiveQuorumState>|null){this.state={...defaultCognitiveQuorum(),...(raw??{})};}
 snapshot(){return structuredClone(this.state);}
 evaluate(input:{action:string;constitutional01:number;worldConfidence01:number;memorySupport01:number;epistemic01:number;budget01:number;identity01:number;urgency01:number}):QuorumDecision{
   const votes:QuorumVote[]=[
     {member:'constitution',score01:clamp(input.constitutional01),weight01:.22,reason:'safety/constitution'},
     {member:'world',score01:clamp(input.worldConfidence01),weight01:.16,reason:'world prediction'},
     {member:'memory',score01:clamp(input.memorySupport01),weight01:.12,reason:'historical support'},
     {member:'epistemic',score01:clamp(input.epistemic01),weight01:.18,reason:'evidence quality'},
     {member:'resource',score01:clamp(input.budget01),weight01:.12,reason:'cognitive budget'},
     {member:'identity',score01:clamp(input.identity01),weight01:.10,reason:'identity coherence'},
     {member:'goal',score01:clamp(.55+input.urgency01*.45),weight01:.10,reason:'goal urgency'},
   ];
   const score=votes.reduce((s,v)=>s+v.score01*v.weight01,0)/votes.reduce((s,v)=>s+v.weight01,0);const mean=votes.reduce((s,v)=>s+v.score01,0)/votes.length;const dissent=votes.reduce((s,v)=>s+Math.abs(v.score01-mean),0)/votes.length;const threshold=clamp(.46+dissent*.24);
   const accepted=score>=threshold || (input.urgency01>.82&&score>=threshold-.05&&input.constitutional01>.7);
   const out:QuorumDecision={action:input.action,accepted,score01:clamp(score),threshold01:threshold,votes,dissent01:clamp(dissent),reason:accepted?'quorum-accepted':'quorum-dissent'};
   this.state.decisions++;accepted?this.state.accepted++:this.state.rejected++;this.state.meanScore01=clamp(this.state.meanScore01*.94+score*.06);this.state.meanDissent01=clamp(this.state.meanDissent01*.94+dissent*.06);this.state.last=out;return structuredClone(out);
 }
}
