import { createHash } from 'node:crypto';

export interface MemoMemoryContext {
  project?: string;
  branch?: string;
  commit?: string;
  task?: string;
  session?: string;
  source?: string;
  [key:string]:string|undefined;
}

export interface MemoMemoryIdentity {
  contentHash:string;
  stableId:string;
  canonicalContent:string;
}

/**
 * Memo-inspired local primitives, adapted to the canonical Neuro-Kurisu memory
 * owner. Memo's important idea is content-addressed identity; we keep the
 * content hash independent from metadata so equivalent memories can be
 * reconciled without creating a second storage system.
 */
export function canonicalizeMemoryContent(content:string):string{
  return String(content)
    .normalize('NFKC')
    .replace(/\r\n?/g,'\n')
    .replace(/[\t ]+/g,' ')
    .replace(/\n{3,}/g,'\n\n')
    .trim();
}

export function sha256Hex(content:string):string{
  return createHash('sha256').update(content).digest('hex');
}

/** Memo-compatible content identity: SHA-256 of canonical content. */
export function memoContentHash(content:string):string{
  return sha256Hex(canonicalizeMemoryContent(content));
}

/**
 * Namespaced stable identity for Neuro-Kurisu. The content hash remains
 * separately available, while kind/source prevent unrelated domains from
 * sharing the same primary record identifier.
 */
export function stableMemoryId(content:string,kind:string,source:string):string{
  const material=`${kind}\0${source}\0${canonicalizeMemoryContent(content)}`;
  const h=sha256Hex(material);
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}

export function deriveMemoryIdentity(content:string,kind:string,source:string):MemoMemoryIdentity{
  const canonicalContent=canonicalizeMemoryContent(content);
  return {
    canonicalContent,
    contentHash:sha256Hex(canonicalContent),
    stableId:stableMemoryId(canonicalContent,kind,source),
  };
}

export function mergeMemoContext(
  existing:Record<string,string>|undefined,
  incoming:MemoMemoryContext|undefined,
):Record<string,string>|undefined{
  if(!existing&&!incoming)return undefined;
  const merged:Record<string,string>={...(existing??{})};
  for(const [key,value] of Object.entries(incoming??{})){
    if(value!==undefined&&value!=='')merged[key]=String(value);
  }
  return merged;
}

export function mergeMemoTags(existing:string[]|undefined,incoming:string[]|undefined):string[]{
  return [...new Set([...(existing??[]),...(incoming??[])].map(x=>String(x).trim()).filter(Boolean))].slice(0,24);
}
