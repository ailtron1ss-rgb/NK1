import { readdir, readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
const root=process.cwd(); const files=[];
async function walk(d){for(const e of await readdir(d,{withFileTypes:true})){const p=path.join(d,e.name); if(e.isDirectory()){if(['legacy-original','legacy','state','node_modules','history','.git','dist','coverage','.grok'].includes(e.name))continue; await walk(p)} else if(/\.(ts|tsx|mts|cts|mjs|cjs|js|jsx)$/.test(e.name)) files.push(p)}}
// Runtime integration tests deliberately import a few canonical React/API source
// seams from the sibling app package. Include those source roots in the graph;
// otherwise the architecture checker reports valid cross-package imports as
// missing simply because it only indexed runtime-local files.
const roots=[path.join(root,'src'),path.join(root,'scripts'),path.join(root,'tests'),path.join(root,'research'),
  path.resolve(root,'../../app/src'),path.resolve(root,'../../app/scripts'),path.resolve(root,'../../app/server')].filter(p=>existsSync(p));
for(const sourceRoot of roots) await walk(sourceRoot);
const pat=/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)(['"])(\.\.?\/[^'"]+)\1/g;
const fileSet=new Set(files); const graph=new Map(files.map(f=>[f,[]])); const missing=[]; const canonicalRoot=path.join(root,'src','organism');
function resolve(base,spec){
  const clean=String(spec).split(/[?#]/,1)[0];
  const p=path.resolve(path.dirname(base),clean);
  const extensions=['.ts','.tsx','.mts','.cts','.mjs','.cjs','.js','.jsx','.json','.css','.svg'];
  const c=[p,...extensions.map(e=>p+e),path.join(p,'index.ts'),path.join(p,'index.tsx'),path.join(p,'index.mjs'),path.join(p,'index.js')];
    const emittedSuffix=p.match(/\.(mjs|cjs|js|jsx)$/i)?.[0];
  if(emittedSuffix){const stem=p.slice(0,-emittedSuffix.length); c.push(stem+'.ts',stem+'.tsx',stem+'.mts',stem+'.cts');}
  const indexed=c.find(x=>graph.has(x)||fileSet.has(x));
  if(indexed)return indexed;
  try{return statSync(p).isFile()?p:undefined}catch{return undefined}
}
for(const f of files){
  const t=await readFile(f,'utf8');
  const runtimeText=t.replace(/import\s+type\s+[^;\n]+from\s+['\"][^'\"]+['\"]\s*;?/g,'');
  let m; while((m=pat.exec(runtimeText))){
    const spec=m[2]; const r=resolve(f,spec); if(r) graph.get(f).push(r); else missing.push([path.relative(root,f),spec]);
  }
}
if(missing.length) throw new Error(`missing relative imports: ${JSON.stringify(missing.slice(0,10))}`);
const canonicalFiles=files.filter(f=>f.startsWith(canonicalRoot+path.sep));
const pathIsInside=(file, directory)=>{
  const rel=path.relative(directory,file);
  return rel==='' || (rel!=='..' && !rel.startsWith('..'+path.sep) && !path.isAbsolute(rel));
};
const hasPathSegment=(file, segment)=>path.normalize(file).split(path.sep).includes(segment);
const appSourceRoot=path.resolve(root,'../../app/src');
const appServerRoot=path.resolve(root,'../../app/server');
const runtimeServerRoot=path.join(root,'src','server');
const boundaryViolations=[];

// The canonical organism implementation may depend on core contracts and
// adapters, but never on delivery/UI code, server routing, research snapshots,
// or legacy trees. These edges create reverse dependencies and duplicate owners.
const coreForbiddenRoots=[
  ['app-source',appSourceRoot],
  ['app-server',appServerRoot],
  ['runtime-server',runtimeServerRoot],
];
for(const f of canonicalFiles){
  for(const dep of graph.get(f)||[]){
    const from=path.relative(root,f);
    const to=path.relative(root,dep);
    for(const [boundary, targetRoot] of coreForbiddenRoots){
      if(pathIsInside(dep,targetRoot)) boundaryViolations.push({rule:'canonical-core-to-outward-layer',boundary,from,to});
    }
    if(hasPathSegment(dep,'research')) boundaryViolations.push({rule:'canonical-core-to-research',from,to});
    if(hasPathSegment(dep,'legacy')||hasPathSegment(dep,'legacy-original')) boundaryViolations.push({rule:'canonical-core-to-legacy',from,to});
  }
}

// The app is an API consumer. A direct source import from the UI into the
// runtime bypasses the versioned HTTP boundary and makes the browser a second
// runtime owner. Test code lives outside app/src and is not covered by this rule.
for(const f of files.filter(file=>pathIsInside(file,appSourceRoot))){
  for(const dep of graph.get(f)||[]){
    if(pathIsInside(dep,path.join(root,'src'))){
      boundaryViolations.push({
        rule:'app-source-to-runtime-private-import',
        from:path.relative(root,f),
        to:path.relative(root,dep),
      });
    }
  }
}
if(boundaryViolations.length){
  throw new Error('dependency boundary violations: '+JSON.stringify(boundaryViolations.slice(0,50))+(boundaryViolations.length>50?' (truncated)':''));
}
const visiting=new Set(), visited=new Set(), cycles=[];
function dfs(n,stack=[]){if(visiting.has(n)){const i=stack.indexOf(n); cycles.push(stack.slice(i).concat(n)); return;} if(visited.has(n)) return; visiting.add(n); for(const d of graph.get(n)||[]) dfs(d,stack.concat(n)); visiting.delete(n); visited.add(n);}
for(const f of files) dfs(f,[]);
if(cycles.length) throw new Error(`import cycles detected: ${JSON.stringify(cycles.slice(0,5).map(c=>c.map(x=>path.relative(root,x))) )}`);
console.log(`CLEAN_ARCHITECTURE=PASS sourceFiles=${files.length} canonicalFiles=${canonicalFiles.length} missing=0 cycles=0 legacyLeakage=0`);
