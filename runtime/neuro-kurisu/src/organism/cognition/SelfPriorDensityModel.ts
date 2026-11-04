export const SELF_PRIOR_REPRESENTATION_ID = 'b270-self-latent-v1';

export interface SelfPriorDensityState {
  version: 3;
  representationId: string;
  highMismatchStreak: number;
  dimensions: number;
  sampleCount: number;
  effectiveSamples: number;
  mean: number[];
  variance: number[];
  lastAt: number;
}
export interface SelfPriorObservation {
  mismatch01: number;
  confidence01: number;
  rmsZ: number;
  sampleCount: number;
}
const clamp=(value:number,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(value)?value:min));
const MIN_VARIANCE=.02,MAX_VARIANCE=16,MAX_DIMENSIONS=64,MAX_SAMPLES=1_000_000,MAX_EFFECTIVE_SAMPLES=64;
function isPlainRecord(value:unknown):value is Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const prototype=Object.getPrototypeOf(value);
  return prototype===Object.prototype||prototype===null;
}
function ownData(record:Record<string,unknown>,key:string):unknown{
  const descriptor=Object.getOwnPropertyDescriptor(record,key);
  return descriptor&&Object.prototype.hasOwnProperty.call(descriptor,'value')?descriptor.value:undefined;
}
function finiteVector(value:unknown,dimensions:number):number[]|null{
  if(!Array.isArray(value)||value.length!==dimensions)return null;
  const result:number[]=[];
  for(let index=0;index<dimensions;index+=1){
    const descriptor=Object.getOwnPropertyDescriptor(value,String(index));
    if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value')||typeof descriptor.value!=='number'||!Number.isFinite(descriptor.value))return null;
    result.push(descriptor.value);
  }
  return result;
}
export function defaultSelfPriorDensityState(dimensions=16,representationId=SELF_PRIOR_REPRESENTATION_ID):SelfPriorDensityState{
  const size=Number.isSafeInteger(dimensions)&&dimensions>0&&dimensions<=MAX_DIMENSIONS?dimensions:16;
  const safeId=typeof representationId==='string'&&/^[a-z0-9][a-z0-9._:-]{0,63}$/i.test(representationId)?representationId:SELF_PRIOR_REPRESENTATION_ID;
  return{version:3,representationId:safeId,highMismatchStreak:0,dimensions:size,sampleCount:0,effectiveSamples:0,mean:new Array(size).fill(0),variance:new Array(size).fill(1),lastAt:0};
}
/** Prequential diagonal-Gaussian prior over the organism's own latent state.
 * Only bounded moments are retained. representationId prevents reuse after a
 * latent basis/encoder change; surprise-sensitive alpha limits outlier capture.
 */
