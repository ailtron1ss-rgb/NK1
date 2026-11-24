import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../src/organism/core/CognitiveSubsystemFacade.ts',import.meta.url),'utf8');
const bad=/import\s+(?:type\s+)?\{?[^;]*OrganismCore[^;]*from|\.\/OrganismCore\.ts/.test(source);
console.log(`FACADE_DEPENDENCY=${bad?'FAIL':'PASS'}`);
if(bad) process.exit(1);
