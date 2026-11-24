/**
 * Owns persistence scheduling, projection, revision and continuity bookkeeping.
 * OrganismCore remains responsible for the policy of when to checkpoint; this
 * runtime owns the mutable machinery and its counters.
 */
import { PersistenceProjectionGovernor } from '../persistence/PersistenceProjectionGovernor.ts';
import { RevisionGraph } from '../persistence/RevisionGraph.ts';
import { RevisionTokenRegistry } from '../persistence/RevisionTokenRegistry.ts';
import { PersistenceBudgetController } from '../persistence/PersistenceBudgetController.ts';
import { PersistenceDurabilityGovernor } from '../persistence/PersistenceDurabilityGovernor.ts';
import { AdvancedProjectionScheduler, defaultProjectionScheduleState, type ProjectionGroup } from '../persistence/AdvancedProjectionScheduler.ts';
import { PersistenceProjectionCoordinator, type PersistenceProjectionContext } from './PersistenceProjectionCoordinator.ts';

export class PersistenceRuntime {
  continuity = { version: 1 as const, frames: 0, lastAt: 0, lastTick: 0, meanJointError01: 0.5, lastJointError01: 0.5 };
  capabilityRefreshedAt = 0;
  persistenceDepth = 0;
  persistenceDirty = false;
  persistenceBatchMarked = false;
  persistenceDirtyMutationCount = 0;
  persistenceDirtyBatchCount = 0;
  persistenceFullCheckpointCount = 0;
  persistencePartialCheckpointCount = 0;
  dirtyCycles = 0;
  readonly projectionGovernor = new PersistenceProjectionGovernor();
  readonly advancedProjectionScheduler = new AdvancedProjectionScheduler();
  readonly revisionGraph = new RevisionGraph();
  readonly revisionTokens = new RevisionTokenRegistry(this.revisionGraph);
  readonly persistenceBudgetController = new PersistenceBudgetController();
  readonly persistenceDurabilityGovernor = new PersistenceDurabilityGovernor();
  readonly persistenceProjectionCoordinator = new PersistenceProjectionCoordinator();
  lastCheckpointAt = 0;
  lastProjectionWasFull = true;
  checkpointMinIntervalMs = 0;
  checkpointMaxDirtyCycles = 4;

  configure(checkpointMinIntervalMs:number, checkpointMaxDirtyCycles:number):void {
    this.checkpointMinIntervalMs=Math.max(0,Number(checkpointMinIntervalMs||0));
    this.checkpointMaxDirtyCycles=Math.max(1,Number(checkpointMaxDirtyCycles||4));
  }
}
