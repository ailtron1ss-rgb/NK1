/**
 * Open-LLM-VTuber-style interrupt: stop TTS + cancel voice loop speaking state.
 */
import { voiceConversation } from './voiceConversation';
import { ttsEngine } from './ttsEngine';

export function interruptSpeech() {
  try {
    ttsEngine.stop?.();
  } catch {
    /* */
  }
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* */
  }
  try {
    voiceConversation.notifySpeakingEnd();
  } catch {
    /* */
  }
}
