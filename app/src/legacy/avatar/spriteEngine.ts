/**
 * Sprite engine — maps expressions to sliced Kurisu frames from user sheets.
 * Layout was 2×4 column-major (1357 / 2468).
 */

export type SpriteId = string;
export type SpriteAction = "respond" | "explore" | "verify" | "rest" | "reflect" | "wait";

const ACTION_PREFERENCES: Readonly<Record<SpriteAction, readonly string[]>> = {
  // These ids retain legacy filenames, but are ordered by the *visible pose* verified in the PNGs.
  // Priority is semantic: a model should not show a phone pose just because the file is in the lab sheet.
  respond: ["soft_smile", "lab_tired", "whiteboard", "lab_think", "drpepper_dusk"],
  explore: ["street_walk", "city_stand", "steeple_focus", "phone_lean"],
  verify: ["wet_glance", "lab_chin", "neutral_front", "whiteboard_write"],
  rest: ["arms_crossed", "lab_crossed", "tired_rest"],
  reflect: ["thinking_chin", "lab_chin", "lab_profile", "whiteboard_write"],
  wait: ["city_stand", "office_shocked", "office_embarrassed", "arms_close"],
};

const EXPR_MAP: Record<string, string[]> = {
  // Asset ids are legacy names; see AVATAR_RENDERING_VISUAL_AUDIT_2026-10-29.md for the verified image meanings.
  neutral: ['city_stand', 'office_shocked', 'office_embarrassed', 'arms_close'],
  happy: ['soft_smile', 'lab_tired'],
  sad: ['reach_out', 'steeple_focus', 'lab_crossed'],
  thinking: ['thinking_chin', 'lab_chin', 'lab_profile', 'whiteboard_write'],
  embarrassed: ['tired_rest'],
  surprised: ['lab_shocked', 'whiteboard', 'lab_steeple'],
  focused: ['wet_glance', 'lab_chin', 'neutral_front', 'whiteboard_write'],
  tired: ['arms_crossed', 'lab_crossed', 'tired_rest'],
  tsundere_denial: ['office_embarrassed', 'lab_explain', 'arms_close'],
  dr_pepper_break: ['lab_steeple', 'sofa_phone'],
  whiteboard_explain: ['wet_glance', 'neutral_front', 'lab_tired', 'lab_think'],
  tender_glance: ['soft_smile', 'steeple_focus'],
  phone: ['phone_look', 'phone_lean', 'clockwork', 'passionate_reach'],
  passionate: ['lab_tired', 'drpepper_dusk', 'lab_think'],
  // fallbacks for avatar expression union
  chin_rest_thinking: ['thinking_chin', 'lab_chin'],
  steeple_fingers: ['whiteboard_write', 'lab_profile'],
  looking_away: ['steeple_focus', 'lab_drpepper'],
  smug: ['soft_smile', 'lab_explain'],
  angry: ['office_embarrassed', 'lab_explain', 'arms_close'],
  flustered: ['tired_rest'],
  sarcasm: ['office_embarrassed', 'lab_explain']
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
  const action = options.action ?? "wait";
  const actionDriven = action === "explore" || action === "verify" || action === "rest" || action === "reflect";
  // Active non-dialogue actions should actually change the pose category instead of
  // silently falling back to a neutral expression frame with no matching action pose.
  if (actionDriven) {
    const actionCandidates = ACTION_PREFERENCES[action].filter((spriteId) => Boolean(SHEET_OF[spriteId]));
    const profileActionCandidates = profile?.spritePreferences?.filter((spriteId) => actionCandidates.includes(spriteId)) ?? [];
    if (profileActionCandidates.length) candidates = profileActionCandidates;
    else if (actionCandidates.length) candidates = actionCandidates;
  } else if (profile?.spritePreferences?.length) {
    const preferred = profile.spritePreferences.filter((spriteId) => candidates!.includes(spriteId));
    if (preferred.length) candidates = preferred;
  }
  // Stable selection avoids a surprise pose jump caused by a wall-clock bucket.
  // Keep the option for API compatibility, but do not use the sheet name as a semantic classifier:
  // visual review found several "lab_*" filenames depict sleep, phone use or unrelated gestures.
  // Emotion/action suitability takes precedence over which sheet an asset came from.
  void preferLab;
  const id = actionDriven
    ? candidates[0]
    : ACTION_PREFERENCES[action].find((candidate) => candidates!.includes(candidate)) ??
      ACTION_PREFERENCES[action][0] ?? candidates[0];
  const sheet = SHEET_OF[id] || 'sheet_anime_office';
  return `/sprites/${sheet}/${id}.png`;
}

export function listAllSprites(): { id: string; path: string }[] {
  return Object.keys(SHEET_OF).map(id => ({
    id,
    path: `/sprites/${SHEET_OF[id]}/${id}.png`
  }));
}
