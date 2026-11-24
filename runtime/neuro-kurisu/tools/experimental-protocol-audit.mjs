import fs from 'node:fs';
const root=new URL('..',import.meta.url).pathname;
const ec=fs.readFileSync(`${root}/src/organism/memory/ExperienceContinuumFabric.ts`,'utf8');
const ul=fs.readFileSync(`${root}/src/organism/learning/UnifiedLearningSubstrate.ts`,'utf8');
const checks={
 protocol:ec.includes('ReplayExperimentProtocol'),
 confirmatoryGate:ec.includes('eligibleForConfirmatoryInference'),
 provenanceLedger:ec.includes('replayEvidenceLedger'),
 transferGate:ul.includes('transferInferenceGate'),
 transferMatrix:ul.includes('transferMatrix'),
 boundedProtocols:ec.includes('slice(-24)') && ec.includes('slice(-128)'),
};
const failed=Object.entries(checks).filter(([,v])=>!v);
console.log('EXPERIMENTAL_PROTOCOL_AUDIT',JSON.stringify({checks,passed:Object.keys(checks).length-failed.length,total:Object.keys(checks).length}));
if(failed.length)process.exit(1);
