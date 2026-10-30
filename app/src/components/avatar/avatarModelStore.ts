export const MAX_AVATAR_MODEL_BYTES = 90 * 1024 * 1024;
export const MAX_AVATAR_ANIMATION_BYTES = 90 * 1024 * 1024;

const DB = "nk1-avatar-model-store";
const VERSION = 2;
const MODEL_STORE = "active-model";
const ANIMATION_STORE = "active-animation";
const KEY = "current";

type StoredAsset = { blob: Blob; name: string; updatedAt: number };

function openDatabase(): Promise<IDBDatabase> {
 return new Promise((resolve,reject)=>{
  if(typeof indexedDB==="undefined"){reject(new Error("IndexedDB is unavailable"));return;}
  const request=indexedDB.open(DB,VERSION);
  request.onupgradeneeded=()=>{
   const database=request.result;
   if(!database.objectStoreNames.contains(MODEL_STORE))database.createObjectStore(MODEL_STORE);
   if(!database.objectStoreNames.contains(ANIMATION_STORE))database.createObjectStore(ANIMATION_STORE);
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error??new Error("Could not open avatar store"));
  request.onblocked=()=>reject(new Error("Avatar database upgrade is blocked"));
 });
}

function safeFileName(value: unknown, fallback: string): string {
 return String(value||fallback).replace(/[\r\n\0]/g,"").slice(0,180)||fallback;
}

async function loadAsset(store:string):Promise<{blob:Blob;name:string}|null>{
 const db=await openDatabase();
 try{
  return await new Promise((resolve,reject)=>{
   const request=db.transaction(store,"readonly").objectStore(store).get(KEY);
   request.onsuccess=()=>{
    const value=request.result as StoredAsset|undefined;
    resolve(value?.blob instanceof Blob&&typeof value.name==="string"?{blob:value.blob,name:value.name}:null);
   };
   request.onerror=()=>reject(request.error??new Error("Could not read stored avatar asset"));
  });
 }finally{db.close();}
}

async function saveAsset(store:string,blob:Blob,name:string,label:string,maxBytes:number):Promise<void>{
 if(!(blob instanceof Blob)||!blob.size||blob.size>maxBytes)throw new Error(`${label} must be non-empty and at most 90 MB`);
 const safeNameValue=safeFileName(name,label);
 const db=await openDatabase();
 try{
  await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction(store,"readwrite");
   tx.objectStore(store).put({blob,name:safeNameValue,updatedAt:Date.now()} satisfies StoredAsset,KEY);
   tx.oncomplete=()=>resolve();
   tx.onerror=()=>reject(tx.error??new Error(`Could not save ${label}`));
   tx.onabort=()=>reject(tx.error??new Error(`${label} save aborted`));
  });
 }finally{db.close();}
}

async function clearAsset(store:string,label:string):Promise<void>{
 const db=await openDatabase();
 try{
  await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction(store,"readwrite");
   tx.objectStore(store).delete(KEY);
   tx.oncomplete=()=>resolve();
   tx.onerror=()=>reject(tx.error??new Error(`Could not clear ${label}`));
   tx.onabort=()=>reject(tx.error??new Error(`${label} reset aborted`));
  });
 }finally{db.close();}
}

export function loadStoredAvatarModel():Promise<{blob:Blob;name:string}|null>{
 return loadAsset(MODEL_STORE);
}
export function saveAvatarModel(blob:Blob,name:string):Promise<void>{
 return saveAsset(MODEL_STORE,blob,name,"avatar.vrm",MAX_AVATAR_MODEL_BYTES);
}
export function clearStoredAvatarModel():Promise<void>{
 return clearAsset(MODEL_STORE,"avatar");
}

export function loadStoredAvatarAnimation():Promise<{blob:Blob;name:string}|null>{
 return loadAsset(ANIMATION_STORE);
}
export function saveAvatarAnimation(blob:Blob,name:string):Promise<void>{
 return saveAsset(ANIMATION_STORE,blob,name,"animation.vrma",MAX_AVATAR_ANIMATION_BYTES);
}
export function clearStoredAvatarAnimation():Promise<void>{
 return clearAsset(ANIMATION_STORE,"VRMA animation");
}
