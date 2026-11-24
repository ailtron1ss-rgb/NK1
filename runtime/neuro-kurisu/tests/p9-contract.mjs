import { readFile } from 'node:fs/promises';
const text=await readFile(new URL('../src/organism/world/WorldModel2Contract.ts', import.meta.url),'utf8');
for(const name of ['LatentWorldState','CausalEdgeHypothesis','WorldTransitionHypothesis','FutureRollout','WorldModel2Contract']) if(!text.includes(`interface ${name}`)) throw new Error(`missing-contract:${name}`);
console.log('P9_CONTRACT=PASS');
