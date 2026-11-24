import type { RealityOutcomeSource } from './RealityGroundingController.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export interface RealityShadowResolution {
  source:RealityOutcomeSource;
  commitShadow:boolean;
  divergence01:number;
  shadowReward01:number;
  groundedReward01:number;
  shadowSurprise01:number;
  reason:string;
}

export interface RealityShadowBridgeState {
  version:1;
  previews:number;
  simulationCommits:number;
  externalHolds:number;
  meanDivergence01:number;
  meanShadowAgreement01:number;
  last:RealityShadowResolution|null;
  history:RealityShadowResolution[];
}

export const defaultRealityShadowBridgeState=():RealityShadowBridgeState=>({version:1,previews:0,simulationCommits:0,externalHolds:0,meanDivergence01:.25,meanShadowAgreement01:.55,last:null,history:[]});

/**
 * P2840: isolate predictive shadow-world transitions from the canonical world state.
 * A shadow transition is committed only when no authoritative external outcome was
 * available for the cycle. This prevents simulated side effects from leaking into the
 * organism's persistent world timeline after a real device action was observed.
 */
export class RealityShadowBridge {
  private state=defaultRealityShadowBridgeState();
  snapshot(){return structuredClone(this.state);}
  restore(raw?:Partial<RealityShadowBridgeState>|null){
    const d=defaultRealityShadowBridgeState(),r:any=raw??{};
    this.state={...d,...structuredClone(r),version:1,last:r.last?structuredClone(r.last):null,history:Array.isArray(r.history)?r.history.slice(-256):[]};
  }
  resolve(input:{source:RealityOutcomeSource;shadowReward01:number;groundedReward01:number;shadowSurprise01:number}):RealityShadowResolution{
    const shadow=clamp(input.shadowReward01),grounded=clamp(input.groundedReward01);
    const divergence=clamp(Math.abs(shadow-grounded));
    const resolution:RealityShadowResolution={source:input.source,commitShadow:input.source==='simulation',divergence01:divergence,shadowReward01:shadow,groundedReward01:grounded,shadowSurprise01:clamp(input.shadowSurprise01),reason:input.source==='simulation'?'no-authoritative-external-outcome;commit-predictive-shadow-as-primary':'authoritative-external-outcome-present;hold-shadow-state-and-record-divergence'};
    this.state.previews++;
    if(resolution.commitShadow)this.state.simulationCommits++;else this.state.externalHolds++;
    const a=.10;
    this.state.meanDivergence01=clamp(this.state.meanDivergence01*(1-a)+divergence*a);
    this.state.meanShadowAgreement01=clamp(this.state.meanShadowAgreement01*(1-a)+(1-divergence)*a);
    this.state.last=resolution;this.state.history=[resolution,...this.state.history].slice(0,256);
    return structuredClone(resolution);
  }
  diagnostics(){return {previews:this.state.previews,simulationCommits:this.state.simulationCommits,externalHolds:this.state.externalHolds,meanDivergence01:this.state.meanDivergence01,meanShadowAgreement01:this.state.meanShadowAgreement01};}
}
