export const NEURAL_SPACE_CONTRACT_VERSION = 1 as const;
export const NEURAL_INPUT_DIM = 64 as const;
export const NEURAL_PRESSURE_DIM = 6 as const;
export const NEURAL_ACTIONS = ['respond','explore','verify','rest','reflect','wait','defer'] as const;

export type NeuralSpaceFrame = {
  input: number[];
  pressure: number[];
  predictionError01: number;
  novelty01: number;
  uncertainty01: number;
  homeostasis01: number;
  identityGap01: number;
  goalPressure01: number;
};

const finite=(x:number)=>Number.isFinite(x)?x:0;
const clamp=(x:number)=>Math.max(-1,Math.min(1,finite(x)));

/** Single typed boundary for the neural branch. It prevents upstream modules from silently
 * changing dimensionality/semantics and makes the branch auditable as one neural space. */
export function normalizeNeuralSpaceFrame(frame: Partial<NeuralSpaceFrame>): NeuralSpaceFrame {
  const input=Array.from({length:NEURAL_INPUT_DIM},(_,i)=>clamp(Number(frame.input?.[i]??0)));
  const p=frame.pressure??[];
  return {
    input,
    pressure:Array.from({length:NEURAL_PRESSURE_DIM},(_,i)=>Math.max(0,Math.min(1,finite(Number(p[i]??.15))))),
    predictionError01:Math.max(0,Math.min(1,finite(Number(frame.predictionError01??.5)))),
    novelty01:Math.max(0,Math.min(1,finite(Number(frame.novelty01??.2)))),
    uncertainty01:Math.max(0,Math.min(1,finite(Number(frame.uncertainty01??.3)))),
    homeostasis01:Math.max(0,Math.min(1,finite(Number(frame.homeostasis01??.5)))),
    identityGap01:Math.max(0,Math.min(1,finite(Number(frame.identityGap01??.2)))),
    goalPressure01:Math.max(0,Math.min(1,finite(Number(frame.goalPressure01??.4)))),
  };
}

export function validateNeuralSpaceContract(frame: NeuralSpaceFrame): {ok:boolean; errors:string[]} {
  const errors:string[]=[];
  if(frame.input.length!==NEURAL_INPUT_DIM) errors.push(`input_dim:${frame.input.length}`);
  if(frame.pressure.length!==NEURAL_PRESSURE_DIM) errors.push(`pressure_dim:${frame.pressure.length}`);
  if(frame.input.some(x=>!Number.isFinite(x))) errors.push('input_nonfinite');
  if(frame.pressure.some(x=>!Number.isFinite(x))) errors.push('pressure_nonfinite');
  return {ok:errors.length===0,errors};
}
