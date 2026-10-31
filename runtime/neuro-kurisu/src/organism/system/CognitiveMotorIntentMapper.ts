import type { MotorGoalCandidate } from './MotorGoalArbiter.ts';
import type { CanonicalMotorJointRole, MotorRigJointProfile } from './MotorRigProfile.ts';

export interface CognitiveMotorIntentInput {
  action: string;
  tick: number;
  nowMs: number;
  joints: readonly Pick<MotorRigJointProfile, 'id' | 'role' | 'minAngleRad' | 'maxAngleRad' | 'restAngleRad'>[];
  score01: number;
  predictedUtility01: number;
  confidence01: number;
  effort01: number;
  conflict01: number;
  goalFit01: number;
  novelty01: number;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

function findJoint(
  joints: CognitiveMotorIntentInput['joints'],
  roles: readonly CanonicalMotorJointRole[],
) {
  for (const role of roles) {
    const joint = joints.find((candidate) => candidate.role === role);
    if (joint) return joint;
  }
  return null;
}

/**
 * Convert a small allowlist of already-selected organism actions into bounded,
 * renderer-neutral avatar gestures. The mapper never invents a rig: every target
 * must resolve to a role in the host-calibrated profile supplied by the runtime.
 */
export function createCognitiveMotorGoalCandidate(
  input: CognitiveMotorIntentInput,
): MotorGoalCandidate | null {
  if (!input || !Number.isSafeInteger(input.tick) || input.tick < 0
    || !Number.isFinite(input.nowMs) || input.nowMs < 0
    || !Array.isArray(input.joints) || input.joints.length === 0) return null;

  const action = String(input.action ?? '');
  const targets: Record<string, number> = {};
  const addOffset = (
    roles: readonly CanonicalMotorJointRole[],
    offset: number,
  ): boolean => {
    const joint = findJoint(input.joints, roles);
    if (!joint) return false;
    const safeOffset = clamp(offset, -0.08, 0.08);
    targets[joint.id] = clamp(joint.restAngleRad + safeOffset, joint.minAngleRad, joint.maxAngleRad);
    return true;
  };

  let mapped = false;
  switch (action) {
    case 'respond':
      mapped = addOffset(['head.pitch', 'neck.pitch'], -0.06);
      break;
    case 'explore':
      mapped = addOffset(['head.yaw', 'neck.yaw'], input.tick % 2 === 0 ? -0.07 : 0.07);
      break;
    case 'verify':
      mapped = addOffset(['head.pitch', 'neck.pitch'], 0.035);
      break;
    case 'rest':
      mapped = addOffset(['head.pitch', 'neck.pitch'], 0);
      break;
    default:
      return null;
  }
  if (!mapped || Object.keys(targets).length === 0) return null;

  const tick = input.tick;
  const goalId = `nk1.motor.goal.${tick}.${action}`;
  const candidate: MotorGoalCandidate = {
    id: `nk1.motor.candidate.${tick}.${action}`,
    goal: {
      id: goalId,
      action: `embodied.${action}`,
      source: 'organism',
      priority: 24,
      confidence01: clamp01(input.confidence01),
      createdAtMs: input.nowMs,
      expiresAtMs: input.nowMs + 1_200,
      targetJointAnglesRad: targets,
      interruptible: true,
      reason: `cognitive-action-approved:${action}`,
    },
    corticalValue01: clamp01(input.score01),
    predictedUtility01: clamp01(input.predictedUtility01),
    confidence01: clamp01(input.confidence01),
    effort01: clamp01(input.effort01),
    conflict01: clamp01(input.conflict01),
    goalFit01: clamp01(input.goalFit01),
    novelty01: clamp01(input.novelty01),
  };
  return candidate;
}
