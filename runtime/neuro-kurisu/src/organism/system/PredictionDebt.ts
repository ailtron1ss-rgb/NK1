export type PredictionDebtStatus='open'|'aging'|'resolved'|'expired';
export interface PredictionDebtRecord{predictionId:string;kind:'reward'|'self'|'world';createdTick:number;dueTick:number;priority01:number;status:PredictionDebtStatus;resolvedAt:number;ageTicks:number;}
export interface PredictionDebtState{version:1;records:PredictionDebtRecord[];openCount:number;agingCount:number;expiredCount:number;meanPriority01:number;lastAt:number;}
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const DEBT_STATUSES:readonly PredictionDebtStatus[]=['open','aging','resolved','expired'];
const DEBT_KINDS:readonly PredictionDebtRecord['kind'][]=['reward','self','world'];
const sanitizeDebt=(v:unknown):PredictionDebtRecord|null=>{
  if(!v||typeof v!=='object')return null;
  const r=v as Record<string,unknown>;
  if(typeof r.predictionId!=='string'||!r.predictionId)return null;
  return {predictionId:r.predictionId.slice(0,120),kind:DEBT_KINDS.includes(r.kind as PredictionDebtRecord['kind'])?r.kind as PredictionDebtRecord['kind']:'reward',createdTick:cnt(r.createdTick,0),dueTick:cnt(r.dueTick,0),priority01:clamp(finN(r.priority01,.5)),status:DEBT_STATUSES.includes(r.status as PredictionDebtStatus)?r.status as PredictionDebtStatus:'open',resolvedAt:Math.max(0,finN(r.resolvedAt,0)),ageTicks:cnt(r.ageTicks,0)};
};
export const defaultPredictionDebt=():PredictionDebtState=>({version:1,records:[],openCount:0,agingCount:0,expiredCount:0,meanPriority01:0,lastAt:0});
export class PredictionDebtEngine{
 private state=defaultPredictionDebt();
 restore(raw?:Partial<PredictionDebtState>|null){const d=defaultPredictionDebt();const src:Record<string,unknown>=(raw&&typeof raw==='object')?raw as unknown as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};let records:PredictionDebtRecord[]=[];try{const r=read('records');if(Array.isArray(r))records=r.map(sanitizeDebt).filter((x):x is PredictionDebtRecord=>x!==null).slice(-256);}catch{records=[];}const lastAt=Math.max(0,finN(read('lastAt'),d.lastAt));this.state={version:1,records,openCount:0,agingCount:0,expiredCount:0,meanPriority01:0,lastAt};this.recompute(0);this.state.lastAt=lastAt;}
 snapshot(){return structuredClone(this.state);}
 planningSnapshot():PredictionDebtState{return {...this.state,records:this.state.records.slice(-32)};}
 register(predictionId:string,kind:PredictionDebtRecord['kind'],createdTick:number,dueTick=Math.max(createdTick+1,createdTick+(kind==='world'?12:kind==='self'?4:1)),priority01=.5){const existing=this.state.records.find(r=>r.predictionId===predictionId);if(existing)return existing;const r:PredictionDebtRecord={predictionId,kind,createdTick,dueTick,priority01:clamp(priority01),status:'open',resolvedAt:0,ageTicks:0};this.state.records=[r,...this.state.records].slice(0,256);this.recompute(createdTick);return structuredClone(r);}
 resolve(predictionId:string,atTick:number){const r=this.state.records.find(x=>x.predictionId===predictionId);if(!r||r.status==='resolved')return false;r.status='resolved';r.resolvedAt=Date.now();r.ageTicks=Math.max(0,atTick-r.createdTick);this.recompute(atTick);return true;}
 tick(tick:number){for(const r of this.state.records){if(r.status==='resolved'||r.status==='expired')continue;r.ageTicks=Math.max(0,tick-r.createdTick);if(tick>r.dueTick+Math.max(8,Math.round((1-r.priority01)*24)))r.status='expired';else if(tick>=r.dueTick)r.status='aging';}this.recompute(tick);}
 private recompute(tick:number){this.state.openCount=this.state.records.filter(r=>r.status==='open').length;this.state.agingCount=this.state.records.filter(r=>r.status==='aging').length;this.state.expiredCount=this.state.records.filter(r=>r.status==='expired').length;const open=this.state.records.filter(r=>r.status==='open'||r.status==='aging');this.state.meanPriority01=open.length?clamp(open.reduce((s,r)=>s+r.priority01,0)/open.length):0;this.state.lastAt=Date.now();void tick;}
 priority():number{return clamp(this.state.meanPriority01 + Math.min(1,this.state.agingCount/4)*.18 + Math.min(1,this.state.expiredCount/8)*.08);}
}
