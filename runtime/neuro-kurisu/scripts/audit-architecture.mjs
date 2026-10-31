import { readdir, readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { maskNonCode } from './lib/source-mask.mjs';
const root=process.cwd(); const files=[];
async function walk(d){for(const e of await readdir(d,{withFileTypes:true})){const p=path.join(d,e.name); if(e.isDirectory()){if(['legacy-original','legacy','state','node_modules','history','.git','dist','coverage','.grok'].includes(e.name))continue; await walk(p)} else if(/\.(ts|tsx|mts|cts|mjs|cjs|js|jsx)$/.test(e.name)) files.push(p)}}
// Runtime integration tests deliberately import a few canonical React/API source
// seams from the sibling app package. Include those source roots in the graph;
// otherwise the architecture checker reports valid cross-package imports as
// missing simply because it only indexed runtime-local files.
const roots=[path.join(root,'src'),path.join(root,'scripts'),path.join(root,'tests'),path.join(root,'research'),
  path.resolve(root,'../../app/src'),path.resolve(root,'../../app/scripts'),path.resolve(root,'../../app/server')].filter(p=>existsSync(p));
for(const sourceRoot of roots) await walk(sourceRoot);
const pat=/(?:from\s*|import\()(['\"])(\.\.?\/[^'\"]+)\1/g;
const graph=new Map(files.map(f=>[f,[]])); const missing=[]; const canonicalRoot=path.join(root,'src','organism');
function resolve(base,spec){const clean=String(spec).split('?')[0]; const p=path.resolve(path.dirname(base),clean); const c=[p,...['.ts','.tsx','.mts','.cts','.mjs','.cjs','.js','.jsx'].map(e=>p+e),path.join(p,'index.ts'),path.join(p,'index.tsx')]; const indexed=c.find(x=>graph.has(x)||files.includes(x)); if(indexed)return indexed; try{return statSync(p).isFile()?p:undefined}catch{return undefined}}
for(const f of files){
  const t=await readFile(f,'utf8');
  const runtimeText=t.replace(/import\s+type\s+[^;\n]+from\s+['\"][^'\"]+['\"]\s*;?/g,'');
  // Offsets are preserved between runtimeText and masked, so a match whose span is
  // fully blanked by the mask is specifier text inside a comment/string/regex literal
  // (e.g. tests asserting on `source.includes("... from './x.ts'")`), not a real import.
  const masked=maskNonCode(runtimeText);
  let m; while((m=pat.exec(runtimeText))){
    const spec=m[2];
    if(masked.slice(m.index,m.index+m[0].length).trim()==='') continue;
    const r=resolve(f,spec); if(r) graph.get(f).push(r); else missing.push([path.relative(root,f),spec]);
  }
}
if(missing.length) throw new Error(`missing relative imports: ${JSON.stringify(missing.slice(0,10))}`);
const canonicalFiles=files.filter(f=>f.startsWith(canonicalRoot+path.sep));
const leakage=[];
for(const f of canonicalFiles){for(const dep of graph.get(f)){if(dep.includes(`${path.sep}legacy-original${path.sep}`)||dep.includes(`${path.sep}research${path.sep}`)) leakage.push([path.relative(root,f),path.relative(root,dep)]);}}
if(leakage.length) throw new Error(`canonical leakage: ${JSON.stringify(leakage)}`);
const visiting=new Set(), visited=new Set(), cycles=[];
function dfs(n,stack=[]){if(visiting.has(n)){const i=stack.indexOf(n); cycles.push(stack.slice(i).concat(n)); return;} if(visited.has(n)) return; visiting.add(n); for(const d of graph.get(n)||[]) dfs(d,stack.concat(n)); visiting.delete(n); visited.add(n);}
for(const f of files) dfs(f,[]);
if(cycles.length) throw new Error(`import cycles detected: ${JSON.stringify(cycles.slice(0,5).map(c=>c.map(x=>path.relative(root,x))) )}`);
console.log(`CLEAN_ARCHITECTURE=PASS sourceFiles=${files.length} canonicalFiles=${canonicalFiles.length} missing=0 cycles=0 legacyLeakage=0`);
