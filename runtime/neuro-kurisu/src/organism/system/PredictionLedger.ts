/**
 * P46 prediction ledger. Stores prediction vs actual separately from confidence,
 * and now exposes a real improvement signal against an early baseline.
 */
export interface PredictionRecord { id:string; at:number; tick:number; kind:'reward'|'self'|'world'; action:string; predicted01:number; confidence01:number; context?:Record<string,unknown>; resolvedAt?:number; actual01?:number; error01?:number; }
export interface PredictionLedgerState { version:2; capacity:number; pending:PredictionRecord[]; resolved:PredictionRecord[]; samples:number; meanAbsoluteError01:number; calibrationGap01:number; lastResolvedAt:number; bestKindError01:Record<string,number>; baselineKindError01:Record<string,number>; improvement01:Record<string,number>; }
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const fin=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:typeof v==='string'&&v.trim().length?Number(v):NaN;return Number.isFinite(n)?n:(Number.isFinite(f)?f:0);};
const KINDS:readonly PredictionRecord['kind'][]=['reward','self','world'];
const sanitizeKindMap=(v:unknown):Record<string,number>|null=>{if(!v||typeof v!=='object')return null;const o=v as Record<string,unknown>;const out:Record<string,number>={};for(const k of KINDS){if(k in o)out[k]=clamp(fin(o[k],.5));}return out;};
const sanitizeRecord=(v:unknown):PredictionRecord|null=>{
  if(!v||typeof v!=='object')return null;
  const r=v as Record<string,unknown>;
  if(typeof r.id!=='string'||!r.id)return null;
  const rec:PredictionRecord={id:r.id.slice(0,80),at:Math.max(0,fin(r.at,0)),tick:Math.max(0,Math.floor(fin(r.tick,0))),kind:KINDS.includes(r.kind as PredictionRecord['kind'])?r.kind as PredictionRecord['kind']:'reward',action:typeof r.action==='string'?r.action.slice(0,120):'',predicted01:clamp(fin(r.predicted01??r.confidence01,.5)),confidence01:clamp(fin(r.confidence01,.5))};
  if(r.context&&typeof r.context==='object')rec.context=r.context as Record<string,unknown>;
  if(r.resolvedAt!==undefined)rec.resolvedAt=Math.max(0,fin(r.resolvedAt,0));
  if(r.actual01!==undefined)rec.actual01=clamp(fin(r.actual01,.5));
  if(r.error01!==undefined)rec.error01=clamp(fin(r.error01,0));
  return rec;
};
const sanitizeList=(v:unknown,cap:number):PredictionRecord[]=>{if(!Array.isArray(v))return [];return v.map(sanitizeRecord).filter((x):x is PredictionRecord=>x!==null).slice(-cap);};
const uid=(tick:number)=>`p46-${tick}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
export class PredictionLedger{
 private state:PredictionLedgerState;
 constructor(capacity=256){this.state=this.defaultState(capacity);}
 private defaultState(capacity:number):PredictionLedgerState{return {version:2,capacity:Math.max(32,Math.min(2048,Math.floor(Number.isFinite(capacity)?capacity:256))),pending:[],resolved:[],samples:0,meanAbsoluteError01:.5,calibrationGap01:.5,lastResolvedAt:0,bestKindError01:{reward:.5,self:.5,world:.5},baselineKindError01:{reward:.5,self:.5,world:.5},improvement01:{reward:0,self:0,world:0}};}
 restore(raw?:Partial<PredictionLedgerState>|null){
  const src:Record<string,unknown>=(raw&&typeof raw==='object')?raw as unknown as Record<string,unknown>:{};
  const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};
  const base=this.defaultState(fin(read('capacity'),256));
  const pending=sanitizeList(read('pending'),base.capacity);
  const resolved=sanitizeList(read('resolved'),base.capacity);
  this.state={version:2,capacity:base.capacity,pending,resolved,samples:Math.max(0,Math.floor(fin(read('samples'),0))),meanAbsoluteError01:clamp(fin(read('meanAbsoluteError01'),.5)),calibrationGap01:clamp(fin(read('calibrationGap01'),.5)),lastResolvedAt:Math.max(0,fin(read('lastResolvedAt'),0)),bestKindError01:{...base.bestKindError01,...(sanitizeKindMap(read('bestKindError01'))??{})},baselineKindError01:{...base.baselineKindError01,...(sanitizeKindMap(read('baselineKindError01'))??{})},improvement01:{...base.improvement01,...(sanitizeKindMap(read('improvement01'))??{})}};
 }
 snapshot():PredictionLedgerState{return structuredClone(this.state);}
 record(input:Omit<PredictionRecord,'id'|'resolvedAt'|'actual01'|'error01'>):string{const id=uid(input.tick);const p={...input,predicted01:clamp(input.predicted01),confidence01:clamp(input.confidence01),id};this.state.pending.push(p);if(this.state.pending.length>this.state.capacity)this.state.pending.splice(0,this.state.pending.length-this.state.capacity);return id;}
 resolve(id:string,actual01:number,at=Date.now()):PredictionRecord|null{
  const idx=this.state.pending.findIndex(p=>p.id===id); if(idx<0)return null;
  const pending=this.state.pending.splice(idx,1)[0]; const actual=clamp(actual01);
  const error=Math.abs(clamp(pending.predicted01)-actual);
  const resolved={...pending,resolvedAt:at,actual01:actual,error01:error};
  this.state.resolved.unshift(resolved); this.state.resolved=this.state.resolved.slice(0,this.state.capacity);
  this.state.samples+=1; this.state.meanAbsoluteError01=clamp(this.state.meanAbsoluteError01*.92+error*.08);
  const calibration=Math.abs(clamp(pending.confidence01)-(1-error));
  this.state.calibrationGap01=clamp(this.state.calibrationGap01*.92+calibration*.08);
  const prev=this.state.bestKindError01[pending.kind]??.5; this.state.bestKindError01[pending.kind]=clamp(prev*.9+error*.1);
  if(this.state.samples<=8){ const base=this.state.baselineKindError01[pending.kind]??.5; this.state.baselineKindError01[pending.kind]=clamp(base*.75+error*.25); }
  else { const base=this.state.baselineKindError01[pending.kind]??.5; this.state.improvement01[pending.kind]=clamp((base-error)/Math.max(.05,base)); }
  this.state.lastResolvedAt=at; return resolved;
 }
 resolveOldest(kind:PredictionRecord['kind'],actual01:number,at=Date.now()){const pending=this.state.pending.find(p=>p.kind===kind);return pending?this.resolve(pending.id,actual01,at):null;}
 pendingCount(kind?:PredictionRecord['kind']){return kind?this.state.pending.filter(p=>p.kind===kind).length:this.state.pending.length;}
 improvement(kind?:PredictionRecord['kind']):number{if(kind)return this.state.improvement01[kind]??0;const vals=Object.values(this.state.improvement01);return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;}
}
