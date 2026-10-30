export type FacialEmotion = "curiosity" | "calm" | "joy" | "anxiety" | "frustration" | "sadness" | "anger" | "protective";

export interface FacialMicrochannelsInput { emotion: FacialEmotion; valence: number; arousal: number; dominance: number; expressionIntensity: number; }
export interface FacialMicrochannels {
  /** Cubism parameters verified in Kurisu.cdi3.json. Values are normalized. */
  eyeSmile: number; browLeftY: number; browRightY: number; browLeftForm: number; browRightForm: number;
  cheek: number; mouthTension: number; blinkBias: number;
  /** Temporal micro-motor targets; milliseconds except saccadeAmplitude. */
  blinkIntervalMs: number; blinkDurationMs: number; saccadeIntervalMs: number; saccadeAmplitude: number;
}
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,Number.isFinite(n)?n:min));
/** Renderer-neutral facial intent. Computes expressive targets only; it never owns emotion, speech visemes, motor goals, or clips. */
export function deriveFacialMicrochannels(input:FacialMicrochannelsInput):FacialMicrochannels {
  const v=clamp(input.valence,0,1),a=clamp(input.arousal,0,1),d=clamp(input.dominance,0,1),i=clamp(input.expressionIntensity,0,1);
  const positive=v-.5,control=d-.5;
  const smile=input.emotion==="joy" ? .72 : input.emotion==="protective" ? .16 : input.emotion==="calm" ? .08 : 0;
  const strain=input.emotion==="anger"||input.emotion==="frustration" ? .62 : input.emotion==="anxiety" ? .28 : 0;
  const sadness=input.emotion==="sadness" ? .48 : input.emotion==="anxiety" ? .18 : 0;
  const surprise=input.emotion==="curiosity" ? .18 : 0;
  const alertness=input.emotion==="curiosity"||input.emotion==="anxiety"||input.emotion==="anger"||input.emotion==="frustration";
  return {
    eyeSmile:clamp(smile*i,0,.8),
    browLeftY:clamp(surprise*.42+sadness*.32-strain*.28+positive*.12,-.45,.45),
    browRightY:clamp(surprise*.42+sadness*.32-strain*.28+positive*.12,-.45,.45),
    browLeftForm:clamp(strain*.42-sadness*.18+control*.12,-.5,.5),
    browRightForm:clamp(strain*.42-sadness*.18+control*.12,-.5,.5),
    cheek:clamp((input.emotion==="joy" ? .22 : input.emotion==="protective" ? .08 : 0)+Math.max(0,positive)*.12,0,.38),
    mouthTension:clamp(strain*.5+(0.5-d)*.12-Math.max(0,positive)*.1,0,.55),
    blinkBias:clamp((input.emotion==="anxiety"?.16:input.emotion==="sadness"?.1:0)+(a-.5)*.08,-.08,.2),
    // Deterministic context targets: alert/high-arousal states move more quickly.
    blinkIntervalMs:clamp(8800-a*1900-(alertness?650:0)+(input.emotion==="sadness" ? 550 : 0),4200,10500),
    blinkDurationMs:clamp(105+a*24+(input.emotion==="sadness" ? 12 : 0),90,145),
    saccadeIntervalMs:clamp(3100-a*1250-(input.emotion==="curiosity"?350:0),1100,4200),
    saccadeAmplitude:clamp(.095+a*.105+(input.emotion==="curiosity" ? .035 : 0),.06,.25),
  };
}
