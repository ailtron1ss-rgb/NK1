import assert from 'node:assert/strict';
import { B299CausalPersonalityDevelopmentLoop } from '../src/organism/system/B299CausalPersonalityDevelopmentLoop.ts';

const loop = new B299CausalPersonalityDevelopmentLoop();
const context={epistemic:.82,autonomy:.25,social:.08,maintenance:.04};

// Establish a repeated, accurate pre-action prediction for verify.
for(let i=0;i<8;i++){
  const pred=loop.predictOutcome('verify',context);
  assert.ok(pred.confidence01>=0);
  loop.observeOutcome({tick:i,action:'verify',reward01:pred.expectedReward01,predictionError01:.08,causalConfidence01:.88,identityContinuity01:.86,externalEvidence01:.90,worldTransition:true,independent:true,autonomous:true,predictedUtility01:.7,context});
}
const calibrated=loop.predictOutcome('verify',context);
assert.ok(calibrated.calibrationCount>=8);
assert.ok(calibrated.calibrationErrorEMA01<.18,JSON.stringify(calibrated));
const beforeMismatch=calibrated.confidence01;

// Deliberate prediction mismatch must lower calibration quality / confidence.
for(let i=0;i<8;i++){
  loop.observeOutcome({tick:20+i,action:'verify',reward01:.12,predictionError01:.75,causalConfidence01:.72,identityContinuity01:.82,externalEvidence01:.82,worldTransition:true,independent:true,autonomous:true,predictedUtility01:.7,context});
}
const mismatched=loop.predictOutcome('verify',context);
assert.ok(mismatched.calibrationErrorEMA01>calibrated.calibrationErrorEMA01,JSON.stringify({calibrated,mismatched}));
assert.ok(mismatched.confidence01 < 0.90,JSON.stringify({beforeMismatch,mismatched}));
assert.ok(Math.abs(mismatched.calibrationBias11)>0.02);

// An accurate action should recover its confidence through subsequent matching outcomes.
for(let i=0;i<12;i++){
  const pred=loop.predictOutcome('verify',context);
  loop.observeOutcome({tick:50+i,action:'verify',reward01:.18,predictionError01:.10,causalConfidence01:.90,identityContinuity01:.88,externalEvidence01:.92,worldTransition:true,independent:true,autonomous:true,predictedUtility01:.7,context});
}
const recovered=loop.predictOutcome('verify',context);
assert.ok(recovered.calibrationErrorEMA01<mismatched.calibrationErrorEMA01);
console.log('B347_PREDICTIVE_CALIBRATION=PASS',JSON.stringify({beforeMismatch:Number(beforeMismatch.toFixed(4)),goodError:Number(calibrated.calibrationErrorEMA01.toFixed(4)),badError:Number(mismatched.calibrationErrorEMA01.toFixed(4)),recoveredError:Number(recovered.calibrationErrorEMA01.toFixed(4)),badConfidence:Number(mismatched.confidence01.toFixed(4)),recoveredConfidence:Number(recovered.confidence01.toFixed(4))}));
