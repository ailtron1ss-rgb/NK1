import { readdir, readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { collectDependencyBoundaryViolations } from './dependency-boundary-policy.mjs';
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
const appSourceRoot=path.resolve(root,'../../app/src');
const appServerRoot=path.resolve(root,'../../app/server');
const runtimeServerRoot=path.join(root,'src','server');
const boundaryViolations=collectDependencyBoundaryViolations({
  root, files, graph, canonicalRoot, appSourceRoot, appServerRoot, runtimeServerRoot,
});
if(boundaryViolations.length){
  throw new Error('dependency boundary violations: '+JSON.stringify(boundaryViolations.slice(0,50))+(boundaryViolations.length>50?' (truncated)':''));
}
const visiting=new Set(), visited=new Set(), cycles=[];
function dfs(n,stack=[]){if(visiting.has(n)){const i=stack.indexOf(n); cycles.push(stack.slice(i).concat(n)); return;} if(visited.has(n)) return; visiting.add(n); for(const d of graph.get(n)||[]) dfs(d,stack.concat(n)); visiting.delete(n); visited.add(n);}
for(const f of files) dfs(f,[]);
if(cycles.length) throw new Error(`import cycles detected: ${JSON.stringify(cycles.slice(0,5).map(c=>c.map(x=>path.relative(root,x))) )}`);
const dependencyEdges=[...graph.values()].reduce((total,edges)=>total+edges.length,0);
console.log(`CLEAN_ARCHITECTURE=PASS sourceFiles=${files.length} canonicalFiles=${canonicalFiles.length} dependencyEdges=${dependencyEdges} missing=0 cycles=0 legacyLeakage=0 boundaryViolations=0`);
