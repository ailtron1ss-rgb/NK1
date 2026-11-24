/**
 * Outfit + live avatar catalog for Kurisu.
 * Images live in /outfits/{id}/preview.png (optional) — procedural canvas always works.
 */

export type OutfitId =
  | 'lab_coat'
  | 'casual'
  | 'hoodie'
  | 'formal'
  | 'nightwear'
  | 'summer';

export interface OutfitDef {
  id: OutfitId;
  nameRu: string;
  description: string;
  /** CSS / canvas palette */
  colors: {
    hair: string;
    hairShadow: string;
    skin: string;
    eyes: string;
    top: string;
    topAccent: string;
    bottom: string;
    accessory?: string;
  };
  /** When Kurisu may auto-switch into this */
  autoTags: string[];
  /** Optional user image under public/outfits/{id}/base.png */
  imagePath?: string;
}

export const OUTFITS: OutfitDef[] = [
  {
    id: 'lab_coat',
    nameRu: 'Халат лаборатории',
    description: 'Классика BRI / Future Gadget vibe',
    colors: {
      hair: '#C45C26',
      hairShadow: '#8B3A12',
      skin: '#F5D0B0',
      eyes: '#5B8C5A',
      top: '#F4F0E8',
      topAccent: '#2A2A32',
      bottom: '#3D3D48',
      accessory: '#C62828'
    },
    autoTags: ['lab', 'science', 'default', 'work'],
    imagePath: '/outfits/lab_coat/base.png'
  },
  {
    id: 'casual',
    nameRu: 'Повседневный',
    description: 'Свободная одежда вне смены',
    colors: {
      hair: '#C45C26',
      hairShadow: '#8B3A12',
      skin: '#F5D0B0',
      eyes: '#5B8C5A',
      top: '#5B7C99',
      topAccent: '#E8E0D5',
      bottom: '#3E4A56'
    },
    autoTags: ['casual', 'city', 'talk'],
    imagePath: '/outfits/casual/base.png'
  },
  {
    id: 'hoodie',
    nameRu: 'Худи',
    description: 'Ночные расчёты и @channel',
    colors: {
      hair: '#C45C26',
      hairShadow: '#8B3A12',
      skin: '#F5D0B0',
      eyes: '#5B8C5A',
      top: '#6B4E71',
      topAccent: '#2D2A32',
      bottom: '#2A2A30'
    },
    autoTags: ['night', 'coding', 'tired', 'idle'],
    imagePath: '/outfits/hoodie/base.png'
  },
  {
    id: 'formal',
    nameRu: 'Формальный',
    description: 'Доклады и серьёзный тон',
    colors: {
      hair: '#C45C26',
      hairShadow: '#8B3A12',
      skin: '#F5D0B0',
      eyes: '#5B8C5A',
      top: '#1E2A3A',
      topAccent: '#C9A227',
      bottom: '#1A1A22'
    },
    autoTags: ['formal', 'meta', 'important'],
    imagePath: '/outfits/formal/base.png'
  },
  {
    id: 'nightwear',
    nameRu: 'Домашний / сон',
    description: 'После «спокойной ночи»',
    colors: {
      hair: '#C45C26',
      hairShadow: '#8B3A12',
      skin: '#F5D0B0',
      eyes: '#5B8C5A',
      top: '#E8D5E0',
      topAccent: '#B88A9A',
      bottom: '#D4C4CE'
    },
    autoTags: ['sleep', 'night_end'],
    imagePath: '/outfits/nightwear/base.png'
  },
  {
    id: 'summer',
    nameRu: 'Летний',
    description: 'Жара и редкие выходные',
    colors: {
      hair: '#C45C26',
      hairShadow: '#8B3A12',
      skin: '#F5D0B0',
      eyes: '#5B8C5A',
      top: '#F0A8B8',
      topAccent: '#FFFFFF',
      bottom: '#F5F0E8'
    },
    autoTags: ['summer', 'warm', 'happy'],
    imagePath: '/outfits/summer/base.png'
  }
];

export function getOutfit(id: OutfitId): OutfitDef {
  return OUTFITS.find(o => o.id === id) || OUTFITS[0];
}

export function pickAutoOutfit(ctx: {
  hour?: number;
  intent?: string;
  energy?: number;
  sleeping?: boolean;
}): OutfitId {
  if (ctx.sleeping) return 'nightwear';
  const h = ctx.hour ?? new Date().getHours();
  if (h >= 23 || h < 6) return 'hoodie';
  if (ctx.intent === 'science' || ctx.intent === 'meta') return 'lab_coat';
  if (ctx.intent === 'emotional') return 'casual';
  if (ctx.energy !== undefined && ctx.energy < 30) return 'hoodie';
  if (h >= 9 && h <= 18) return 'lab_coat';
  return 'casual';
}
