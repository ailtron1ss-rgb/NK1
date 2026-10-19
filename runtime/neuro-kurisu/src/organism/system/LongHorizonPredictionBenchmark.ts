import type { OrganismState } from '../core/types.ts';
export interface HorizonSample{ id:string;createdTick:number;horizon:number;predicted01:number;actual01?:number;error01?:number;resolvedAt?:number; }
export interface LongHorizonPredictionState{version:2;samples:number;resolved:number;meanErrorByHorizon:Record<string,number>;baselineErrorByHorizon:Record<string,number>;improvementByHorizon:Record<string,number>;pending:HorizonSample[];recent:HorizonSample[];lastAt:number;}
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
export const defaultLongHorizonPrediction=():LongHorizonPredictionState=>({version:2,samples:0,resolved:0,meanErrorByHorizon:{'1':.5,'4':.5,'12':.5},baselineErrorByHorizon:{'1':.5,'4':.5,'12':.5},improvementByHorizon:{'1':0,'4':0,'12':0},pending:[],recent:[],lastAt:0});
export class LongHorizonPredictionBenchmark{
 private state=defaultLongHorizonPrediction();
 restore(raw?:Partial<LongHorizonPredictionState>|null){const d=defaultLongHorizonPrediction();this.state={...d,...(raw??{}),version:2,pending:Array.isArray(raw?.pending)?raw!.pending.slice(-96):[],recent:Array.isArray(raw?.recent)?raw!.recent.slice(-128):[],meanErrorByHorizon:{...d.meanErrorByHorizon,...(raw?.meanErrorByHorizon??{})},baselineErrorByHorizon:{...d.baselineErrorByHorizon,...((raw as any)?.baselineErrorByHorizon??{})},improvementByHorizon:{...d.improvementByHorizon,...(raw?.improvementByHorizon??{})}};}
 snapshot(){return structuredClone(this.state);}
 private scalar(s:OrganismState){return clamp(.45*s.needs.energy+.25*(1-s.needs.cognitiveLoad)+.15*(1-s.needs.uncertainty)+.15*s.needs.identityCoherence);}
 seed(state:OrganismState,horizon:1|4|12,predicted01:number){const id=`lhp-${state.tick}-${horizon}-${Math.random().toString(16).slice(2)}`;this.state.pending=[{id,createdTick:state.tick,horizon,predicted01:clamp(predicted01)},...this.state.pending].slice(-96);return id;}
 tick(state:OrganismState){const actual=this.scalar(state);for(const p of this.state.pending){if(p.actual01!=null||state.tick-p.createdTick<p.horizon)continue;p.actual01=actual;p.error01=Math.abs(clamp(p.predicted01)-actual);p.resolvedAt=Date.now();const key=String(p.horizon);const prev=this.state.meanErrorByHorizon[key]??.5;const baseline=this.state.baselineErrorByHorizon[key]??.5;this.state.meanErrorByHorizon[key]=clamp(prev*.85+p.error01*.15);this.state.improvementByHorizon[key]=clamp((baseline-p.error01)/Math.max(.1,baseline));this.state.resolved++;this.state.samples++;this.state.recent=[p,...this.state.recent].slice(0,128);}
 this.state.pending=this.state.pending.filter(p=>p.actual01==null);this.state.lastAt=Date.now();}
 predictedScalarForAction(state:OrganismState,action:string){const delta=action==='rest'?.08:action==='explore'?.02:action==='verify'?.04:action==='reflect'?.03:action==='respond'?.01:-.01;return clamp(this.scalar(state)+delta);}
 summary(){return {samples:this.state.samples,resolved:this.state.resolved,meanErrorByHorizon:{...this.state.meanErrorByHorizon},improvementByHorizon:{...this.state.improvementByHorizon},pending:this.state.pending.length};}
}
