import assert from 'node:assert/strict';
import { P30ContinualIntelligenceEngine, defaultP30Continual } from '../src/organism/learning/P30ContinualIntelligence.ts';
const p=new P30ContinualIntelligenceEngine();p.restore(defaultP30Continual());
p.captureRollback({p26:{version:1,w:[1,2]},p27:{version:1,x:[3]},p28:{version:1,y:[4]}});
const b=p.rollbackBundle();assert.equal(b.p26.w[1],2);
const s=p.snapshot();const raw=s.rollback.compressedBundleB64;
p.restore(s);assert.equal(p.rollbackBundle().p28.y[0],4);assert.equal(p.snapshot().rollback.compressedBundleB64,raw);
console.log(`P30_ROLLBACK=PASS bytes=${p.snapshot().rollback.compressedBytes} generation=${p.snapshot().rollback.generation}`);
