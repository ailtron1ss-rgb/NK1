/**
 * BIG PASS 220 — functional hypothalamic/allostatic homeostasis layer.
 *
 * This is a computational organism controller, not a biological reconstruction.
 * It converts internal resource state and predicted demand into bounded drives,
 * protective caps, and recovery pressure. The useful abstraction is allostatic:
 * anticipate demand, then reserve resources before failure rather than only
 * reacting after a resource has been exhausted.
 */
export interface HypothalamicHomeostasisInput {
  tick:number;
  energy01:number;
  thermal01:number;
  cognitiveLoad01:number;
  sleepPressure01:number;
  goalPressure01:number;
  uncertainty01:number;
  novelty01:number;
  externalInput?:boolean;
  safetyPressure01?:number;
}
export interface HypothalamicHomeostasisFrame {
  energyReserve01:number;
  thermalStress01:number;
  allostaticLoad01:number;
  predictedDemand01:number;
  motivationDrive01:number;
  computeCap01:number;
  plasticityCap01:number;
  recoveryDrive01:number;
  restorativePriority01:number;
  reason:string[];
}
export interface HypothalamicHomeostasisState {
  version:1;
  ticks:number;
  protectiveTicks:number;
  recoveryTicks:number;
  meanEnergyReserve01:number;
  meanThermalStress01:number;
  meanAllostaticLoad01:number;
  predictedDemand01:number;
  lastFrame:HypothalamicHomeostasisFrame|null;
}
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const strArr=(v:unknown,cap:number):string[]=>Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'&&x.length>0).map(x=>x.slice(0,160)).slice(0,cap):[];
const sanFrame=(x:unknown):HypothalamicHomeostasisFrame|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;return {energyReserve01:clamp(finN(r.energyReserve01,0)),thermalStress01:clamp(finN(r.thermalStress01,0)),allostaticLoad01:clamp(finN(r.allostaticLoad01,0)),predictedDemand01:clamp(finN(r.predictedDemand01,0)),motivationDrive01:clamp(finN(r.motivationDrive01,0)),computeCap01:clamp(finN(r.computeCap01,0)),plasticityCap01:clamp(finN(r.plasticityCap01,0)),recoveryDrive01:clamp(finN(r.recoveryDrive01,0)),restorativePriority01:clamp(finN(r.restorativePriority01,0)),reason:strArr(r.reason,16)};};
export const defaultHypothalamicHomeostasisState=():HypothalamicHomeostasisState=>({version:1,ticks:0,protectiveTicks:0,recoveryTicks:0,meanEnergyReserve01:.72,meanThermalStress01:.18,meanAllostaticLoad01:.2,predictedDemand01:.35,lastFrame:null});
export class HypothalamicHomeostasisController {
  private state=defaultHypothalamicHomeostasisState();
  restore(raw?:Partial<HypothalamicHomeostasisState>|null){const d=defaultHypothalamicHomeostasisState();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};this.state={version:1,ticks:cnt(read('ticks'),d.ticks),protectiveTicks:cnt(read('protectiveTicks'),d.protectiveTicks),recoveryTicks:cnt(read('recoveryTicks'),d.recoveryTicks),meanEnergyReserve01:clamp(finN(read('meanEnergyReserve01'),d.meanEnergyReserve01)),meanThermalStress01:clamp(finN(read('meanThermalStress01'),d.meanThermalStress01)),meanAllostaticLoad01:clamp(finN(read('meanAllostaticLoad01'),d.meanAllostaticLoad01)),predictedDemand01:clamp(finN(read('predictedDemand01'),d.predictedDemand01)),lastFrame:sanFrame(read('lastFrame'))};}
  snapshot(){return structuredClone(this.state);}
  tick(input:HypothalamicHomeostasisInput):HypothalamicHomeostasisFrame{
    const energy=clamp(input.energy01), thermal=clamp(input.thermal01), load=clamp(input.cognitiveLoad01), sleep=clamp(input.sleepPressure01), goal=clamp(input.goalPressure01), uncertainty=clamp(input.uncertainty01), novelty=clamp(input.novelty01), safety=clamp(input.safetyPressure01??0);
    const instantaneousDemand=clamp(.28*load+.22*goal+.18*uncertainty+.12*novelty+.10*(input.externalInput?.65:.2)+.10*safety);
    // Slow demand prediction gives the controller anticipatory rather than purely reactive behavior.
    const predictedDemand=clamp(this.state.predictedDemand01*.88+instantaneousDemand*.12);
    const energyStress=clamp(1-energy);
    const thermalStress=clamp(thermal);
    const allostatic=clamp(.28*energyStress+.24*thermalStress+.18*load+.14*sleep+.10*predictedDemand+.06*safety);
    const energyReserve=clamp(energy*.62+(1-thermal)*.18+(1-predictedDemand)*.20);
    const recovery=clamp(allostatic*.68+thermalStress*.16+energyStress*.12+sleep*.16);
    const computeCap=clamp(1-allostatic*.62-thermalStress*.18-energyStress*.12);
    const plasticityCap=clamp(1-allostatic*.72-thermalStress*.10-energyStress*.10);
    const motivation=clamp(.34*goal+.22*novelty+.18*uncertainty+.14*energyStress+.12*(1-sleep));
    const restorative=clamp(.44*recovery+.28*(1-energy)+.20*thermal+.08*sleep);
    const reason:string[]=[];
    if(energy<.35)reason.push('energy-reserve-protection');
    if(thermal>.65)reason.push('thermal-protection');
    if(predictedDemand>.62)reason.push('anticipated-demand');
    if(sleep>.65)reason.push('sleep-homeostasis');
    if(goal>.68)reason.push('motivational-drive');
    if(!reason.length)reason.push('homeostatic-steady-state');
    const frame={energyReserve01:energyReserve,thermalStress01:thermalStress,allostaticLoad01:allostatic,predictedDemand01:predictedDemand,motivationDrive01:motivation,computeCap01:computeCap,plasticityCap01:plasticityCap,recoveryDrive01:recovery,restorativePriority01:restorative,reason};
    this.state.ticks++; this.state.predictedDemand01=predictedDemand;
    this.state.meanEnergyReserve01=clamp(this.state.meanEnergyReserve01*.95+energyReserve*.05);
    this.state.meanThermalStress01=clamp(this.state.meanThermalStress01*.95+thermalStress*.05);
    this.state.meanAllostaticLoad01=clamp(this.state.meanAllostaticLoad01*.95+allostatic*.05);
    if(allostatic>.55)this.state.protectiveTicks++; if(recovery>.55)this.state.recoveryTicks++;
    this.state.lastFrame=structuredClone(frame); return structuredClone(frame);
  }
  diagnostics(){return structuredClone(this.state);}
}
