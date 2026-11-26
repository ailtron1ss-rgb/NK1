import type { JsonStateStore } from '../persistence/FileStateStore.ts';
import type { PersistedOrganism } from './OrganismCore.ts';
import { CognitiveModuleCheckpointStore } from './CognitiveModuleCheckpointStore.ts';
import {
  CognitiveModuleRuntime,
  type CognitiveModuleRegistration,
  type CognitiveModuleRuntimeOptions,
} from './CognitiveModuleRuntime.ts';

/**
 * Connects module-owned snapshots to the organism's one canonical state store.
 * The returned stateStore must be supplied to OrganismCore/OrganismRuntime.
 * Call load through that owner before activateAll, and stopAll before shutdown.
 */
export function createCognitiveModuleRuntimePersistence(
  delegate: JsonStateStore<PersistedOrganism>,
  registrations: readonly CognitiveModuleRegistration[],
  options: Omit<CognitiveModuleRuntimeOptions, 'stateStore'> = {},
) {
  const stateStore = new CognitiveModuleCheckpointStore(delegate, options.clock);
  const runtime = new CognitiveModuleRuntime({
    ...options,
    stateStore: stateStore.moduleStateStore,
  });

  stateStore.bindSnapshotProvider(() => runtime.snapshotAll());
  for (const registration of registrations) runtime.register(registration);

  return {
    /** Canonical store adapter: pass this to OrganismCore/OrganismRuntime. */
    stateStore,
    /** Host-owned lifecycle manager for the registered modules. */
    runtime,
    activateAll: () => runtime.activateAll(),
    stopAll: () => runtime.stopAll(),
    diagnostics: () => stateStore.diagnostics(),
  };
}
