import { P49TemporalLifeEngine } from '../src/organism/developmental/P49TemporalLifeEngine.ts';

const event=(id,tick,at,type,payload)=>({id,tick,at,type,payload});
const engine=new P49TemporalLifeEngine();
const events=[
  event('e1',1,1000,'decision',{selectedAction:'explore'}),
  event('e2',1,1050,'world-transition',{success:.9,reward:.8,surprise:.1,notes:'good'}),
  event('e3',2,5000,'decision',{selectedAction:'rest'}),
  event('e4',2,5050,'world-transition',{success:.2,reward:-.4,surprise:.6,notes:'bad'}),
  event('e5',3,7000,'decision',{selectedAction:'explore'}),
];
const first=engine.ingest(events);
if(first.eventsIndexed!==events.length) throw new Error('P49 did not index all events');
const before=engine.snapshot();
const report=engine.consolidate(3);
if(report.kept>3) throw new Error('P49 consolidation overflow');
const sleep=engine.sleep(9000,'deep');
if(sleep.sleepConsolidations!==1) throw new Error('P49 sleep consolidation missing');
const second=engine.ingest(events);
if(second.eventsIndexed!==events.length) throw new Error('P49 ingest is not idempotent');
if(second.journalHash!==before.journalHash) throw new Error('P49 journal changed on duplicate ingest');
if(engine.summary().continuityHealth01<0 || engine.summary().continuityHealth01>1) throw new Error('P49 health out of range');
console.log('P49 temporal-life test PASS');
