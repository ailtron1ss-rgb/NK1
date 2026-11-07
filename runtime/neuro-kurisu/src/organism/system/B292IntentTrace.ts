/**
 * B292 — Evidence-linked intention trace.
 *
 * A compact memory of how an internally selected intention persists across
 * ticks and how its outcomes affect commitment. It records evidence; the
 * executive gate remains the authority that selects the current action.
 */
export interface B292IntentTraceRecord {
  tick:number;
  goalId:string|null;
  action:string|null;
  mode:string;
  autonomy01:number;
  gate01:number;
  reward01:number|null;
  predictionError01:number|null;
  external01:number;
}

export interface B292IntentTraceState {
  version:1;
  currentIntent:string|null;
  goalId:string|null;
  commitment01:number;
  continuity01:number;
  successEMA01:number;
  failureEMA01:number;
  switchCount:number;
  outcomeCount:number;
  lastDecisionTick:number;
  lastOutcomeTick:number;
  records:B292IntentTraceRecord[];
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const str=(v:unknown,f:string,n=160):string=>typeof v==='string'&&v?v.slice(0,n):f;
const strOrNull=(v:unknown,n=160):string|null=>typeof v==='string'&&v?v.slice(0,n):null;
const numOrNull=(v:unknown):number|null=>{if(v===null||v===undefined||v==='')return null;const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:null;};
const sanB292Rec=(x:unknown):B292IntentTraceRecord|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;return {tick:cnt(r.tick,0),goalId:strOrNull(r.goalId),action:strOrNull(r.action),mode:str(r.mode,''),autonomy01:clamp(finN(r.autonomy01,0)),gate01:clamp(finN(r.gate01,0)),reward01:numOrNull(r.reward01),predictionError01:numOrNull(r.predictionError01),external01:clamp(finN(r.external01,0))};};
export const defaultB292IntentTrace=():B292IntentTraceState=>({
  version:1,currentIntent:null,goalId:null,commitment01:.42,continuity01:.55,
  successEMA01:.5,failureEMA01:.0,switchCount:0,outcomeCount:0,lastDecisionTick:0,lastOutcomeTick:0,records:[]
});

export class B292IntentTrace {
  private state=defaultB292IntentTrace();
  restore(raw?:Partial<B292IntentTraceState>|null){
    const d=defaultB292IntentTrace();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};const rec=read('records');
    this.state={version:1,currentIntent:strOrNull(read('currentIntent')),goalId:strOrNull(read('goalId')),commitment01:clamp(finN(read('commitment01'),d.commitment01)),continuity01:clamp(finN(read('continuity01'),d.continuity01)),successEMA01:clamp(finN(read('successEMA01'),d.successEMA01)),failureEMA01:clamp(finN(read('failureEMA01'),d.failureEMA01)),switchCount:cnt(read('switchCount'),d.switchCount),outcomeCount:cnt(read('outcomeCount'),d.outcomeCount),lastDecisionTick:cnt(read('lastDecisionTick'),d.lastDecisionTick),lastOutcomeTick:cnt(read('lastOutcomeTick'),d.lastOutcomeTick),records:Array.isArray(rec)?(rec as unknown[]).slice(-96).map(sanB292Rec).filter((x):x is B292IntentTraceRecord=>x!==null):[]};
  }
  snapshot(){return structuredClone(this.state);}
  observeDecision(input:{tick:number;goalId:string|null;action:string|null;mode:string;autonomy01:number;gate01:number;external01:number}){
    const switched=this.state.currentIntent!==null && input.action!==this.state.currentIntent;
    if(switched) this.state.switchCount++;
    const sameGoal=this.state.goalId!==null && this.state.goalId===input.goalId;
    const delta=sameGoal&&!switched ? .025 : switched ? -.035 : .008;
    this.state.commitment01=clamp(this.state.commitment01+delta+input.autonomy01*.012+input.gate01*.008);
    this.state.continuity01=clamp(this.state.continuity01*.96+(sameGoal&&!switched?.72:.44)*.04);
    this.state.currentIntent=input.action; this.state.goalId=input.goalId; this.state.lastDecisionTick=input.tick;
    this.state.records.unshift({tick:input.tick,goalId:input.goalId,action:input.action,mode:input.mode,autonomy01:clamp(input.autonomy01),gate01:clamp(input.gate01),reward01:null,predictionError01:null,external01:clamp(input.external01)});
    if(this.state.records.length>96) this.state.records.pop();
    return {commitment01:this.state.commitment01,continuity01:this.state.continuity01,switchCount:this.state.switchCount};
  }
  observeOutcome(input:{tick:number;action:string|null;reward01:number;predictionError01:number;external01:number}){
    const reward=clamp(input.reward01), pe=clamp(input.predictionError01);
    const success=clamp(reward*(1-pe*.45));
    this.state.successEMA01=this.state.successEMA01*.92+success*.08;
    this.state.failureEMA01=this.state.failureEMA01*.94+(1-success)*.06;
    const same=input.action!==null&&input.action===this.state.currentIntent;
    const adjustment=(success-.5)*.10 - pe*.035 + (same?.012:-.008) - input.external01*.012;
    this.state.commitment01=clamp(this.state.commitment01+adjustment);
    this.state.continuity01=clamp(this.state.continuity01*.97+(same?.72:.38)*.03);
    this.state.outcomeCount++; this.state.lastOutcomeTick=input.tick;
    const r=this.state.records[0]; if(r&&r.tick===input.tick){r.reward01=reward;r.predictionError01=pe;}
    return {commitment01:this.state.commitment01,continuity01:this.state.continuity01,successEMA01:this.state.successEMA01,failureEMA01:this.state.failureEMA01};
  }
  metrics(){const s=this.state; return {currentIntent:s.currentIntent,goalId:s.goalId,commitment01:s.commitment01,continuity01:s.continuity01,successEMA01:s.successEMA01,failureEMA01:s.failureEMA01,switchCount:s.switchCount,outcomeCount:s.outcomeCount,lastDecisionTick:s.lastDecisionTick,lastOutcomeTick:s.lastOutcomeTick,recordDepth:s.records.length};}
  diagnostics(){return {...this.snapshot(),recordDepth:this.state.records.length};}
}
