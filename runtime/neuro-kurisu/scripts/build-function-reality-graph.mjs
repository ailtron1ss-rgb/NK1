import fs from 'node:fs';
import path from 'node:path';
import { ts } from './lib/resolve-typescript.mjs';
const root=process.cwd();
const ignored=new Set(['node_modules','.git','legacy-original','state','history']);
const files=[];
function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(ignored.has(ent.name))continue;const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p);else if(/\.(ts|tsx|mjs|js)$/.test(ent.name))files.push(p);}}
for(const d of ['src','tests','research','scripts']) if(fs.existsSync(path.join(root,d))) walk(path.join(root,d));
const srcFiles=files.filter(f=>f.includes(`${path.sep}src${path.sep}`));
const testFiles=files.filter(f=>f.includes(`${path.sep}tests${path.sep}`));
const text=new Map(files.map(f=>[f,fs.readFileSync(f,'utf8')]));
const ast=new Map();
for(const f of files){const t=text.get(f); ast.set(f,ts.createSourceFile(f,t,ts.ScriptTarget.Latest,true,/\.tsx$/.test(f)?ts.ScriptKind.TSX:/\.mjs$/.test(f)?ts.ScriptKind.JS:ts.ScriptKind.TS));}
function rel(f){return path.relative(root,f).replaceAll(path.sep,'/');}
function resolveImport(base,spec){if(!spec.startsWith('.'))return null;const p=path.resolve(path.dirname(base),spec);const c=[p,...['.ts','.tsx','.mjs','.js'].map(e=>p+e),path.join(p,'index.ts')];return c.find(x=>ast.has(x))??null;}
const decls=new Map(); const byFile=new Map(); const imports=new Map();
function addDecl(d){decls.set(d.id,d); if(!byFile.has(d.file))byFile.set(d.file,[]); byFile.get(d.file).push(d);}
for(const f of files){const sf=ast.get(f);const list=[];const importMap=new Map();
  for(const st of sf.statements){
    if(ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier)){
      const target=resolveImport(f,st.moduleSpecifier.text); if(!target)continue;
      const clause=st.importClause; if(!clause)continue;
      if(clause.name) importMap.set(clause.name.text,{target,imported:'default'});
      const nb=clause.namedBindings;
      if(nb && ts.isNamespaceImport(nb)) importMap.set(nb.name.text,{target,namespace:true});
      if(nb && ts.isNamedImports(nb)) for(const el of nb.elements){importMap.set(el.name.text,{target,imported:(el.propertyName??el.name).text});}
    }
  }
  imports.set(f,importMap);
  function visit(n,className=null){
    if(ts.isClassDeclaration(n) && n.name){
      const cls=n.name.text;
      const classId=`${rel(f)}::class:${cls}`;
      addDecl({id:classId,file:f,rel:rel(f),name:cls,kind:'class',className:cls,start:n.getStart(sf),end:n.getEnd(),line:sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1,exported:Boolean(n.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)),body:true});
      for(const m of n.members){
        if(ts.isMethodDeclaration(m)||ts.isGetAccessor(m)||ts.isSetAccessor(m)||ts.isConstructorDeclaration(m)){
          const name=m.name?.getText(sf)??'constructor';
          addDecl({id:`${rel(f)}::${cls}.${name}:${sf.getLineAndCharacterOfPosition(m.getStart(sf)).line+1}`,file:f,rel:rel(f),name,kind:ts.isConstructorDeclaration(m)?'constructor':'method',className:cls,start:m.getStart(sf),end:m.getEnd(),line:sf.getLineAndCharacterOfPosition(m.getStart(sf)).line+1,exported:Boolean(n.modifiers?.some(x=>x.kind===ts.SyntaxKind.ExportKeyword)),body:Boolean(m.body),node:m});
        }
      }
    }
    if(ts.isFunctionDeclaration(n) && n.name){addDecl({id:`${rel(f)}::function:${n.name.text}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1}`,file:f,rel:rel(f),name:n.name.text,kind:'function',className:null,start:n.getStart(sf),end:n.getEnd(),line:sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1,exported:Boolean(n.modifiers?.some(x=>x.kind===ts.SyntaxKind.ExportKeyword)),body:Boolean(n.body),node:n});}
    ts.forEachChild(n,c=>visit(c,className??(ts.isClassDeclaration(n)&&n.name?n.name.text:null)));
  }
  ts.forEachChild(sf,n=>{
    if(ts.isClassDeclaration(n)||ts.isFunctionDeclaration(n)||ts.isVariableStatement(n)) visit(n,null);
  });
}
// Deduplicate class records created by nested visitation.
for(const [id,d] of [...decls]){ if(!d.node && d.kind==='class') continue; }
const topFunction=(file,name)=>[...(byFile.get(file)||[])].find(d=>d.kind==='function'&&d.name===name);
const method=(file,cls,name)=>[...(byFile.get(file)||[])].find(d=>d.kind==='method'&&d.className===cls&&d.name===name);
const classDecl=(file,name)=>[...(byFile.get(file)||[])].find(d=>d.kind==='class'&&d.name===name);
const edges=new Map([...decls.keys()].map(id=>[id,[]]));
const incoming=new Map([...decls.keys()].map(id=>[id,[]]));
function addEdge(from,to,kind,site){if(!from||!to||from===to)return;if(!edges.has(from))edges.set(from,[]);if(!edges.get(from).some(e=>e.to===to)){edges.get(from).push({to,kind,site});incoming.get(to).push({from,kind,site});}}
function enclosingDecl(file,pos){return [...(byFile.get(file)||[])].filter(d=>d.node&&d.start<=pos&&pos<=d.end&&d.kind!=='class').sort((a,b)=>(b.end-b.start)-(a.end-a.start))[0]??null;}
function enclosingClass(file,pos){return [...(byFile.get(file)||[])].filter(d=>d.kind==='method'&&d.start<=pos&&pos<=d.end).sort((a,b)=>(b.end-b.start)-(a.end-a.start))[0]?.className??null;}
const propertyClassMap=new Map();
for(const f of srcFiles){const sf=ast.get(f), im=imports.get(f)||new Map();
  function resolveClassName(name){
    if(!name) return null;
    return classDecl(f,name)?.name
      ? classDecl(f,name)
      : (im.get(name)?.target ? classDecl(im.get(name).target,im.get(name).imported||name) : null);
  }
  function mapProperty(propName,target){ if(propName && target) propertyClassMap.set(`${f}::${propName}`,target); }
  function visit(n){
    if(ts.isPropertyDeclaration(n) && n.name){
      const propName=n.name.getText(sf);
      if(n.initializer && ts.isNewExpression(n.initializer) && ts.isIdentifier(n.initializer.expression)) mapProperty(propName,resolveClassName(n.initializer.expression.text));
      if(!n.initializer && n.type && ts.isTypeReferenceNode(n.type) && ts.isIdentifier(n.type.typeName)) mapProperty(propName,resolveClassName(n.type.typeName.text));
    }
    if(ts.isBinaryExpression(n) && n.operatorToken.kind===ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(n.left) && ts.isThis(n.left.expression) && ts.isNewExpression(n.right) && ts.isIdentifier(n.right.expression)){
      mapProperty(n.left.name.text,resolveClassName(n.right.expression.text));
    }
    if(ts.isCallExpression(n) || ts.isNewExpression(n)){
      const pos=n.getStart(sf), caller=enclosingDecl(f,pos); if(caller){
        let target=null, kind='call';
        if(ts.isIdentifier(n.expression)){
          const name=n.expression.text;
          target=topFunction(f,name)||method(f,enclosingClass(f,pos),name);
          if(!target){const imap=im.get(name); if(imap?.target){target=imap.namespace?null:(topFunction(imap.target,imap.imported)||classDecl(imap.target,imap.imported));}}
        } else if(ts.isPropertyAccessExpression(n.expression)){
          const recvNode=n.expression.expression, recv=recvNode.getText(sf), name=n.expression.name.text;
          if(ts.isThis(recvNode)) target=method(f,enclosingClass(f,pos),name);
          else if(ts.isPropertyAccessExpression(recvNode) && ts.isThis(recvNode.expression)){
            const pc=propertyClassMap.get(`${f}::${recvNode.name.text}`); if(pc) target=method(pc.file,pc.name,name);
            if(!target) target=method(f,enclosingClass(f,pos),name);
          } else if(recv && recv!=='super'){
            const pc=propertyClassMap.get(`${f}::${recv}`); if(pc) target=method(pc.file,pc.name,name);
          }
          if(!target){
            const base=n.expression.expression;
            if(ts.isIdentifier(base)){const imap=im.get(base.text); if(imap?.namespace) target=method(imap.target,imap.imported,name);}
          }
        }
        if(ts.isNewExpression(n)) kind='construct';
        if(target){addEdge(caller.id,target.id,kind,`${rel(f)}:${sf.getLineAndCharacterOfPosition(pos).line+1}`);}
      }
    }
    ts.forEachChild(n,visit);
  }
  ts.forEachChild(sf,visit);
}
// Test/source references to declarations. Use one identifier index per file, not declaration × file rescans.
const globalSourceCounts=new Map(); const globalTestCounts=new Map();
function countIdentifiers(t,map){const rx=/\b[A-Za-z_$][\w$]*\b/g;let m;while((m=rx.exec(t)))map.set(m[0],(map.get(m[0])??0)+1);}
for(const f of srcFiles) countIdentifiers(text.get(f),globalSourceCounts);
for(const f of testFiles) countIdentifiers(text.get(f),globalTestCounts);
const tokenRefs=new Map(); for(const d of decls.values()){
  const selfCount=(text.get(d.file).slice(d.start,d.end).match(new RegExp(`\\b${d.name.replace(/[.*+?^${}()|[\\]\\]/g,'\\\\$&')}\\b`,'g'))||[]).length;
  const source=Math.max(0,(globalSourceCounts.get(d.name)??0)-selfCount);
  const tests=globalTestCounts.get(d.name)??0;
  tokenRefs.set(d.id,{source,tests});
}
// Runtime roots are intentionally narrow. Exported-by-itself is not evidence of runtime use.
// Tests are tracked separately so a function can be TEST_ONLY without polluting runtime reachability.
const runtimeRoots = new Set();
for(const f of srcFiles){
  if(/OrganismRuntime\.ts$/.test(f) || /server\.(mjs|ts)$/.test(f) || /main\.(mjs|ts)$/.test(f)){
    for(const d of byFile.get(f)||[]) if(d.kind==='class' || d.name==='init' || d.name==='step' || d.name==='autonomousStep' || d.name==='runAutonomousCycles' || d.name==='main' || d.name==='start') runtimeRoots.add(d.id);
  }
}
const runtimeReachable=new Set(); const queue=[...runtimeRoots]; while(queue.length){const id=queue.shift();if(runtimeReachable.has(id))continue;runtimeReachable.add(id);for(const e of edges.get(id)||[])queue.push(e.to);}
const categories={}; for(const d of decls.values()){
  const incomingCount=(incoming.get(d.id)||[]).length; const r=tokenRefs.get(d.id)||{source:0,tests:0};
  let category='ORPHAN';
  if(runtimeReachable.has(d.id)) category='RUNTIME_REACHABLE';
  else if(r.tests>0 && r.source===0) category='TEST_ONLY';
  else if(r.source>0) category='REFERENCED_NOT_RUNTIME_REACHABLE';
  categories[d.id]={id:d.id,file:d.rel,name:d.name,kind:d.kind,className:d.className,line:d.line,exported:d.exported,incoming:incomingCount,outgoing:(edges.get(d.id)||[]).length,sourceReferences:r.source,testReferences:r.tests,category};
}
const counts={RUNTIME_REACHABLE:0,TEST_ONLY:0,REFERENCED_NOT_RUNTIME_REACHABLE:0,ORPHAN:0};for(const x of Object.values(categories))counts[x.category]++;
const priority=Object.values(categories).filter(x=>x.category!=='RUNTIME_REACHABLE'&&x.kind!=='class').sort((a,b)=>(b.testReferences-a.testReferences)||(b.sourceReferences-a.sourceReferences)).slice(0,600);
const graph={pass:190,generatedAt:new Date().toISOString(),definition:'Static structural graph used to distinguish runtime reachability from test-only or orphaned code. Exported status alone is never a runtime root; semantic VERIFIED remains a separate behavioural gate.',files:files.length,sourceFiles:srcFiles.length,declarations:Object.keys(categories).length,counts,runtimeRoots:[...runtimeRoots],nodes:categories,edges:Object.fromEntries([...edges.entries()].map(([k,v])=>[k,v])) ,priorityUnreachable:priority};
fs.writeFileSync('FUNCTION_REALITY_GRAPH.json',JSON.stringify(graph,null,2));
const md=[
'# BIG PASS 190 — FUNCTION REALITY GRAPH','',`Generated: ${graph.generatedAt}`,'',
'## Meaning','',graph.definition,'',
'| Category | Count |','|---|---:|',...Object.entries(counts).map(([k,v])=>`| ${k} | ${v} |`),'',
'## Reachability rule','',
'- Runtime entrypoints are narrow seeds; exported-by-itself is not runtime evidence.','- Tests are tracked independently and never promote runtime reachability.','- Static call edges are conservative; unresolved dynamic dispatch is never assumed reachable.','- RUNTIME_REACHABLE is not equivalent to VERIFIED.','',
'## Highest-priority unreachable / test-only functions','',
'| File | Function | Kind | Src refs | Test refs | Category |','|---|---|---|---:|---:|---|',
...priority.slice(0,300).map(x=>`| ${x.file} | ${x.name} | ${x.kind} | ${x.sourceReferences} | ${x.testReferences} | ${x.category} |`)
].join('\n'); fs.writeFileSync('FUNCTION_REALITY_GRAPH_RU.md',md);
console.log(JSON.stringify({pass:190,files:graph.files,sourceFiles:graph.sourceFiles,declarations:graph.declarations,counts},null,2));
