export interface PhoneBodySnapshot {
  at:number;
  battery01:number;
  thermal01:number;
  cpu01:number;
  ram01:number;
  networkOnline:boolean|null;
  screenInteractive:boolean|null;
  charging:boolean|null;
  bodyEnergy01:number;
  cognitiveCapacity01:number;
}
export interface PhoneBodyWorldState {
  version:1;
  observations:number;
  transitions:number;
  last:PhoneBodySnapshot|null;
  meanDrainPerCycle01:number;
  meanThermalRise01:number;
  meanCapacityDrop01:number;
  resourceRisk01:number;
  projectedBattery01:number;
}
const c=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export const defaultPhoneBodyWorld=():PhoneBodyWorldState=>({version:1,observations:0,transitions:0,last:null,meanDrainPerCycle01:0,meanThermalRise01:0,meanCapacityDrop01:0,resourceRisk01:0.12,projectedBattery01:0.75});
export class PhoneBodyWorldModel{
  private state=defaultPhoneBodyWorld();
  restore(s:PhoneBodyWorldState|undefined){this.state={...defaultPhoneBodyWorld(),...(s??{}),last:s?.last?{...s.last}:null};}
  snapshot(){return structuredClone(this.state);}
  observe(body:{telemetry:{battery01:number;thermalPressure01:number;cpuLoad01:number;ramPressure01:number;networkOnline:boolean|null;screenInteractive:boolean|null;charging:boolean|null;};bodyEnergy01:number;cognitiveCapacity01:number},at=Date.now()){
    const next:PhoneBodySnapshot={at,battery01:c(body.telemetry.battery01),thermal01:c(body.telemetry.thermalPressure01),cpu01:c(body.telemetry.cpuLoad01),ram01:c(body.telemetry.ramPressure01),networkOnline:body.telemetry.networkOnline,screenInteractive:body.telemetry.screenInteractive,charging:body.telemetry.charging,bodyEnergy01:c(body.bodyEnergy01),cognitiveCapacity01:c(body.cognitiveCapacity01)};
    if(this.state.last){
      const dt=Math.max(1000,at-this.state.last.at); const charging=Boolean(next.charging);
      const drain=charging?0:c(Math.max(0,this.state.last.battery01-next.battery01)/(dt/60000));
      const rise=c(next.thermal01-this.state.last.thermal01);
      const cap=c(this.state.last.cognitiveCapacity01-next.cognitiveCapacity01);
      const n=this.state.transitions+1;
      this.state.meanDrainPerCycle01 += (drain-this.state.meanDrainPerCycle01)/n;
      this.state.meanThermalRise01 += (rise-this.state.meanThermalRise01)/n;
      this.state.meanCapacityDrop01 += (cap-this.state.meanCapacityDrop01)/n;
      this.state.transitions=n;
    }
    this.state.last=next; this.state.observations+=1;
    const drainRisk=c(this.state.meanDrainPerCycle01*18); const heatRisk=c(this.state.meanThermalRise01*8); const capRisk=c(this.state.meanCapacityDrop01*5);
    this.state.resourceRisk01=c(drainRisk*.42+heatRisk*.28+capRisk*.30 + (1-next.battery01)*.22 + next.thermal01*.25);
    this.state.projectedBattery01=c(next.battery01-this.state.meanDrainPerCycle01*6);
    return this.snapshot();
  }
  predict(minutes:number){const m=Math.max(0,minutes); const last=this.state.last; const battery=c((last?.battery01??this.state.projectedBattery01)-this.state.meanDrainPerCycle01*m); const thermal=c((last?.thermal01??0.2)+this.state.meanThermalRise01*m); return {battery01:battery,thermal01:thermal,resourceRisk01:c(this.state.resourceRisk01+thermal*.15)};}
}
