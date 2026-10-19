import type { ActionKind } from '../core/types.ts';

const clamp = (x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));

/**
 * P2862 — thin, stateless integration boundary.
 * It deliberately owns no memory and no policy authority. It only converts
 * already-owned neural/world/memory signals into bounded cross-system frames.
 */
export interface P2862WorldNeuralFeedback {
  vector01:number[];
  confidence01:number;
  predictionError01:number;
  novelty01:number;
  coherence01:number;
}

export interface P2862GoalFeedback {
  confidence01:number;
  unresolved01:number;
  novelty01:number;
  epistemicPressure01:number;
}

export function blendLatent01(
  world:number[] = [],
  neural:number[] = [],
  memory:number[] = [],
  weights:{world?:number;neural?:number;memory?:number} = {},
  dim = 32,
){
  const ww=weights.world ?? .60;
  const wn=weights.neural ?? .25;
  const wm=weights.memory ?? .15;
  const total=Math.max(1e-9,ww+wn+wm);
  const out=new Array(dim).fill(.5);
  for(let i=0;i<dim;i++){
    const w=Number(world[i] ?? .5);
    const n=Number(neural[i] ?? .5);
    const m=Number(memory[i] ?? .5);
    out[i]=clamp((clamp(w)*ww+clamp(n)*wn+clamp(m)*wm)/total);
  }
  return out;
}

export function previousWorldFeedback(
  prediction:number[] = [],
  confidence01:number = .5,
  error01:number = .5,
  dim = 16,
):P2862WorldNeuralFeedback{
  const confidence=clamp(confidence01);
  const error=clamp(error01);
  const vector01=Array.from({length:dim},(_,i)=>clamp(Number(prediction[i] ?? .5)));
  const mean=vector01.reduce((a,b)=>a+b,0)/Math.max(1,vector01.length);
  const variance=vector01.reduce((a,b)=>a+(b-mean)**2,0)/Math.max(1,vector01.length);
  return {
    vector01,
    confidence01:confidence,
    predictionError01:error,
    novelty01:clamp(.45 + Math.sqrt(variance)*1.8 + error*.42),
    coherence01:clamp(confidence*.72 + (1-error)*.28),
  };
}

export function buildGoalFeedback(
  transitionConfidence01:number,
  transitionError01:number,
  memoryNovelty01:number,
  neuralConfidence01:number,
):P2862GoalFeedback{
  const confidence=clamp(transitionConfidence01);
  const error=clamp(transitionError01);
  const novelty=clamp(memoryNovelty01);
  const neural=clamp(neuralConfidence01);
  return {
    confidence01:clamp(confidence*.55+neural*.45),
    unresolved01:clamp(error*.62+(1-confidence)*.23+novelty*.15),
    novelty01:clamp(novelty*.70+(1-confidence)*.30),
    epistemicPressure01:clamp(error*.55+(1-confidence)*.35+novelty*.10),
  };
}

export function boundedActionFeedback(
  actionBias:Partial<Record<ActionKind,number>>,
  scale=.12,
){
  return Object.fromEntries(Object.entries(actionBias).map(([action,value])=>[action,clamp(Number(value??0),-scale,scale)])) as Partial<Record<ActionKind,number>>;
}

export function neuralMemoryContext(
  neural:number[] = [],
  coherence01=.5,
  confidence01=.5,
  predictionError01=.5,
){
  const latent=neural.slice(0,8).map(v=>clamp((Number(v)+1)/2));
  while(latent.length<8)latent.push(.5);
  latent[5]=clamp(latent[5]!*.7+clamp(coherence01)*.15+clamp(confidence01)*.15);
  latent[6]=clamp(latent[6]!*.7+(1-clamp(predictionError01))*.3);
  latent[7]=clamp(latent[7]!*.7+clamp(confidence01)*.3);
  return latent;
}
