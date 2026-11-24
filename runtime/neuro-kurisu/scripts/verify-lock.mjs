import fs from 'node:fs/promises';
const lock=JSON.parse(await fs.readFile('package-lock.json','utf8'));
if(lock.lockfileVersion < 3) throw new Error('expected lockfileVersion >=3');
const keys=Object.keys(lock.packages||{}); if(keys.some(k=>k!=='')) throw new Error(`unexpected external lock entries: ${keys.join(',')}`);
console.log('LOCKFILE=PASS zero-dependency-tree');
