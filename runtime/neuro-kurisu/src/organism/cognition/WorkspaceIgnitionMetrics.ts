import type { WorkspaceStateV2 } from './RecurrentWorkspaceV2.ts';
export interface WorkspaceIgnitionState{version:1; ignitionStrength:number; broadcastBreadth:number; recurrenceDepth:number; competitionIntensity:number; perturbability:number; limitedCapacity:number; samples:number; updatedAt:number;}
export function defaultWorkspaceIgnition():WorkspaceIgnitionState{return{version:1,ignitionStrength:0,broadcastBreadth:0,recurrenceDepth:0,competitionIntensity:0,perturbability:0,limitedCapacity:1,samples:0,updatedAt:Date.now()};}
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
export function updateWorkspaceIgnition(prev:WorkspaceIgnitionState,w:WorkspaceStateV2,perturbation=0):WorkspaceIgnitionState{
  const breadth=clamp(w.items.length/Math.max(1,w.capacity));
  const recurrence=clamp(w.recurrence/8);
  const competition=clamp(w.lastCompetition);
  const ignition=clamp(breadth*0.35+recurrence*0.35+competition*0.15+clamp(perturbation)*0.15);
  return{version:1,ignitionStrength:ignition,broadcastBreadth:breadth,recurrenceDepth:recurrence,competitionIntensity:competition,perturbability:clamp(perturbation),limitedCapacity:clamp(1-breadth*0.4),samples:prev.samples+1,updatedAt:Date.now()};
}
