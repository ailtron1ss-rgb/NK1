import { memoryEngine } from './memoryEngine';
import { unifiedConsciousness } from '../cognitive/UnifiedConsciousness';
import { thoughtDebt } from '../cognitive/thoughtDebt';
import { echoCheckReply } from '../brain/echoCheck';
import { embodimentBus } from './embodimentBus';
import { userModel } from '../brain/userModel';
import { sessionEpisode } from '../brain/sessionEpisode';
import { extractFactsFromUser } from '../brain/factExtractor';
/**
 * Chat Service v5 — BrainOrchestrator + intent router + multi-model.
 */

import { localLLMEngine } from './localLLMEngine';
import { EmotionalState, AvatarExpression, MemoryItem } from '../types';
import {
  getActiveCloudProvider,
  isForceOffline,
  setForceOffline,
  ProviderConfig,
  getCloudProvidersRanked
} from './providerConfig';
import { neuralLocalEngine } from './neuralLocalEngine';
import { brain } from '../brain/BrainOrchestrator';
import { tokenMeter } from './tokenMeter';
import { splitSpeechAndActions } from './responseHygiene';
import { regexHygiene } from './regexHygiene';
import { pickFallback, pickSmartFallback } from './fallbackBank';
import { logger } from './logger';
import { brainHub } from '../brain/BrainHub';
import { powerGovernor } from './powerGovernor';
import { autonomyDrives } from '../cognitive/AutonomyDrives';
import { synergyOrchestrator } from '../synergy/SynergyOrchestrator';
import { loadProviders, saveProviders } from './providerConfig';

export interface ChatResponse {
  text: string;
  expression: AvatarExpression;
  trustDelta: number;
  affectionDelta: number;
  irritationDelta: number;
  curiosityDelta: number;
  newTopic: string | null;
  inferenceMode: string;
  performanceMs: number;
  backendInfo?: string;
}

