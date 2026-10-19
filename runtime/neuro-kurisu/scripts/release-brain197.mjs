import { spawnSync } from 'node:child_process';
const commands=[
 ['npm',['run','typecheck']],
 ['npm',['run','test:big-pass-197']],
 ['npm',['run','test:big-pass-198']],
 ['npm',['run','test:big-pass-199']],
 ['npm',['run','test:big-pass-196']],
 ['npm',['run','test:big-pass-196:core']],
 ['npm',['run','test:big-pass-195']],
 ['npm',['run','test:big-pass-195:learning-core']],
 ['npm',['run','test:big-pass-191']],
 ['npm',['run','test:big-pass-187']],
 ['npm',['run','test:big-pass-185']],
 ['npm',['run','test:p26:true-learning']],
 ['npm',['run','test:p22:phone']],
 ['npm',['test:big-pass-197']]
];
for(const [cmd,args] of commands){const r=spawnSync(cmd,args,{stdio:'inherit',cwd:process.cwd(),env:process.env});if(r.status!==0)process.exit(r.status??1);}
console.log('RELEASE_BRAIN197=PASS');
