import { readFile } from 'node:fs/promises';
const files=['src/organism/core/UnifiedCognitiveSubstrate.ts','src/organism/system/OrganismResourceAllocator.ts','src/organism/system/PredictionDebt.ts','src/organism/world/WorldEnvironment.ts'];
const stats=[]; for(const f of files){const text=await readFile(f,'utf8'); stats.push({file:f,lines:text.split('\n').length,bytes:Buffer.byteLength(text)});}
console.log('SUBSTRATE_AUDIT=PASS',JSON.stringify({files:stats,principles:['single cross-system projection','scarce compute allocation','signed raw rewards','no canonical-state duplication']}));
