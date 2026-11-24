import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';
import { CausalSelfExperimentLab } from '../src/organism/system/CausalSelfExperimentLab.ts';

const root=path.resolve('src/organism');
const files=[];
function walk(dir){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory())walk(p); else if(/\.(ts|tsx|mjs|js)$/.test(ent.name))files.push(p);
  }
}
walk(root);
const violations=[];
for(const file of files){
  const s=fs.readFileSync(file,'utf8');
  if(/\b(TODO|FIXME|NotImplemented)\b/.test(s))violations.push(`${file}:implementation marker`);
  if(/class\s+(Mock|Stub|Dummy|Placeholder)\b/.test(s))violations.push(`${file}:fake class`);
}
assert.deepEqual(violations,[],'active organism contains explicit implementation stubs');

const branch=fs.readFileSync(path.resolve('src/organism/cognition/NeuralExperienceBranch.ts'),'utf8');
const syntheticBlock=branch.slice(branch.indexOf('const syntheticSamples='),branch.indexOf('const metaBudget=',branch.indexOf('const syntheticSamples=')));
assert.equal(/syntheticReplay[\s\S]{0,220}actionReadout/.test(syntheticBlock),false,'synthetic replay must not mutate action readout before observed confirmation');
assert.equal(/syntheticReplay[\s\S]{0,220}noteSyntheticCredit\(/.test(syntheticBlock),false,'synthetic replay must not earn direct learning credit');
assert.match(syntheticBlock,/verifiedSyntheticTrajectoryGate\.stage/);

const lab=new CausalSelfExperimentLab();
const projected=lab.run({at:1,domain:'audit',baseline01:.70,intervention01:.40,predictedDelta01:.12,evidenceClass:'synthetic',source:'simulation'});
assert.equal(projected.verified,false);
assert.equal(lab.summary().observed,0);
const observed=lab.run({at:2,domain:'audit',baseline01:.70,intervention01:.55,predictedDelta01:.12,executed:true,evidenceClass:'observed',source:'controlled-test'});
assert.equal(observed.verified,true);
assert.equal(lab.summary().observed,1);

const journal=new BoundedOperationalJournal(16);
await journal.write('info','one');
await journal.write('warn','two');
await journal.write('error','three');
await journal.write('info','four');
assert.equal(journal.metrics().records,4);
assert.equal(journal.metrics().errors,1);
assert.equal(journal.snapshot()[0].event,'four');

const results={
  pass:'P2900_ANTI_DECORATION_AUDIT',
  sourceFiles:files.length,
  suspiciousMarkers:0,
  syntheticLearningLeak:false,
  syntheticCausalEvidence:false,
  boundedJournal:true,
  verified:true,
};
console.log(JSON.stringify(results,null,2));
