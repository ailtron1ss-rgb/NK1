/**
 * Multi-provider API key store + routing.
 * Keys live only in localStorage of the device.
 * Supports free-tier friendly providers.
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

const STORAGE_KEY = 'kurisu_providers_v2';

const DEFAULTS: ProviderConfig[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    enabled: true,
    apiKey: '',
    model: 'gemini-2.5-flash',
    freeNote: 'Бесплатный ключ в Google AI Studio'
  },
  {
    id: 'groq',
    name: 'Groq',
    enabled: false,
    apiKey: '',
    model: 'llama-3.3-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1',
    freeNote: 'Очень быстрый бесплатный tier'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    enabled: false,
    apiKey: '',
    model: 'google/gemma-2-9b-it:free',
    baseUrl: 'https://openrouter.ai/api/v1',
    freeNote: 'Много бесплатных моделей'
  },
  {
    id: 'together',
    name: 'Together.ai',
    enabled: false,
    apiKey: '',
    model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    baseUrl: 'https://api.together.xyz/v1',
    freeNote: 'Бесплатный trial / низкая цена'
  },
  {
    id: 'local',
    name: 'Локальный (offline)',
    enabled: true,
    apiKey: '',
    model: 'template-engine',
    freeNote: 'Всегда доступен без сети'
  }
];

export function loadProviders(): ProviderConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw) as ProviderConfig[];
    // merge with defaults to pick up new providers
    return DEFAULTS.map(d => {
      const found = parsed.find(p => p.id === d.id);
      return found ? { ...d, ...found } : d;
    });
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function saveProviders(list: ProviderConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getActiveCloudProvider(): ProviderConfig | null {
  const list = loadProviders();
  return list.find(p => p.id !== 'local' && p.enabled && p.apiKey.trim().length > 8) || null;
}

export function isForceOffline(): boolean {
  return localStorage.getItem('kurisu_force_offline') === '1';
}

export function setForceOffline(v: boolean) {
  localStorage.setItem('kurisu_force_offline', v ? '1' : '0');
}
