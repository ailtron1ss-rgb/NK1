/**
 * NK1 modular wardrobe domain model.
 *
 * This is a metadata/control layer, not a claim that missing garment meshes or
 * texture assets already exist. Asset references are optional, relative paths
 * and must be supplied by a renderer-specific wardrobe pack.
 */
export const WARDROBE_SLOTS = [
  "outerwear", "top", "bottom", "footwear", "hair", "hairAccessory",
  "neckAccessory", "earAccessory", "wristAccessory", "handheld",
] as const;
export type WardrobeSlot = typeof WARDROBE_SLOTS[number];
export type WardrobeRenderer = "live2d" | "depth2d" | "vrm3d";
export type OutfitId = "lab_coat" | "casual" | "hoodie" | "formal" | "nightwear" | "summer";
export type WardrobeAssetState = "missing" | "concept" | "authored" | "verified";
export interface WardrobeAssetRef {
  renderer: WardrobeRenderer;
  state: WardrobeAssetState;
  /** Relative path inside the selected, licensed wardrobe pack. */
  path?: string;
}
export interface GarmentDef {
  id: string;
  slot: WardrobeSlot;
  nameRu: string;
  tags: string[];
  assets: Partial<Record<WardrobeRenderer, WardrobeAssetRef>>;
  requires?: string[];
  excludes?: string[];
}
export interface OutfitDef {
  id: OutfitId;
  nameRu: string;
  description: string;
  tags: string[];
  garmentIds: string[];
  autoEligible: boolean;
}
export interface WardrobeContext {
  intent?: string;
  emotion?: string;
  energy01?: number;
  thermalComfort01?: number;
  sleeping?: boolean;
  userPinnedOutfit?: OutfitId | null;
  autoChangeEnabled?: boolean;
}
export interface WardrobeRecommendation {
  outfitId: OutfitId;
  reason: string;
  score: number;
  source: "user-pin" | "autonomous-context" | "default";
}
const clamp01 = (v: number | undefined, fallback = 0.5): number =>
  Number.isFinite(v) ? Math.max(0, Math.min(1, v as number)) : fallback;

export const GARMENTS: readonly GarmentDef[] = [
  { id:"coat-lab", slot:"outerwear", nameRu:"Лабораторный халат", tags:["science","work","formal"], assets:{live2d:{renderer:"live2d",state:"missing"},depth2d:{renderer:"depth2d",state:"missing"},vrm3d:{renderer:"vrm3d",state:"missing"}} },
  { id:"top-casual", slot:"top", nameRu:"Повседневный верх", tags:["casual","city"], assets:{live2d:{renderer:"live2d",state:"missing"},depth2d:{renderer:"depth2d",state:"missing"},vrm3d:{renderer:"vrm3d",state:"missing"}} },
  { id:"top-hoodie", slot:"top", nameRu:"Худи", tags:["night","coding","rest"], assets:{live2d:{renderer:"live2d",state:"missing"},depth2d:{renderer:"depth2d",state:"missing"},vrm3d:{renderer:"vrm3d",state:"missing"}} },
  { id:"top-formal", slot:"top", nameRu:"Формальный верх", tags:["formal","presentation"], assets:{live2d:{renderer:"live2d",state:"missing"},depth2d:{renderer:"depth2d",state:"missing"},vrm3d:{renderer:"vrm3d",state:"missing"}} },
  { id:"top-night", slot:"top", nameRu:"Домашний верх", tags:["sleep","rest"], assets:{live2d:{renderer:"live2d",state:"missing"},depth2d:{renderer:"depth2d",state:"missing"},vrm3d:{renderer:"vrm3d",state:"missing"}} },
  { id:"top-summer", slot:"top", nameRu:"Летний верх", tags:["summer","warm","casual"], assets:{live2d:{renderer:"live2d",state:"missing"},depth2d:{renderer:"depth2d",state:"missing"},vrm3d:{renderer:"vrm3d",state:"missing"}} },
  { id:"bottom-neutral", slot:"bottom", nameRu:"Базовый низ", tags:["all"], assets:{live2d:{renderer:"live2d",state:"missing"},depth2d:{renderer:"depth2d",state:"missing"},vrm3d:{renderer:"vrm3d",state:"missing"}} },
  { id:"shoes-neutral", slot:"footwear", nameRu:"Базовая обувь", tags:["all"], assets:{depth2d:{renderer:"depth2d",state:"missing"},vrm3d:{renderer:"vrm3d",state:"missing"}} },
  { id:"hair-clip-red", slot:"hairAccessory", nameRu:"Красная заколка", tags:["signature","all"], assets:{live2d:{renderer:"live2d",state:"missing"},depth2d:{renderer:"depth2d",state:"missing"},vrm3d:{renderer:"vrm3d",state:"missing"}} },
  { id:"glasses-lab", slot:"earAccessory", nameRu:"Защитные очки", tags:["science","lab"], assets:{depth2d:{renderer:"depth2d",state:"missing"},vrm3d:{renderer:"vrm3d",state:"missing"}} },
] as const;

