/**
 * Adapted from the consequence-based energy model described by Hexis.
 * This is deliberately separate from compute/resource cost: it prices the
 * consequences of acting (irreversibility, social exposure, commitment,
 * user attention and identity impact). It is a pre-selection autonomy guard;
 * ActionGateway remains the sole execution/permission authority.
 *
 * Donor reference: Hexis (MIT), docs/reference/energy-model.md and
 * docs/concepts/heartbeat-system.md. No donor runtime or SQL is imported.
 */
export type ActionConsequenceClass = 'read-only' | 'mutation' | 'social' | 'destructive' | 'unknown';
export type ActionConsequenceTier = 'low' | 'moderate' | 'high' | 'critical';

export interface ActionConsequenceTool {
  id: string;
  capability: string;
  destructive: boolean;
  requiresApproval?: boolean;
}

export interface ActionConsequenceDimensions {
  irreversibility01: number;
  socialExposure01: number;
  commitment01: number;
  userAttention01: number;
  identityImpact01: number;
}

export interface ActionConsequenceAssessment {
  classification: ActionConsequenceClass;
  tier: ActionConsequenceTier;
  dimensions: Readonly<ActionConsequenceDimensions>;
  cost01: number;
  autonomousAllowed: boolean;
  requiresApprovalRecommended: boolean;
  reason: string;
}

const PROFILES: Readonly<Record<ActionConsequenceClass, Readonly<ActionConsequenceDimensions>>> = Object.freeze({
  'read-only': Object.freeze({ irreversibility01: .02, socialExposure01: .01, commitment01: .01, userAttention01: .02, identityImpact01: .01 }),
  mutation: Object.freeze({ irreversibility01: .42, socialExposure01: .06, commitment01: .38, userAttention01: .08, identityImpact01: .28 }),
  social: Object.freeze({ irreversibility01: .55, socialExposure01: .92, commitment01: .62, userAttention01: .88, identityImpact01: .58 }),
  destructive: Object.freeze({ irreversibility01: .98, socialExposure01: .42, commitment01: .82, userAttention01: .32, identityImpact01: .90 }),
  unknown: Object.freeze({ irreversibility01: .65, socialExposure01: .35, commitment01: .55, userAttention01: .40, identityImpact01: .55 }),
});

const READ_TOKENS = new Set(['read', 'inspect', 'status', 'health', 'evidence', 'research', 'context', 'list', 'search', 'lookup', 'fetch', 'query', 'observe', 'reconcile', 'snapshot', 'metadata', 'capabilities']);
const SOCIAL_TOKENS = new Set(['send', 'post', 'message', 'contact', 'reach', 'email', 'sms', 'dm', 'notify', 'speak', 'publish', 'share']);
const DESTRUCTIVE_TOKENS = new Set(['delete', 'remove', 'destroy', 'shutdown', 'restart', 'terminate', 'wipe', 'drop', 'reset', 'revoke', 'purge']);
const MUTATION_TOKENS = new Set(['write', 'create', 'update', 'patch', 'edit', 'modify', 'execute', 'exec', 'shell', 'install', 'commit', 'save', 'upload', 'move', 'rename', 'apply', 'mutate', 'trigger', 'invoke', 'launch', 'transfer', 'purchase', 'submit', 'capture', 'record']);

function tokens(value: string): string[] {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase('en-US').split(/[^a-z0-9]+/).filter(Boolean);
}

function classify(tool: ActionConsequenceTool): ActionConsequenceClass {
  if (tool.destructive === true) return 'destructive';
  const words = new Set([...tokens(tool.id), ...tokens(tool.capability)]);
  // Consequence-bearing verbs win over read-like words in mixed identifiers.
  if ([...DESTRUCTIVE_TOKENS].some(word => words.has(word))) return 'destructive';
  if ([...SOCIAL_TOKENS].some(word => words.has(word))) return 'social';
  if ([...MUTATION_TOKENS].some(word => words.has(word))) return 'mutation';
  if ([...READ_TOKENS].some(word => words.has(word))) return 'read-only';
  return 'unknown';
}

function weightedCost(d: ActionConsequenceDimensions): number {
  // Weights sum to 1. Social exposure and irreversibility are intentionally costly.
  return Math.max(0, Math.min(1,
    d.irreversibility01 * .28 +
    d.socialExposure01 * .24 +
    d.commitment01 * .18 +
    d.userAttention01 * .14 +
    d.identityImpact01 * .16,
  ));
}

function tierFor(cost01: number): ActionConsequenceTier {
  if (cost01 >= .70) return 'critical';
  if (cost01 >= .40) return 'high';
  if (cost01 >= .18) return 'moderate';
  return 'low';
}

/**
 * Classify from the host-registered tool identity/capability, never from
 * model-authored cost values. Unknown capabilities fail closed for ambient use.
 */
export function assessActionConsequence(tool: ActionConsequenceTool): ActionConsequenceAssessment {
  const classification = classify(tool);
  const dimensions = PROFILES[classification];
  const cost01 = weightedCost(dimensions);
  const autonomousAllowed = classification === 'read-only' &&
    tool.destructive !== true && tool.requiresApproval !== true && cost01 < .18;
  const requiresApprovalRecommended = classification !== 'read-only' || tool.requiresApproval === true;
  return {
    classification,
    tier: tierFor(cost01),
    dimensions: { ...dimensions },
    cost01,
    autonomousAllowed,
    requiresApprovalRecommended,
    reason: autonomousAllowed
      ? 'low-consequence-read-only'
      : `ambient-autonomy-denied:${classification}`,
  };
}
