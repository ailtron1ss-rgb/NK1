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
const graph=new Map(files.map(f=>[f,[]])); const missing=[]; const canonicalRoot=path.join(root,'src','organism');
function resolve(base,spec){const clean=String(spec).split('?')[0]; const p=path.resolve(path.dirname(base),clean); const c=[p,...['.ts','.tsx','.mts','.cts','.mjs','.cjs','.js','.jsx'].map(e=>p+e),path.join(p,'index.ts'),path.join(p,'index.tsx')]; const indexed=c.find(x=>graph.has(x)||files.includes(x)); if(indexed)return indexed; try{return statSync(p).isFile()?p:undefined}catch{return undefined}}
const isIdChar=ch=>ch!==undefined&&/[A-Za-z0-9_$]/.test(ch);
// Import specifiers must be read from real module syntax, not from arbitrary
// text: string literals such as assert.ok(source.includes("from './X.ts'"))
// are documentation strings, not imports, and must not enter the module graph.
function extractRelativeSpecifiers(src){
  const out=[]; const n=src.length; let i=0; let state='code';
  const readStr=start=>{const q=src[start]; let j=start+1; let raw=''; while(j<n){const ch=src[j]; if(ch==='\\'){raw+=ch+(src[j+1]||'');j+=2;continue;} if(ch===q){j++;return{raw,end:j};} if(ch==='\n'&&q!=='`'){return{raw,end:j};} raw+=ch;j++;} return{raw,end:j};};
  while(i<n){
    const c=src[i], c2=src[i+1];
    if(state==='code'){
      if(c==='/'&&c2==='/'){state='line';i+=2;continue;}
      if(c==='/'&&c2==='*'){state='block';i+=2;continue;}
      if(c==="'"||c==='"'||c==='`'){const r=readStr(i); i=r.end; continue;}
      if(c==='f'&&src.startsWith('from',i)&&!isIdChar(src[i-1])&&!isIdChar(src[i+4])){
        let j=i+4; while(j<n&&/\s/.test(src[j]))j++;
        if(src[j]==="'"||src[j]==='"'){const r=readStr(j); if(r.raw.startsWith('.'))out.push(r.raw); i=r.end; continue;}
      }
      if(c==='i'&&src.startsWith('import',i)&&!isIdChar(src[i-1])&&!isIdChar(src[i+6])){
        let j=i+6; while(j<n&&/\s/.test(src[j]))j++;
        if(src.startsWith('type',j)&&!isIdChar(src[j+4])){
          // `import type` is erased at runtime and cannot create a real module
          // edge, so it must not contribute to the graph (and never to cycles).
          let k=j+4; while(k<n){ if(src.startsWith('from',k)&&!isIdChar(src[k-1])&&!isIdChar(src[k+4])){let s=k+4; while(s<n&&/\s/.test(src[s]))s++; if(src[s]==="'"||src[s]==='"'){const r=readStr(s); i=r.end; break;}} k++; }
          if(k>=n) i=j+4;
          continue;
        }
        if(src[j]==='('){j++; while(j<n&&/\s/.test(src[j]))j++; if(src[j]==="'"||src[j]==='"'){const r=readStr(j); if(r.raw.startsWith('.'))out.push(r.raw); i=r.end; continue;}}
        else if(src[j]==="'"||src[j]==='"'){const r=readStr(j); if(r.raw.startsWith('.'))out.push(r.raw); i=r.end; continue;}
      }
      if(c==='r'&&src.startsWith('require',i)&&!isIdChar(src[i-1])&&!isIdChar(src[i+7])){
        let j=i+7; while(j<n&&/\s/.test(src[j]))j++;
        if(src[j]==='('){j++; while(j<n&&/\s/.test(src[j]))j++; if(src[j]==="'"||src[j]==='"'){const r=readStr(j); if(r.raw.startsWith('.'))out.push(r.raw); i=r.end; continue;}}
      }
      i++; continue;
    }
    if(state==='line'){if(c==='\n')state='code'; i++; continue;}
    if(state==='block'){if(c==='*'&&c2==='/'){state='code';i+=2;continue;} i++; continue;}
  }
  return out;
}
for(const f of files){
  const t=await readFile(f,'utf8');
  for(const spec of extractRelativeSpecifiers(t)){
    const r=resolve(f,spec); if(r) graph.get(f).push(r); else missing.push([path.relative(root,f),spec]);
  }
}
if(missing.length) throw new Error(`missing relative imports: ${JSON.stringify(missing.slice(0,10))}`);
const canonicalFiles=files.filter(f=>f.startsWith(canonicalRoot+path.sep));
const researchRoot=path.join(canonicalRoot,'research')+path.sep;
const leakage=[];
for(const f of canonicalFiles){
  // Files inside the research sandbox may depend on their own internals; the
  // invariant is that production code outside research/ never reaches into it.
  if(f.startsWith(researchRoot))continue;
  for(const dep of graph.get(f)){if(dep.includes(`${path.sep}legacy-original${path.sep}`)||dep.includes(`${path.sep}research${path.sep}`)) leakage.push([path.relative(root,f),path.relative(root,dep)]);}}
if(leakage.length) throw new Error(`canonical leakage: ${JSON.stringify(leakage)}`);
const visiting=new Set(), visited=new Set(), cycles=[];
function dfs(n,stack=[]){if(visiting.has(n)){const i=stack.indexOf(n); cycles.push(stack.slice(i).concat(n)); return;} if(visited.has(n)) return; visiting.add(n); for(const d of graph.get(n)||[]) dfs(d,stack.concat(n)); visiting.delete(n); visited.add(n);}
for(const f of files) dfs(f,[]);
if(cycles.length) throw new Error(`import cycles detected: ${JSON.stringify(cycles.slice(0,5).map(c=>c.map(x=>path.relative(root,x))) )}`);
console.log(`CLEAN_ARCHITECTURE=PASS sourceFiles=${files.length} canonicalFiles=${canonicalFiles.length} missing=0 cycles=0 legacyLeakage=0`);
