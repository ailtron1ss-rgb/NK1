/**
 * Android-safe browser-only local neural engine (multi-model).
 * Transformers.js loaded from CDN only when enabled — no onnxruntime-node in npm.
 */

import {
  getActiveLocalSpec,
  isLocalNeuralEnabled,
  setLocalNeuralEnabled,
  LocalModelId,
  setActiveLocalModelId,
  getActiveLocalModelId
} from '../brain/modelManager';

export type NeuralDevice = 'webgpu' | 'wasm';

export interface NeuralLocalStatus {
  enabled: boolean;
  loaded: boolean;
  loading: boolean;
  device: NeuralDevice | 'unknown';
  model: string;
  modelId: LocalModelId;
  error?: string;
}

const TRANSFORMERS_VERSION = '3.8.1';
const TRANSFORMERS_CDN = `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${TRANSFORMERS_VERSION}/+esm`;

type Generator = (prompt: string, options?: Record<string, unknown>) => Promise<any>;

class NeuralLocalEngine {
  private generator: Generator | null = null;
  private loading: Promise<void> | null = null;
  private error = '';
  private device: NeuralDevice | 'unknown' = 'unknown';
  private loadedModelId: LocalModelId | null = null;

  public getStatus(): NeuralLocalStatus {
    const spec = getActiveLocalSpec();
    return {
      enabled: isLocalNeuralEnabled(),
      loaded: !!this.generator && this.loadedModelId === getActiveLocalModelId(),
      loading: !!this.loading,
      device: this.device,
      model: spec.hfId,
      modelId: spec.id,
      error: this.error || undefined
    };
  }

  public setEnabled(enabled: boolean) {
    setLocalNeuralEnabled(enabled);
    if (!enabled) {
      this.generator = null;
      this.loading = null;
      this.error = '';
      this.device = 'unknown';
      this.loadedModelId = null;
    }
  }

  public selectModel(id: LocalModelId) {
    if (getActiveLocalModelId() === id && this.generator) return;
    setActiveLocalModelId(id);
    // force reload on next generate
    this.generator = null;
    this.loadedModelId = null;
    this.error = '';
  }

  private async load() {
    if (this.generator && this.loadedModelId === getActiveLocalModelId()) return;
    if (this.loading) return this.loading;

    const spec = getActiveLocalSpec();
    this.loading = (async () => {
      try {
        const browserImport = new Function('url', 'return import(url)') as (url: string) => Promise<any>;
        const transformers = await browserImport(TRANSFORMERS_CDN);
        const pipeline = transformers.pipeline;
        if (typeof pipeline !== 'function') {
          throw new Error('Не удалось загрузить Transformers.js из CDN');
        }

        const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
        this.device = hasWebGPU ? 'webgpu' : 'wasm';
        const dtype = this.device === 'webgpu' ? 'q4f16' : 'q4';

        this.generator = await pipeline('text-generation', spec.hfId, {
          device: this.device,
          dtype,
          progress_callback: (p: any) => {
            window.dispatchEvent(new CustomEvent('kurisu-neural-progress', { detail: p }));
          }
        });
        this.loadedModelId = spec.id;
        this.error = '';
      } catch (e) {
        this.generator = null;
        this.loadedModelId = null;
        this.error = e instanceof Error ? e.message : String(e);
        throw e;
      } finally {
        this.loading = null;
      }
    })();

    return this.loading;
  }

  public async ensureLoaded(): Promise<boolean> {
    if (!isLocalNeuralEnabled()) return false;
    try {
      await this.load();
      return !!this.generator;
    } catch {
      return false;
    }
  }

  public async generate(system: string, user: string, maxNewTokens = 180): Promise<string> {
    if (!isLocalNeuralEnabled()) throw new Error('Локальная нейросеть отключена');
    await this.load();
    if (!this.generator) throw new Error(this.error || 'Локальная модель не загрузилась');

    const prompt = ['### System', system, '### User', user, '### Assistant'].join('\n');
    const result = await this.generator(prompt, {
      max_new_tokens: maxNewTokens,
      temperature: 0.7,
      do_sample: true,
      top_p: 0.9,
      repetition_penalty: 1.08,
      return_full_text: false
    });
    const text = result?.[0]?.generated_text ?? result?.generated_text ?? '';
    return String(text).trim();
  }
}

export const neuralLocalEngine = new NeuralLocalEngine();
