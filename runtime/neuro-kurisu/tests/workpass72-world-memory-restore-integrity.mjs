import assert from 'node:assert/strict';
import { WorldModel } from '../src/organism/world/WorldModel.ts';
import { MultiTimescaleMemory } from '../src/organism/memory/MultiTimescaleMemory.ts';

const context = (overrides = {}) => ({ tick:1, location:'lab', energy:.7, attention:.6, uncertainty:.3, facts:['a','b'], objects:[{ id:'o1', label:'lamp', location:'lab', value:.5, visible:true, collected:false }], events:['e1'], ...overrides });

// ---------- WorldModel ----------
// 1. Valid snapshot round-trips.
const world = new WorldModel();
world.restore({ belief: context(), transitions:[{ action:'verify', before:context(), after:context({ tick:2 }), reward:.6, surprise:.1, at:5 }] });
assert.equal(world.transitionCount(),1);
assert.ok(world.beliefAvailable());
assert.equal(world.currentBelief().location,'lab');
assert.equal(world.snapshot()[0].action,'verify');

// 2. Corrupt transitions and belief are dropped, not copied or crashed on.
const corrupt = new WorldModel();
assert.doesNotThrow(() => corrupt.restore({
  belief:{ location:'x', energy:NaN, attention:1, uncertainty:1, facts:null, events:null, objects:'nope' },
  transitions:[
    { action:'rest', before:null, after:null, reward:NaN, surprise:'x', at:-1 },
    { action:'teleport', before:context(), after:context(), reward:.5, surprise:.2, at:3 },
    'garbage',
    null,
    { action:'explore', before:context(), after:context(), reward:.5, surprise:.2, at:4 },
  ],
}));
assert.equal(corrupt.transitionCount(),1,'only the fully valid transition survives');
assert.equal(corrupt.snapshot()[0].action,'explore');
assert.equal(corrupt.beliefAvailable(),false,'a malformed belief is dropped');

// 3. restore(undefined) and restore(null-ish) clear state without throwing.
const empty = new WorldModel();
assert.doesNotThrow(() => empty.restore(undefined));
assert.equal(empty.transitionCount(),0);
assert.equal(empty.beliefAvailable(),false);
assert.doesNotThrow(() => empty.restore([]));
assert.equal(empty.transitionCount(),0);

// 4. Accessors and traps fail closed.
let getterCalls = 0;
const hostile = {};
Object.defineProperty(hostile,'belief',{ enumerable:true, get(){ getterCalls++; throw new Error('getter executed'); } });
const guarded = new WorldModel();
guarded.restore({ belief:context(), transitions:[{ action:'verify', before:context(), after:context(), reward:.5, surprise:.2, at:1 }] });
assert.doesNotThrow(() => guarded.restore(hostile));
assert.equal(getterCalls,0,'restore must never execute snapshot accessors');
assert.equal(guarded.transitionCount(),0,'a hostile snapshot resets state');
assert.equal(guarded.beliefAvailable(),false);

const proxy = new Proxy({}, { getPrototypeOf(){ throw new Error('prototype trap'); } });
assert.doesNotThrow(() => guarded.restore(proxy));
assert.equal(guarded.transitionCount(),0);
const revoked = Proxy.revocable({},{}); revoked.revoke();
assert.doesNotThrow(() => guarded.restore(revoked.proxy));
assert.equal(guarded.transitionCount(),0,'revoked proxies fail closed');

// 5. Restored belief must not carry non-finite values into beliefSignature.
const finite = new WorldModel();
finite.restore({ belief: context({ energy:Infinity, uncertainty:-2 }), transitions:[] });
const signature = finite.beliefSignature();
assert.doesNotMatch(signature,/NaN|Infinity/,'belief signature must never contain non-finite values');
const finiteBelief = finite.currentBelief();
assert.ok(Number.isFinite(finiteBelief.energy) && finiteBelief.energy >= 0 && finiteBelief.energy <= 1,'energy is coerced to a finite unit value');
assert.ok(Number.isFinite(finiteBelief.uncertainty) && finiteBelief.uncertainty >= 0 && finiteBelief.uncertainty <= 1,'uncertainty is coerced to a finite unit value');

// 6. observeContext tolerates hostile input shapes without fabricating state.
const live = new WorldModel();
assert.doesNotThrow(() => live.observeContext(context({ facts:'notarray', events:null, objects:'nope' })));
assert.ok(live.beliefAvailable());
assert.doesNotThrow(() => live.observeContext(undefined));
assert.ok(live.beliefAvailable(),'a rejected observation must not wipe the previous belief');

// ---------- MultiTimescaleMemory ----------
// 7. Valid rows restore; malformed rows are dropped instead of crashing.
const memory = new MultiTimescaleMemory();
const good = { id:'m1', kind:'episode', summary:'hello world', salience:.5, evidence:['a'], createdAt:1, timescale:'episodic', retrievalCount:2, lastRetrievedAt:5, confidence:.7, sourceEventIds:['e1'] };
assert.doesNotThrow(() => memory.restore([
  good,
  { id:'m2', kind:'nope', summary:'x', evidence:[], createdAt:1, timescale:'episodic', retrievalCount:0, lastRetrievedAt:0, confidence:.5, sourceEventIds:[] },
  { id:'m3', kind:'pattern', summary:'s', salience:NaN, evidence:[], createdAt:1, timescale:'semantic', retrievalCount:0, lastRetrievedAt:0, confidence:.5, sourceEventIds:[] },
  null,
  'x',
]));
const restored = memory.snapshot();
assert.equal(restored.length,2,'only structurally valid rows survive');
assert.equal(restored.find(row => row.id === 'm3').salience,0,'non-finite salience is normalized');
assert.ok(restored.every(row => Number.isFinite(row.salience) && Number.isFinite(row.confidence)));

// 8. Non-array and hostile input reset to empty rather than throwing.
assert.doesNotThrow(() => memory.restore('not-an-array'));
assert.equal(memory.snapshot().length,0);
assert.doesNotThrow(() => memory.restore(undefined));
assert.equal(memory.snapshot().length,0);

let memGetterCalls = 0;
const hostileRow = {};
Object.defineProperty(hostileRow,'id',{ enumerable:true, get(){ memGetterCalls++; throw new Error('getter executed'); } });
assert.doesNotThrow(() => memory.restore([hostileRow, good]));
assert.equal(memGetterCalls,0,'restore must never execute row accessors');
assert.equal(memory.snapshot().length,1,'the valid row survives, the hostile row is dropped');

// 9. Retrieval still works after a mixed restore.
assert.ok(memory.retrieve('hello',5).length >= 1);

console.log('WORKPASS72_WORLD_MEMORY_RESTORE_INTEGRITY=PASS');
