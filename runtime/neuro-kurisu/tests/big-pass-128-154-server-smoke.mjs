import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const child=spawn(process.execPath,['--experimental-strip-types','src/server/server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'18993'},stdio:['ignore','pipe','pipe']});
let text=''; child.stderr.on('data',d=>text+=d.toString());
try { await new Promise(r=>setTimeout(r,2200)); let res; try { res=await fetch('http://127.0.0.1:18993/api/organism/autonomous-cognitive-life'); } catch(e) { throw new Error(`server-unavailable: ${e.message}; stderr=${text}`); } assert.equal(res.status,200); const j=await res.json(); assert.equal(j.ok,true); assert(j.benchmark); console.log(`BIG_PASS_128_154_SERVER=PASS endpoint=${j.ok} benchmark=${Number(j.benchmark.overall01).toFixed(3)}`); }
finally { child.kill('SIGTERM'); }
