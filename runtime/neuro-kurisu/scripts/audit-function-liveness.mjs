import fs from 'node:fs';
import path from 'node:path';
import { ts } from './lib/resolve-typescript.mjs';
const root=process.cwd();
const files=[];
function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(['node_modules','legacy-original','.git','state'].includes(e.name))continue;const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(/\.(ts|tsx|mjs)$/.test(e.name))files.push(p)}}
walk(path.join(root,'src')); for(const base of ['tests','research','scripts']) if(fs.existsSync(path.join(root,base))) walk(path.join(root,base));
const decls=[]; const globalCounts=new Map(); const localCounts=new Map();
for(const f of files){
  const text=fs.readFileSync(f,'utf8');
  const sf=ts.createSourceFile(f,text,ts.ScriptTarget.Latest,true,f.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const idx=new Map(); const rx=/\b[A-Za-z_$][\w$]*\b/g; let m;
  while((m=rx.exec(text))) { idx.set(m[0],(idx.get(m[0])??0)+1); globalCounts.set(m[0],(globalCounts.get(m[0])??0)+1); }
  localCounts.set(f,idx);
  function visit(n){
    if(ts.isFunctionDeclaration(n)||ts.isMethodDeclaration(n)||ts.isGetAccessor(n)||ts.isSetAccessor(n)||ts.isConstructorDeclaration(n)){
      const name=n.name?.getText(sf)??'constructor';
      if(name){const start=sf.getLineAndCharacterOfPosition(n.getStart(sf)); decls.push({file:f,name,line:start.line+1,start:n.getStart(sf),end:n.getEnd(),kind:ts.isMethodDeclaration(n)?'method':ts.isFunctionDeclaration(n)?'function':ts.isConstructorDeclaration(n)?'constructor':'accessor',body:Boolean(n.body),paramCount:n.parameters?.length??0,exported:Boolean(n.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))});}
    }
    ts.forEachChild(n,visit);
  }
  ts.forEachChild(sf,visit);
}
const testCounts=new Map();
for(const f of files.filter(x=>x.includes(`${path.sep}tests${path.sep}`))){
  const idx=localCounts.get(f); if(!idx) continue;
  for(const [name,count] of idx) testCounts.set(name,(testCounts.get(name)??0)+count);
}
const escapeRegex=(value)=>String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
for(const d of decls){
  const ownText=fs.readFileSync(d.file,'utf8').slice(d.start,d.end);
  const ownRx=new RegExp('\\b'+escapeRegex(d.name)+'\\b','g');
  let own=0,m; while((m=ownRx.exec(ownText))) own++;
  d.refs=Math.max(0,(globalCounts.get(d.name)??0)-own);
  d.testReferences=testCounts.get(d.name)??0;
}
const zero=decls.filter(d=>d.body&&d.refs===0); const low=decls.filter(d=>d.body&&d.refs<=1);
const result={pass:190,generatedAt:new Date().toISOString(),sourceFiles:files.length,functionLikeDeclarations:decls.length,withBody:decls.filter(d=>d.body).length,exported:decls.filter(d=>d.exported).length,zeroReference:zero.length,oneOrLessReference:low.length,algorithm:'single global source index + single global test index + declaration-local subtraction (linear test attribution)',topZero:zero.slice(0,2000).map(({file,name,line,kind,paramCount,testReferences})=>({file:path.relative(root,file),name,line,kind,paramCount,testReferences}))};
fs.writeFileSync('FUNCTION_LIVENESS_AUDIT.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
