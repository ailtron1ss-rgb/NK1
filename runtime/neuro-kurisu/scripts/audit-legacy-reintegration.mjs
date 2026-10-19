import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const modelPath=path.join(root,'public/live2d/Kurisu/Kurisu.model3.json');
const provenancePath=path.join(root,'public/live2d/PROVENANCE.json');
const viewerPath=path.join(root,'public/live2d/viewer.html');
const refDir=path.join(root,'docs/history/reintegrated-legacy');
const fail=[];
const must=(ok,msg)=>{if(!ok)fail.push(msg)};

must(fs.existsSync(modelPath),'missing canonical Live2D model');
must(fs.existsSync(provenancePath),'missing Live2D provenance');
must(fs.existsSync(viewerPath),'missing Live2D viewer');

if(fs.existsSync(modelPath)){
  const model=JSON.parse(fs.readFileSync(modelPath,'utf8'));
  const refs=model.FileReferences||{};
  const base=path.dirname(modelPath);
  const referenced=[refs.Moc,refs.Physics,refs.DisplayInfo,...(refs.Textures||[]),...(Object.values(refs.Motions||{}).flat().map(x=>x.File)),...(refs.Expressions||[]).map(x=>x.File)].filter(Boolean);
  for(const rel of referenced) must(fs.existsSync(path.join(base,rel)),`missing Live2D reference: ${rel}`);
  must(referenced.length>=10,`unexpectedly small Live2D reference set: ${referenced.length}`);
}

if(fs.existsSync(provenancePath)){
  const p=JSON.parse(fs.readFileSync(provenancePath,'utf8'));
  must(p.integrationStatus==='canonical-public-asset','invalid Live2D integration status');
}

const forbiddenImports=['legacy-original','docs/history/reintegrated-legacy'];
for(const dir of ['src','public']){
  const base=path.join(root,dir);
  if(!fs.existsSync(base)) continue;
  const walk=(d)=>{
    for(const e of fs.readdirSync(d,{withFileTypes:true})){
      const p=path.join(d,e.name);
      if(e.isDirectory())walk(p); else if(/\.(ts|tsx|mjs|js)$/.test(e.name)){
        const t=fs.readFileSync(p,'utf8');
        for(const token of forbiddenImports){
          const importLike=/(?:from\s+['\"]|import\s*\(\s*['\"]|require\s*\(\s*['\"])[^'\"]*$/m;
          const badImportLines=t.split(/\r?\n/).some(line=>importLike.test(line) && line.includes(token));
          must(!badImportLines,`canonical runtime source imports historical path: ${path.relative(root,p)}`);
        }
      }
    }
  };
  walk(base);
}

const references=[];
const walkRef=(d)=>{if(!fs.existsSync(d))return;for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walkRef(p);else references.push(path.relative(refDir,p))}};
walkRef(refDir);
must(references.length>=8,`historical reference packet unexpectedly small: ${references.length}`);
console.log(JSON.stringify({ok:fail.length===0,live2d:fs.existsSync(modelPath),historicalReferenceFiles:references.length,errors:fail},null,2));
if(fail.length)process.exit(1);
