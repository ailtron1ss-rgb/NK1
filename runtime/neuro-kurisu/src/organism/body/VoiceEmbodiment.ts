import type { ActionKind, OrganismNeeds } from '../core/types.ts';
import type { OrganismBodyState } from './EmbodiedBody.ts';

export type VoiceBreathMode = 'ping'|'talk'|'lecture'|'confess'|'argue';
export type VoiceTone = 'neutral'|'warm'|'focused'|'playful'|'hostile'|'reflective'|'tender';

export interface VoiceProsody {
  pitch: number;
  rate: number;
  volume: number;
  pauseMs: number;
  emphasis01: number;
}

export interface VoicePlan {
  mode: VoiceBreathMode;
  tone: VoiceTone;
  prosody: VoiceProsody;
  language: string;
  stream: string;
  reason: string[];
}

const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const clampRange=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,Number.isFinite(n)?n:lo));

/** Match the two-language heuristic already used by browser-side speech. */
export function inferVoiceLanguage(text:string): string {
  const value=String(text??'');
  const cyrillic=(value.match(/[А-Яа-яЁё]/gu)??[]).length;
  const latin=(value.match(/[A-Za-z]/gu)??[]).length;
  return latin>cyrillic?'en-US':'ru-RU';
}

export function detectVoiceBreathMode(text:string): VoiceBreathMode {
  const t=String(text||'').trim().toLowerCase();
  if ((/^(привет|хай|йо|ку|здравствуй|доброе утро|добрый вечер)(?:$|[\\s,!.?])/u.test(t)
      || /^(hi|hello|hey|yo|good morning|good evening)(?:$|[\s,!.?])/iu.test(t)) && t.length<64) return 'ping';
  if (/(кто ты|ты жива|ты жив|ты настоящ|что ты такое|самосознан|сознани)/u.test(t)
      || /\b(who are you|are you alive|what are you|self-aware|consciousness)\b/iu.test(t)) return 'confess';
  if (/(почему|объясни|разбери|как работает|докажи|сравни|теори|исследован|подробно)/u.test(t)
      || /\b(why|explain|analy[sz]e|how does|prove|compare|theory|research|in detail)\b/iu.test(t)
      || t.length>240) return 'lecture';
  if (/(не прав|не права|спор|возраж|критик|глуп|ошиб|не соглас)/u.test(t)
      || /\b(disagree|object|argue|criticize|criticise|wrong|mistake|ridiculous)\b/iu.test(t)) return 'argue';
  return 'talk';
}

