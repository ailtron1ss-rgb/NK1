import assert from 'node:assert/strict';
import { GeminiVisionSemanticBackend } from '../src/organism/body/GeminiVisionSemanticBackend.ts';
const b=new GeminiVisionSemanticBackend({apiKey:'test-key',model:'gemini-3.8-flash'});
assert.equal(b.id,'gemini-vision:gemini-3.8-flash');
console.log('VISION_BACKEND_CONTRACT=PASS opt-in backend contract is explicit and model-configurable');
