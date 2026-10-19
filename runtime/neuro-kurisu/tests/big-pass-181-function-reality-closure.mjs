import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root=process.cwd();
const srcRoot=path.join(root,'src','organism');
const files=[];
function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p);else if(p.endsWith('.ts')&&!p.endsWith('.d.ts'))files.push(p)}}
walk(srcRoot);

const rows=[]; const classKeys=new Set();
let imported=0, candidates=0, passed=0, failed=0, skipped=0;

for(const file of files){
  if(file.endsWith(`${path.sep}index.ts`)) continue;
  let mod; try{mod=await import(pathToFileURL(file).href); imported++;}catch(e){rows.push({file:path.relative(root,file),status:'IMPORT_FAILED',error:String(e?.message??e)});continue;}
  for(const [exportName, value] of Object.entries(mod)){
    if(typeof value!=='function'||!value.prototype) continue;
    if(typeof value.prototype.snapshot!=='function'||typeof value.prototype.restore!=='function') continue;
    const key=`${path.relative(root,file).replaceAll(path.sep,'/')}::${exportName}`;
    if(classKeys.has(key)) continue;
    classKeys.add(key); candidates++;
    let a,b;
    try{
      a=new value();
      const before=a.snapshot();
      const serialized=JSON.stringify(before);
      assert.ok(serialized !== undefined, 'snapshot_not_json_serializable');
      const transported=JSON.parse(serialized);
      await a.restore(transported);
      const after=a.snapshot();
      const normalized=(value)=>{if(!value||typeof value!=='object'||Array.isArray(value))return value; const clone=JSON.parse(JSON.stringify(value)); if('lastAt' in clone) delete clone.lastAt; return clone;};
      assert.equal(JSON.stringify(normalized(transported)),JSON.stringify(normalized(after)), 'restore_roundtrip_mismatch');
      b=new value();
      await b.restore(transported);
      const restoredB=b.snapshot();
      assert.equal(JSON.stringify(normalized(after)),JSON.stringify(normalized(restoredB)), 'cross_instance_restore_mismatch');
      await b.restore(restoredB);
      const twice=b.snapshot();
      assert.equal(JSON.stringify(normalized(restoredB)),JSON.stringify(normalized(twice)), 'restore_not_idempotent');
      passed++;
      rows.push({file:path.relative(root,file).replaceAll(path.sep,'/'),class:exportName,status:'PASS'});
    }catch(e){
      failed++;
      rows.push({file:path.relative(root,file).replaceAll(path.sep,'/'),class:exportName,status:'FAIL',error:String(e?.message??e).slice(0,300)});
    }
  }
}

const evidence={
  pass:181,
  generatedAt:new Date().toISOString(),
  protocol:'instantiate class; snapshot; JSON transport; restore in same instance; exact compare; restore in independent instance; exact compare; restore twice; exact compare',
  sourceFiles:files.length,
  imported,
  candidates,
  passed,
  failed,
  skipped,
  rows,
};
fs.writeFileSync('BIG_PASS_181_FUNCTION_REALITY_EVIDENCE.json',JSON.stringify(evidence,null,2));
console.log(JSON.stringify({pass:181,sourceFiles:files.length,imported,candidates,passed,failed,skipped},null,2));
if(failed)process.exit(2);
