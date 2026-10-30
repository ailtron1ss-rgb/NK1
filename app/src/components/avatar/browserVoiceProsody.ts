export type BrowserVoiceEmotion = "curiosity" | "calm" | "joy" | "anxiety" | "frustration" | "sadness" | "anger" | "protective";
export interface BrowserVoiceProsodyInput {
  text: string;
  emotion: BrowserVoiceEmotion | string;
  action: string;
  arousal: number;
  valence: number;
  cognitiveLoad: number;
  uncertainty: number;
  socialNeed: number;
}
export interface BrowserVoiceProsody {
  language: string;
  pitch: number;
  rate: number;
  volume: number;
  emphasis01: number;
  reason: string[];
}
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,Number.isFinite(value)?value:min));
const unit=(value:number)=>clamp(value,0,1);
export function inferBrowserVoiceLanguage(text:string):string {
  const value=String(text??"");
  const cyrillic=(value.match(/[А-Яа-яЁё]/gu)??[]).length;
  const latin=(value.match(/[A-Za-z]/gu)??[]).length;
  return latin>cyrillic?"en-US":"ru-RU";
}
/**
 * Bounded affect-to-prosody mapping for the native browser TTS path.
 * This deliberately uses small changes: emotion colours delivery without
 * overpowering intelligibility or turning negative arousal into aggression.
 */
export function buildBrowserVoiceProsody(input:BrowserVoiceProsodyInput):BrowserVoiceProsody {
  const emotion=String(input.emotion??"calm").toLowerCase();
  const action=String(input.action??"wait").toLowerCase();
  const arousal=unit(input.arousal),valence=unit(input.valence);
  const load=unit(input.cognitiveLoad),uncertainty=unit(input.uncertainty),social=unit(input.socialNeed);
  const text=String(input.text??"").trim();
  let pitch=1,rate=.96,volume=.92,emphasis=.25;
  const reason:string[]=[];
  if(action==="respond"){pitch+=.01;emphasis+=.04;reason.push("response");}
  if(action==="reflect"||action==="verify"){pitch-=.015;rate-=.025;reason.push("cognitive-focus");}
  if(action==="explore"){pitch+=.008;rate+=.012;reason.push("exploration");}
  if(action==="rest"){rate-=.055;volume-=.04;reason.push("rest");}
  if(emotion==="joy"){pitch+=.035;rate+=.025;emphasis+=.12;reason.push("joy");}
  else if(emotion==="curiosity"){pitch+=.018;emphasis+=.08;reason.push("curiosity");}
  else if(emotion==="sadness"){pitch-=.025;rate-=.035;volume-=.025;reason.push("sadness");}
  else if(emotion==="anxiety"){rate-=.035;volume-=.035;emphasis-=.035;reason.push("anxiety-regulation");}
  else if(emotion==="frustration"||emotion==="anger"){pitch-=.018;rate-=.018;emphasis-=.025;reason.push("negative-affect-regulation");}
  else if(emotion==="protective"){rate-=.012;emphasis+=.025;reason.push("protective");}
  if(load>.72){rate-=.045;reason.push("high-cognitive-load");}
  if(uncertainty>.65){rate-=.025;emphasis+=.025;reason.push("uncertainty");}
  if(social>.68){rate-=.02;emphasis+=.04;reason.push("social-need");}
  if(arousal>=.78){emphasis+=.025;reason.push("high-arousal");}
  else if(arousal<=.2){rate-=.012;volume-=.012;reason.push("low-arousal");}
  if(valence>=.68){pitch+=.008;emphasis+=.02;reason.push("positive-valence");}
  else if(valence<=.32){rate-=.012;reason.push("negative-valence");}
  if(/[!?！？]{2,}/u.test(text)){emphasis+=.035;reason.push("punctuation-emphasis");}
  return {
    language:inferBrowserVoiceLanguage(text),
    pitch:clamp(pitch,.82,1.18),
    rate:clamp(rate,.78,1.16),
    volume:clamp(volume,.55,1),
    emphasis01:unit(emphasis),
    reason,
  };
}
