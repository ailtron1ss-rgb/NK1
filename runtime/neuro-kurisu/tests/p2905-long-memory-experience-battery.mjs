import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
const m=new MemoryOS2();
const cases=[
  ['static','the laboratory base uses reactor chamber alpha and cooling loop beta'],
  ['dynamic','the laboratory base cooling loop beta changed to state degraded after the inspection'],
  ['workflow','when verifying reactor chamber alpha first inspect coolant then verify the interlock before responding'],
  ['gotcha','the maintenance console rejects commands when the emergency latch is open'],
  ['premise','the current project assumption is that continuity must survive restart without synthetic claims'],
];
for(let i=0;i<cases.length*4;i++){
  const [kind,content]=cases[i%cases.length];
  m.encode({content:`${content}; trace ${i}`,kind:kind==='workflow'?'procedural':kind==='premise'?'semantic':'episodic',source:i%2?'device-experience':'external-log',tags:['memory-battery',kind],context:{memoryAbility:kind},salience:.65,emotionalWeight:.25,identityRelevance:kind==='premise'?.8:.2,goalRelevance:.55,socialRelevance:.1,predictionError:.35,confidence:.84,epistemicStatus:'fact',entities:[kind,'continuity','reactor'],semanticLinks:[],temporalLinks:[],causalLinks:[],contradictionLinks:[],provenanceClass:i%2?'device':'external',sourceAuthority01:i%2?.94:.82});
}
const queries=[
  ['reactor chamber alpha','static'],
  ['cooling loop beta degraded','dynamic'],
  ['inspect coolant interlock responding','workflow'],
  ['emergency latch open command','gotcha'],
  ['continuity survives restart synthetic claims','premise'],
];
let hits=0;
for(const [q,expected] of queries){
  const rows=m.retrieve(q,6);
  if(rows.some(r=>r.tags?.includes(expected)||r.context?.memoryAbility===expected))hits++;
}
const score=hits/queries.length;
assert.ok(score>=.8,`experience memory battery score ${score} below threshold`);
console.log(JSON.stringify({pass:true,score,queries:queries.length,semanticQueries:m.snapshot().semanticQueries,semanticHits:m.snapshot().semanticHits}));
