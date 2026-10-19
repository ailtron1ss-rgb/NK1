import assert from 'node:assert/strict';
import { P29LearningGovernanceEngine, defaultP29Governance } from '../src/organism/learning/P29LearningGovernance.ts';

const g=new P29LearningGovernanceEngine();
g.restore(defaultP29Governance());
let r=g.arbitrate([
  {source:'p26-policy',bias:.08,confidence01:.9,cost01:.2},
  {source:'p27-world',bias:.05,confidence01:.8,cost01:.25},
  {source:'p28-plasticity',bias:-.015,confidence01:.6,cost01:.1},
],.9,.12);
assert.equal(r.accepted,true);
assert.ok(Math.abs(r.netBias)>.0005);
g.recordOutcome('p26-policy',.8,.2,.3,true);
g.recordProvenance('learning-arbitration','explore','accepted with dominant source',['trace-1'],g.sourceTrust('p26-policy'),.3,true);
g.recordContinualTask('task-a',.9);
g.recordContinualTask('task-b',.8);
g.recordContinualTask('task-a',.7);
assert.ok(g.snapshot().resourceBudget.spent01>0);
assert.ok(g.snapshot().continual.forgetting01>0);
assert.equal(g.snapshot().provenance.length,1);
console.log('P29_LEARNING_GOVERNANCE=PASS accepted=true forgetting>0 provenance=1');
