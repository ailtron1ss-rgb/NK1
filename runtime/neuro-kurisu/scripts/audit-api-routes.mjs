import { readFile } from 'node:fs/promises';
const text=await readFile('src/server/server.mjs','utf8');
const re=/req\.method === ['\"](GET|POST|PUT|PATCH|DELETE)['\"] && url\.pathname === ['\"]([^'\"]+)['\"]/g; const seen=new Set(), dup=[]; let m;
while((m=re.exec(text))){const k=`${m[1]} ${m[2]}`; if(seen.has(k)) dup.push(k); seen.add(k);}
console.log(`API_ROUTES=${seen.size} duplicates=${dup.length}`); if(dup.length){console.error(dup.join('\n'));process.exit(1)}
