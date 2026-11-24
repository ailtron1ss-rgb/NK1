/**
 * Multi-provider keys + model catalogs (v20).
 * Keys only in localStorage — never hardcode secrets in the repo.
 */

export type ProviderId = 'gemini' | 'groq' | 'openrouter' | 'together' | 'local';

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  enabled: boolean;
  apiKey: string;
  model: string;
  baseUrl?: string;
  freeNote: string;
}

const STORAGE_KEY = 'kurisu_providers_v3';

/** Safe defaults for free / new Google AI Studio keys */
export const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-pro',
  'gemini-flash-latest'
];

export const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'gemma2-9b-it',
  'mixtral-8x7b-32768'
];

export const OPENROUTER_MODELS = [
  'google/gemma-2-9b-it:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'qwen/qwen-2.5-7b-instruct:free',
  'mistralai/mistral-7b-instruct:free'
];

export const TOGETHER_MODELS = [
  'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
  'mistralai/Mistral-7B-Instruct-v0.3'
];

export function modelsFor(id: ProviderId): string[] {
  switch (id) {
    case 'gemini':
      return GEMINI_MODELS;
    case 'groq':
      return GROQ_MODELS;
    case 'openrouter':
      return OPENROUTER_MODELS;
    case 'together':
      return TOGETHER_MODELS;
    default:
      return [];
  }
}

const DEFAULTS: ProviderConfig[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    enabled: true,
    apiKey: '',
    model: 'gemini-2.0-flash',
    freeNote: 'Стабильный основной маршрут: Gemini 2.5 Flash; доступность зависит от аккаунта/API.'
  },
  {
    id: 'groq',
    name: 'Groq',
    enabled: false,
    apiKey: '',
    model: 'llama-3.1-8b-instant',
    baseUrl: 'https://api.groq.com/openai/v1',
    freeNote: 'Быстрый free tier'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    enabled: false,
    apiKey: '',
    model: 'google/gemma-2-9b-it:free',
    baseUrl: 'https://openrouter.ai/api/v1',
    freeNote: 'Бесплатные :free модели'
  },
  {
    id: 'together',
    name: 'Together.ai',
    enabled: false,
    apiKey: '',
    model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    baseUrl: 'https://api.together.xyz/v1',
    freeNote: 'Trial / низкая цена'
  },
  {
    id: 'local',
    name: 'Локальный (offline)',
    enabled: true,
    apiKey: '',
    model: 'template-engine',
    freeNote: 'Без сети'
  }
];

function cloneDefaults(): ProviderConfig[] {
  return JSON.parse(JSON.stringify(DEFAULTS));
}

export function loadProviders(): ProviderConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('kurisu_providers_v2');
    if (!raw) return cloneDefaults();
    const parsed = JSON.parse(raw) as ProviderConfig[];
    return DEFAULTS.map(d => {
      const found = parsed.find(p => p.id === d.id);
      if (!found) return { ...d };
      // migrate bad default 2.5 for users who never changed model
      let model = found.model || d.model;
      if (d.id === 'gemini' && /^(gemini-2\.0|gemini-1\.5)/.test(model) && !(found as any)._userPickedModel) {
        model = 'gemini-2.0-flash';
      }
      return { ...d, ...found, model };
    });
  } catch {
    return cloneDefaults();
  }
}

export function saveProviders(list: ProviderConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getActiveCloudProvider(): ProviderConfig | null {
  const list = loadProviders();
  return list.find(p => p.id !== 'local' && p.enabled && p.apiKey.trim().length > 8) || null;
}


export function getCloudProvidersRanked(preference: 'strong' | 'fast' = 'fast'): ProviderConfig[] {
  const list = loadProviders().filter(p => p.id !== 'local' && p.enabled && p.apiKey.trim().length > 8);
  const strongOrder: ProviderId[] = ['gemini', 'openrouter', 'groq', 'together'];
  const fastOrder: ProviderId[] = ['groq', 'gemini', 'openrouter', 'together'];
  const order = preference === 'strong' ? strongOrder : fastOrder;
  return list.slice().sort((a, b) => {
    const ai = order.indexOf(a.id), bi = order.indexOf(b.id);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
}

export function isForceOffline(): boolean {
  return localStorage.getItem('kurisu_force_offline') === '1';
}

export function setForceOffline(v: boolean) {
  localStorage.setItem('kurisu_force_offline', v ? '1' : '0');
}

/** List models visible to this Gemini API key */
export async function listGeminiModels(apiKey: string): Promise<string[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
  );
  if (!res.ok) throw new Error(`listModels HTTP ${res.status}`);
  const data = await res.json();
  const names: string[] = (data.models || [])
    .map((m: any) => String(m.name || '').replace(/^models\//, ''))
    .filter((n: string) => n.includes('gemini') && !n.includes('embedding'));
  return names.length ? names : GEMINI_MODELS;
}
