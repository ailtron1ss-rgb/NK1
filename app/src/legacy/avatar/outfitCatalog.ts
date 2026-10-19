/**
 * Legacy visual-profile catalog for Kurisu.
 * Profiles select real legacy sprite families; this catalog does not invent outfit images.
 */
export type VisualProfileId = 'lab_coat' | 'casual' | 'hoodie' | 'formal' | 'nightwear' | 'summer';

export interface VisualProfileDef {
  id: VisualProfileId;
  nameRu: string;
  description: string;
  spritePreferences: string[];
  autoTags: string[];
}

export const OUTFITS: VisualProfileDef[] = [
  { id:'lab_coat', nameRu:'Халат лаборатории', description:'Научная/рабочая сцена.', spritePreferences:['lab_chin','lab_crossed','lab_explain','lab_steeple','lab_profile'], autoTags:['lab','science','default','work'] },
  { id:'casual', nameRu:'Повседневный', description:'Городская и разговорная сцена.', spritePreferences:['city_stand','street_walk','soft_smile','sofa_phone'], autoTags:['casual','city','talk'] },
  { id:'hoodie', nameRu:'Худи / ночной профиль', description:'Ночная работа, отдых, усталость.', spritePreferences:['tired_rest','phone_lean','drpepper_dusk','wet_glance'], autoTags:['night','coding','tired','idle'] },
  { id:'formal', nameRu:'Формальный', description:'Доклад, доска, серьёзная работа.', spritePreferences:['whiteboard','whiteboard_write','steeple_focus','lab_steeple'], autoTags:['formal','meta','important'] },
  { id:'nightwear', nameRu:'Домашний / сон', description:'Спокойная ночная сцена.', spritePreferences:['sofa_phone','tired_rest','wet_glance'], autoTags:['sleep','night_end'] },
  { id:'summer', nameRu:'Летний', description:'Светлая выходная сцена.', spritePreferences:['sunset_phone','reach_out','passionate_reach','soft_smile'], autoTags:['summer','warm','happy'] },
];

export function getOutfit(id: VisualProfileId): VisualProfileDef {
  return OUTFITS.find((o) => o.id === id) || OUTFITS[0];
}

export function pickAutoOutfit(ctx: { hour?: number; intent?: string; energy?: number; sleeping?: boolean }): VisualProfileId {
  if (ctx.sleeping) return 'nightwear';
  const h = ctx.hour ?? new Date().getHours();
  if (h >= 23 || h < 6) return 'hoodie';
  if (ctx.intent === 'science' || ctx.intent === 'meta') return 'lab_coat';
  if (ctx.intent === 'emotional') return 'casual';
  if (ctx.energy !== undefined && ctx.energy < 30) return 'hoodie';
  if (h >= 9 && h <= 18) return 'lab_coat';
  return 'casual';
}
