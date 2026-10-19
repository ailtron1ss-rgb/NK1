import assert from 'node:assert/strict';
import { P47TemporalMemoryMind, defaultP47State } from '../src/organism/developmental/P47TemporalMemoryMind.ts';
const m = new P47TemporalMemoryMind();
m.restore(defaultP47State());
m.ingest([
  { id:'e1', tick:1, at:1000, type:'world-transition', payload:{summary:'device stable', importance:.5} },
  { id:'e2', tick:2, at:1100, type:'experiment', payload:{claim:'device stable', uncertainty:.1} },
  { id:'e3', tick:3, at:1200, type:'experiment', payload:{claim:'device not stable', uncertainty:.2} },
]);
const s1=m.snapshot(); assert.equal(s1.ingestedEvents,3); assert.ok(s1.nodes>=3); assert.ok(s1.beliefs>=1);
const r=m.reflect(5000); assert.ok(r.openContradictions>=0); assert.ok(r.compacted>=0); assert.ok(m.snapshot().nodes<=220);
m.ingest([{ id:'e2', tick:2, at:1100, type:'experiment', payload:{claim:'device stable'} }]); assert.equal(m.snapshot().ingestedEvents,3);
console.log('P47 TEMPORAL MEMORY PASS');
