import { readJson, writeJson } from '../cognitive/StateVault';
/**
 * Local model registry.
 *
 * The runtime accepts any Hugging Face repository that is compatible with
 * Transformers.js text-generation + ONNX artifacts. The curated catalog is
 * only a convenience layer; custom repositories can be added by the user.
 * One model is loaded at a time to protect mid-range Android devices.
 */

export type LocalModelId = string;

export interface LocalModelSpec {
  id: LocalModelId;
  name: string;
  hfId: string;
  approxMB: number;
  ramHint: string;
  quality: number;
  speed: number;
  notes: string;
  source?: 'curated' | 'custom';
  dtype?: 'q4' | 'q4f16' | 'int8' | 'fp16';
}

export const LOCAL_MODELS: LocalModelSpec[] = [

  {
    id: 'smol135', name: 'SmolLM2 135M', hfId: 'onnx-community/SmolLM2-135M-Instruct-ONNX-MHA',
    approxMB: 182, ramHint: 'очень лёгкая', quality: 4, speed: 9,
    notes: 'быстрый базовый офлайн-диалог', source: 'curated'
  },
  {
    id: 'smol360', name: 'SmolLM2 360M', hfId: 'onnx-community/SmolLM2-360M-Instruct-ONNX',
    approxMB: 386, ramHint: 'подходит для 4–6 ГБ RAM при умеренной нагрузке', quality: 6, speed: 7,
    notes: 'рекомендуемый локальный компромисс; q4 ≈386 МБ, runtime выше размера файла', source: 'curated'
  },
  {
    id: 'qwen05', name: 'Qwen2.5 0.5B Instruct', hfId: 'onnx-community/Qwen2.5-0.5B-Instruct',
    approxMB: 648, ramHint: 'лучше 6+ ГБ RAM', quality: 7, speed: 4,
    notes: 'сильнее в рассуждениях; runtime RAM выше размера файла', source: 'curated'
  },
  {
    id: 'qwen3-06', name: 'Qwen3 0.6B Instruct', hfId: 'onnx-community/Qwen3-0.6B-Instruct-ONNX',
    approxMB: 648, ramHint: 'лучше 6+ ГБ RAM', quality: 8, speed: 4,
    notes: 'современный 0.6B; есть q4f16 ONNX', source: 'curated', dtype: 'q4f16'
  },
  {
    id: 'phi35', name: 'Phi-3.5 Mini Instruct', hfId: 'onnx-community/Phi-3.5-mini-instruct-onnx-web',
    approxMB: 220, ramHint: 'файл Q4F16 ≈220 МБ, runtime намного больше', quality: 8, speed: 3,
    notes: 'сильный, но тяжёлый для среднего телефона', source: 'curated', dtype: 'q4f16'
  },
  {
    id: 'tinyllama11', name: 'TinyLlama 1.1B Chat', hfId: 'onnx-community/TinyLlama-1.1B-Chat-v1.0-ONNX',
    approxMB: 650, ramHint: 'лучше 6+ ГБ RAM', quality: 6, speed: 3,
    notes: 'старее, но полезен для экспериментов', source: 'curated'
  },
  {
    id: 'qwen3-06-base', name: 'Qwen3 0.6B Base ONNX', hfId: 'onnx-community/Qwen3-0.6B-ONNX',
    approxMB: 570, ramHint: '6+ ГБ RAM; q4f16', quality: 7, speed: 4,
    notes: 'базовая Qwen3 без Instruct; экспериментальный режим', source: 'curated', dtype: 'q4f16'
  },
];

const CUSTOM_KEY = 'kurisu_custom_local_models_v1';
const ACTIVE_KEY = 'kurisu_local_model_id';
const ENABLED_KEY = 'kurisu_neural_local';

function readCustom(): LocalModelSpec[] {
  const parsed = readJson<unknown[]>(CUSTOM_KEY, []);
  return Array.isArray(parsed) ? parsed.filter(x => (x as any)?.id && (x as any)?.hfId).slice(0, 24) as LocalModelSpec[] : [];
}

export function getAllLocalModels(): LocalModelSpec[] {
  return [...LOCAL_MODELS, ...readCustom()];
}

export function addCustomLocalModel(input: Omit<LocalModelSpec, 'id' | 'source'> & { id?: string }): LocalModelSpec {
  const id = input.id?.trim() || `custom_${Date.now().toString(36)}`;
  const spec: LocalModelSpec = { ...input, id, source: 'custom' };
  const next = [spec, ...readCustom().filter(m => m.id !== id)].slice(0, 24);
  writeJson(CUSTOM_KEY, next);
  return spec;
}

export function removeCustomLocalModel(id: string) {
  writeJson(CUSTOM_KEY, readCustom().filter(m => m.id !== id));
  if (getActiveLocalModelId() === id) setActiveLocalModelId('smol135');
}

export function getActiveLocalModelId(): LocalModelId {
  let v = readJson<string | null>(ACTIVE_KEY, null);
  if (!v) { try { v = localStorage.getItem(ACTIVE_KEY); } catch {} }
  if (v && getAllLocalModels().some(m => m.id === v)) return v;
  // Russian-first default: Qwen3 0.6B is multilingual but costs more RAM.
  // On 6 GB+ devices it is preferred; 4 GB devices use the lighter model.
  const ram = getDeviceMemoryGB();
  return ram != null && ram >= 6 ? 'qwen3-06' : ram != null && ram >= 4 ? 'smol360' : 'smol135';
}

export function setActiveLocalModelId(id: LocalModelId) {
  writeJson(ACTIVE_KEY, id);
}

export function getActiveLocalSpec(): LocalModelSpec {
  const id = getActiveLocalModelId();
  return getAllLocalModels().find(m => m.id === id) || LOCAL_MODELS[0];
}

export function isLocalNeuralEnabled(): boolean {
  const v = readJson<boolean | string>(ENABLED_KEY, false);
  if (v === true || v === '1') return true;
  try { return localStorage.getItem(ENABLED_KEY) === '1'; } catch { return false; }
}

export function setLocalNeuralEnabled(on: boolean) {
  writeJson(ENABLED_KEY, on);
}

export function preferredCloudTier(backend: 'cloud_strong' | 'cloud_fast'): 'strong' | 'fast' {
  return backend === 'cloud_strong' ? 'strong' : 'fast';
}


export function getDeviceMemoryGB(): number | null {
  try {
    const dm = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    return typeof dm === 'number' && dm > 0 ? dm : null;
  } catch { return null; }
}

export function canAttemptModel(spec = getActiveLocalSpec()): { ok: boolean; reason: string } {
  const ram = getDeviceMemoryGB();
  if (ram === null) return { ok: true, reason: 'RAM unknown — allow cautious attempt' };
  const estimated = Math.max(1.2, spec.approxMB / 1024 * 2.6);
  if (ram < 4 && estimated > 1.2) return { ok: false, reason: `deviceMemory ${ram}GB is too low for ${spec.name}` };
  if (ram < 6 && estimated > 2.0) return { ok: false, reason: `deviceMemory ${ram}GB is marginal for ${spec.name}` };
  return { ok: true, reason: `deviceMemory ${ram}GB` };
}
