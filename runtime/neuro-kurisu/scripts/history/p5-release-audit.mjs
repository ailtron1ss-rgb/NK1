import fs from 'node:fs/promises';
import path from 'node:path';

const root=new URL('..',import.meta.url).pathname;
const read=async rel=>fs.readFile(path.join(root,rel),'utf8');
const version=JSON.parse(await read('VERSION.json'));
const pkg=JSON.parse(await read('package.json'));
const errors=[];
if(version.application!=='clean-rebuild-3.0.0') errors.push('VERSION.application mismatch');
if(version.phase!=='P5-autonomous-self-authorship') errors.push('VERSION.phase mismatch');
if(version.organismStateSchema!==7) errors.push('VERSION schema mismatch');
if(pkg.version!=='3.0.0') errors.push('package version mismatch');
if(!pkg.scripts['research:p5']||!pkg.scripts['organism:p5']) errors.push('P5 npm scripts missing');
const canonical=(await import('./audit-architecture.mjs')).default;
if(errors.length){console.error('P5_RELEASE_AUDIT=FAIL',errors);process.exit(1);} console.log('P5_RELEASE_AUDIT=PASS');