async function callOpenAICompatible(provider: ProviderConfig, system: string, userMessage: string): Promise<string> {
  const url = `${provider.baseUrl}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.75,
      max_tokens: 2048
    })
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`${provider.name} HTTP ${res.status}: ${errText.slice(0, 100)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function callGemini(provider: ProviderConfig, system: string, userMessage: string): Promise<string> {
  const fallbacks = [
    provider.model,
    'gemini-2.0-flash', 'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
    'gemini-flash-latest'
  ].filter((v, i, a) => v && a.indexOf(v) === i) as string[];

  let lastErr = '';
  for (const model of fallbacks) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${provider.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${system}\n\nПользователь: ${userMessage}` }] }],
        generationConfig: { temperature: 0.78, maxOutputTokens: 2048 }
      })
    });
    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      if (text) {
        // remember working model
        try {
          const list = (await import('./providerConfig')).loadProviders();
          const next = list.map(p => p.id === 'gemini' ? { ...p, model } : p);
          (await import('./providerConfig')).saveProviders(next);
        } catch { /* */ }
        return text;
      }
      lastErr = `empty response (${model})`;
      continue;
    }
    const errText = await res.text().catch(() => '');
    lastErr = `HTTP ${res.status} ${model}: ${errText.slice(0, 140)}`;
    // only continue fallback on model-not-found style errors
    if (res.status !== 404 && !/not found|not supported|not available|NOT_FOUND/i.test(errText)) {
      throw new Error(`Gemini ${lastErr}`);
    }
  }
  throw new Error(`Gemini: все модели недоступны. ${lastErr}`);
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: any;
  const timeout = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new Error(`timeout ${ms}ms ${label}`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export class ChatService {

  public setForceOffline(value: boolean): void {
    setForceOffline(value);
  }

  public getModeHint(): string {
    if (isForceOffline()) {
      const n = neuralLocalEngine.getStatus();
      if (n.enabled && n.loaded) return `Neural:${n.modelId}`;
      if (n.enabled) return 'Neural (loading…)';
      return 'Template (offline)';
    }
    const p = getActiveCloudProvider();
    if (p) return `Cloud (${p.name})`;
    const n = neuralLocalEngine.getStatus();
    if (n.enabled && n.loaded) return `Neural:${n.modelId}`;
    if (n.enabled) return 'Neural (loading…)';
    return 'Template (no key)';
  }

  public async sendMessage(
    message: string,
    stm: string[],
    ltm: MemoryItem[],
    emotions: EmotionalState,
    _imageData?: string
  ): Promise<ChatResponse> {
    const start = performance.now();
    const plan = brain.plan({ message, emotions, stm, ltm });
    try {
      (window as any).__kurisuHasImage = !!_imageData;
      (window as any).__kurisuImageMeta = _imageData ? { bytes: _imageData.length } : null;
    } catch { /* */ }
    const imageVisionNote = _imageData
      ? '\n[VISION] Пользователь прикрепил изображение. Опиши то, что реально видно, свяжи с вопросом, не выдумывай невидимое.'
      : '';

    const pack = (
      raw: string,
      mode: string,
      backendInfo: string,
      deltas: Partial<ChatResponse> = {}
    ): ChatResponse => {
      const cleaned = splitSpeechAndActions(regexHygiene(raw)).display;
      const { text, expression } = brain.finalizeText(message, cleaned, emotions);
      try { synergyOrchestrator.onAct(message, text); } catch { /* */ }
      try { autonomyDrives.onDialogue(message, text.length); } catch { /* */ }
      try {
        sessionEpisode.push('user', message);
        sessionEpisode.push('kurisu', text);
        thoughtDebt.observeExchange(message, text);
        try { unifiedConsciousness.afterReply(message, text); } catch { /* */ }
        try {
          const w = Math.max(3, Math.min(10, 5 + Math.round((message.length > 80 ? 1 : 0) + (/!|\?/.test(message) ? 1 : 0) + (text.length > 100 ? 1 : 0))));
          // store notable user facts with weight
          if (/запомни:|меня зовут|я люблю|я живу/i.test(message)) {
            memoryEngine.addLongTermMemory('user', message.slice(0, 200), 'факт', Math.min(10, w + 2));
          } else if (w >= 7 && message.length > 40) {
            memoryEngine.addLongTermMemory('dialogue', `U: ${message.slice(0, 100)} | K: ${text.slice(0, 100)}`, 'ход', w);
          }
        } catch { /* */ }
        const echo = echoCheckReply(text);
        if (!echo.ok) {
          try { logger.warn?.('echoCheck', echo.note || ''); } catch { /* */ }
        }
        try { embodimentBus.emit({ speaking: false, emotion: expression as any }); } catch { /* */ }
        extractFactsFromUser(message);
        userModel.observeUserMessage(message);
      } catch { /* */ }
      try {
        const s = analyzeSentiment(message);
        (window as any).__kurisuSentiment = s;
      } catch { /* */ }
      brain.afterReply(message, text);
      try { brainHub.afterReply(message, text, 0.1); } catch { /* */ }
      const ms = Math.round(performance.now() - start);
      brain.noteGenerationMeta(backendInfo, ms);
      return {
        text,
        expression,
        trustDelta: deltas.trustDelta ?? 1,
        affectionDelta: deltas.affectionDelta ?? 0,
        irritationDelta: deltas.irritationDelta ?? 0,
        curiosityDelta: deltas.curiosityDelta ?? 1,
        newTopic: deltas.newTopic ?? null,
        inferenceMode: mode,
        performanceMs: ms,
        backendInfo: `${backendInfo} | ${plan.reason}`
      };
    };

    // Route: cloud
    if (plan.route === 'cloud') {
      let provider = getActiveCloudProvider();
      if (provider && tokenMeter.softExhausted(provider.id)) {
        const next = tokenMeter.pickNextCloud(provider.id);
        if (next) {
          const list = loadProviders().map(p => ({
            ...p,
            enabled: p.id === next.id ? true : p.id === provider!.id ? false : p.enabled
          }));
          // keep others; prefer next as first enabled with key
          saveProviders(list.map(p => p.id === next.id ? { ...p, enabled: true } : p));
          tokenMeter.noteSwitch(`Токены ${provider.name} на исходе → ${next.name}`);
          provider = next;
        } else {
          tokenMeter.noteSwitch(`Облако исчерпано → локальный режим`);
          provider = null as any;
        }
      }
      const ranked = getCloudProvidersRanked(plan.intent.backend === 'cloud_strong' ? 'strong' : 'fast');
      const tryProviders = ranked.length ? ranked : (provider ? [provider] : []);
      for (const prov of tryProviders) {
        if (!prov) continue;
        try {
          let text = '';
          if (prov.id === 'gemini') {
            text = await withTimeout(callGemini(prov, plan.systemPrompt, message), 20000, 'gemini');
          } else {
            text = await withTimeout(callOpenAICompatible(prov, plan.systemPrompt, message), 20000, prov.id);
          }
          if (!text) throw new Error('Empty cloud response');
          const clean = splitSpeechAndActions(text).display;
          tokenMeter.record(prov.id, plan.systemPrompt + message, clean);
          return pack(clean, prov.id, `${prov.name} • ${prov.model}`);
        } catch (e) {
          console.warn('[ChatService] Cloud failed', prov.id, e);
          tokenMeter.noteSwitch(`${prov.name} ошибка → следующая`);
        }
      }
    }

    // Route: neural or cloud-fallback → neural
    if ((plan.route === 'neural' || plan.route === 'cloud') && !(powerGovernor.preferCloudOnly() && plan.route === 'neural')) {
      try {
        const localRes = await localLLMEngine.processInference(
          message, stm, ltm, emotions, plan.systemPrompt
        );
        if (localRes.mode === 'neural') {
          return pack(localRes.text, 'neural', `Neural ${localRes.performance.backend}`, {
            trustDelta: localRes.trustDelta,
            affectionDelta: localRes.affectionDelta,
            irritationDelta: localRes.irritationDelta,
            curiosityDelta: localRes.curiosityDelta,
            newTopic: localRes.newTopic
          });
        }
        // template from local engine
        return pack(localRes.text, 'template', 'Template', {
          trustDelta: localRes.trustDelta,
          affectionDelta: localRes.affectionDelta,
          irritationDelta: localRes.irritationDelta,
          curiosityDelta: localRes.curiosityDelta,
          newTopic: localRes.newTopic
        });
      } catch (e) {
        console.warn('[ChatService] Local path failed:', e);
      }
    }

    // Hard template fallback
    logger.warn('falling to local/template', powerGovernor.get().mode);
    try {
    const localRes = await localLLMEngine.processInference(message, stm, ltm, emotions, plan.systemPrompt);
    return pack(localRes.text, localRes.mode, localRes.mode === 'neural' ? 'Neural' : 'Template', {
      trustDelta: localRes.trustDelta,
      affectionDelta: localRes.affectionDelta,
      irritationDelta: localRes.irritationDelta,
      curiosityDelta: localRes.curiosityDelta,
      newTopic: localRes.newTopic
    });
    } catch (e) {
      logger.error('total failure', e);
      return pack(pickSmartFallback(message), 'fallback', 'Fallback bank');
    }
  }
}

export const chatService = new ChatService();
