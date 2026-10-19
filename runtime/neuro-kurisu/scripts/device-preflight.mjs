import { execFileSync } from 'node:child_process';
import { access, mkdir, stat } from 'node:fs/promises';
import os from 'node:os';
const checks = [];
function check(name, ok, detail=''){ checks.push({name, ok, detail}); console.log(`${ok?'PASS':'WARN'} ${name}${detail?` — ${detail}`:''}`); }
const parseVersion = v => v.split('.').map(Number);
const atLeast = (v, req) => { const a=parseVersion(v), b=parseVersion(req); for(let i=0;i<3;i++){if((a[i]||0)!==(b[i]||0)) return (a[i]||0)>(b[i]||0); } return true; };
check('node', atLeast(process.versions.node, '22.12.0'), process.version);
try { const npm=execFileSync('npm',['--version'],{encoding:'utf8'}).trim(); check('npm', atLeast(npm,'10.8.0'), npm); } catch { check('npm', false, 'npm executable not found'); }
check('npm-lock', true, 'lockfile is checked by lock:verify');
try { execFileSync('node',['--version'],{stdio:'ignore'}); check('node-executable',true); } catch { check('node-executable',false); }
try { await access('state'); check('state-dir',true); } catch { await mkdir('state',{recursive:true}); check('state-dir',true,'created'); }
const free = os.freemem(); const total = os.totalmem(); check('memory', free > 128*1024*1024, `${Math.round(free/1024/1024)} MiB free / ${Math.round(total/1024/1024)} MiB total`);
for (const cmd of ['termux-battery-status','termux-api-start','termux-sensor','termux-wifi-connectioninfo','termux-tts-speak','termux-speech-to-text']) {
  try { execFileSync('sh',['-lc',`command -v ${cmd}`],{stdio:'ignore'}); check(cmd,true); } catch { check(cmd,false,'optional / not installed'); }
}
const hard = checks.filter(c => ['node','node-executable','state-dir','memory'].includes(c.name) && !c.ok);
if (hard.length) process.exit(1);
console.log(JSON.stringify({ok:true, checks},null,2));
