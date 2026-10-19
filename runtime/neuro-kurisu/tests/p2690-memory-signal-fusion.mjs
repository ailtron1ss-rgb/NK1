import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
const now=Date.now();
const balanced=new MemoryOS2({signalFusionProfile:'balanced'});
const semanticOnly=new MemoryOS2({signalFusionProfile:'semantic-only'});
const corpus=[
  ['alice-tokyo','Alice currently lives in Tokyo and prefers quiet neighborhoods',{entities:['alice','tokyo'],goalRelevance:.8}],
  ['alice-history','Alice moved from Berlin to Tokyo in 2024',{entities:['alice','berlin','tokyo'],createdAt:now-365*86_400_000}],
  ['bike','The system observed a red bicycle near the station',{entities:['bicycle','station']}],
  ['database','The PostgreSQL database backup completed successfully',{entities:['postgresql','database']}],
  ['termux','Termux mobile runtime checkpoint policy uses a 60 second minimum interval',{entities:['termux','mobile','checkpoint']}],
  ['identity','Identity continuity should survive restart and preserve autobiographical anchors',{entities:['identity','continuity','restart'],identityRelevance:.95}],
];
for(const [id,content,extra] of corpus){
  const base={id,content,kind:'episodic',salience:.6,emotionalWeight:.4,identityRelevance:extra.identityRelevance??.1,goalRelevance:extra.goalRelevance??.2,socialRelevance:.1,predictionError:.1,confidence:.8,epistemicStatus:'fact',source:'p2690',entities:extra.entities,semanticLinks:[],temporalLinks:[],causalLinks:[]};
  if(extra.createdAt) base.createdAt=extra.createdAt;
  for(const store of [balanced,semanticOnly]) store.encode(base);
}
const cases=[
  ['Alice current residence','alice-tokyo'],
  ['Alice Tokyo','alice-tokyo'],
  ['red bicycle station','bike'],
  ['PostgreSQL backup','database'],
  ['Termux checkpoint','termux'],
  ['identity continuity restart','identity'],
  ['Tokyo 2024','alice-history'],
];
let fusionHits=0,semanticHits=0;
for(const [query,gold] of cases){
  const fused=balanced.retrieve(query,1,.7,.8)[0];
  const plain=semanticOnly.retrieve(query,1,.7,.8)[0];
  if(fused?.id===gold)fusionHits++;
  if(plain?.id===gold)semanticHits++;
  console.log(JSON.stringify({query,fused:fused?.id,semanticOnly:plain?.id,gold}));
}
assert.ok(fusionHits>=semanticHits,'fusion should not underperform semantic-only on the controlled cases');
const diag=balanced.retrievalDiagnostics();
assert.equal(diag.signalFusion,true);
console.log(JSON.stringify({pass:true,fusionHits,semanticHits,cases:cases.length,delta:fusionHits-semanticHits,diag,size:balanced.size(),now}));
