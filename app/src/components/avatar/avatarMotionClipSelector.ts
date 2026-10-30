export type AvatarMotionAction = "respond" | "explore" | "verify" | "rest" | "reflect" | "wait";

export interface AvatarMotionClipLike {
  name?: unknown;
}

/**
 * Pick an exact semantic action clip without silently returning an idle clip.
 * Keeping this separate is important when multiple animation sources exist:
 * an unrelated sidecar idle must not mask an embedded model's action clip.
 */
export function selectActionMotionClip<T extends AvatarMotionClipLike>(
  clips: readonly T[],
  action: AvatarMotionAction,
): T | null {
  const rules: Record<AvatarMotionAction, RegExp> = {
    respond: /talk|speak|gesture|explain|wave/i,
    explore: /look|walk|explore|turn|inspect/i,
    verify: /think|inspect|focus|work|write/i,
    rest: /idle|rest|breath|sit/i,
    reflect: /think|ponder|idle/i,
    wait: /idle|stand|breath/i,
  };
  const rule = rules[action];
  return clips.find((clip) => rule.test(String(clip.name ?? ""))) ?? null;
}

export function selectIdleMotionClip<T extends AvatarMotionClipLike>(
  clips: readonly T[],
): T | null {
  return clips.find((clip) => /idle|breath|stand/i.test(String(clip.name ?? ""))) ?? null;
}

export interface AvatarMotionClipSources<T extends AvatarMotionClipLike> {
  action: AvatarMotionAction;
  vrmaClips: readonly T[];
  modelClips: readonly T[];
  vrmaDefaultClip?: T | null;
}

/**
 * Priority: semantic VRMA match, semantic embedded-model match, explicit
 * sidecar default, then idle fallback. The first source is never allowed to
 * satisfy an action request merely by containing an unrelated idle clip.
 */
export function selectAvatarMotionClip<T extends AvatarMotionClipLike>(
  sources: AvatarMotionClipSources<T>,
): T | null {
  return (
    selectActionMotionClip(sources.vrmaClips, sources.action) ??
    selectActionMotionClip(sources.modelClips, sources.action) ??
    sources.vrmaDefaultClip ??
    selectIdleMotionClip(sources.vrmaClips) ??
    selectIdleMotionClip(sources.modelClips)
  );
}
