import type { LearningProcessCommand, LearningProcessResult, LearningProcessRun } from './LearningProcessSupervisor.ts';
import { runLearningProcess } from './LearningProcessSupervisor.ts';

export interface TrustedShadowRunContext {
  runId: string;
  taskId: string;
  seed: number;
  manifestFingerprint: string;
  runtimeVersion: string;
}

/** Minimal host-owned surface exposed by OrganismCore for trusted run provenance. */
export interface TrustedShadowRunRegistrar {
  registerTrustedSkillShadowRun(context: TrustedShadowRunContext): void | Promise<unknown>;
}

export interface TrustedShadowLearningRunInput {
  core: TrustedShadowRunRegistrar;
  runtimeVersion: string;
  run: LearningProcessRun;
  planFingerprint: string;
  command: LearningProcessCommand;
}

/**
 * Canonical entry point for any real shadow-learning child process.
 * It requires the host OrganismCore registration surface and binds its runtime
 * version outside the child process. Registration is awaited before spawn;
 * failures reject and the learner process is never started.
 */
export async function runTrustedShadowLearningProcess(
  input: TrustedShadowLearningRunInput,
): Promise<LearningProcessResult> {
  if (!input || !input.core ||
      typeof input.core.registerTrustedSkillShadowRun !== 'function') {
    throw new Error('trusted OrganismCore run registrar is required');
  }
  if (typeof input.runtimeVersion !== 'string' || !input.runtimeVersion.trim()) {
    throw new Error('trusted runtime version is required');
  }
  // Do not let a caller accidentally register baseline/control work as trusted
  // shadow evidence. This coordinator is intentionally narrower than the generic
  // process supervisor: only the explicitly named candidate/shadow lane qualifies.
  if (!input.run || input.run.arm !== 'candidate' || input.run.method !== 'shadow') {
    throw new Error('trusted shadow coordinator accepts only candidate/shadow runs');
  }
  return runLearningProcess(input.run, input.planFingerprint, input.command, {
    runtimeVersion: input.runtimeVersion,
    register: context => input.core.registerTrustedSkillShadowRun(context),
  });
}
