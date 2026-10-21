import assert from 'node:assert/strict';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

const previousNodeEnv = process.env.NODE_ENV;
try {
  process.env.NODE_ENV = 'production';
  assert.throws(() => new OrganismRuntime({
    stateFile: '/tmp/nk-workpass224-state.json',
    stateStore: new MemoryStateStore(),
    worldStateStore: new MemoryStateStore(),
    journal: new BoundedOperationalJournal(),
    enableLanguage: false,
    compoundRepairRevision: {
      // The production guard must reject missing independent authorities before
      // trying to inspect or invoke the candidate store or provider.
      engine: {},
      provideInputs: async () => { throw new Error('provider must not be called'); },
    },
  }), /production-compound-repair-revision-requires-independent-evaluation-authority/);
  console.log('WorkPass224 production independent-evaluation requirement: PASS');
} finally {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
}
