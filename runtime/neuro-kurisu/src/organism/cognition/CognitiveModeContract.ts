/** Canonical cognitive execution modes and their hard completion-token ceilings. */
export type CognitiveBridgeMode = 'reflex'|'shallow'|'retrieve'|'deep'|'simulate'|'defer'|'sleep';

export const COGNITIVE_MODE_TOKEN_CEILINGS:Readonly<Record<CognitiveBridgeMode,number>>={
  reflex:256,
  shallow:384,
  retrieve:512,
  deep:768,
  simulate:768,
  defer:128,
  sleep:128,
};