export class SelfPriorDensityModel{
  private state:SelfPriorDensityState;
  constructor(dimensions=16,representationId=SELF_PRIOR_REPRESENTATION_ID){this.state=defaultSelfPriorDensityState(dimensions,representationId);}
  snapshot():SelfPriorDensityState{return structuredClone(this.state);}
  restore(value:unknown):void{
    const fallback=defaultSelfPriorDensityState(this.state.dimensions,this.state.representationId);
    try{
      if(!isPlainRecord(value)){this.state=fallback;return;}
      const version=ownData(value,'version'),representationId=ownData(value,'representationId'),dimensions=ownData(value,'dimensions');
      const sampleCount=ownData(value,'sampleCount'),effectiveSamples=ownData(value,'effectiveSamples'),lastAt=ownData(value,'lastAt');
      const highMismatchStreak=ownData(value,'highMismatchStreak');
      const mean=finiteVector(ownData(value,'mean'),fallback.dimensions),variance=finiteVector(ownData(value,'variance'),fallback.dimensions);
      if(version!==3||representationId!==fallback.representationId||dimensions!==fallback.dimensions
        ||!Number.isSafeInteger(highMismatchStreak)||(highMismatchStreak as number)<0||(highMismatchStreak as number)>32
        ||!Number.isSafeInteger(sampleCount)||(sampleCount as number)<0||(sampleCount as number)>MAX_SAMPLES
        ||!Number.isSafeInteger(effectiveSamples)||(effectiveSamples as number)<0||(effectiveSamples as number)>MAX_EFFECTIVE_SAMPLES
        ||effectiveSamples!==Math.min(sampleCount as number,MAX_EFFECTIVE_SAMPLES)
        ||typeof lastAt!=='number'||!Number.isFinite(lastAt)||lastAt<0||!mean||!variance){this.state=fallback;return;}
      this.state={version:3,representationId:fallback.representationId,highMismatchStreak:highMismatchStreak as number,dimensions:fallback.dimensions,sampleCount:sampleCount as number,effectiveSamples:effectiveSamples as number,mean:mean.map(v=>clamp(v,-4,4)),variance:variance.map(v=>clamp(v,MIN_VARIANCE,MAX_VARIANCE)),lastAt:lastAt as number};
    }catch{this.state=fallback;}
  }
  predict(observation:readonly number[]):SelfPriorObservation{
    const vector=this.validateObservation(observation),sampleCount=this.state.sampleCount;
    if(sampleCount<4)return{mismatch01:0,confidence01:0,rmsZ:0,sampleCount};
    let squaredZ=0;
    for(let i=0;i<vector.length;i+=1){const variance=Math.max(MIN_VARIANCE,this.state.variance[i]);const z=(vector[i]-this.state.mean[i])/Math.sqrt(variance);squaredZ+=z*z;}
    const rmsZ=Math.sqrt(squaredZ/vector.length);
    return{mismatch01:clamp(rmsZ/(1+rmsZ)),confidence01:clamp((sampleCount-3)/24),rmsZ,sampleCount};
  }
  observe(observation:readonly number[],at=Date.now()):SelfPriorObservation{
    const vector=this.validateObservation(observation);
    if(typeof at!=='number'||!Number.isFinite(at)||at<0)throw new RangeError('self-prior-observation-timestamp-must-be-finite-and-non-negative');
    if(at<this.state.lastAt)throw new RangeError('self-prior-observation-timestamp-out-of-order');
    const prediction=this.predict(vector),baseAlpha=Math.min(.2,2/(this.state.effectiveSamples+2));
    const highMismatch=prediction.confidence01>=.5&&prediction.mismatch01>=.35;
    const nextMismatchStreak=highMismatch?Math.min(32,this.state.highMismatchStreak+1):0;
    const surpriseAdjustedAlpha=baseAlpha*(1-.65*prediction.mismatch01*prediction.confidence01);
    // Isolated surprise is resisted; persistent coherent mismatch is treated as
    // a regime shift so legitimate self-development is not permanently penalized.
    const alpha=nextMismatchStreak>=5?Math.max(surpriseAdjustedAlpha,Math.min(.12,baseAlpha*3)):surpriseAdjustedAlpha;
    for(let i=0;i<vector.length;i+=1){const delta=vector[i]-this.state.mean[i];this.state.mean[i]+=alpha*delta;const nextVariance=(1-alpha)*(this.state.variance[i]+alpha*delta*delta);this.state.variance[i]=clamp(nextVariance,MIN_VARIANCE,MAX_VARIANCE);}
    this.state.sampleCount=Math.min(MAX_SAMPLES,this.state.sampleCount+1);
    this.state.effectiveSamples=Math.min(MAX_EFFECTIVE_SAMPLES,this.state.effectiveSamples+1);
    this.state.lastAt=at;
    this.state.highMismatchStreak=nextMismatchStreak;
    return prediction;
  }
  private validateObservation(observation:readonly number[]):number[]{
    try{
      if(!Array.isArray(observation)||observation.length!==this.state.dimensions)throw new RangeError('self-prior-observation-dimension-mismatch');
      const vector:number[]=[];
      for(let i=0;i<this.state.dimensions;i+=1){
        const descriptor=Object.getOwnPropertyDescriptor(observation,String(i));
        if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value'))throw new RangeError('self-prior-observation-must-be-dense-data');
        const value=descriptor.value;
        if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>4)throw new RangeError('self-prior-observation-must-be-finite-and-bounded');
        vector.push(value);
      }
      return vector;
    }catch(error){if(error instanceof RangeError)throw error;throw new RangeError('self-prior-observation-invalid');}
  }
}
