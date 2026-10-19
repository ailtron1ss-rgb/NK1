import assert from 'node:assert/strict';
import { MemoryFabric } from '../src/organism/memory/MemoryFabric.ts';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { EventLog } from '../src/organism/memory/EventSourcing.ts';
import { MultiTimescaleMemory } from '../src/organism/memory/MultiTimescaleMemory.ts';
import { MemorySubstrateCoordinator } from '../src/organism/developmental/MemorySubstrateCoordinator.ts';
import { UnifiedMemorySystem } from '../src/organism/developmental/UnifiedMemorySystem.ts';
import { P62MemoryFabric } from '../src/organism/memory/P62MemoryFabric.ts';
import { SemanticMemoryGraph } from '../src/organism/memory/SemanticMemoryGraph.ts';

const memoryOS=new MemoryOS2();
const events=new EventLog(128);
const multi=new MultiTimescaleMemory();
const substrate=new MemorySubstrateCoordinator();
const unified=new UnifiedMemorySystem();
const p62=new P62MemoryFabric();
const semantic=new SemanticMemoryGraph();
semantic.upsertNode('identity continuity','concept',.9);
const fabric=new MemoryFabric(memoryOS,events,multi,substrate,unified,p62,semantic,{maxHotItems:8});

const input={content:'Neuro-Kurisu should preserve identity continuity across restart',kind:'identity',salience:.9,emotionalWeight:.2,identityRelevance:.95,goalRelevance:.7,socialRelevance:.1,predictionError:.2,confidence:.82,epistemicStatus:'belief',source:'test',entities:[],semanticLinks:[],temporalLinks:[],causalLinks:[]};
const a=fabric.encode(input,{tick:1});
const size1=memoryOS.size();
const b=fabric.encode(input,{tick:2});
assert.equal(memoryOS.size(),size1,'duplicate encode must reconsolidate canonical item');
assert.equal(a.id,b.id);

const hits=fabric.retrieve('identity continuity restart',4,{tick:3});
assert.ok(hits.some(x=>x.id===a.id));
const second=memoryOS.size();
for(let i=0;i<16;i++) fabric.encode({...input,content:`memory ${i} unique ${i}`,id:undefined},{tick:4+i,emitEvent:false});
assert.equal(memoryOS.size(),second+16);
assert.ok(fabric.hotIdsSnapshot().length<=8);
const recall=fabric.recall('identity continuity');
assert.ok(recall.hits.length>=1);

const snap=fabric.snapshot();
const fabric2=new MemoryFabric(memoryOS,events,multi,substrate,unified,p62,semantic,{maxHotItems:8});
fabric2.restore(snap);
assert.deepEqual(fabric2.hotIdsSnapshot(),fabric.hotIdsSnapshot());
assert.equal(fabric2.inspect().canonicalAuthority,'memoryOS2');
assert.ok(events.size()>=2);
console.log('BIG_PASS_52_MEMORY_FABRIC=PASS');
console.log(JSON.stringify({canonicalItems:memoryOS.size(),events:events.size(),hot:fabric.hotIdsSnapshot().length,queries:fabric.inspect().stats.retrievals,recallHits:recall.hits.length}));
