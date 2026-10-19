#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const thresholds=JSON.parse(await readFile(path.join(root,'contracts/OPERATIONAL_ALERT_THRESHOLDS.json'),'utf8'));
const base=process.env.SUPER_RUNTIME_URL || 'http://127.0.0.1:3310';
const timeout=Number(process.env.SUPER_HEALTH_TIMEOUT_MS||4000);
const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),timeout);
try {
 const health=await (await fetch(`${base}/api/health`,{signal:controller.signal})).json();
 if(!health?.ok) throw new Error('runtime-health-not-ok');
 const metrics=await (await fetch(`${base}/api/metrics`,{signal:controller.signal})).json().catch(()=>({}));
 const result={ok:true,health,metrics,thresholds,checkedAt:new Date().toISOString()}; console.log(JSON.stringify(result,null,2));
} finally { clearTimeout(timer); }
