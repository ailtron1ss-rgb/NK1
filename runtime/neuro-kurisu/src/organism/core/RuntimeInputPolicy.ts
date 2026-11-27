import { types as nodeUtilTypes } from 'node:util';

export type RuntimeExternalGoalPolicy = 'user-command' | 'evidence-only';

export interface RuntimeExternalPluginSource {
  kind: 'neko-plugin';
  pluginId: string;
  messageId: string;
}

export function externalGoalForRuntimeInput(
  text: string | undefined,
  policy: RuntimeExternalGoalPolicy | undefined,
): { title:string; importance:number; urgency:number } | undefined {
  if (!text || policy === 'evidence-only') return undefined;
  return { title:text.slice(0,160), importance:0.65, urgency:0.4 };
}

export function shouldInvokeLanguageForRuntimeStep(input:{
  enabled:boolean;
  hasInvoker:boolean;
  languageBudgetAllows:boolean;
  hasExternalText:boolean;
  hasAutonomousAgenda:boolean;
  suppressResponse?:boolean;
}):boolean {
  return input.suppressResponse !== true && input.enabled && input.hasInvoker &&
    input.languageBudgetAllows && (input.hasExternalText || input.hasAutonomousAgenda);
}

/**
 * An object-shaped source is not an authentication proof. Only this module's
 * host-side issuer can create an object accepted by the runtime normalizer.
 * The WeakSet makes the capability process-local, non-serializable and
 * unforgeable by plugin JSON or a caller-built lookalike object.
 */
const issuedPluginSourceCapabilities = new WeakSet<object>();

export function createAuthenticatedRuntimeExternalPluginSource(
  pluginId: string,
  messageId: string,
): RuntimeExternalPluginSource {
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(pluginId) ||
      !/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(messageId)) {
    throw new Error('runtime-plugin-source-identity-invalid');
  }
  const capability = Object.freeze({ kind: 'neko-plugin' as const, pluginId, messageId });
  issuedPluginSourceCapabilities.add(capability);
  return capability;
}

/** Consumes the one-use capability minted after PluginMessageIngress host authorization. */
export function normalizeRuntimeExternalPluginSource(value:unknown):RuntimeExternalPluginSource|undefined {
  try {
    if(value===null||typeof value!=='object'||Array.isArray(value)||nodeUtilTypes.isProxy(value)||
       !issuedPluginSourceCapabilities.has(value)) return undefined;
    issuedPluginSourceCapabilities.delete(value);
    const descriptors=Object.getOwnPropertyDescriptors(value);
    const keys=Reflect.ownKeys(descriptors);
    if(keys.length!==3||keys.some(key=>typeof key!=='string'||!['kind','pluginId','messageId'].includes(key))) return undefined;
    const read=(key:'kind'|'pluginId'|'messageId')=>{
      const descriptor=descriptors[key];
      if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value')||descriptor.get!==undefined||descriptor.set!==undefined||!descriptor.enumerable) return undefined;
      return descriptor.value;
    };
    const kind=read('kind'),pluginId=read('pluginId'),messageId=read('messageId');
    if(kind!=='neko-plugin'||typeof pluginId!=='string'||typeof messageId!=='string') return undefined;
    if(!/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(pluginId)||!/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(messageId)) return undefined;
    return {kind:'neko-plugin',pluginId,messageId};
  } catch {
    return undefined;
  }
}
