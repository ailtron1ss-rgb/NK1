export interface AblationFactor{ id:string; enabled:boolean; baseline01:number; active01:number; contribution01:number; samples:number; }
export interface B2527State{version:1;enabled:boolean;tick:number;experiments:number;completed:number;factors:AblationFactor[];lastCondition:string;lastDelta01:number;interactionGain01:number;confidence01:number;}
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:.5));
export const defaultB2527State=():B2527State=>({version:1,enabled:true,tick:0,experiments:0,completed:0,factors:[],lastCondition:'baseline',lastDelta01:0,interactionGain01:0,confidence01:0});
export class B2527FactorialAblationHarness{
 private state=defaultB2527State(); readonly systemName='cognition:b2527-factorial-ablation-harness' as const;
 snapshot(){return structuredClone(this.state)} restore(raw?:Partial<B2527State>|null){const d=defaultB2527State(),r:any=raw??{};this.state={...d,...structuredClone(r),factors:Array.isArray(r.factors)?structuredClone(r.factors):[],version:1}}
 registerFactor(id:string,baseline01=.5){if(!this.state.factors.some(f=>f.id===id))this.state.factors.push({id,enabled:true,baseline01:clamp(baseline01),active01:clamp(baseline01),contribution01:0,samples:0})}
 observe(condition:string,score01:number){if(!this.state.enabled)return;this.state.tick++;this.state.experiments++;this.state.lastCondition=condition;const baseline=this.state.factors.reduce((s,f)=>s+f.baseline01,0)/Math.max(1,this.state.factors.length);this.state.lastDelta01=clamp(score01-baseline*.5+.5)-.5;this.state.completed++;this.state.confidence01=clamp(this.state.confidence01*.9+.1);}
 recordFactor(id:string,baseline01:number,active01:number){let f=this.state.factors.find(x=>x.id===id);if(!f){this.registerFactor(id,baseline01);f=this.state.factors.find(x=>x.id===id)!}const d=active01-baseline01;f.baseline01=clamp(baseline01);f.active01=clamp(active01);f.contribution01=f.contribution01*.8+d*.2;f.samples++}
 recordInteraction(a:string,b:string,joint01:number,individualA01:number,individualB01:number){const expected=individualA01+individualB01-.5;this.state.interactionGain01=this.state.interactionGain01*.8+(joint01-expected)*.2;this.state.lastCondition=`${a}×${b}`}
 metrics(){return {...structuredClone(this.state),factors:structuredClone(this.state.factors)}}
}
