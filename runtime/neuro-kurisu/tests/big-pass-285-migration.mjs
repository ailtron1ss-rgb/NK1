import assert from 'node:assert/strict';
import { B285NeuralLifeConsolidationCore } from '../src/organism/cognition/B285NeuralLifeConsolidationCore.ts';
const core=new B285NeuralLifeConsolidationCore();
for(let t=1;t<=80;t++) core.step({tick:t,selfLatent:new Array(24).fill(Math.sin(t*.1)),worldLatent:new Array(16).fill(Math.cos(t*.07)),goalVector:new Array(8).fill(Math.sin(t*.08)),memoryLatent:new Array(16).fill(Math.cos(t*.05)),relationshipVector:new Array(24).fill(.1),relationshipId:'migration-test',reward01:.72,predictionError01:.12,agency01:.8});
const before=core.snapshot();
const restored=new B285NeuralLifeConsolidationCore(); restored.restore(before);
assert.deepEqual(restored.snapshot(),before);
console.log(JSON.stringify({pass:true,steps:restored.diagnostics().steps,chapters:restored.diagnostics().chapterCount,relationships:restored.diagnostics().relationshipCount}));
