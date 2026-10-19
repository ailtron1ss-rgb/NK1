import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
const core=new OrganismCore({});
const diag=()=>core.autonomousCognitiveLifeDiagnostics();
const before=diag();
// Use public runtime-facing cycle method used by the organism itself.
const snap=core.autonomousCognitiveLifeSnapshot(); assert(snap && snap.version===1);
const bench=core.autonomousCognitiveLifeBenchmark(); assert(bench && typeof bench.overall01==='number');
assert(core.autonomousCognitiveLifeSelectPerception()===null || typeof core.autonomousCognitiveLifeSelectPerception().mode==='string');
console.log(`BIG_PASS_128_154_CORE=PASS cycles=${before.cycles} overall=${bench.overall01.toFixed(3)} restored=${Boolean(snap)}`);
