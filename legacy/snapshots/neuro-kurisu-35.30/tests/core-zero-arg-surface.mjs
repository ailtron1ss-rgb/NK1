import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { NoopOperationalJournal } from '../src/organism/persistence/NoopOperationalJournal.ts';

const safe=/^(get|is|has|can|should|snapshot|summary|status|metrics|health|inspect|recent|diagnostics|manifest|graph|executionOrder|flight|temperatureSummary|retrievalDiagnostics|claimAssessment|neighborhood|person|worldModel|advancedDevelopment|developmentalCognition|developmentalCausalSnapshot|perception|temporalContext|capabilities|system|memory|cognitive|emotion|p66|p67|p68|p79|p82|p57|p73|p61|p71|p72|p74|p75|p76|p78|p80|p81|p83|p84|prediction|continuity|projection|evolution|identity|runtime|research|resource)/i;
const unsafe=/(restore|rollback|delete|forget|destroy|shutdown|stop|reset|apply|set[A-Z]|record[A-Z]|observe|feedback|learn|train|write|save|flush|checkpoint|tick|start|init|exportPortableSubject)/i;
const core=new OrganismCore(new MemoryStateStore(),{enableLanguage:false,journal:new NoopOperationalJournal(),stateStore:new MemoryStateStore()});
await core.init();
const names=Object.getOwnPropertyNames(Object.getPrototypeOf(core)).filter(name=>{
  if(name==='constructor'||!safe.test(name)||unsafe.test(name))return false;
  const d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(core),name); return typeof d?.value==='function' && d.value.length===0;
});
const failures=[]; let invoked=0;
for(const name of names){ try{ const r=core[name](); if(r?.then)await r; invoked++; }catch(e){failures.push(`${name}:${e?.message??e}`);} }
assert.equal(failures.length,0,failures.join('\n'));
console.log(`CORE_ZERO_ARG_SURFACE=PASS invoked=${invoked} discovered=${names.length} skipped=unsafe-filtered`);
await core.flush(); core.stop?.();
