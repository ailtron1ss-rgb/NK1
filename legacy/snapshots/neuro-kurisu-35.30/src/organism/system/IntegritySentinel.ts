import { createHash } from 'node:crypto';
import type { PersistedOrganism } from '../core/OrganismCore.ts';
import { RELEASE_CONTRACT } from './ReleaseContract.ts';
import { validatePersistedOrganism, type IntegritySnapshot } from './InvariantEngine.ts';

export class IntegritySentinel {
  check(value: PersistedOrganism): IntegritySnapshot { return validatePersistedOrganism(value); }

  hash(value: PersistedOrganism): string {
    const digest=createHash('sha256');
    const feed=(x:any,root=false):void=>{
      if(x===null){digest.update('null');return;}
      if(typeof x!=='object'){const encoded=JSON.stringify(x);digest.update(encoded===undefined?'null':encoded);return;}
      if(Array.isArray(x)){digest.update('[');for(let i=0;i<x.length;i++){if(i)digest.update(',');feed(x[i]);}digest.update(']');return;}
      const keys=Object.keys(x).filter(k=>!(root&&k==='system')).sort();
      digest.update('{');for(let i=0;i<keys.length;i++){if(i)digest.update(',');const k=keys[i]!;digest.update(JSON.stringify(k));digest.update(':');feed(x[k]);}digest.update('}');
    };
    feed(value,true); return digest.digest('hex');
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
