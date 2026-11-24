import assert from 'node:assert/strict';
import { P43EmbodiedImageryWorkspace } from '../src/organism/cognition/P43EmbodiedImageryWorkspace.ts';
const p=new P43EmbodiedImageryWorkspace();
const s=p.integrate({at:1,scene:'lab',selfLocation:'phone',objects:['desk','screen'],relations:['self:near:desk'],memoryLabels:['previous lab session'],predictionLabels:['lab:verify'],goal:'learn why the screen changed'});
assert.equal(s.scene.label,'lab'); assert.ok(s.activeContents.length>=2); assert.equal(s.imagined.length,7); assert.ok(s.metrics.workspaceUse01>0); assert.ok(s.metrics.selfGrounding01>0); assert.ok(s.imagined.some(x=>x.action==='explore'));
console.log('P43_MENTAL_SCENE=PASS',JSON.stringify({contents:s.activeContents.length,imagined:s.imagined.length,workspace:s.metrics.workspaceUse01.toFixed(3)}));
