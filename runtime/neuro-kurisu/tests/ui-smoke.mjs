import {spawn} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp, rm} from 'node:fs/promises';
const port=35000 + Math.floor(Math.random()*3000); const tempState=await mkdtemp(path.join(os.tmpdir(),'nk-ui-smoke-')); const proc=spawn(process.execPath,['--experimental-strip-types','src/server/server.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',STATE_DIR:tempState},stdio:['ignore','pipe','pipe']});
let ready=false; const start=Date.now(); proc.stdout.on('data',b=>{if(String(b).includes(`http://127.0.0.1:${port}`)) ready=true;});
while(!ready&&Date.now()-start<15000) await new Promise(r=>setTimeout(r,100));
if(!ready){proc.kill('SIGTERM');throw new Error('server-start-timeout');}
const get=async(p)=>{const x=await fetch(`http://127.0.0.1:${port}${p}`); if(!x.ok) throw new Error(`${p}:${x.status}`); return x;};
try{
  const html = await (await get('/')).text();
  const appJs = await (await get('/app.js')).text();
  const requiredIds = ['refresh','speak','listen','voice-turn','viewer','camera','sleep','wake','snapshot','avatar-expression','avatar-head-tap','avatar-body-tap','avatar-quality','form','message','send','network','neuromod','memory','evolution','cognitive','science','development','beliefs','social','perception','status'];
  for (const id of requiredIds) if (!html.includes(`id=\"${id}\"`)) throw new Error(`ui-missing:${id}`);
  for (const id of requiredIds.filter((x)=>['refresh','speak','listen','voice-turn','viewer','sleep','wake','snapshot','avatar-expression','avatar-head-tap','avatar-body-tap','avatar-quality','form'].includes(x))) if (!appJs.includes(`$('${id}')`)) throw new Error(`ui-handler-missing:${id}`);
  await get('/app.js'); await get('/style.css'); await get('/avatar.html');
  await get('/api/organism/perception'); const status=await (await get('/api/organism/status')).json(); if(!status.ok) throw new Error('status'); if(!status.cognition?.cognitiveField || status.cognition?.budget == null || !status.advanced?.memoryOS || !status.advanced?.worldModel2 || !status.unifiedMemory || !status.socialDevelopment) throw new Error('cognition-status-missing');
  await get('/api/health'); await get('/api/metrics'); await get('/api/organism/inspect'); await get('/api/organism/avatar');
  for(const [p,body] of [['/api/organism/sleep',{}],['/api/organism/wake',{}],['/api/organism/voice/speak',{text:'test'}],['/api/organism/voice/listen',{}],['/api/organism/voice/interrupt',{reason:'ui-smoke-idle'}]]){
    const x=await fetch(`http://127.0.0.1:${port}${p}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}); const payload=await x.json(); if(!payload || payload.ok===undefined) throw new Error(`${p}:invalid-json`);
    if(p.endsWith('/voice/interrupt')) { if(![200,202,503].includes(x.status)) throw new Error(`${p}:${x.status}`); if(payload.playbackVerified!==false) throw new Error(`${p}:must-not-claim-playback-verification`); }
    else if(p.endsWith('/voice/speak') || p.endsWith('/voice/listen')) { if(x.status===403) { if(payload.approvalRequired!==true) throw new Error(`${p}:403-without-approval-required`); } else if(![200,503].includes(x.status)) throw new Error(`${p}:${x.status}`); }
    else if(!x.ok) throw new Error(`${p}:${x.status}`);
  }
  const chat=await fetch(`http://127.0.0.1:${port}/api/organism/chat`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'проверь гипотезу'})}); if(!chat.ok) throw new Error(`chat:${chat.status}`);
  const voiceStatus=await fetch(`http://127.0.0.1:${port}/api/organism/voice/status`); if(!voiceStatus.ok) throw new Error(`voice-status:${voiceStatus.status}`);
  const voiceTurn=await fetch(`http://127.0.0.1:${port}/api/organism/voice/turn`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({speak:false})}); const voiceTurnBody=await voiceTurn.json(); if(voiceTurn.status===403 ? voiceTurnBody.approvalRequired!==true : ![200,503].includes(voiceTurn.status)) throw new Error(`voice-turn:${voiceTurn.status}`);
  console.log('UI_SMOKE=PASS');
}finally{proc.kill('SIGTERM'); await new Promise(r=>setTimeout(r,300)); await rm(tempState,{recursive:true,force:true});}
