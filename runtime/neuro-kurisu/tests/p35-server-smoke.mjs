import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import process from 'node:process';

const port=3471;
const child=spawn(process.execPath,['--experimental-strip-types','src/server/server.mjs'],{env:{...process.env,PORT:String(port),AUTO_RUN:'false',STATE_DIR:`/tmp/neuro-kurisu-p35-server-${process.pid}`},stdio:['ignore','pipe','pipe']});
let stdout=''; child.stdout.on('data',d=>stdout+=d.toString());
await new Promise((resolve,reject)=>{ const t=setTimeout(()=>resolve(),1800); child.stderr.on('data',d=>{const s=d.toString(); if(/EADDRINUSE|SyntaxError|TypeError/.test(s)) reject(new Error(s));}); child.stdout.on('data',d=>{if(d.toString().includes('listening')){clearTimeout(t);resolve();}}); });
const get=await fetch(`http://127.0.0.1:${port}/api/organism/semantic-world`);
assert.equal(get.status,200);
const getBody=await get.json(); assert.equal(getBody.ok,true); assert.ok(getBody.semanticWorldBody);
const post=await fetch(`http://127.0.0.1:${port}/api/organism/semantic-world/ingest`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({vision:{sceneLabel:'lab',confidence01:.9,objects:[{label:'microscope',kind:'object',confidence01:.9}]}})});
assert.equal(post.status,200);
const postBody=await post.json(); assert.equal(postBody.ok,true); assert.ok(postBody.summary);
child.kill('SIGTERM'); await once(child,'exit');
console.log('P35_SERVER=PASS',JSON.stringify({scene:postBody.summary.scene.label,entities:postBody.summary.topEntities.length}));
