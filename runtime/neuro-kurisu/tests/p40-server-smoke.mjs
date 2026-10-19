import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const dir=await mkdtemp(path.join(os.tmpdir(),'neuro-p40-server-')); const port=3300+Math.floor(Math.random()*300);
const child=spawn(process.execPath,['--experimental-strip-types','src/server/server.mjs'],{cwd:path.resolve('.'),env:{...process.env,PORT:String(port),STATE_DIR:dir,AUTONOMY_INTERVAL_MS:'3600000',NEURO_AUTONOMY_ENABLED:'0'},stdio:['ignore','pipe','pipe']});
const deadline=Date.now()+6000; let ok=false;
while(Date.now()<deadline){try{const r=await fetch(`http://127.0.0.1:${port}/api/organism/semantic-intelligence`); if(r.status===200){const j=await r.json();assert.ok(j.ok);ok=true;break;}}catch{} await new Promise(r=>setTimeout(r,80));}
child.kill('SIGTERM'); assert.ok(ok,'server did not start'); console.log('P40_SERVER=PASS');
