#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const input=path.join(root,process.argv[2]||'super-config.json');
const output=path.join(root,'.super-config.canonical.json');
let source={};
try{source=JSON.parse(await readFile(input,'utf8'));}catch(err){if(err.code!=='ENOENT')throw err;}
const env={
  NEURO_RUNTIME_MODE: source.NEURO_RUNTIME_MODE ?? source.runtimeMode ?? 'active',
  STATE_DIR: source.STATE_DIR ?? source.stateDir ?? '.super-state/organism',
  NEURO_INTERVAL_MS: source.NEURO_INTERVAL_MS ?? source.intervalMs ?? 30000,
  NEURO_RATE_LIMIT: source.NEURO_RATE_LIMIT ?? source.rateLimit ?? 240,
  NEURO_MAX_BODY_BYTES: source.NEURO_MAX_BODY_BYTES ?? source.maxBodyBytes ?? 256000,
  NEURO_REQUEST_TIMEOUT_MS: source.NEURO_REQUEST_TIMEOUT_MS ?? source.requestTimeoutMs ?? 45000,
  DATABASE_URL: source.DATABASE_URL ? '[redacted]' : null,
  NEURO_API_TOKEN: source.NEURO_API_TOKEN ? '[redacted]' : null,
};
const config={schema:1,generatedAt:new Date().toISOString(),source:input,environment:env,notes:['Secrets are represented only by [redacted] and are never written from raw token values.','Use the corresponding environment variables in deployment.']};
await writeFile(output,JSON.stringify(config,null,2)+'\n'); console.log(JSON.stringify({ok:true,output,secretSafe:true},null,2));
