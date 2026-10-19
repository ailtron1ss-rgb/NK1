import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
const store=new FileStateStore('/tmp/neuro-kurisu-b721b900-test');
const o=new OrganismCore(store, {performanceProfile:'mobile'});
await o.init();
for(let i=0;i<10;i++){await o.observe({text:i%2?'test':'',source:'b721-test',surprise:(i%3)/3}, 'operational');}
const d=o.b721B900Diagnostics();
const snap=o.snapshot?.();
console.log('B721_B900_ORGANISM_PASS');
console.log('diagnostics',JSON.stringify(d));
console.log('snapshot',Boolean(snap));
