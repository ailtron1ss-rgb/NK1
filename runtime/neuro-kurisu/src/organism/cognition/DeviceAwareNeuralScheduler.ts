const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const deep=<T>(x:T):T=>structuredClone(x);
export interface DeviceAwareNeuralSchedulerState{version:1;tick:number;decisions:number;thermalStrain01:number;battery01:number;cpuLoad01:number;ramPressure01:number;sensorFreshness01:number;budget01:number;degradedMode01:number;skippedDeepRollouts:number;throttledCycles:number;thermalSafety01:number;computeEfficiency01:number;lastReason:string;}
const defaultState=():DeviceAwareNeuralSchedulerState=>({version:1,tick:0,decisions:0,thermalStrain01:.2,battery01:.8,cpuLoad01:.2,ramPressure01:.2,sensorFreshness01:.9,budget01:.75,degradedMode01:0,skippedDeepRollouts:0,throttledCycles:0,thermalSafety01:.8,computeEfficiency01:.7,lastReason:'baseline'});
export class DeviceAwareNeuralScheduler{
 private state=defaultState();snapshot(){return deep(this.state);}
 restore(raw?:Partial<DeviceAwareNeuralSchedulerState>|null){const d=defaultState(),r:any=raw??{};this.state={...d,...deep(r),version:1,thermalStrain01:clamp(Number(r.thermalStrain01??.2)),battery01:clamp(Number(r.battery01??.8)),cpuLoad01:clamp(Number(r.cpuLoad01??.2)),ramPressure01:clamp(Number(r.ramPressure01??.2)),sensorFreshness01:clamp(Number(r.sensorFreshness01??.9)),budget01:clamp(Number(r.budget01??.75)),degradedMode01:clamp(Number(r.degradedMode01??0)),thermalSafety01:clamp(Number(r.thermalSafety01??.8)),computeEfficiency01:clamp(Number(r.computeEfficiency01??.7))};}
 beforeDecision(args:{tick:number;continuityBudget01:number;thermalStrain01?:number;battery01?:number;cpuLoad01?:number;ramPressure01?:number;sensorFreshness01?:number;predictionError01:number;novelty01:number}):{budget01:number;skipDeep:boolean;degraded01:number;reason:string}{
  this.state.tick=args.tick;this.state.decisions++;const t=clamp(args.thermalStrain01??this.state.thermalStrain01),b=clamp(args.battery01??this.state.battery01),cpu=clamp(args.cpuLoad01??this.state.cpuLoad01),ram=clamp(args.ramPressure01??this.state.ramPressure01),fresh=clamp(args.sensorFreshness01??this.state.sensorFreshness01);
  this.state.thermalStrain01=clamp(this.state.thermalStrain01*.9+t*.1);this.state.battery01=clamp(this.state.battery01*.9+b*.1);this.state.cpuLoad01=clamp(this.state.cpuLoad01*.9+cpu*.1);this.state.ramPressure01=clamp(this.state.ramPressure01*.9+ram*.1);this.state.sensorFreshness01=clamp(this.state.sensorFreshness01*.9+fresh*.1);
  const pressure=.34*t+.22*cpu+.18*ram+.14*(1-b)+.12*(1-fresh);const urgency=clamp(args.predictionError01*.45+args.novelty01*.25+(1-fresh)*.15);
  let budget=clamp(args.continuityBudget01*(1-pressure*.58)+urgency*.12,.20,1);let skipDeep=budget<.46||pressure>.65;
  if(pressure>.78){budget=Math.min(budget,.35);skipDeep=true;}if(skipDeep)this.state.skippedDeepRollouts++;if(pressure>.58)this.state.throttledCycles++;
  const degraded=clamp((pressure-.42)/.45);const reason=pressure>.78?'thermal_memory_guard':pressure>.58?'load_guard':skipDeep?'budget_guard':'full';
  this.state.budget01=budget;this.state.degradedMode01=clamp(this.state.degradedMode01*.93+degraded*.07);this.state.thermalSafety01=clamp(this.state.thermalSafety01*.96+(1-t)*.04);this.state.computeEfficiency01=clamp(this.state.computeEfficiency01*.95+(1-pressure)*.05);this.state.lastReason=reason;
  return {budget01:budget,skipDeep,degraded01:this.state.degradedMode01,reason};
 }
 metrics(){return deep(this.state);}
}
export const defaultDeviceAwareNeuralScheduler=():DeviceAwareNeuralSchedulerState=>defaultState();
