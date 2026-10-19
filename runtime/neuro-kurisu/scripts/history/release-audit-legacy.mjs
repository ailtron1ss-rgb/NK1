import { spawnSync } from 'node:child_process';
const commands=['lock:verify','organism:smoke','organism:autonomy','organism:restart','organism:integrity','organism:architecture'];
for(const c of commands){ console.log(`\n>>> npm run ${c}`); const r=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run',c],{stdio:'inherit'}); if(r.status!==0) process.exit(r.status||1); }
console.log('\nCLEAN_RELEASE_AUDIT=PASS');
