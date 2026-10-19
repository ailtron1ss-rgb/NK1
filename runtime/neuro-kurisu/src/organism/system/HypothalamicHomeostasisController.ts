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
export const defaultHypothalamicHomeostasisState=():HypothalamicHomeostasisState=>({version:1,ticks:0,protectiveTicks:0,recoveryTicks:0,meanEnergyReserve01:.72,meanThermalStress01:.18,meanAllostaticLoad01:.2,predictedDemand01:.35,lastFrame:null});
export class HypothalamicHomeostasisController {
  private state=defaultHypothalamicHomeostasisState();
  restore(raw?:Partial<HypothalamicHomeostasisState>|null){const d=defaultHypothalamicHomeostasisState(),r=raw??{};this.state={...d,...r,lastFrame:r.lastFrame?structuredClone(r.lastFrame):null,version:1};}
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
