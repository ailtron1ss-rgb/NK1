import type { VoiceBreathMode, VoiceTone, VoiceProsody } from '../contracts/VoicePlan.ts';

export { buildVoicePlan, detectVoiceBreathMode, inferVoiceLanguage } from '../contracts/VoicePlan.ts';
export type {
  VoiceBreathMode,
  VoiceTone,
  VoiceProsody,
  VoicePlan,
  VoicePlanInput,
  VoicePlanNeeds,
  VoicePlanBody,
} from '../contracts/VoicePlan.ts';

export interface VoiceRuntimeState { version:1; speaking:boolean; listening:boolean; lastMode:VoiceBreathMode|null; lastTone:VoiceTone|null; lastProsody:VoiceProsody|null; utteranceCount:number; listenCount:number; interruptionCount:number; lastAt:number; lastError:string|null; }
export const defaultVoiceRuntimeState=():VoiceRuntimeState=>({version:1,speaking:false,listening:false,lastMode:null,lastTone:null,lastProsody:null,utteranceCount:0,listenCount:0,interruptionCount:0,lastAt:0,lastError:null});
