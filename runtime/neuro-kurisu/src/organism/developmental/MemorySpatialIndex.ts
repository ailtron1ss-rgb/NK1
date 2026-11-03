/**
 * Derived, bounded 3D spatial index for canonical MemoryOS2 records.
 * Canonical points remain in MemoryItem2.context; this module owns no memory.
 */
export interface MemorySpatialQuery { frameId:string; x:number; y:number; z?:number; radius:number; }
export interface MemorySpatialPoint { frameId:string; x:number; y:number; z:number; }
export interface MemorySpatialHit { id:string; distance:number; relevance01:number; }

const CELL_SIZE=4, MAX_COORDINATE=1_000_000, MAX_RADIUS=24, MAX_QUERY_CELLS=4096;
const DEFAULT_HITS=64, MAX_HITS=128;

function ownDataRecord(value:unknown):Record<string,unknown>|null {
 try {
  if(!value||typeof value!=="object"||Array.isArray(value))return null;
  const prototype=Object.getPrototypeOf(value);
  if(prototype!==Object.prototype&&prototype!==null)return null;
  const descriptors=Object.getOwnPropertyDescriptors(value);
  const result:Record<string,unknown>=Object.create(null);
  for(const key of Reflect.ownKeys(descriptors)){
   if(typeof key!=="string")return null;
   const descriptor=descriptors[key];
   if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,"value")||
      descriptor.get!==undefined||descriptor.set!==undefined)return null;
   result[key]=descriptor.value;
  }
  return result;
 }catch{return null;}
}
function validFrameId(value:unknown):string|null {
 if(typeof value!=="string")return null;
 const frameId=value.normalize("NFKC").trim();
 return frameId&&frameId.length<=64&&!/[\u0000-\u001f\u007f]/u.test(frameId)?frameId:null;
}
function coordinate(value:unknown):number|null {
 let parsed:number;
 if(typeof value==="number")parsed=value;
 else if(typeof value==="string"&&/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu.test(value.trim()))parsed=Number(value.trim());
 else return null;
 return Number.isFinite(parsed)&&Math.abs(parsed)<=MAX_COORDINATE?parsed:null;
}
export function spatialPointFromContext(context?:Record<string,string>):MemorySpatialPoint|null {
 // Context may originate at an external ingestion boundary. Copy own data
 // properties only; never execute getters or proxy traps while deriving an index.
 const row=ownDataRecord(context);
 if(!row)return null;
 const frameId=validFrameId(row.spatialFrameId),x=coordinate(row.spatialX),y=coordinate(row.spatialY);
 const z=row.spatialZ===undefined?0:coordinate(row.spatialZ);
 return frameId&&x!==null&&y!==null&&z!==null?{frameId,x,y,z}:null;
}
export function normalizeMemorySpatialQuery(value:unknown):MemorySpatialQuery|null {
 const row=ownDataRecord(value);if(!row)return null;
 const frameId=validFrameId(row.frameId),x=coordinate(row.x),y=coordinate(row.y);
 const z=row.z===undefined?0:coordinate(row.z),radius=coordinate(row.radius);
 if(!frameId||x===null||y===null||z===null||radius===null||radius<=0||radius>MAX_RADIUS)return null;
 const minX=Math.floor((x-radius)/CELL_SIZE),maxX=Math.floor((x+radius)/CELL_SIZE);
 const minY=Math.floor((y-radius)/CELL_SIZE),maxY=Math.floor((y+radius)/CELL_SIZE);
 const minZ=Math.floor((z-radius)/CELL_SIZE),maxZ=Math.floor((z+radius)/CELL_SIZE);
 const cells=(maxX-minX+1)*(maxY-minY+1)*(maxZ-minZ+1);
 if(!Number.isSafeInteger(cells)||cells<1||cells>MAX_QUERY_CELLS)return null;
 return {frameId,x,y,z,radius};
}
function cellCoordinates(point:MemorySpatialPoint):[number,number,number] {
 return [Math.floor(point.x/CELL_SIZE),Math.floor(point.y/CELL_SIZE),Math.floor(point.z/CELL_SIZE)];
}
function cellKey(frameId:string,x:number,y:number,z:number):string{return JSON.stringify([frameId,x,y,z]);}