export const OUTFITS: readonly OutfitDef[] = [
  {id:"lab_coat",nameRu:"Лабораторный образ",description:"Работа, исследования и научные обсуждения.",tags:["science","work","default"],garmentIds:["coat-lab","bottom-neutral","shoes-neutral","hair-clip-red"],autoEligible:true},
  {id:"casual",nameRu:"Повседневный",description:"Неформальное общение и городские сцены.",tags:["casual","city","talk"],garmentIds:["top-casual","bottom-neutral","shoes-neutral","hair-clip-red"],autoEligible:true},
  {id:"hoodie",nameRu:"Худи",description:"Ночная работа и отдых.",tags:["night","coding","tired","idle"],garmentIds:["top-hoodie","bottom-neutral","hair-clip-red"],autoEligible:true},
  {id:"formal",nameRu:"Формальный",description:"Доклады и серьёзные события.",tags:["formal","presentation","important"],garmentIds:["top-formal","bottom-neutral","shoes-neutral","hair-clip-red"],autoEligible:true},
  {id:"nightwear",nameRu:"Домашний / сон",description:"Отдых и восстановление.",tags:["sleep","rest"],garmentIds:["top-night","bottom-neutral"],autoEligible:true},
  {id:"summer",nameRu:"Летний",description:"Тёплая погода и выходные.",tags:["summer","warm","casual"],garmentIds:["top-summer","bottom-neutral","shoes-neutral","hair-clip-red"],autoEligible:true},
] as const;

const outfitById = new Map(OUTFITS.map((outfit) => [outfit.id, outfit]));
const garmentById = new Map(GARMENTS.map((garment) => [garment.id, garment]));
export function getOutfit(id: OutfitId): OutfitDef { return outfitById.get(id) ?? OUTFITS[0]; }
export function getGarment(id: string): GarmentDef | undefined { return garmentById.get(id); }

/** Reject absolute paths, traversal, query strings and remote URLs in wardrobe packs. */
export function isSafeWardrobeAssetPath(path: string): boolean {
  if (!path || path.length > 240 || path.startsWith("/") || path.includes(":") || path.includes("\\") || /[?#\u0000-\u001f]/u.test(path)) return false;
  const parts = path.split("/");
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..") &&
    /\.(?:png|webp|jpg|jpeg|json|vrm|glb|gltf)$/iu.test(path);
}
export function validateWardrobeCatalog(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const garment of GARMENTS) {
    if (ids.has(garment.id)) errors.push(`duplicate-garment:${garment.id}`);
    ids.add(garment.id);
    for (const [renderer, asset] of Object.entries(garment.assets)) {
      if (asset.renderer !== renderer) errors.push(`renderer-mismatch:${garment.id}:${renderer}`);
      if (asset.path && !isSafeWardrobeAssetPath(asset.path)) errors.push(`unsafe-asset-path:${garment.id}:${renderer}`);
      if (asset.state === "verified" && !asset.path) errors.push(`verified-asset-without-path:${garment.id}:${renderer}`);
    }
    for (const required of garment.requires ?? []) if (!garmentById.has(required)) errors.push(`unknown-required-garment:${garment.id}:${required}`);
  }
  for (const outfit of OUTFITS) {
    const seenSlots = new Set<WardrobeSlot>();
    for (const id of outfit.garmentIds) {
      const garment = garmentById.get(id);
      if (!garment) { errors.push(`unknown-outfit-garment:${outfit.id}:${id}`); continue; }
      if (seenSlots.has(garment.slot)) errors.push(`duplicate-slot:${outfit.id}:${garment.slot}`);
      seenSlots.add(garment.slot);
      for (const required of garment.requires ?? []) if (!outfit.garmentIds.includes(required)) errors.push(`missing-dependency:${outfit.id}:${id}:${required}`);
      for (const excluded of garment.excludes ?? []) if (outfit.garmentIds.includes(excluded)) errors.push(`conflicting-garments:${outfit.id}:${id}:${excluded}`);
    }
  }
  return errors;
}

/**
 * Recommend only. Applying a wardrobe change is a separate renderer action.
 * A user pin always wins; autonomous changes require an explicit opt-in.
 */
export function recommendOutfit(context: WardrobeContext): WardrobeRecommendation {
  if (context.userPinnedOutfit && outfitById.has(context.userPinnedOutfit)) {
    return {outfitId:context.userPinnedOutfit,reason:"user-pinned-preference",score:1,source:"user-pin"};
  }
  if (context.autoChangeEnabled !== true) {
    return {outfitId:"lab_coat",reason:"automatic-wardrobe-disabled",score:1,source:"default"};
  }
  const intent = String(context.intent ?? "").toLowerCase();
  const emotion = String(context.emotion ?? "").toLowerCase();
  const energy = clamp01(context.energy01);
  const thermal = clamp01(context.thermalComfort01);
  let outfitId: OutfitId = "casual";
  let reason = "neutral-social-context";
  if (context.sleeping || intent === "sleep" || intent === "rest") { outfitId="nightwear"; reason="sleep-or-rest-state"; }
  else if (intent === "science" || intent === "research" || intent === "experiment") { outfitId="lab_coat"; reason="scientific-work-context"; }
  else if (intent === "presentation" || intent === "formal") { outfitId="formal"; reason="presentation-context"; }
  else if (thermal < 0.25) { outfitId="hoodie"; reason="low-thermal-comfort"; }
  else if (thermal > 0.85 && (intent === "outdoor" || intent === "casual")) { outfitId="summer"; reason="warm-environment-context"; }
  else if (energy < 0.25 || emotion === "tired" || emotion === "exhausted") { outfitId="hoodie"; reason="low-energy-comfort"; }
  else if (intent === "social" || intent === "conversation" || emotion === "joy") { outfitId="casual"; reason="social-context"; }
  return {outfitId,reason,score:Math.max(0.5,Math.min(0.95,0.65+Math.abs(energy-0.5)*0.2)),source:"autonomous-context"};
}

export function resolveOutfitAssets(outfitId: OutfitId, renderer: WardrobeRenderer): Array<{garment:GarmentDef;asset:WardrobeAssetRef}> {
  return getOutfit(outfitId).garmentIds.flatMap((id) => {
    const garment = garmentById.get(id);
    const asset = garment?.assets[renderer];
    return garment && asset && asset.path && asset.state === "verified" ? [{garment,asset}] : [];
  });
}
