import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const rows=[];
for(let seed=0;seed<5;seed++){
  const r=spawnSync(process.execPath,['--experimental-strip-types','tests/big-pass-363-core-five-step-causal-selection.mjs'],{env:{...process.env,B363_SEED_START:String(seed),B363_SEED_END:String(seed+1)},encoding:'utf8',timeout:180000});
  assert.equal(r.status,0,`seed ${seed+1} failed: ${r.stderr}`);
  const out=JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
  assert.equal(out.pass,true); assert.equal(out.seeds,1); rows.push(out.rows[0]);
}
assert.equal(rows.length,5);
console.log(JSON.stringify({pass:true,status:'CORE_FIVE_STEP_PREDICTIVE_CAUSAL_ON_OFF_SHAM_PASS_ALL_SEEDS',seeds:5,changed:rows.filter(x=>x.selectedChanged).length,minCausalL1:Math.min(...rows.map(x=>x.causalL1)),minCausalShamRatio:Math.min(...rows.map(x=>x.ratio)),rows},null,2));
