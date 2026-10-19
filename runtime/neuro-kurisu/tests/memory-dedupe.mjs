import { AutobiographicalMemory } from '../src/organism/memory/AutobiographicalMemory.ts';
import { MultiTimescaleMemory } from '../src/organism/memory/MultiTimescaleMemory.ts';
const memory = new AutobiographicalMemory();
const events = [
  { id:'e1', tick:1, at:1, type:'decision', payload:{ selectedAction:'explore' } },
  { id:'e2', tick:1, at:2, type:'world-transition', payload:{ reward:0.6 } },
];
const row = memory.buildEpisode(events, 100);
if (!row) throw new Error('episode not created');
const store = new MultiTimescaleMemory();
store.add(row);
store.add(row);
if (store.snapshot().filter(x => x.id === row.id).length !== 1) throw new Error('episode duplicate was not collapsed');
console.log('MEMORY_DEDUP=PASS');
