import { spawnSync } from 'node:child_process';
const commands=[
  'typecheck',
  'test:b259-canonical-brain','test:big-pass-260','test:big-pass-261','test:big-pass-261-core',
  'test:b262:world','test:b262:core','test:b263:causal','test:b263:core',
  'test:b264:policy','test:b264:core','test:big-pass-265','test:big-pass-265:migration','test:big-pass-265:core',
  'test:big-pass-266','test:big-pass-266:migration','test:big-pass-266:core','test:big-pass-267','test:big-pass-267:core','test:big-pass-267:migration',
  'test:big-pass-268','test:big-pass-268:core','test:big-pass-269','test:big-pass-269:migration','test:big-pass-269:core',
  'test:big-pass-270','test:big-pass-270:migration','test:big-pass-270:core',
  'audit:full','audit:architecture','audit:integrity','audit:hygiene','audit:syntax','audit:contract','audit:forensics','verify:release-source','doctor','manifest:archive','audit:archive'
];
for(const script of commands){const r=spawnSync('npm',['run','-s',script],{stdio:'inherit',env:process.env});if(r.status!==0)process.exit(r.status??1);} console.log('RELEASE_B270=PASS');
