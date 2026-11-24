export interface MemoRuntimeContextSnapshot {
  project?:string;
  branch?:string;
  commit?:string;
  host?:string;
}

let cached:MemoRuntimeContextSnapshot|undefined;

/**
 * Memo-inspired session context, adapted to the typed organism runtime.
 * Values are injected by the host when available; no filesystem/git process is
 * spawned on the cognitive hot path.
 */
export function memoRuntimeContext():MemoRuntimeContextSnapshot{
  if(cached)return cached;
  cached={
    project:process.env.NEURO_KURISU_PROJECT||process.env.PWD,
    branch:process.env.GIT_BRANCH||process.env.GITHUB_REF_NAME,
    commit:process.env.GIT_COMMIT||process.env.GITHUB_SHA,
    host:process.env.TERMUX_VERSION?'termux':process.env.RUNTIME_HOST,
  };
  return cached;
}
