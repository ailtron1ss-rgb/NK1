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

/** Only the authenticated adapter should supply this origin; malformed metadata fails closed. */
export function normalizeRuntimeExternalPluginSource(value:unknown):RuntimeExternalPluginSource|undefined {
  if(value===null||typeof value!=='object'||Array.isArray(value)) return undefined;
  const raw=value as Record<string,unknown>;
  if(raw.kind!=='neko-plugin'||typeof raw.pluginId!=='string'||typeof raw.messageId!=='string') return undefined;
  if(!/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(raw.pluginId)||!/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(raw.messageId)) return undefined;
  return {kind:'neko-plugin',pluginId:raw.pluginId,messageId:raw.messageId};
}
