import { createPublicKey, verify as verifySignature, type KeyObject } from 'node:crypto';
import type {
  P26HoldoutEvidenceVerifier,
  VerifiedHoldoutEvidenceInput,
} from './P26TrueLearningEngine.ts';

export interface P26TrustedHoldoutVerifierEntry {
  publicKeyPem:string;
  protocolIds:string[];
}

export type P26TrustedHoldoutVerifierConfig=Record<string,P26TrustedHoldoutVerifierEntry>;

export type P26SignedHoldoutPayload = Pick<
  VerifiedHoldoutEvidenceInput,
  'evidenceId'|'taskId'|'protocolId'|'verifierId'|'sampleSetHash'|'baseline01'|'learned01'|'verified'|'independent'
> & { schemaVersion:1 };

const hasUnsafeControl=(value:string)=>[...value].some(ch=>{
  const n=ch.charCodeAt(0);
  return n<32||(n>=127&&n<=159);
});
const text=(value:unknown,max=300):value is string=>
  typeof value==='string'&&value.length>0&&value.length<=max&&value.trim()===value&&!hasUnsafeControl(value);
const metric=(value:unknown):value is number=>
  typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;

/**
 * Canonical bytes that the independent evaluator must sign with its Ed25519
 * private key. Only this exact, bounded record is trusted by the runtime.
 * Private keys must remain in the external evaluator, never in NK1.
 */
export function canonicalP26HoldoutPayload(input:VerifiedHoldoutEvidenceInput):string {
  const payload:P26SignedHoldoutPayload={
    schemaVersion:1,
    evidenceId:input.evidenceId,
    taskId:input.taskId,
    protocolId:input.protocolId,
    verifierId:input.verifierId,
    sampleSetHash:input.sampleSetHash,
    baseline01:input.baseline01,
    learned01:input.learned01,
    verified:input.verified,
    independent:input.independent,
  };
  return JSON.stringify(payload);
}

function compileVerifierConfig(raw:unknown):Map<string,{key:KeyObject;protocols:ReadonlySet<string>}> {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('p26-holdout-verifier-config-must-be-object');
  const entries=Object.entries(raw as Record<string,unknown>);
  if(entries.length<1||entries.length>64)throw new Error('p26-holdout-verifier-config-size-invalid');
  const compiled=new Map<string,{key:KeyObject;protocols:ReadonlySet<string>}>();
  for(const [verifierId,value] of entries){
    if(!text(verifierId,180)||!value||typeof value!=='object'||Array.isArray(value))
      throw new Error('p26-holdout-verifier-entry-invalid');
    const row=value as Partial<P26TrustedHoldoutVerifierEntry>;
    if(typeof row.publicKeyPem!=='string'||row.publicKeyPem.length<64||row.publicKeyPem.length>16384||
       !row.publicKeyPem.includes('BEGIN PUBLIC KEY')||row.publicKeyPem.includes('BEGIN PRIVATE KEY')||
       !Array.isArray(row.protocolIds)||row.protocolIds.length<1||row.protocolIds.length>64)
      throw new Error('p26-holdout-verifier-entry-invalid');
    const protocols=new Set<string>();
    for(const protocolId of row.protocolIds){
      if(!text(protocolId,180)||protocols.has(protocolId))throw new Error('p26-holdout-protocol-id-invalid');
      protocols.add(protocolId);
    }
    let key:KeyObject;
    try{key=createPublicKey(row.publicKeyPem);}catch{throw new Error('p26-holdout-public-key-invalid');}
    if(key.type!=='public'||key.asymmetricKeyType!=='ed25519')
      throw new Error('p26-holdout-key-must-be-ed25519-public-key');
    compiled.set(verifierId,{key,protocols});
  }
  return compiled;
}

/** Validate the whole host-owned config at startup; malformed configured trust never silently degrades. */
export function createP26HoldoutEvidenceVerifier(raw:unknown):P26HoldoutEvidenceVerifier {
  const trusted=compileVerifierConfig(raw);
  return (input:Readonly<VerifiedHoldoutEvidenceInput>):boolean=>{
    if(!input||typeof input!=='object')return false;
    if(!text(input.evidenceId,180)||!text(input.taskId,180)||!text(input.protocolId,180)||
       !text(input.verifierId,180)||!text(input.sampleSetHash,300)||
       !metric(input.baseline01)||!metric(input.learned01)||
       input.verified!==true||input.independent!==true||
       typeof input.signature!=='string'||input.signature.length<80||input.signature.length>1024)
      return false;
    const authority=trusted.get(input.verifierId);
    if(!authority||!authority.protocols.has(input.protocolId))return false;
    let signature:Buffer;
    try{
      signature=Buffer.from(input.signature,'base64');
      if(signature.length!==64||signature.toString('base64')!==input.signature)return false;
    }catch{return false;}
    try{
      return verifySignature(
        null,
        Buffer.from(canonicalP26HoldoutPayload(input as VerifiedHoldoutEvidenceInput),'utf8'),
        authority.key,
        signature,
      );
    }catch{return false;}
  };
}

/** Missing configuration means no verifier, so P26 stays fail-closed by default. */
export function createP26HoldoutEvidenceVerifierFromEnv(
  raw=process.env.NEURO_P26_HOLDOUT_VERIFIERS_JSON,
):P26HoldoutEvidenceVerifier|undefined {
  if(typeof raw!=='string'||!raw.trim())return undefined;
  let config:unknown;
  try{config=JSON.parse(raw);}catch{throw new Error('p26-holdout-verifier-config-invalid-json');}
  return createP26HoldoutEvidenceVerifier(config);
}
