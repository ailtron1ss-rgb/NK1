import { readFile } from 'node:fs/promises';
const checks=[
 ['src/organism/developmental/MemoryOS2.ts',['bm25Score','hybridRetrieval','contradictionLinks','identifierLike','sharedEntityCount']],
 ['src/organism/developmental/MemoInspiredMemoryPrimitives.ts',['memoContentHash','deriveMemoryIdentity','mergeMemoContext','mergeMemoTags']],
 ['src/organism/core/OrganismCore.ts',['Public snapshots must carry the live runtime-owned state','neuralExperienceBranch=this.developmentalNeural.neuralExperienceBranch.snapshot']],
 ['tests/r14-hybrid-memory-integration.mjs',['identifier-like queries','contradictions','bm25CandidateCount']],
 ['docs/MEMORY_TRANSFER_R14_2026-09-25.md',['Memo','BM25','contradiction','RRF','Mem0']],
];
let fail=0;for(const [file,needles] of checks){const s=await readFile(file,'utf8');for(const n of needles){if(!s.includes(n)){console.error(`MISSING ${file}: ${n}`);fail++;}}}
console.log(`R14_MEMORY_AUDIT=${fail?'FAIL':'PASS'} checks=${checks.reduce((n,[,x])=>n+x.length,0)} failures=${fail}`);if(fail)process.exit(1);
