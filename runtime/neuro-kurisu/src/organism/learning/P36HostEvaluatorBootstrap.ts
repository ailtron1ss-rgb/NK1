import { readFile, readdir, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ToolDefinition } from '../system/ActionGateway.ts';
import { VerifiedOutcomeLedger, type TaskManifestEntry } from './VerifiedOutcomeLedger.ts';
import { ingestSignedOutcomeArtifact, type SignedOutcomeArtifact } from './VerifiedOutcomeArtifact.ts';
import {
  createP36VerifiedOutcomeLedgerEvaluator,
  measureP36VerifiedOutcomeLedger,
  type P36VerifiedOutcomeLedgerEvaluatorConfig,
} from './P36VerifiedOutcomeLedgerEvaluator.ts';

const MAX_CONFIG_BYTES=256*1024;
const MAX_MANIFEST_BYTES=4*1024*1024;
const MAX_KEYRING_BYTES=1024*1024;
const MAX_ARTIFACT_BYTES=512*1024;
const MAX_TOTAL_ARTIFACT_BYTES=64*1024*1024;
const MAX_ARTIFACT_FILES=10_000;

function fail(code:string):never { throw new Error(code); }
function validText(value:unknown,max=180):value is string {
  return typeof value==='string'&&value.length>0&&value.length<=max&&
    value===value.normalize('NFKC').trim()&&
    !/[\u0000-\u001f\u007f-\u009f]/.test(value);
}
function safeMode(mode:number,label:string):void {
  // Trust inputs and host code must be read-only to the runtime identity.
  // Deployments that need updates should replace them through the host/deploy pipeline.
  if(process.platform!=='win32'&&(mode&0o222)!==0)fail('p36-host-bootstrap-'+label+'-must-be-read-only');
}
function isWithinDirectory(root:string,target:string):boolean {
  const relative=path.relative(root,target);
  return relative===''||(relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative));
}
function assertOutsideRuntimeState(stateRoot:string|undefined,target:string,label:string):void {
  if(stateRoot&&isWithinDirectory(stateRoot,target))fail('p36-host-bootstrap-'+label+'-inside-runtime-writable-state');
}
function parseJson<T>(text:string,code:string):T {
  try { return JSON.parse(text) as T; }
  catch { return fail(code); }
}
async function readTrustedJsonFile(filePath:string,label:string,maxBytes:number):Promise<unknown> {
  let stat;
  try { stat=await lstat(filePath); } catch { return fail('p36-host-bootstrap-'+label+'-not-accessible'); }
  if(stat.isSymbolicLink()||!stat.isFile())fail('p36-host-bootstrap-'+label+'-must-be-regular-file');
  safeMode(stat.mode,label);
  if(stat.size>maxBytes)fail('p36-host-bootstrap-'+label+'-too-large');
  let text:string;
  try { text=await readFile(filePath,'utf8'); } catch { return fail('p36-host-bootstrap-'+label+'-read-failed'); }
  return parseJson(text,'p36-host-bootstrap-'+label+'-invalid-json');
}
function configuredPath(base:string,value:unknown,label:string):string {
  if(!validText(value,2048))return fail('p36-host-bootstrap-'+label+'-path-invalid');
  const resolved=path.isAbsolute(value)?path.resolve(value):path.resolve(base,value);
  if(!path.isAbsolute(value)) {
    const relative=path.relative(base,resolved);
    if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative)) {
      return fail('p36-host-bootstrap-'+label+'-path-escapes-config-directory');
    }
  }
  return resolved;
}

export interface P36SignedLedgerHostBootstrapConfig extends P36VerifiedOutcomeLedgerEvaluatorConfig {
  version:1;
  manifestFile:string;
  trustedVerifierKeysFile:string;
  artifactsDirectory:string;
}
interface ParsedP36SignedLedgerHostBootstrapConfig extends Omit<P36SignedLedgerHostBootstrapConfig,'ledger'|'manifest'> {
  version:1;
}

/**
 * Build the experiment-evidence evaluator from explicit host-owned files.
 * Only public verifier keys are read; private signing keys must remain in the
 * external verifier. Every artifact is re-authenticated on each process start,
 * so the JSON ledger snapshot is never treated as proof on its own.
 */
