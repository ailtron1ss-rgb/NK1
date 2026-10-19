import { interruptTermuxTts } from '../src/organism/body/AndroidEmbodimentBridge.ts';
if (interruptTermuxTts() !== false) throw new Error('expected no active TTS process at test start');
console.log('VOICE_INTERRUPTION=PASS idle-safe');
