import { randomUUID } from 'node:crypto';
export interface ScientificHypothesis{id:string;text:string;confidence:number;status:'open'|'supported'|'rejected';evidenceIds:string[];}
export interface ScientificProject{ id:string; question:string; hypotheses:ScientificHypothesis[]; predictions:string[]; experiments:string[]; evidence:string[]; contradictions:string[]; beliefRevisions:string[]; uncertainty:number; status:'open'|'testing'|'concluded'; provenance:string[]; createdAt:number; updatedAt:number; }
export interface ScientificMethodState{projects:ScientificProject[];completed:number;revisionCount:number;}
export const defaultScientificMethod=():ScientificMethodState=>({projects:[],completed:0,revisionCount:0});
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const fin=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:typeof v==='string'&&v.trim().length?Number(v):NaN;return Number.isFinite(n)?n:(Number.isFinite(f)?f:0);};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(fin(v,f)));
const str=(v:unknown,f:string):string=>typeof v==='string'?v.slice(0,320):f;
const strArr=(v:unknown,cap:number):string[]=>Array.isArray(v)?v.filter((x):x is string=>typeof x==='string').map(x=>x.slice(0,320)).slice(0,cap):[];
const HYP_STATUS:readonly ScientificHypothesis['status'][]=['open','supported','rejected'];
const PROJ_STATUS:readonly ScientificProject['status'][]=['open','testing','concluded'];
const sanitizeProject=(value:unknown):ScientificProject|null=>{
  if(!value||typeof value!=='object')return null;
  const r=value as Record<string,unknown>;
  if(typeof r.id!=='string'||!r.id)return null;
  const hypotheses=Array.isArray(r.hypotheses)?r.hypotheses.filter((h):h is Record<string,unknown>=>Boolean(h&&typeof h==='object')).map(h=>({id:typeof h.id==='string'?h.id:'',text:str(h.text,''),confidence:clamp(fin(h.confidence,.5)),status:HYP_STATUS.includes(h.status as ScientificHypothesis['status'])?h.status as ScientificHypothesis['status']:'open',evidenceIds:strArr(h.evidenceIds,16)})).slice(0,16):[];
  return {id:r.id.slice(0,80),question:str(r.question,''),hypotheses,predictions:strArr(r.predictions,32),experiments:strArr(r.experiments,32),evidence:strArr(r.evidence,64),contradictions:strArr(r.contradictions,32),beliefRevisions:strArr(r.beliefRevisions,32),uncertainty:clamp(fin(r.uncertainty,.7)),status:PROJ_STATUS.includes(r.status as ScientificProject['status'])?r.status as ScientificProject['status']:'open',provenance:strArr(r.provenance,16),createdAt:Math.max(0,fin(r.createdAt,0)),updatedAt:Math.max(0,fin(r.updatedAt,0))};
};
export class ScientificMethodEngine{
 private state=defaultScientificMethod();
 /** Restore without trusting the snapshot: each project is rebuilt field-by-field so a malformed hypothesis cannot smuggle NaN confidence or an unknown status into live research state. */
 restore(s:ScientificMethodState|undefined){
  const d=defaultScientificMethod();
  const src:Record<string,unknown>=(s&&typeof s==='object')?s as unknown as Record<string,unknown>:{};
  const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};
  const projects=Array.isArray(read('projects'))?(read('projects') as unknown[]).map(sanitizeProject).filter((p):p is ScientificProject=>p!==null).slice(0,64):[];
  this.state={projects,completed:cnt(read('completed'),d.completed),revisionCount:cnt(read('revisionCount'),d.revisionCount)};
 }
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
