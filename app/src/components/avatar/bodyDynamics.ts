export type BodyDynamicsEmotion = "curiosity" | "calm" | "joy" | "anxiety" | "frustration" | "sadness" | "anger" | "protective";
export interface BodyDynamicsInput {
  emotion: BodyDynamicsEmotion;
  arousal: number;
  energy: number;
  cognitiveLoad: number;
  uncertainty: number;
  awake: boolean;
  elapsedSeconds: number;
  /** Optional accumulated breath-cycle phase; keeps cadence changes phase-continuous. */
  phaseCycles?: number;
}
export interface BodyDynamicsFrame {
  breathsPerMinute: number;
  breathPhase: number;
  torsoScaleY: number;
  verticalOffset: number;
  weightShift: number;
  shoulderLift: number;
  headSway: number;
  armBreath: number;
}
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,Number.isFinite(value)?value:min));
/** Derive a bounded breathing cadence from the canonical affect/energy snapshot. This adapter does not select actions or clips. */
export function deriveBodyDynamics(input:BodyDynamicsInput):BodyDynamicsFrame {
  const arousal=clamp(input.arousal,0,1),energy=clamp(input.energy,0,1),load=clamp(input.cognitiveLoad,0,1),uncertainty=clamp(input.uncertainty,0,1);
  const emotionBias=input.emotion==="anxiety"||input.emotion==="anger"||input.emotion==="frustration"?1.1:input.emotion==="calm"?-1.2:input.emotion==="sadness"?-.6:0;
  const sleepBias=input.awake?0:-2.1;
  const breathsPerMinute=clamp(10+arousal*4.8+energy*1.4+emotionBias+sleepBias,6,19);
  const elapsed=clamp(input.elapsedSeconds,0,86400*365);
  const fallbackCycles=elapsed*breathsPerMinute/60;
  const rawCycles=Number.isFinite(input.phaseCycles)?input.phaseCycles!:fallbackCycles;
  const normalizedCycles=((rawCycles%1)+1)%1;
  const breathPhase=normalizedCycles*Math.PI*2;
  const inhale=Math.max(0,Math.sin(breathPhase));
  const activity=input.awake?.72:.38;
  const sway=activity*(.35+uncertainty*.65);
  const slowSway=Math.sin(elapsed*.47+uncertainty*.8);
  return {
    breathsPerMinute,
    breathPhase,
    torsoScaleY:1+inhale*(.004+energy*.004),
    verticalOffset:Math.sin(breathPhase)*(.0025+energy*.003)+slowSway*.0025*sway,
    weightShift:slowSway*.006*sway,
    shoulderLift:inhale*(.003+energy*.004)*(1-load*.25),
    headSway:Math.sin(elapsed*.71+uncertainty)*(.0035+.004*sway),
    armBreath:Math.sin(breathPhase)*(.004+.003*activity),
  };
}
