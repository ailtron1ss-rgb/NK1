import type { ActionKind, OrganismState, OrganismNeeds } from '../core/types.ts';
import { actionCost } from '../core/ActionCostPolicy.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const now=()=>Date.now();
const finiteOr=(value:unknown,fallback:number):number=>{
  const numeric=typeof value==='number'?value:typeof value==='string'&&value.trim().length?Number(value):NaN;
  return Number.isFinite(numeric)?numeric:(Number.isFinite(fallback)?fallback:0);
};
const countOr=(value:unknown,fallback:number):number=>Math.max(0,Math.floor(finiteOr(value,fallback)));
const bounded=(value:unknown,fallback:number,lo:number,hi:number):number=>Math.max(lo,Math.min(hi,finiteOr(value,fallback)));

export interface ContextualWorldState{version:1;samples:number;updates:number;models:Record<ActionKind,{weights:number[];bias:number;loss01:number;mean01:number;variance01:number;lastAt:number;samples:number}>;featureNames:string[];calibrationError01:number;}
export interface WorldPrediction{action:ActionKind;reward01:number;nextEnergy01:number;nextLoad01:number;nextUncertainty01:number;nextNovelty01:number;confidence01:number;samples:number;}

const FEATURES=['energy','lowEnergyBasis','highEnergyBasis','cognitiveLoad','uncertainty','novelty','goalPressure','socialNeed','predictionError','attentionBudget','identityCoherence','actionCost'];
function features(s:OrganismState,a:ActionKind){const n=s.needs;const energy=clamp(n.energy); return [energy,Math.max(0,.5-energy),Math.max(0,energy-.5),clamp(n.cognitiveLoad),clamp(n.uncertainty),clamp(n.novelty),clamp(n.goalPressure),clamp(n.socialNeed),clamp(s.predictionError),clamp(s.attentionBudget),clamp(n.identityCoherence),actionCost(a)];}
function defaultModel(){return {weights:new Array(FEATURES.length).fill(0),bias:.5,loss01:0,mean01:.5,variance01:.25,lastAt:0,samples:0};}
export const defaultContextualWorld=():ContextualWorldState=>({version:1,samples:0,updates:0,models:Object.fromEntries(ACTIONS.map(a=>[a,defaultModel()])) as ContextualWorldState['models'],featureNames:[...FEATURES],calibrationError01:0});

export class ContextualWorldModel{
 private state=defaultContextualWorld();
 /**
  * Restore without trusting the snapshot. Each action model is rebuilt field by
  * field: weights must be a finite numeric array (padded/truncated to the fixed
  * feature width), bias/mean/variance are finite and range-bounded, and counts are
  * non-negative. A NaN weight or bias previously produced degenerate (0) reward
  * predictions; unknown model keys are dropped so the model map stays canonical.
  */
 restore(raw?:Partial<ContextualWorldState>|null){
  const d=defaultContextualWorld();
  const source=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};
  const read=(key:string):unknown=>{try{return (source as Record<string,unknown>)[key];}catch{return undefined;}};
  const modelsRaw=read('models');
  const models=Object.fromEntries(ACTIONS.map(a=>{
   const dm=defaultModel();
   let rawModel:unknown;
   try{ rawModel=(modelsRaw&&typeof modelsRaw==='object')?(modelsRaw as Record<string,unknown>)[a]:undefined; }catch{ rawModel=undefined; }
   const rm=(rawModel&&typeof rawModel==='object')?rawModel as Record<string,unknown>:{};
   const readM=(key:string):unknown=>{try{return (rm as Record<string,unknown>)[key];}catch{return undefined;}};
   const weightsRaw=readM('weights');
   const weights=Array.from({length:FEATURES.length},(_,i)=>Array.isArray(weightsRaw)?bounded(weightsRaw[i],0,-3,3):dm.weights[i]!);
   return [a,{
    weights,
    bias:bounded(readM('bias'),dm.bias,-3,3),
    loss01:clamp(finiteOr(readM('loss01'),dm.loss01)),
    mean01:clamp(finiteOr(readM('mean01'),dm.mean01)),
    variance01:clamp(finiteOr(readM('variance01'),dm.variance01)),
    lastAt:Math.max(0,finiteOr(readM('lastAt'),dm.lastAt)),
    samples:countOr(readM('samples'),dm.samples),
   }];
  })) as ContextualWorldState['models'];
  this.state={
   version:1,
   samples:countOr(read('samples'),d.samples),
   updates:countOr(read('updates'),d.updates),
   models,
   featureNames:[...FEATURES],
   calibrationError01:clamp(finiteOr(read('calibrationError01'),d.calibrationError01)),
  };
 }
 snapshot(){return structuredClone(this.state);}
 predict(s:OrganismState,a:ActionKind):WorldPrediction{
  const m=this.state.models[a]??defaultModel();const x=features(s,a);const z=m.bias+x.reduce((sum,v,i)=>sum+v*(m.weights[i]??0),0);const reward=clamp(z);
  const c=clamp(.18+Math.min(.70,m.samples/60*.70)*(1-m.variance01));
  const n=s.needs; const energy=clamp(n.energy + (a==='rest'?.18:(a==='explore'?-.10:a==='respond'?-.04:-.02)) + (reward-.5)*.04);
  const load=clamp(n.cognitiveLoad + actionCost(a)*.18 - (a==='rest'?.12:0));
  const unc=clamp(n.uncertainty + (a==='verify'?-.12:a==='explore'?.06:.01) - (reward-.5)*.04);
  const novelty=clamp(n.novelty + (a==='explore'?.16:-.03) + (1-reward)*.03);
  return {action:a,reward01:reward,nextEnergy01:energy,nextLoad01:load,nextUncertainty01:unc,nextNovelty01:novelty,confidence01:c,samples:m.samples};
 }
 observe(state:OrganismState,action:ActionKind,actual:{reward01:number;nextEnergy01:number;nextLoad01:number;nextUncertainty01:number;nextNovelty01:number}){
  const m=this.state.models[action]??defaultModel();const x=features(state,action);const targets=[actual.reward01,actual.nextEnergy01,actual.nextLoad01,actual.nextUncertainty01,actual.nextNovelty01];
  // The primary model learns reward; the transition traces are retained as bounded calibration signals.
  const p=this.predict(state,action);const target=clamp(actual.reward01);const error=target-p.reward01;const norm=.5+x.reduce((s,v)=>s+v*v,0);const lr=.16/norm;
  for(let i=0;i<x.length;i++) m.weights[i]=Math.max(-3,Math.min(3,(m.weights[i]??0)+lr*error*x[i]));
  m.bias=Math.max(-3,Math.min(3,m.bias+lr*error));m.loss01=clamp(error*error);m.mean01=clamp(m.mean01*.97+target*.03);m.variance01=clamp(m.variance01*.95+Math.abs(error)*.05);m.lastAt=now();m.samples++;
  this.state.samples++;this.state.updates++;this.state.calibrationError01=clamp(this.state.calibrationError01*.98+Math.abs(error)*.02);
  return {predictionBefore:p,error01:Math.abs(error),target01:target,transitionTargets:targets};
 }
 calibrationError(){return this.state.calibrationError01;}
}