export function buildVoicePlan(input:{text:string;action?:ActionKind|string|null;mode?:string|null;needs:OrganismNeeds;body:OrganismBodyState;continuity01?:number;grounding01?:number;uncertainty01?:number;emotion?:{label?:string;valence01?:number;arousal01?:number;dominance01?:number};}): VoicePlan {
  const {text,action,mode,needs,body}=input;
  const breath=detectVoiceBreathMode(text);
  const continuity=clamp(input.continuity01??.7);
  const grounding=clamp(input.grounding01??.7);
  const uncertainty=clamp(input.uncertainty01??needs.uncertainty);
  const emotionLabel=String(input.emotion?.label??'').trim().toLocaleLowerCase();
  const valence=clamp(input.emotion?.valence01??.5);
  const arousal=clamp(input.emotion?.arousal01??.22);
  const reason:string[]=[];

  let tone:VoiceTone='neutral';
  if(action==='respond') tone='warm';
  if(action==='reflect'||mode==='reflect') tone='reflective';
  if(action==='verify'||action==='explore'||mode==='learn') tone='focused';
  if(action==='rest'||mode==='rest') tone='tender';
  // Appraisal may tune delivery, but high-arousal negative states never become
  // an instruction to escalate into hostile speech.
  if(emotionLabel==='joy') tone='playful';
  else if(emotionLabel==='curiosity'||emotionLabel==='anxiety'||emotionLabel==='frustration'||emotionLabel==='anger'||emotionLabel==='protective') tone='focused';
  else if(emotionLabel==='sadness') tone='tender';
  if(breath==='argue') tone='focused';
  if(breath==='confess') tone='reflective';

  let pitch=1;
  let rate=1;
  let volume=.92;
  let pauseMs=90;
  let emphasis=.25;

  if(tone==='warm'||tone==='tender'){ pitch+=.025; rate-=.035; emphasis+=.10; }
  if(tone==='focused'){ pitch-=.025; rate+=.015; emphasis+=.14; }
  if(tone==='reflective'){ pitch-=.015; rate-=.05; emphasis+=.08; }
  if(needs.cognitiveLoad>.72){ rate-=.055; pauseMs+=70; reason.push('high-cognitive-load'); }
  if(needs.uncertainty>.65){ rate-=.02; pauseMs+=40; emphasis+=.05; reason.push('high-uncertainty'); }
  if(needs.socialNeed>.68){ rate-=.025; emphasis+=.06; reason.push('social-need'); }
  if(body.thermalStrain01>.7){ rate-=.045; volume-=.04; reason.push('thermal-load'); }
  if(body.cognitiveCapacity01<.45){ rate-=.05; pauseMs+=45; reason.push('low-capacity'); }
  if(body.circadian01<.4){ rate-=.035; volume-=.03; reason.push('circadian-rest'); }
  if(grounding<.45){ emphasis-=.04; reason.push('low-grounding'); }
  if(continuity<.5){ pauseMs+=30; reason.push('continuity-uncertainty'); }

  switch(breath){
    case 'ping': rate+=.04; pauseMs=65; emphasis+=.04; reason.push('ping-breath'); break;
    case 'lecture': rate-=.025; pauseMs+=35; emphasis+=.08; reason.push('lecture-breath'); break;
    case 'confess': rate-=.045; pauseMs+=55; emphasis+=.10; reason.push('confess-breath'); break;
    case 'argue': rate+=.02; pitch-=.02; emphasis+=.10; reason.push('argue-breath'); break;
    default: reason.push('talk-breath');
  }

  if(action==='explore') { pitch+=.012; rate+=.018; }
  if(action==='verify') { pitch-=.012; rate-=.008; }
  if(action==='rest') { rate-=.05; volume-=.04; }
  if(uncertainty>.8){ rate-=.02; pauseMs+=25; }

  if(emotionLabel==='joy'){ pitch+=.012; rate+=.012; emphasis+=.035; reason.push('affect-joy'); }
  else if(emotionLabel==='curiosity'){ pitch+=.006; emphasis+=.035; reason.push('affect-curiosity'); }
  else if(emotionLabel==='anxiety'){ rate-=.025; pauseMs+=25; emphasis-=.025; reason.push('affect-anxiety-deescalation'); }
  else if(emotionLabel==='sadness'){ pitch-=.018; rate-=.028; pauseMs+=20; reason.push('affect-sadness'); }
  else if(emotionLabel==='frustration'||emotionLabel==='anger'){ pitch-=.012; pauseMs+=15; reason.push('affect-regulation'); }
  else if(emotionLabel==='protective'){ rate-=.012; reason.push('affect-protective'); }
  if(valence>=.68){ pitch+=.006; emphasis+=.015; reason.push('positive-valence'); }
  else if(valence<=.32){ rate-=.012; pauseMs+=10; reason.push('negative-valence'); }
  if(arousal>=.78){ emphasis+=.025; reason.push('high-arousal'); }
  else if(arousal<=.20){ rate-=.01; volume-=.01; reason.push('low-arousal'); }

  const safePitch=clampRange(pitch,.72,1.28);
  const safeRate=clampRange(rate,.72,1.25);
  const safeVolume=clampRange(volume,.4,1);
  const safePause=Math.round(clampRange(pauseMs,55,450));
  return {
    mode:breath,
    tone,
    prosody:{pitch:safePitch,rate:safeRate,volume:safeVolume,pauseMs:safePause,emphasis01:clamp(emphasis)},
    language:inferVoiceLanguage(text),
    stream:'MUSIC',
    reason,
  };
}

export interface VoiceRuntimeState { version:1; speaking:boolean; listening:boolean; lastMode:VoiceBreathMode|null; lastTone:VoiceTone|null; lastProsody:VoiceProsody|null; utteranceCount:number; listenCount:number; interruptionCount:number; lastAt:number; lastError:string|null; }
export const defaultVoiceRuntimeState=():VoiceRuntimeState=>({version:1,speaking:false,listening:false,lastMode:null,lastTone:null,lastProsody:null,utteranceCount:0,listenCount:0,interruptionCount:0,lastAt:0,lastError:null});
