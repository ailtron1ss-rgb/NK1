import type { EmotionState, OrganismSnapshot } from "@/organism/types";

const NEUTRAL: EmotionState = {
  label:"calm",valence:.5,arousal:.22,dominance:.5,tendency:"engage",cause:"stale-affect-frame",
};
export function resolvePresentationEmotion(snapshot:Pick<OrganismSnapshot,"tick"|"emotion"|"affectFrame">,now=Date.now()):EmotionState {
  const frame=snapshot.affectFrame;
  if(!frame)return snapshot.emotion;
  const age=now-frame.sampledAt,expected=Math.max(0,1-Math.max(0,age)/30_000);
  if(!Number.isSafeInteger(frame.stateVersion)||frame.stateVersion!==snapshot.tick||!Number.isFinite(now)||
    !Number.isFinite(frame.sampledAt)||age< -250||age>30_000||!Number.isFinite(frame.freshness01)||
    frame.freshness01<=0||frame.freshness01>expected+.1)return {...NEUTRAL};
  const mood=frame.mood, moodAge=mood?now-mood.sampledAt:Infinity;
  const moodExpected=mood?Math.exp(-Math.max(0,moodAge)/(24*60*60_000)):0;
  const moodValid=Boolean(mood&&mood.schemaVersion===1&&moodAge>=-250&&moodAge<=7*24*60*60_000&&
    Number.isFinite(mood.ageMs)&&Math.abs(mood.ageMs-Math.max(0,moodAge))<=5_000&&
    Number.isFinite(mood.freshness01)&&Math.abs(mood.freshness01-moodExpected)<=.08&&
    [mood.valence01,mood.arousal01,mood.stress01,mood.socialSafety01,mood.deviation01,mood.recoveryRate01,mood.resilience01,mood.resilienceConfidence01].every(v=>Number.isFinite(v)&&v>=0&&v<=1));
  const weight=moodValid?mood!.freshness01*.18*(.6+.4*mood!.resilienceConfidence01):0;
  const mix=(a:number,b:number,w:number)=>a+(b-a)*w;
  return {label:frame.label,valence:mix(frame.valence01,moodValid?mood!.valence01:frame.valence01,weight),
    arousal:mix(frame.arousal01,moodValid?mood!.arousal01:frame.arousal01,weight*.65),
    dominance:frame.dominance01,tendency:frame.actionTendency,cause:frame.cause};
}
