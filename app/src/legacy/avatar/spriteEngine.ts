/**
 * Sprite engine — maps expressions to sliced Kurisu frames from user sheets.
 * Layout was 2×4 column-major (1357 / 2468).
 */

export type SpriteId = string;
export type SpriteAction = "respond" | "explore" | "verify" | "rest" | "reflect" | "wait";

const ACTION_PREFERENCES: Readonly<Record<SpriteAction, readonly string[]>> = {
  respond: ["soft_smile", "lab_explain", "neutral_front", "lab_crossed"],
  explore: ["lab_profile", "street_walk", "lab_chin", "thinking_chin", "lab_think"],
  verify: ["lab_steeple", "steeple_focus", "whiteboard_write", "whiteboard", "lab_think"],
  rest: ["tired_rest", "lab_tired", "sofa_phone", "phone_lean"],
  reflect: ["thinking_chin", "lab_chin", "steeple_focus", "lab_steeple"],
  wait: ["neutral_front", "soft_smile", "lab_crossed", "arms_close"],
};

const EXPR_MAP: Record<string, string[]> = {
  neutral: ['neutral_front', 'lab_crossed', 'arms_close', 'lab_profile'],
  happy: ['soft_smile', 'lab_explain'],
  sad: ['lab_tired', 'rain_kneel', 'tired_rest'],
  thinking: ['thinking_chin', 'lab_chin', 'steeple_focus', 'lab_steeple'],
  embarrassed: ['embarrassed'],
  surprised: ['shocked', 'lab_shocked'],
  focused: ['whiteboard', 'whiteboard_write', 'lab_think'],
  tired: ['tired_rest', 'lab_tired'],
  tsundere_denial: ['arms_crossed', 'lab_crossed'],
  dr_pepper_break: ['lab_drpepper', 'drpepper_dusk'],
  whiteboard_explain: ['whiteboard', 'whiteboard_write'],
  tender_glance: ['soft_smile', 'wet_glance'],
  phone: ['phone_look', 'phone_lean', 'sofa_phone'],
  passionate: ['passionate_reach', 'reach_out'],
  // fallbacks for avatar expression union
  chin_rest_thinking: ['thinking_chin', 'lab_chin'],
  steeple_fingers: ['steeple_focus', 'lab_steeple'],
  looking_away: ['lab_profile', 'wet_glance'],
  smug: ['soft_smile'],
  angry: ['arms_crossed', 'lab_crossed'],
  flustered: ['embarrassed'],
  sarcasm: ['arms_close']
};

const SHEET_OF: Record<string, string> = {};
[
  ['sheet_anime_office', ['thinking_chin','arms_crossed','embarrassed','shocked','tired_rest','neutral_front','whiteboard','phone_look']],
  ['sheet_trench_full', ['city_stand','rain_kneel','reach_out','phone_lean','lab_think','sunset_phone','clockwork','street_walk']],
  ['sheet_cinematic', ['arms_close','sofa_phone','passionate_reach','whiteboard_write','drpepper_dusk','steeple_focus','wet_glance','soft_smile']],
  ['sheet_lab', ['lab_chin','lab_tired','lab_crossed','lab_drpepper','lab_explain','lab_profile','lab_steeple','lab_shocked']]
].forEach(([sheet, ids]) => {
  (ids as string[]).forEach(id => { SHEET_OF[id] = sheet as string; });
});

import type { VisualProfileDef } from "./outfitCatalog";

export function resolveSpritePath(expression: string, options: { preferLab?: boolean; profile?: VisualProfileDef; action?: SpriteAction } = {}): string {
  const preferLab = options.preferLab ?? true;
  const profile = options.profile;
  const key = String(expression || 'neutral').toLowerCase();
  let candidates = EXPR_MAP[key];
  if (!candidates) {
    // fuzzy
    for (const [k, v] of Object.entries(EXPR_MAP)) {
      if (key.includes(k) || k.includes(key.split('_')[0])) {
        candidates = v;
        break;
      }
    }
  }
  if (!candidates) candidates = EXPR_MAP.neutral;
  if (profile?.spritePreferences?.length) {
    const preferred = profile.spritePreferences.filter((spriteId) => candidates!.includes(spriteId));
    if (preferred.length) candidates = preferred;
  }
  // Stable selection avoids a surprise pose jump caused by a wall-clock bucket.
  if (preferLab) {
    const labCandidates = candidates.filter(c => c.startsWith("lab_") || SHEET_OF[c] === "sheet_lab");
    if (labCandidates.length) candidates = labCandidates;
  }
  const action = options.action ?? "wait";
  const id = ACTION_PREFERENCES[action].find((candidate) => candidates!.includes(candidate)) ?? candidates[0];
  const sheet = SHEET_OF[id] || 'sheet_anime_office';
  return `/sprites/${sheet}/${id}.png`;
}

export function listAllSprites(): { id: string; path: string }[] {
  return Object.keys(SHEET_OF).map(id => ({
    id,
    path: `/sprites/${SHEET_OF[id]}/${id}.png`
  }));
}
