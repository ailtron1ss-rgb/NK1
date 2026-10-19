import { readFile, readdir } from 'node:fs/promises'; import path from 'node:path';
const root=process.cwd(); const files=[]; async function walk(d){for(const e of await readdir(d,{withFileTypes:true})){if(['node_modules','.git','state','legacy-original','history'].includes(e.name))continue;const p=path.join(d,e.name);if(e.isDirectory())await walk(p);else files.push(p);}}
await walk(path.join(root,'src/organism')); const texts=[]; for(const f of files) texts.push(await readFile(f,'utf8'));
const checks={network:/CognitiveNetworkBus/,neuromodulation:/NeuromodulationSystem/,semanticMemory:/SemanticMemoryGraph/,worldPrediction:/PredictedActionOutcome/,languageDownstream:/buildCognitivePrompt/,actionGateway:/ActionGateway/,identity:/KURISU_ORGANISM_CANON/,brainAtlas:/ArtificialBrainAtlas/,thalamocorticalGate:/ThalamocorticalGate/};
for(const [k,re] of Object.entries(checks)) if(!texts.some(t=>re.test(t))) throw new Error(`brain-link-missing:${k}`);
console.log(`AUDIT_BRAIN=PASS organismFiles=${files.length} links=${Object.keys(checks).length}`);
