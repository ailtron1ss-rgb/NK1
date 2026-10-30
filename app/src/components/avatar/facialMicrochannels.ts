export interface FacialMicrochannelsInput {
  emotion: "curiosity" | "calm" | "joy" | "anxiety" | "frustration" | "sadness" | "anger" | "protective";
  valence: number;
  arousal: number;
  dominance: number;
  expressionIntensity: number;
}
export interface FacialMicrochannels {
  /** Cubism parameters verified in Kurisu.cdi3.json. All values are normalized. */
  eyeSmile: number;
  browLeftY: number;
  browRightY: number;
  browLeftForm: number;
  browRightForm: number;
  cheek: number;
  mouthTension: number;
  blinkBias: number;
}
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,Number.isFinite(n)?n:min));
/**
 * Renderer-neutral facial intent. This adapter only computes expressive targets;
 * it never owns emotion, speech visemes, motor goals, or animation clips.
 */
export function deriveFacialMicrochannels(input:FacialMicrochannelsInput):FacialMicrochannels {
  const v=clamp(input.valence,0,1),a=clamp(input.arousal,0,1),d=clamp(input.dominance,0,1),i=clamp(input.expressionIntensity,0,1);
  const positive=v-.5,control=d-.5;
  const smile= input.emotion==="joy" ? .72 : input.emotion==="protective" ? .16 : input.emotion==="calm" ? .08 : 0;
  const strain=input.emotion==="anger"||input.emotion==="frustration" ? .62 : input.emotion==="anxiety" ? .28 : 0;
  const sadness=input.emotion==="sadness" ? .48 : input.emotion==="anxiety" ? .18 : 0;
  const surprise=input.emotion==="curiosity" ? .18 : 0;
  return {
    eyeSmile:clamp(smile*i,0,0.8),
    browLeftY:clamp(surprise*.42+sadness*.32-strain*.28+(positive*.12),-0.45,0.45),
    browRightY:clamp(surprise*.42+sadness*.32-strain*.28+(positive*.12),-0.45,0.45),
    browLeftForm:clamp(strain*.42-sadness*.18+control*.12,-0.5,0.5),
    browRightForm:clamp(strain*.42-sadness*.18+control*.12,-0.5,0.5),
    cheek:clamp((input.emotion==="joy"?.22:input.emotion==="protective"?.08:0)+Math.max(0,positive)*.12,0,0.38),
    mouthTension:clamp(strain*.5+(0.5-d)*.12-Math.max(0,positive)*.1,0,0.55),
    blinkBias:clamp((input.emotion==="anxiety"?.16:input.emotion==="sadness"?.1:0)+(a-.5)*.08,-0.08,0.2),
  };
}
