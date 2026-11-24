import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const files=[];
function walk(dir){for(const name of fs.readdirSync(dir)){const p=path.join(dir,name);const st=fs.statSync(p);if(st.isDirectory()&&!['node_modules','.git','coverage','dist'].includes(name))walk(p);else if(/\.(ts|mjs)$/.test(name))files.push(p);}}
walk(path.join(root,'src'));
const violations=[];
for(const file of files){
  const rel=path.relative(root,file);
  const s=fs.readFileSync(file,'utf8');
  if(/NoopOperationalJournal/.test(s))violations.push(`${rel}:legacy-noop-journal-name`);
  if(/class\s+(Mock|Stub|Dummy|Placeholder)\b/.test(s))violations.push(`${rel}:fake-class`);
}
const branch=fs.readFileSync(path.join(root,'src/organism/cognition/NeuralExperienceBranch.ts'),'utf8');
if(/syntheticReplay[\s\S]{0,260}actionReadout/.test(branch))violations.push('NeuralExperienceBranch:synthetic-direct-action-learning');
if(/syntheticReplay[\s\S]{0,260}noteSyntheticCredit\(/.test(branch))violations.push('NeuralExperienceBranch:synthetic-direct-credit');
const shadow=fs.readFileSync(path.join(root,'src/organism/system/RealityShadowBridge.ts'),'utf8');
if(!/promotionEligible:!simulation/.test(shadow))violations.push('RealityShadowBridge:simulation-promotion-guard-missing');
if(violations.length){for(const v of violations)console.error('FAIL',v);process.exit(1);}
console.log(`P2901_STATIC_ANTI_DECORATION=PASS files=${files.length}`);
