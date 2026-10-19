const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export type ActivePerceptionModality='text'|'vision'|'audio'|'sensor'|'world';
export interface ActivePerceptionRequest{ id:string; modality:ActivePerceptionModality; reason:string; expectedInformationGain01:number; estimatedCost01:number; priority01:number; createdAt:number; status:'proposed'|'executed'|'expired'; }
export interface ActivePerceptionState{version:1;proposed:number;executed:number;expired:number;lastRequest:ActivePerceptionRequest|null;lastInformationGain01:number;meanGain01:number;meanCost01:number;lastAt:number;history:Array<{id:string;modality:ActivePerceptionModality;gain01:number;cost01:number;executed:boolean;at:number}>;}
export const defaultActivePerceptionExecutor=():ActivePerceptionState=>({version:1,proposed:0,executed:0,expired:0,lastRequest:null,lastInformationGain01:0,meanGain01:0,meanCost01:0,lastAt:0,history:[]});
export class ActivePerceptionExecutor{
  rankCandidates(candidates:Array<{modality:ActivePerceptionModality;reason:string;expectedInformationGain01:number;estimatedCost01:number;priority01?:number}>,budget01:number){
    return candidates.map((c,i)=>({...c,priority01:clamp((c.priority01??.5)*.35+c.expectedInformationGain01*.55-clamp(c.estimatedCost01)*.30),index:i}))
      .filter(c=>c.estimatedCost01<=clamp(budget01)*1.25).sort((a,b)=>b.priority01-a.priority01);
  }
 private state=defaultActivePerceptionExecutor();
 restore(raw?:Partial<ActivePerceptionState>|null){const d=defaultActivePerceptionExecutor(),r=raw??{};this.state={...d,...r,lastRequest:r.lastRequest??null,history:Array.isArray(r.history)?r.history.slice(-96):[]};}
 snapshot(){return structuredClone(this.state);}
 pendingRequestId(){return this.state.lastRequest?.status==='proposed' ? this.state.lastRequest.id : undefined;}
 propose(input:{request?:{modality:ActivePerceptionModality;reason:string;expectedInformationGain01:number;estimatedCost01:number;priority01:number}|null;budget01:number;at?:number}){
  const at=input.at??Date.now(); const r=input.request; if(!r || input.budget01<clamp(r.estimatedCost01)*.5){if(this.state.lastRequest?.status==='proposed')this.state.lastRequest.status='expired';return null;}
  const req:ActivePerceptionRequest={id:`apx:${at.toString(36)}:${this.state.proposed+1}`,modality:r.modality,reason:String(r.reason).slice(0,160),expectedInformationGain01:clamp(r.expectedInformationGain01),estimatedCost01:clamp(r.estimatedCost01),priority01:clamp(r.priority01),createdAt:at,status:'proposed'};
  this.state.proposed++;this.state.lastRequest=req;this.state.lastAt=at;this.state.meanCost01=clamp(this.state.meanCost01*.92+req.estimatedCost01*.08);return structuredClone(req);
 }
 execute(input:{id?:string;observedGain01?:number;at?:number}){
  const at=input.at??Date.now(); const r=this.state.lastRequest; if(!r||r.status!=='proposed'||(input.id&&input.id!==r.id))return false;
  const gain=clamp(input.observedGain01??r.expectedInformationGain01); r.status='executed';this.state.executed++;this.state.lastInformationGain01=gain;this.state.meanGain01=clamp(this.state.meanGain01*.9+gain*.1);this.state.lastAt=at;this.state.history=[{id:r.id,modality:r.modality,gain01:gain,cost01:r.estimatedCost01,executed:true,at},...this.state.history].slice(0,96);return true;
 }
 expire(at=Date.now()){const r=this.state.lastRequest;if(r?.status==='proposed'){r.status='expired';this.state.expired++;this.state.history=[{id:r.id,modality:r.modality,gain01:0,cost01:r.estimatedCost01,executed:false,at},...this.state.history].slice(0,96);this.state.lastAt=at;return true;}return false;}
}
