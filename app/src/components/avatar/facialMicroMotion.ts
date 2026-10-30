export interface FacialMicroMotionInput {
  blinkPhaseMs: number;
  blinkDurationMs: number;
  saccadePhaseMs: number;
  saccadeIndex: number;
  saccadeAmplitude: number;
  speaking: boolean;
}
export interface FacialMicroMotionFrame {
  /** 0 = eyes open, 1 = full closure. */
  blinkClosure: number;
  /** Small normalized gaze offsets, intentionally separate from head gaze. */
  saccadeX: number;
  saccadeY: number;
}
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,Number.isFinite(value)?value:min));
const DIRECTIONS:ReadonlyArray<readonly [number,number]>=[
  [1,.15],[-.8,.25],[.25,-1],[-1,-.15],[.65,.75],
];
/** Deterministic short blink and saccade pulses for renderers with local frame clocks. */
export function deriveFacialMicroMotion(input:FacialMicroMotionInput):FacialMicroMotionFrame {
  const blinkDuration=clamp(input.blinkDurationMs,90,145);
  const blinkPhase=clamp(input.blinkPhaseMs,0,10500);
  const blinkClosure=blinkPhase<blinkDuration?Math.sin(Math.PI*blinkPhase/blinkDuration):0;
  // Saccades are brief pulses, not a continuous sinusoid; the renderer owns the phase clock.
  const saccadePhase=clamp(input.saccadePhaseMs,0,4200);
  const index=Number.isSafeInteger(input.saccadeIndex)?Math.abs(input.saccadeIndex):0;
  const [directionX,directionY]=DIRECTIONS[index%DIRECTIONS.length];
  const envelope=clamp(1-saccadePhase/180,0,1);
  const gain=clamp(input.saccadeAmplitude,.06,.25)*envelope*(input.speaking?.58:1);
  return {blinkClosure,saccadeX:directionX*gain,saccadeY:directionY*gain};
}
