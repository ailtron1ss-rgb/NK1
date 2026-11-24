import assert from 'node:assert/strict';
import { DecisionActionPipeline } from '../src/organism/core/DecisionActionPipeline.ts';

const pipe = new DecisionActionPipeline();
const candidates = [
  {id:'a',action:'verify',score:.602,predictedUtility:.60,confidence01:.7,generatedAt:1},
  {id:'b',action:'explore',score:.600,predictedUtility:.60,confidence01:.7,generatedAt:1},
];
const learned = [
  {action:'verify',expectedReward01:.46,confidence01:.90,samples:12},
  {action:'explore',expectedReward01:.72,confidence01:.90,samples:12},
];
const out = pipe.rank(candidates, [], learned);
assert.equal(out.candidates[0].action,'explore');
assert(out.rehearsal.find(x=>x.action==='explore')?.adjustment > 0);
assert(out.rehearsal.find(x=>x.action==='verify')?.adjustment < 0);
console.log('B345_LEARNED_CONSEQUENCE_REHEARSAL=PASS', JSON.stringify({top:out.candidates[0].action,rehearsal:out.rehearsal}));
