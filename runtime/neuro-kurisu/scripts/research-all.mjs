import { spawnSync } from 'node:child_process';
const commands = [
  'research:p7','test:p8','test:p9:contract','test:p9','test:model-switch','test:p10:contract','test:p10','test:p10:migration','test:p10:planner','test:p11','test:p11:migration','test:p11:integration','research:p10','research:p11','research:p12','test:p14','test:p14:migration','test:p14:ui','research:p14','test:p15','test:p15:migration','research:p15','test:p16','test:p16:migration','test:p17','test:p17:migration','test:p18','test:p18:migration','research:p18','test:p19','test:p19:migration','research:p19','test:p20:temporal','test:p20:session'
];
for (const script of commands) { console.log(`\n=== ${script} ===`); const r=spawnSync('npm',['run',script],{stdio:'inherit'}); if(r.status!==0) process.exit(r.status??1); }
console.log('RESEARCH_ALL=PASS');
