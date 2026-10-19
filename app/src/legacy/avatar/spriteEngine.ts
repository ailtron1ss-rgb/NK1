/**
 * Sprite engine — maps expressions to sliced Kurisu frames from user sheets.
 * Layout was 2×4 column-major (1357 / 2468).
 */

export type SpriteId = string;

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

export function resolveSpritePath(expression: string, options: { preferLab?: boolean; profile?: VisualProfileDef } = {}): string {
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
    const preferred = profile.spritePreferences.filter((id) => candidates!.includes(id));
    if (preferred.length) candidates = preferred;
  }
  let id = candidates[0];
  if (preferLab) {
    const lab = candidates.find(c => c.startsWith('lab_') || SHEET_OF[c] === 'sheet_lab');
    if (lab) id = lab;
  }
  const idx = Math.floor(Date.now() / 120000) % candidates.length;
  id = candidates[idx] || id;
  const sheet = SHEET_OF[id] || 'sheet_anime_office';
  return `/sprites/${sheet}/${id}.png`;
}

export function listAllSprites(): { id: string; path: string }[] {
  return Object.keys(SHEET_OF).map(id => ({
    id,
    path: `/sprites/${SHEET_OF[id]}/${id}.png`
  }));
}
