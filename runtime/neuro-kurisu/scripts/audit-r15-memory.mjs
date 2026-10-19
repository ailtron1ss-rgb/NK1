import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const m=new MemoryOS2();
const base=Date.now()-10000;
for(let i=0;i<64;i++) m.encode({content:`R15 audit memory ${i} continuity branch token ${i}`,kind:'episodic',source:'r15-audit',salience:.3+(i%7)/20,emotionalWeight:.1,identityRelevance:i===0?1:.1,goalRelevance:.2,socialRelevance:.1,predictionError:.2,confidence:.7,epistemicStatus:'fact',entities:[],semanticLinks:[],temporalLinks:[],causalLinks:[],contradictionLinks:[],validFromAt:base+i,});
const old=m.encode({content:'R15 revision audit claim ORIGINAL-Z91 is active',kind:'semantic',source:'r15-audit',salience:.8,emotionalWeight:.1,identityRelevance:.1,goalRelevance:.5,socialRelevance:.1,predictionError:.2,confidence:.9,epistemicStatus:'fact',entities:[],semanticLinks:[],temporalLinks:[],causalLinks:[],contradictionLinks:[],validFromAt:base-100});
m.reviseContent(old.id,'R15 revision audit claim REVISED-Z91 is active',{validAt:Date.now(),reason:'audit-revision'});
const beforeForget=m.indexDiagnostics();
const rows=m.retrieve('REVISED-Z91',8);
for(const row of rows.slice(0,3)) m.markDormant(row.id,true,'r15-pressure-test');
m.maintain({pressure01:.9,maxItems:1600});
const afterForget=m.indexDiagnostics();
const temporal=m.temporalDiagnostics();
const pass=beforeForget.pass&&afterForget.pass&&rows.length>0&&temporal.maxRevision>=2;
console.log(JSON.stringify({pass,beforeForget,afterForget,temporal,retrieval:rows.length}));
if(!pass)process.exit(1);
