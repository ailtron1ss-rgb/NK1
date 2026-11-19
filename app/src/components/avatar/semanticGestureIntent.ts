/**
 * Conservative N.E.K.O.-inspired semantic action-card bridge for NK1.
 *
 * Only closed, explicit stage directions are considered. Ordinary dialogue is
 * never mined for gestures, and source text is not retained in the returned card.
 * The resolver maps to NK1-owned normalized motion programs; it imports no
 * N.E.K.O. renderer, model, VRMA binary, or external playback runtime.
 */
import type { SemanticGestureProgramId } from "./motionLibrary.ts";

export interface SemanticGestureIntentV1 {
  schemaVersion: 1;
  actionId: SemanticGestureProgramId;
  programId: SemanticGestureProgramId;
  cardId: string;
  priority: number;
  confidence01: number;
  source: "closed-stage-direction";
}

interface GestureRule {
  id: SemanticGestureProgramId;
  priority: number;
  pattern: RegExp;
}

const MAX_SOURCE_LENGTH = 4_000;
const MAX_STAGE_DIRECTIONS = 3;
const MAX_DIRECTION_LENGTH = 180;
const NEGATION = /(?:^|[\s,;])(?:не|нет|без|not|never|no|without|doesn't|does not|don't|didn't)(?:[\s,;]|$)/iu;

const RULES: readonly GestureRule[] = Object.freeze([
  { id: "clap", priority: 92, pattern: /\b(?:claps?\s+(?:(?:her|his|their)\s+)?hands?|applauds?)\b|хлопает\s+в\s+ладоши|аплодирует/iu },
  { id: "nod", priority: 88, pattern: /\b(?:nods?|nodding|gives?\s+(?:(?:her|his|their)\s+)?nod)\b|кивает|кивнул(?:а|и)?|кивая|кивком/iu },
  { id: "shake", priority: 88, pattern: /\b(?:shakes?\s+(?:(?:her|his|their|my)\s+)?head|headshake)\b|качает\s+головой|покачал(?:а|и)?\s+головой|отрицательно\s+качает\s+головой/iu },
  { id: "wave", priority: 80, pattern: /\b(?:waves?\s+(?:at|hello|goodbye|to)\b|waves?\s+(?:(?:her|his|their)\s+)?hand)\b|машет\s+рукой|помахал(?:а|и)?|помахивает\s+рукой/iu },
  { id: "bow", priority: 80, pattern: /\b(?:bows?|makes?\s+a\s+bow)\b|кланяется|поклонил(?:а|и)?сь|делает\s+поклон/iu },
]);

function closedStageDirections(value: string): string[] {
  const source = value.normalize("NFKC").slice(0, MAX_SOURCE_LENGTH);
  const directions: string[] = [];
  const pattern = /\(([^()\r\n]{1,180})\)|（([^（）\r\n]{1,180})）/gu;
  for (const match of source.matchAll(pattern)) {
    const direction = String(match[1] ?? match[2] ?? "").trim();
    if (!direction || direction.length > MAX_DIRECTION_LENGTH) continue;
    directions.push(direction);
    if (directions.length >= MAX_STAGE_DIRECTIONS) break;
  }
  return directions;
}

/**
 * Select one deterministic gesture card. Explicit negative stage directions
 * suppress matching; ordinary prose, unfinished parentheses and raw dialogue
 * have no effect. At most three closed directions are inspected per turn.
 */
export function resolveSemanticGestureIntent(value: unknown): SemanticGestureIntentV1 | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const directions = closedStageDirections(value);
  if (!directions.length) return null;

  const candidates: SemanticGestureIntentV1[] = [];
  for (const direction of directions) {
    if (NEGATION.test(direction)) continue;
    const normalized = direction.toLocaleLowerCase("en-US");
    for (const rule of RULES) {
      if (!rule.pattern.test(normalized)) continue;
      candidates.push({
        schemaVersion: 1,
        actionId: rule.id,
        programId: rule.id,
        cardId: `nk1.semantic-gesture.${rule.id}.v1`,
        priority: rule.priority,
        confidence01: 0.92,
        source: "closed-stage-direction",
      });
    }
  }
  candidates.sort((left, right) => right.priority - left.priority
    || left.actionId.localeCompare(right.actionId, "en"));
  return candidates[0] ?? null;
}
