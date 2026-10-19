import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here=path.dirname(fileURLToPath(import.meta.url));
const packageRoot=path.resolve(here,"..");
const entry=path.join(packageRoot,"src/server/server.mjs");
const source=fs.readFileSync(entry,"utf8");
const specifiers=[];
for(const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*)["']([^"']+)["']/g)){
  const value=match[1]; if(value.startsWith(".")) specifiers.push(value);
}
function resolveImport(value){
  const base=path.resolve(path.dirname(entry),value);
  const candidates=[base,base+".ts",base+".mts",base+".mjs",base+".js",base+".json",path.join(base,"index.ts"),path.join(base,"index.mjs"),path.join(base,"index.js")];
  return candidates.find(candidate=>fs.existsSync(candidate)&&fs.statSync(candidate).isFile())||null;
}
const resolved=specifiers.map(specifier=>({specifier,resolved:resolveImport(specifier)}));
const missing=resolved.filter(item=>!item.resolved);
console.log(JSON.stringify({check:"server-relative-imports",entry:path.relative(packageRoot,entry),checked:resolved.length,missing},null,2));
if(missing.length) process.exitCode=1; else console.log("AUDIT_SERVER_IMPORTS=PASS");
