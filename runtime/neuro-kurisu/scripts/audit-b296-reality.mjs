import { execFileSync } from 'node:child_process';
const cmds=[['npm',['run','test:big-pass-296:neural-personality']],['npm',['run','typecheck']]];
for(const [bin,args] of cmds){execFileSync(bin,args,{stdio:'inherit'});}
console.log(JSON.stringify({pass:true,layer:'B296',claim:'neural personality-agency nucleus is executable and integrated'}));