export async function loadP36VerifiedOutcomeLedgerEvaluator(
  configFile:string,
  runtimeWritableDirectory?:string,
):Promise<Omit<ToolDefinition,'id'>> {
  if(!validText(configFile,4096))return fail('p36-host-bootstrap-config-path-invalid');
  let configStat;
  try { configStat=await lstat(configFile); } catch { return fail('p36-host-bootstrap-config-not-accessible'); }
  if(configStat.isSymbolicLink()||!configStat.isFile())fail('p36-host-bootstrap-config-must-be-regular-file');
  safeMode(configStat.mode,'config');
  const configRealPath=await realpath(configFile);
  const runtimeStateReal=runtimeWritableDirectory?await realpath(runtimeWritableDirectory):undefined;
  assertOutsideRuntimeState(runtimeStateReal,configRealPath,'config');
  const configDirectory=path.dirname(configRealPath);
  if(configStat.size>MAX_CONFIG_BYTES)fail('p36-host-bootstrap-config-too-large');
  const raw=await parseJson<ParsedP36SignedLedgerHostBootstrapConfig>(
    await readFile(configRealPath,'utf8'),
    'p36-host-bootstrap-config-invalid-json',
  );
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.version!==1) {
    fail('p36-host-bootstrap-config-version-invalid');
  }
  const manifestPath=configuredPath(configDirectory,raw.manifestFile,'manifest');
  const keysPath=configuredPath(configDirectory,raw.trustedVerifierKeysFile,'keyring');
  const artifactsPath=configuredPath(configDirectory,raw.artifactsDirectory,'artifacts');
  assertOutsideRuntimeState(runtimeStateReal,await realpath(manifestPath),'manifest');
  assertOutsideRuntimeState(runtimeStateReal,await realpath(keysPath),'keyring');
  assertOutsideRuntimeState(runtimeStateReal,await realpath(artifactsPath),'artifacts-directory');
  const manifestRaw=await readTrustedJsonFile(manifestPath,'manifest',MAX_MANIFEST_BYTES);
  if(!Array.isArray(manifestRaw)||manifestRaw.length===0||manifestRaw.length>10_000) {
    fail('p36-host-bootstrap-manifest-invalid');
  }
  const manifest=manifestRaw as TaskManifestEntry[];
  let ledger:VerifiedOutcomeLedger;
  try { ledger=new VerifiedOutcomeLedger(manifest); } catch { return fail('p36-host-bootstrap-manifest-invalid'); }

  const keyringRaw=await readTrustedJsonFile(keysPath,'keyring',MAX_KEYRING_BYTES);
  if(!keyringRaw||typeof keyringRaw!=='object'||Array.isArray(keyringRaw)) {
    fail('p36-host-bootstrap-keyring-invalid');
  }
  const trustedVerifierKeys=new Map<string,string>();
  for(const [verifierId,publicKey] of Object.entries(keyringRaw as Record<string,unknown>)) {
    if(!validText(verifierId,256)||typeof publicKey!=='string'||!publicKey.trim()||
       publicKey.length>32_000||/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(publicKey)) {
      fail('p36-host-bootstrap-keyring-entry-invalid');
    }
    trustedVerifierKeys.set(verifierId,publicKey);
  }
  if(trustedVerifierKeys.size===0)fail('p36-host-bootstrap-keyring-empty');

  let directoryStat;
  try { directoryStat=await lstat(artifactsPath); } catch { return fail('p36-host-bootstrap-artifacts-directory-not-accessible'); }
  if(directoryStat.isSymbolicLink()||!directoryStat.isDirectory())fail('p36-host-bootstrap-artifacts-path-must-be-directory');
  safeMode(directoryStat.mode,'artifacts-directory');
  let names:string[];
  try { names=(await readdir(artifactsPath)).filter(name=>name.toLowerCase().endsWith('.json')).sort(); }
  catch { return fail('p36-host-bootstrap-artifacts-directory-read-failed'); }
  if(names.length===0||names.length>MAX_ARTIFACT_FILES)fail('p36-host-bootstrap-artifact-count-invalid');

  let totalBytes=0;
  let accepted=0;
  for(const name of names) {
    if(!validText(name,255)||name!==path.basename(name)||name==='.'||name==='..') {
      fail('p36-host-bootstrap-artifact-filename-invalid');
    }
    const artifactPath=path.join(artifactsPath,name);
    const artifactRaw=await readTrustedJsonFile(artifactPath,'artifact',MAX_ARTIFACT_BYTES);
    const stat=await lstat(artifactPath);
    totalBytes+=stat.size;
    if(totalBytes>MAX_TOTAL_ARTIFACT_BYTES)fail('p36-host-bootstrap-artifact-total-size-exceeded');
    const result=ingestSignedOutcomeArtifact(
      ledger,manifest,artifactRaw as SignedOutcomeArtifact,trustedVerifierKeys,
    );
    if(!result.accepted) {
      // Do not hide a bad signature, replay, unknown signer or conflicting row.
      fail('p36-host-bootstrap-artifact-rejected-'+String(result.rejection??'unknown').replace(/[^a-z0-9-]/gi,'-').slice(0,80));
    }
    accepted++;
  }
  if(accepted===0)fail('p36-host-bootstrap-no-authenticated-artifacts');

  let config:P36VerifiedOutcomeLedgerEvaluatorConfig;
  try {
    config={
      ledger,manifest,
      evaluatorVersion:raw.evaluatorVersion,
      baselineMethod:raw.baselineMethod,
      treatmentMethod:raw.treatmentMethod,
      taskFamily:raw.taskFamily,
      sourceId:raw.sourceId,
      independenceKey:raw.independenceKey,
      ...(raw.minimumPairedSeeds===undefined?{}:{minimumPairedSeeds:raw.minimumPairedSeeds}),
    };
    // Force both the adapter config checks and the actual coverage check during boot.
    // A configured-but-empty evaluator must not silently look ready.
    const readiness=measureP36VerifiedOutcomeLedger({
      hypothesisId:'p36-host-bootstrap-readiness',
      contextKey:config.taskFamily,
      holdout:true,
      delayMs:0,
      evaluatorVersion:config.evaluatorVersion,
      evidenceSource:'external-evaluator',
      protocolId:ledger.manifestFingerprint(),
      baselineMethod:config.baselineMethod,
      treatmentMethod:config.treatmentMethod,
      taskFamily:config.taskFamily,
      manifestFingerprint:ledger.manifestFingerprint(),
    },config);
    if(!readiness)fail('p36-host-bootstrap-signed-holdout-coverage-insufficient');
    return createP36VerifiedOutcomeLedgerEvaluator(config);
  } catch(error) {
    if(error instanceof Error&&error.message.startsWith('p36-host-bootstrap-'))throw error;
    fail('p36-host-bootstrap-evaluator-config-invalid');
  }
}

