/**
 * Android-safe browser-only local neural engine (multi-model).
 * Transformers.js loaded from CDN only when enabled — no onnxruntime-node in npm.
 */

import { energyBudget } from '../brain/energyBudget';
import { runtimeGovernor } from './runtimeGovernor';
import {
  getActiveLocalSpec,
  isLocalNeuralEnabled,
  setLocalNeuralEnabled,
  LocalModelId,
  setActiveLocalModelId,
  getActiveLocalModelId,
  canAttemptModel
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
        const compatibility = canAttemptModel(spec);
        if (!compatibility.ok) throw new Error(`Модель остановлена защитой RAM: ${compatibility.reason}`);
        if (!energyBudget.canLoadNeural()) {
          throw new Error('Лимит загрузок локальной модели на сегодня исчерпан');
        }
        const browserImport = new Function('url', 'return import(url)') as (url: string) => Promise<any>;
        const transformers = await browserImport(TRANSFORMERS_CDN);
        const pipeline = transformers.pipeline;
        if (typeof pipeline !== 'function') {
          throw new Error('Не удалось загрузить Transformers.js из CDN');
        }

        const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
        const progress_callback = (p: any) => {
          try { window.dispatchEvent(new CustomEvent('kurisu-neural-progress', { detail: p })); } catch {}
        };

        const loadWith = async (device: NeuralDevice) => {
          this.device = device;
          const dtype = spec.dtype || (device === 'webgpu' ? 'q4f16' : 'q4');
          // Keep WASM thread count conservative on 4–6 GB Android devices.
          try {
            if (device === 'wasm' && transformers.env?.backends?.onnx?.wasm) {
              transformers.env.backends.onnx.wasm.numThreads = 2;
              transformers.env.backends.onnx.wasm.simd = true;
            }
          } catch {}
          return pipeline('text-generation', spec.hfId, {
            device,
            dtype,
            progress_callback
          });
        };

        try {
          this.generator = hasWebGPU ? await loadWith('webgpu') : await loadWith('wasm');
        } catch (webGpuOrPrimaryError) {
          // Some Android browsers expose navigator.gpu but cannot execute a
          // particular ONNX operator. Fall back to WASM instead of failing.
          if (hasWebGPU) {
            this.generator = await loadWith('wasm');
          } else {
            throw webGpuOrPrimaryError;
          }
        }
        this.loadedModelId = spec.id;
        energyBudget.recordNeuralLoad();
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

  public async generate(system: string, user: string, maxNewTokens = 220): Promise<string> {
    if (!isLocalNeuralEnabled()) throw new Error('Локальная нейросеть отключена');
    if (!runtimeGovernor.canLoadLocalNeural()) throw new Error('Профиль производительности временно запретил тяжёлую локальную модель');
    await this.load();
    if (!this.generator) throw new Error(this.error || 'Локальная модель не загрузилась');

    const prompt = ['### System', system, '### User', user, '### Assistant'].join('\n');
    const result = await this.generator(prompt, {
      max_new_tokens: maxNewTokens,
      temperature: 0.7,
      do_sample: true,
      top_p: 0.9,
      repetition_penalty: 1.08,
      presence_penalty: 0.35,
      return_full_text: false
    });
    const text = result?.[0]?.generated_text ?? result?.generated_text ?? '';
    return String(text).trim();
  }
}

export const neuralLocalEngine = new NeuralLocalEngine();
