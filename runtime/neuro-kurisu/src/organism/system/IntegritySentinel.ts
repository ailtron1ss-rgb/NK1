import { createHash } from 'node:crypto';
import type { PersistedOrganism } from '../core/OrganismCore.ts';
import { RELEASE_CONTRACT } from './ReleaseContract.ts';
import { validatePersistedOrganism, type IntegritySnapshot } from './InvariantEngine.ts';

function canonicalHashJson(value:any, root=false): string {
  if (value === null) return 'null';
  if (typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    return encoded === undefined ? 'null' : encoded;
  }
  if (Array.isArray(value)) {
    let out='[';
    for (let i=0;i<value.length;i+=1) {
      if (i) out+=',';
      out+=canonicalHashJson(value[i]);
    }
    return out+']';
  }
  const keys=Object.keys(value).filter(k=>!(root&&k==='system')).sort();
  let out='{';
  for (let i=0;i<keys.length;i+=1) {
    if (i) out+=',';
    const key=keys[i]!;
    out+=JSON.stringify(key)+':'+canonicalHashJson(value[key]);
  }
  return out+'}';
}

export class IntegritySentinel {
  check(value: PersistedOrganism): IntegritySnapshot { return validatePersistedOrganism(value); }

  hash(value: PersistedOrganism): string {
    const canonical = canonicalHashJson(value, true);
    return createHash('sha256').update(canonical).digest('hex');
  }

  stamp(value: PersistedOrganism, capabilities: PersistedOrganism['system']['capabilities'], integrity: IntegritySnapshot, options: { clone?: boolean; hash?: boolean; precomputedHash?: string } = {}): PersistedOrganism {
    const next = options.clone === false ? value : structuredClone(value);
    const previousHash = next.system?.lastStateHash ?? '';
    next.schemaVersion = RELEASE_CONTRACT.stateSchema;
    next.state.version = RELEASE_CONTRACT.stateSchema;
    next.system = {
      ...next.system,
      release: RELEASE_CONTRACT.application,
      organismCore: RELEASE_CONTRACT.organismCore,
      schemaVersion: RELEASE_CONTRACT.stateSchema,
      capabilities,
      integrity,
      lastStateHash: previousHash,
      replaySignature: next.system?.replaySignature ?? '',
      lastReplayAt: next.system?.lastReplayAt ?? 0,
      evolution: next.system?.evolution ?? { version:1, stage:'emergence', intrinsicProjectCycles:0, selfAuthoredActions:0, valueRevisionCycles:0, identitySamples:0, replaySignature:'', lastReplayAt:0 },
    };
    if (options.hash !== false) next.system.lastStateHash = options.precomputedHash ?? this.hash(next);
    return next;
  }
}
