import { randomUUID } from 'node:crypto';
export interface ScientificHypothesis{id:string;text:string;confidence:number;status:'open'|'supported'|'rejected';evidenceIds:string[];}
export interface ScientificProject{ id:string; question:string; hypotheses:ScientificHypothesis[]; predictions:string[]; experiments:string[]; evidence:string[]; contradictions:string[]; beliefRevisions:string[]; uncertainty:number; status:'open'|'testing'|'concluded'; provenance:string[]; createdAt:number; updatedAt:number; }
export interface ScientificMethodState{projects:ScientificProject[];completed:number;revisionCount:number;}
export const defaultScientificMethod=():ScientificMethodState=>({projects:[],completed:0,revisionCount:0});
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export class ScientificMethodEngine{
 private state=defaultScientificMethod();
 restore(s:ScientificMethodState|undefined){this.state={...defaultScientificMethod(),...(s??{}),projects:Array.isArray(s?.projects)?s!.projects.slice(0,64):[]};}
 create(question:string,hypothesis:string,prediction:string,provenance:string[]):ScientificProject{const p:ScientificProject={id:randomUUID(),question:question.slice(0,240),hypotheses:[{id:randomUUID(),text:hypothesis.slice(0,240),confidence:.5,status:'open',evidenceIds:[]}],predictions:[prediction.slice(0,240)],experiments:[],evidence:[],contradictions:[],beliefRevisions:[],uncertainty:.7,status:'open',provenance:provenance.slice(0,16),createdAt:Date.now(),updatedAt:Date.now()};this.state.projects=[p,...this.state.projects].slice(0,64);return structuredClone(p);}
 observe(projectId:string,input:{experiment?:string;evidence?:string;success?:number;contradiction?:string;conclusion?:string;verified?:boolean}){
  const p=this.state.projects.find(x=>x.id===projectId);
  if(!p||p.status==='concluded'||input.verified!==true)return;
  // Outcome credit needs one stable, unique evidence identity; malformed or repeated
  // receipts must not shift confidence, even when a caller retries after a timeout.
  const evidence=typeof input.evidence==='string'?input.evidence.normalize('NFKC').replace(/[\r\n\t]+/gu,' ').trim().slice(0,320):'';
  if(!evidence||p.evidence.includes(evidence))return;
  if(input.success!==undefined&&(!Number.isFinite(input.success)||input.success<0||input.success>1))return;
  p.status='testing';
  if(input.experiment)p.experiments=[input.experiment,...p.experiments].slice(0,32);
  p.evidence=[evidence,...p.evidence].slice(0,64);
  if(input.contradiction)p.contradictions=[input.contradiction,...p.contradictions].slice(0,32);
  if(input.conclusion){p.beliefRevisions=[input.conclusion,...p.beliefRevisions].slice(0,32);this.state.revisionCount++;}
  if(input.success!=null){
   const h=p.hypotheses[0];
   if(h){h.confidence=clamp(h.confidence*.7+input.success*.3);if(h.confidence>.78)h.status='supported';if(h.confidence<.22)h.status='rejected';h.evidenceIds=[...new Set([...h.evidenceIds,evidence])].slice(-16);}
   p.uncertainty=clamp(p.uncertainty*.75+(1-input.success)*.25);
  }
  p.updatedAt=Date.now();
  if(p.hypotheses[0]&&p.hypotheses[0].status!=='open'&&p.uncertainty<.25){p.status='concluded';this.state.completed++;}
 }
 snapshot(){return structuredClone(this.state);}
}
