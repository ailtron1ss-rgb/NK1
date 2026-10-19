import {spawn} from 'node:child_process';
const p=spawn(process.execPath,['--experimental-strip-types','scripts/parameterized-function-probe.mjs'],{stdio:'inherit'}); const code=await new Promise(r=>p.on('close',r)); if(code!==0)process.exit(code);
