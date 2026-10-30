export type AffectiveBodyEmotion = "curiosity" | "calm" | "joy" | "anxiety" | "frustration" | "sadness" | "anger" | "protective";
export type AffectiveBodyAction = "respond" | "explore" | "verify" | "rest" | "reflect" | "wait";
export interface AffectiveBodyLanguageInput {
  emotion: AffectiveBodyEmotion; valence: number; arousal: number; dominance: number; energy: number;
  cognitiveLoad: number; uncertainty: number; socialNeed: number; guardedness: number; composure: number;
  action: AffectiveBodyAction; speaking: boolean; thinking: boolean; awake: boolean;
}
export interface AffectiveBodyLanguage {
  torsoLean: number; torsoRoll: number; weightShift: number; shoulderTension: number; armOpenness: number;
  gestureAmplitude: number; movementTempo: number; stillness: number; postureStability: number;
  headTiltBias: number; gazeEngagement: number;
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
const EMOTION = {
 curiosity:{lean:.014,roll:-.006,open:.08,tension:.02,gesture:.13,still:-.04,tempo:.08,head:-.018,gaze:.10},
 calm:{lean:0,roll:0,open:.04,tension:-.05,gesture:-.04,still:.08,tempo:-.08,head:0,gaze:.04},
 joy:{lean:.01,roll:.004,open:.18,tension:-.08,gesture:.20,still:-.12,tempo:.12,head:.008,gaze:.13},
 anxiety:{lean:-.012,roll:-.008,open:-.18,tension:.22,gesture:-.04,still:.12,tempo:.04,head:-.008,gaze:-.12},
 frustration:{lean:.006,roll:.01,open:-.12,tension:.24,gesture:.10,still:-.03,tempo:.08,head:.01,gaze:.02},
 sadness:{lean:-.02,roll:-.004,open:-.20,tension:.10,gesture:-.14,still:.20,tempo:-.16,head:.018,gaze:-.16},
 anger:{lean:.012,roll:.012,open:-.22,tension:.30,gesture:.16,still:-.08,tempo:.14,head:.008,gaze:.08},
 protective:{lean:.006,roll:0,open:.02,tension:.04,gesture:.05,still:.02,tempo:0,head:-.006,gaze:.16}
} as const;
const ACTION = {
 respond:{lean:.004,gesture:.16,tempo:.06,gaze:.12}, explore:{lean:.014,gesture:.08,tempo:.10,gaze:.08},
 verify:{lean:.018,gesture:-.04,tempo:-.04,gaze:.04}, rest:{lean:-.01,gesture:-.12,tempo:-.18,gaze:-.08},
 reflect:{lean:.01,gesture:-.06,tempo:-.08,gaze:-.04}, wait:{lean:0,gesture:-.10,tempo:-.12,gaze:-.02}
} as const;
const KEYS = ["torsoLean","torsoRoll","weightShift","shoulderTension","armOpenness","gestureAmplitude","movementTempo","stillness","postureStability","headTiltBias","gazeEngagement"] as const;
const RANGE: Record<typeof KEYS[number], [number,number]> = {
 torsoLean:[-.08,.08],torsoRoll:[-.05,.05],weightShift:[-.025,.025],shoulderTension:[0,1],armOpenness:[0,1],
 gestureAmplitude:[0,1],movementTempo:[.55,1.4],stillness:[0,1],postureStability:[0,1],headTiltBias:[-.08,.08],gazeEngagement:[0,1]
};
/** Continuous renderer-neutral biases. This adapter never selects actions or launches gestures. */
export function deriveAffectiveBodyLanguage(i: AffectiveBodyLanguageInput): AffectiveBodyLanguage {
 const emotion = Object.hasOwn(EMOTION, i.emotion) ? i.emotion : "calm";
 const action = Object.hasOwn(ACTION, i.action) ? i.action : "wait";
 const e = EMOTION[emotion], a = ACTION[action];
 const v=clamp(i.valence,0,1), ar=clamp(i.arousal,0,1), d=clamp(i.dominance,0,1), en=clamp(i.energy,0,1);
 const load=clamp(i.cognitiveLoad,0,1), u=clamp(i.uncertainty,0,1), social=clamp(i.socialNeed,0,1);
 const guard=clamp(i.guardedness,0,1), comp=clamp(i.composure,0,1), awake=Number(i.awake), speak=Number(i.speaking), think=Number(i.thinking);
 const fatigue=1-en, shoulderTension=clamp(guard*.42+load*.20+u*.12+e.tension-comp*.13,0,1);
 const openness=clamp(.5+social*.13+d*.08+e.open-guard*.34-fatigue*.1,0,1);
 const stillness=clamp(.18+(1-ar)*.23+fatigue*.17+load*.12+(1-awake)*.48+e.still-speak*.1-think*.025,0,1);
 const stability=clamp(.48+d*.15+comp*.24-u*.18-load*.1-shoulderTension*.06+fatigue*.04,0,1);
 return {
  torsoLean:clamp(a.lean+e.lean+(.5-v)*.012+(ar-.5)*.006,-.08,.08),
  torsoRoll:clamp(e.roll+(d-.5)*.018+(.5-v)*.008,-.05,.05),
  weightShift:clamp((u-.5)*.025+(.5-stability)*.018,-.025,.025),
  shoulderTension, armOpenness:openness,
  gestureAmplitude:clamp((ar*.28+a.gesture+social*speak*.1+e.gesture+(1-guard)*.04)*awake*(.58+en*.42)*(1-stillness*.42),0,1),
  movementTempo:clamp(.78+ar*.42+en*.16-load*.11-u*.06+a.tempo+e.tempo,.55,1.4),
  stillness, postureStability:stability,
  headTiltBias:clamp(e.head+(.5-d)*.025+(.5-v)*.012,-.08,.08),
  gazeEngagement:clamp(.38+social*.22+speak*.1+d*.08+e.gaze+a.gaze-guard*.22-(1-awake)*.55,0,1)
 };
}
/** Frame-rate independent smoothing for renderer cues, not semantic motor goals. */
export function smoothAffectiveBodyLanguage(previous:AffectiveBodyLanguage|null,next:AffectiveBodyLanguage,deltaMs:number):AffectiveBodyLanguage {
 if(!previous||!Number.isFinite(deltaMs)||deltaMs<=0) return {...next};
 const dt=clamp(deltaMs,0,1000), out={} as AffectiveBodyLanguage;
 for(const key of KEYS) {
  const [lo,hi]=RANGE[key], from=clamp(previous[key],lo,hi), to=clamp(next[key],lo,hi);
  const tau=Math.abs(to)>Math.abs(from)?95:175, alpha=1-Math.exp(-dt/tau);
  out[key]=clamp(from+(to-from)*alpha,lo,hi);
 }
 return out;
}
