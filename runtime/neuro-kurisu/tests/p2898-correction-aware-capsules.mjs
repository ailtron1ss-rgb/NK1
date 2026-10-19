import assert from 'node:assert/strict';
import { TemporalMemoryCompressor } from '../src/organism/developmental/TemporalMemoryCompressor.ts';
const c=new TemporalMemoryCompressor();
const rows=[...Array(8)].map((_,i)=>({at:i+1,id:`e:${i}`,action:i%2?'verify':'explore',summary:`event-${i}`,predictionError:.1,provenanceClass:i<4?'runtime-outcome':'external',evidenceHash:`h${i}`}));
rows[6]={...rows[6],correctionOfId:'e:2',epistemicStatus:'superseded'}; rows[7]={...rows[7],correctionOfId:'e:3',epistemicStatus:'quarantined'};
const cap=c.compress(rows,'daily'); assert.ok(cap); assert.equal(cap.correctionCount,2); assert.equal(cap.correctionLinks.length,2); assert.deepEqual(cap.correctionLinks.map(x=>x.corrects).sort(),['e:2','e:3']); assert.ok(cap.provenanceClasses.length>=2); assert.ok(cap.evidenceHashes.length>=8); assert.ok(cap.sourceDiversity01>.4);
const d=new TemporalMemoryCompressor(); d.restore(c.snapshot()); assert.deepEqual(d.snapshot(),c.snapshot()); console.log(JSON.stringify({pass:true,correctionCount:cap.correctionCount,correctionLinks:cap.correctionLinks.length,sourceDiversity01:cap.sourceDiversity01,evidenceHashes:cap.evidenceHashes.length}));