/**
 * Load explicitly configured host-owned delayed-maturity code. This is trusted
 * executable application code, not a runtime-created skill or a user-supplied
 * callback. Absence means that the maturity lane stays unavailable.
 */
export async function loadP36DevelopmentalOutcomeEvaluatorModule(
  modulePath:string,
  stateDirectory:string,
):Promise<Omit<ToolDefinition,'id'>> {
  if(!validText(modulePath,2048)||!path.isAbsolute(stateDirectory)) {
    fail('p36-maturity-provider-config-invalid');
  }
  const resolved=path.isAbsolute(modulePath)?path.resolve(modulePath):path.resolve(process.cwd(),modulePath);
  let stat;
  try { stat=await lstat(resolved); } catch { return fail('p36-maturity-provider-module-not-accessible'); }
  if(stat.isSymbolicLink()||!stat.isFile())fail('p36-maturity-provider-module-must-be-regular-file');
  safeMode(stat.mode,'maturity-provider-module');
  const real=await realpath(resolved);
  const stateReal=await realpath(stateDirectory);
  if(isWithinDirectory(stateReal,real))fail('p36-maturity-provider-module-inside-runtime-writable-state');
  const loaded=await import(pathToFileURL(real).href) as Record<string,unknown>;
  const factory=loaded.createP36DevelopmentalOutcomeEvaluator??loaded.default;
  if(typeof factory!=='function')fail('p36-maturity-provider-factory-missing');
  let evaluator:unknown;
  try { evaluator=await (factory as (context:{stateDirectory:string})=>Promise<unknown>|unknown)({stateDirectory:path.resolve(stateDirectory)}); }
  catch { return fail('p36-maturity-provider-factory-failed'); }
  if(!evaluator||typeof evaluator!=='object'||Array.isArray(evaluator))fail('p36-maturity-provider-result-invalid');
  const typed=evaluator as Partial<ToolDefinition>;
  if(typed.destructive!==false||typeof typed.execute!=='function'||typeof typed.verify!=='function'||
     !typed.observationSource||typeof typed.observationSource.sourceId!=='string'||
     typeof typed.observationSource.independenceKey!=='string') {
    fail('p36-maturity-provider-result-invalid');
  }
  return evaluator as Omit<ToolDefinition,'id'>;
}
