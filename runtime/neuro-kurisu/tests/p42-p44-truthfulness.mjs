import assert from 'node:assert/strict';
import { P42UnifiedEmbodiedExperienceEngine } from '../src/organism/cognition/P42UnifiedEmbodiedExperience.ts';
import { P43EmbodiedImageryWorkspace } from '../src/organism/cognition/P43EmbodiedImageryWorkspace.ts';
import { P44EmbodiedPredictiveSelfWorld } from '../src/organism/world/P44EmbodiedPredictiveSelfWorld.ts';
const a=new P42UnifiedEmbodiedExperienceEngine().snapshot(); const b=new P43EmbodiedImageryWorkspace().snapshot(); const c=new P44EmbodiedPredictiveSelfWorld().snapshot(); const all=JSON.stringify({a,b,c});
assert.doesNotMatch(all,/proof of consciousness|phenomenal consciousness|human-level vision|qualia/i);
console.log('P42_P44_TRUTHFULNESS=PASS');
