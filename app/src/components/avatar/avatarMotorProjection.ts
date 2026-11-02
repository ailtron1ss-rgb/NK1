import type { ActionKind } from "@/organism/types";
import type { AvatarMotorAction } from "./motorIntent";

/**
 * Renderer projection for the shared organism motor action vocabulary.
 * This is an adapter, not another selector: the semantic action is decided
 * once by planAvatarMotorIntent, then translated into the closest action
 * channel the existing Three.js / VRM runtime already supports.
 */
const MOTOR_ACTION_TO_3D_ACTION: Readonly<Record<AvatarMotorAction, ActionKind>> = {
  rest: "rest",
  listen: "wait",
  reflect: "reflect",
  inspect: "explore",
  explain: "respond",
  comfort: "respond",
  respond: "respond",
};

export function projectAvatarMotorActionTo3DAction(action: AvatarMotorAction): ActionKind {
  return MOTOR_ACTION_TO_3D_ACTION[action];
}
