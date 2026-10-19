/**
 * Model Manager — multiple local ONNX models + cloud providers as one catalog.
 * User can enable/download local models in-browser (Transformers.js CDN).
 * Optimized for mid-range Android: only one local model loaded at a time.
 */

export type LocalModelId = 'smol135' | 'smol360' | 'qwen05';

export interface LocalModelSpec {
  id: LocalModelId;
  name: string;
  hfId: string;
  approxMB: number;
  ramHint: string;
  quality: number; // 1..10
  speed: number;   // 1..10
  notes: string;
}

export const LOCAL_MODELS: LocalModelSpec[] = [
  {
    id: 'smol135',
    name: 'SmolLM2 135M',
    hfId: 'onnx-community/SmolLM2-135M-Instruct-ONNX-MHA',
    approxMB: 140,
    ramHint: 'лёгкая, средний телефон',
    quality: 4,
    speed: 9,
    notes: 'Быстрый offline-диалог, слабее в науке'
  },
  {
    id: 'smol360',
    name: 'SmolLM2 360M',
    hfId: 'onnx-community/SmolLM2-360M-Instruct-ONNX',
    approxMB: 280,
    ramHint: 'нужно ≥6 ГБ RAM',
    quality: 6,
    speed: 6,
    notes: 'Заметнее умнее 135M, медленнее'
  },
  {
    id: 'qwen05',
    name: 'Qwen2.5 0.5B',
    hfId: 'onnx-community/Qwen2.5-0.5B-Instruct-ONNX',
    approxMB: 400,
    ramHint: 'тяжёлая для слабых телефонов',
    quality: 7,
    speed: 4,
    notes: 'Лучше рассуждения, может не влезть в RAM'
  }
];

const ACTIVE_KEY = 'kurisu_local_model_id';
const ENABLED_KEY = 'kurisu_neural_local';

export function getActiveLocalModelId(): LocalModelId {
  const v = localStorage.getItem(ACTIVE_KEY) as LocalModelId | null;
  if (v && LOCAL_MODELS.some(m => m.id === v)) return v;
  return 'smol135';
}

export function setActiveLocalModelId(id: LocalModelId) {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function getActiveLocalSpec(): LocalModelSpec {
  const id = getActiveLocalModelId();
  return LOCAL_MODELS.find(m => m.id === id) || LOCAL_MODELS[0];
}

export function isLocalNeuralEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) === '1';
}

export function setLocalNeuralEnabled(on: boolean) {
  localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
}

/** Pick cloud provider preference from intent */
export function preferredCloudTier(backend: 'cloud_strong' | 'cloud_fast'): 'strong' | 'fast' {
  return backend === 'cloud_strong' ? 'strong' : 'fast';
}
