export type PredictionDebtStatus='open'|'aging'|'resolved'|'expired';
export interface PredictionDebtRecord{predictionId:string;kind:'reward'|'self'|'world';createdTick:number;dueTick:number;priority01:number;status:PredictionDebtStatus;resolvedAt:number;ageTicks:number;}
export interface PredictionDebtState{version:1;records:PredictionDebtRecord[];openCount:number;agingCount:number;expiredCount:number;meanPriority01:number;lastAt:number;}
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
export const defaultPredictionDebt=():PredictionDebtState=>({version:1,records:[],openCount:0,agingCount:0,expiredCount:0,meanPriority01:0,lastAt:0});
export class PredictionDebtEngine{
 private state=defaultPredictionDebt();
 restore(raw?:Partial<PredictionDebtState>|null){const d=defaultPredictionDebt();const restoredLastAt=Number(raw?.lastAt??d.lastAt);this.state={...d,...(raw??{}),records:Array.isArray(raw?.records)?raw!.records.slice(-256).map((r:any)=>({...r,status:['open','aging','resolved','expired'].includes(r.status)?r.status:'open',priority01:clamp(Number(r.priority01??.5)),ageTicks:Math.max(0,Number(r.ageTicks??0))})):[]};this.recompute(0);this.state.lastAt=restoredLastAt;}
 snapshot(){return structuredClone(this.state);}
 register(predictionId:string,kind:PredictionDebtRecord['kind'],createdTick:number,dueTick=Math.max(createdTick+1,createdTick+(kind==='world'?12:kind==='self'?4:1)),priority01=.5){const existing=this.state.records.find(r=>r.predictionId===predictionId);if(existing)return existing;const r:PredictionDebtRecord={predictionId,kind,createdTick,dueTick,priority01:clamp(priority01),status:'open',resolvedAt:0,ageTicks:0};this.state.records=[r,...this.state.records].slice(0,256);this.recompute(createdTick);return structuredClone(r);}
 resolve(predictionId:string,atTick:number){const r=this.state.records.find(x=>x.predictionId===predictionId);if(!r||r.status==='resolved')return false;r.status='resolved';r.resolvedAt=Date.now();r.ageTicks=Math.max(0,atTick-r.createdTick);this.recompute(atTick);return true;}
 tick(tick:number){for(const r of this.state.records){if(r.status==='resolved'||r.status==='expired')continue;r.ageTicks=Math.max(0,tick-r.createdTick);if(tick>r.dueTick+Math.max(8,Math.round((1-r.priority01)*24)))r.status='expired';else if(tick>=r.dueTick)r.status='aging';}this.recompute(tick);}
 private recompute(tick:number){this.state.openCount=this.state.records.filter(r=>r.status==='open').length;this.state.agingCount=this.state.records.filter(r=>r.status==='aging').length;this.state.expiredCount=this.state.records.filter(r=>r.status==='expired').length;const open=this.state.records.filter(r=>r.status==='open'||r.status==='aging');this.state.meanPriority01=open.length?clamp(open.reduce((s,r)=>s+r.priority01,0)/open.length):0;this.state.lastAt=Date.now();void tick;}
 priority():number{return clamp(this.state.meanPriority01 + Math.min(1,this.state.agingCount/4)*.18 + Math.min(1,this.state.expiredCount/8)*.08);}
}
