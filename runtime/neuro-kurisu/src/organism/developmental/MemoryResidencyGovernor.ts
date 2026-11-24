export type MemoryResidencyTier = 'hot'|'warm'|'cold';

export interface MemoryResidencyPlan {
  hotBudget:number;
  warmBudget:number;
  coldBudget:number;
  pressure01:number;
  targetItems:number;
  tierCounts:{hot:number;warm:number;cold:number};
}

const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const int=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,Math.floor(Number.isFinite(x)?x:min)));

/**
 * Phone-oriented residency policy. It does not delete canonical memory;
 * it decides which records deserve fast retrieval residency and how much
 * canonical memory should remain materialized in RAM.
 */
export class MemoryResidencyGovernor {
  plan(input:{hotBudget:number;warmBudget:number;coldBudget:number;pressure01:number;identityTension01?:number}):MemoryResidencyPlan {
    const pressure=clamp01(input.pressure01);
    const identityTension=clamp01(input.identityTension01??0);
    const hot=int(input.hotBudget,16,96);
    const warm=int(input.warmBudget,64,384);
    const cold=int(input.coldBudget,128,2048);
    const protectedBoost=Math.round(identityTension*48);
    const adaptiveCold=Math.max(128,Math.min(cold,Math.round(cold*(0.46-0.20*pressure)+protectedBoost)));
    return {
      hotBudget:hot,
      warmBudget:Math.max(hot,warm),
      coldBudget:adaptiveCold,
      pressure01:pressure,
      targetItems:Math.max(128,Math.min(1600,hot+warm+adaptiveCold)),
      tierCounts:{hot:0,warm:0,cold:0},
    };
  }
}