export class MemorySpatialIndex {
 private readonly cells=new Map<string,Set<string>>();
 private readonly cellById=new Map<string,string>();
 private readonly pointById=new Map<string,MemorySpatialPoint>();
 clear():void{this.cells.clear();this.cellById.clear();this.pointById.clear();}
 remove(id:string):boolean {
  const key=this.cellById.get(id),existed=this.pointById.delete(id);this.cellById.delete(id);
  if(key){const members=this.cells.get(key);if(members){members.delete(id);if(members.size===0)this.cells.delete(key);}}
  return existed;
 }
 upsert(id:string,context?:Record<string,string>):boolean {
  if(typeof id!=="string"||!id.trim()||id.length>160)return false;
  // Validate the replacement before mutating the current derived index. A refused
  // update leaves the last validated point intact; canonical callers explicitly
  // remove first when they intentionally clear a point from the owning memory.
  const point=spatialPointFromContext(context);if(!point)return false;
  this.remove(id);
  const [x,y,z]=cellCoordinates(point),key=cellKey(point.frameId,x,y,z);
  let members=this.cells.get(key);if(!members){members=new Set<string>();this.cells.set(key,members);}
  members.add(id);this.cellById.set(id,key);this.pointById.set(id,point);return true;
 }
 query(input:unknown,limit=DEFAULT_HITS):MemorySpatialHit[] {
  const query=normalizeMemorySpatialQuery(input);if(!query)return [];
  const safeLimit=Number.isFinite(limit)?Math.max(1,Math.min(MAX_HITS,Math.floor(limit))):DEFAULT_HITS;
  const minX=Math.floor((query.x-query.radius)/CELL_SIZE),maxX=Math.floor((query.x+query.radius)/CELL_SIZE);
  const minY=Math.floor((query.y-query.radius)/CELL_SIZE),maxY=Math.floor((query.y+query.radius)/CELL_SIZE);
  const minZ=Math.floor((query.z!-query.radius)/CELL_SIZE),maxZ=Math.floor((query.z!+query.radius)/CELL_SIZE);
  const radiusSquared=query.radius*query.radius,hits:MemorySpatialHit[]=[],seen=new Set<string>();
  for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++)for(let z=minZ;z<=maxZ;z++){
   const members=this.cells.get(cellKey(query.frameId,x,y,z));if(!members)continue;
   for(const id of members){
    if(seen.has(id))continue;seen.add(id);const point=this.pointById.get(id);if(!point)continue;
    const dx=point.x-query.x,dy=point.y-query.y,dz=point.z-query.z!,distanceSquared=dx*dx+dy*dy+dz*dz;
    if(distanceSquared>radiusSquared)continue;
    const distance=Math.sqrt(distanceSquared);
    hits.push({id,distance,relevance01:Math.max(0,Math.min(1,1-distance/query.radius))});
   }
  }
  return hits.sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id)).slice(0,safeLimit);
 }
 diagnostics(items:ReadonlyArray<{id:string;context?:Record<string,string>}>):{
  pass:boolean;indexedItems:number;canonicalSpatialItems:number;missingItems:number;staleItems:number;
  reverseMappingMismatch:number;cellPostingMismatch:number;cellCount:number;
 } {
  const expected=new Map<string,MemorySpatialPoint>();
  const expectedCellById=new Map<string,string>();
  const expectedCells=new Map<string,Set<string>>();
  for(const item of items){
   const point=spatialPointFromContext(item.context);if(!point)continue;
   expected.set(item.id,point);
   const [x,y,z]=cellCoordinates(point),key=cellKey(point.frameId,x,y,z);
   expectedCellById.set(item.id,key);
   let members=expectedCells.get(key);if(!members){members=new Set<string>();expectedCells.set(key,members);}
   members.add(item.id);
  }
  let missingItems=0,staleItems=0,reverseMappingMismatch=0,cellPostingMismatch=0;
  for(const [id,point] of expected){
   const actual=this.pointById.get(id);
   if(!actual)missingItems++;
   else if(actual.frameId!==point.frameId||actual.x!==point.x||actual.y!==point.y||actual.z!==point.z)staleItems++;
  }
  for(const id of this.pointById.keys())if(!expected.has(id))staleItems++;
  // Verify the ID -> cell reverse map independently of the point payload map.
  for(const [id,key] of expectedCellById)if(this.cellById.get(id)!==key)reverseMappingMismatch++;
  for(const [id,key] of this.cellById)if(expectedCellById.get(id)!==key)reverseMappingMismatch++;
  // Verify complete cell -> ID memberships. A missing or orphan posting can make
  // an otherwise valid point unreachable (or make a stale ID occupy query work).
  for(const [key,expectedIds] of expectedCells){
   const actualIds=this.cells.get(key);
   if(!actualIds||actualIds.size!==expectedIds.size||
      [...expectedIds].some(id=>!actualIds.has(id)))cellPostingMismatch++;
  }
  for(const [key,actualIds] of this.cells){
   const expectedIds=expectedCells.get(key);
   if(!expectedIds||actualIds.size!==expectedIds.size||
      [...actualIds].some(id=>!expectedIds.has(id)))cellPostingMismatch++;
   if(actualIds.size===0)cellPostingMismatch++;
  }
  const pass=missingItems===0&&staleItems===0&&reverseMappingMismatch===0&&
   cellPostingMismatch===0&&expected.size===this.pointById.size&&
   expectedCellById.size===this.cellById.size&&expectedCells.size===this.cells.size;
  return {pass,indexedItems:this.pointById.size,canonicalSpatialItems:expected.size,
   missingItems,staleItems,reverseMappingMismatch,cellPostingMismatch,cellCount:this.cells.size};
 }
}
