import { execFile, execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile, statfs } from 'node:fs/promises';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { DeviceEvidenceLedger, defaultDeviceEvidence } from '../src/organism/body/DeviceEvidenceLedger.ts';

const exec = promisify(execFile);
const outDir = path.resolve(process.env.NK_DEVICE_GATE_DIR || 'state/device-reality-b321');
await mkdir(outDir, { recursive: true });

async function commandExists(cmd){
  try { await exec('sh',['-lc',`command -v ${cmd}`]); return true; } catch { return false; }
}
async function run(cmd,args=[]){
  try { const {stdout} = await exec(cmd,args,{timeout:5000,maxBuffer:1024*1024}); return {ok:true,stdout:String(stdout)}; }
  catch(error){ return {ok:false,error:String(error?.message||error)}; }
}
function numberOrNull(v){ const n=Number(v); return Number.isFinite(n)?n:null; }

const platform = process.platform;
const node = process.version;
const androidLike = platform === 'android' || await commandExists('getprop');
const termuxCommands = ['termux-battery-status','termux-sensor','termux-wifi-connectioninfo'];
const commandCaps = {};
for (const c of termuxCommands) commandCaps[c] = await commandExists(c);
const battery = commandCaps['termux-battery-status'] ? await run('termux-battery-status') : {ok:false};
const sensors = commandCaps['termux-sensor'] ? await run('termux-sensor',['-n','1']) : {ok:false};
const wifi = commandCaps['termux-wifi-connectioninfo'] ? await run('termux-wifi-connectioninfo') : {ok:false};

let batteryJson=null, wifiJson=null;
try { if(battery.ok) batteryJson=JSON.parse(battery.stdout); } catch{}
try { if(wifi.ok) wifiJson=JSON.parse(wifi.stdout); } catch{}

const mem = {totalBytes:os.totalmem(), freeBytes:os.freemem()};
const freeMiB = Math.round(mem.freeBytes/1048576), totalMiB = Math.round(mem.totalBytes/1048576);
const stateDir = path.resolve(process.env.NK_STATE_DIR || 'state');
await mkdir(stateDir,{recursive:true});
const probeFile = path.join(outDir, '.fs-probe.tmp');
const probePayload = Buffer.alloc(256*1024, 0x4b);
const fsSamples=[];
for(let i=0;i<3;i++){
  const started=performance.now();
  await writeFile(probeFile, probePayload);
  const writeMs=performance.now()-started;
  fsSamples.push(writeMs);
}
await rm(probeFile,{force:true});
const fsWriteMs = fsSamples.reduce((a,b)=>a+b,0)/fsSamples.length;
const fsInfo = await statfs(outDir);

const androidVersion = androidLike ? (await run('getprop',['ro.build.version.release'])).stdout.trim() || null : null;
const model = androidLike ? ((await run('getprop',['ro.product.model'])).stdout.trim() || null) : null;
const abi = androidLike ? ((await run('getprop',['ro.product.cpu.abi'])).stdout.trim() || null) : null;
const termux = androidLike && /termux/i.test(process.env.PREFIX||'') ? true : await commandExists('termux-battery-status');

const batteryPct = numberOrNull(batteryJson?.percentage);
const batteryTempC = numberOrNull(batteryJson?.temperature);
const battery01 = batteryPct == null ? null : Math.max(0,Math.min(1,batteryPct/100));
const telemetry = {
  battery01,
  batteryTemperatureC:batteryTempC,
  thermalPressure01:null,
  cpuLoad01:Math.min(1,Math.max(0,os.loadavg()[0]/Math.max(1,os.cpus().length))),
  ramPressure01:1-(mem.freeBytes/Math.max(1,mem.totalBytes)),
  networkOnline:wifiJson ? wifiJson.ssid !== undefined : null,
  screenInteractive:null,
  ambientLight01:null,
  proximity01:null,
  motion01:null,
  charging: batteryJson?.plugged === 'PLUGGED_AC' || batteryJson?.plugged === 'PLUGGED_USB',
  sampledAt:Date.now(),
  source:androidLike && termux ? 'android-termux' : 'host-probe',
  staleMs:0,
};
const capabilities = {
  battery: !!battery.ok,
  sensors: !!sensors.ok,
  tts: await commandExists('termux-tts-speak'),
  stt: await commandExists('termux-speech-to-text'),
  camera: await commandExists('termux-camera-info'),
  wifi: !!wifi.ok,
};
const attempted = Object.values(commandCaps).length;
const succeeded = Object.entries(commandCaps).filter(([name,present]) => present && ({'termux-battery-status':battery,'termux-sensor':sensors,'termux-wifi-connectioninfo':wifi}[name]?.ok)).length;
const status = androidLike && termux && attempted>0 && succeeded/attempted >= 0.67 ? 'REAL_DEVICE_VERIFIED' : (androidLike || termux ? 'HOST_PROBE' : 'HOST_PROBE');

const ledger = new DeviceEvidenceLedger();
ledger.restore(defaultDeviceEvidence());
ledger.record({at:Date.now(),status,capabilities,telemetry:{telemetry,diagnostics:{sampledAt:Date.now(),commandsAttempted:attempted,commandsSucceeded:succeeded,commandFailures:attempted-succeeded,sensorPayloadValid:!!sensors.ok,batteryPayloadValid:!!battery.ok,wifiPayloadValid:!!wifi.ok,capabilitySnapshot:capabilities,source:telemetry.source}}});
const certification = ledger.certification(1);

const report = {
  gate:'B321_DEVICE_REALITY_GATE',
  version:'35.6.4',
  sampledAt:new Date().toISOString(),
  verdict:status==='REAL_DEVICE_VERIFIED'?'VERIFIED_DEVICE':'HOST_ONLY',
  platform,node,androidLike,termux,androidVersion,model,abi,
  memory:{...mem,totalMiB,freeMiB},
  filesystem:{fsWriteMsAvg:fsWriteMs,freeBytes:Number(fsInfo.bfree)*Number(fsInfo.bsize),blocks:Number(fsInfo.blocks)},
  commands:{availability:commandCaps,attempted,succeeded,successRate01:attempted?succeeded/attempted:0},
  capabilities,telemetry,
  batteryRaw:batteryJson,
  wifiRaw:wifiJson,
  certification,
  rule:'HOST_PROBE never counts as physical-device certification; verified requires live Android/Termux telemetry.',
};
await writeFile(path.join(outDir,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if (process.env.NK_REQUIRE_REAL_DEVICE === '1' && status !== 'REAL_DEVICE_VERIFIED') process.exit(4);
