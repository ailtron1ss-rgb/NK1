/**
 * Chat Service v5 — BrainOrchestrator + intent router + multi-model.
 */

import { localLLMEngine } from './localLLMEngine';
import { EmotionalState, AvatarExpression, MemoryItem } from '../types';
import {
  getActiveCloudProvider,
  isForceOffline,
  setForceOffline,
  ProviderConfig
} from './providerConfig';
import { neuralLocalEngine } from './neuralLocalEngine';
import { brain } from '../brain/BrainOrchestrator';

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
      max_tokens: 450
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
  const model = provider.model || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${provider.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `${system}\n\nПользователь: ${userMessage}` }] }],
      generationConfig: { temperature: 0.75, maxOutputTokens: 450 }
    })
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 100)}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
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

    const pack = (
      raw: string,
      mode: string,
      backendInfo: string,
      deltas: Partial<ChatResponse> = {}
    ): ChatResponse => {
      const { text, expression } = brain.finalizeText(message, raw, emotions);
      brain.afterReply(message, text);
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
      const provider = getActiveCloudProvider();
      if (provider) {
        try {
          let text = '';
          if (provider.id === 'gemini') {
            text = await callGemini(provider, plan.systemPrompt, message);
          } else {
            text = await callOpenAICompatible(provider, plan.systemPrompt, message);
          }
          if (!text) throw new Error('Empty cloud response');
          return pack(text, provider.id, `${provider.name} • ${provider.model}`);
        } catch (e) {
          console.warn('[ChatService] Cloud failed, falling through:', e);
        }
      }
    }

    // Route: neural or cloud-fallback → neural
    if (plan.route === 'neural' || plan.route === 'cloud') {
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
    const localRes = await localLLMEngine.processInference(message, stm, ltm, emotions, plan.systemPrompt);
    return pack(localRes.text, localRes.mode, localRes.mode === 'neural' ? 'Neural' : 'Template', {
      trustDelta: localRes.trustDelta,
      affectionDelta: localRes.affectionDelta,
      irritationDelta: localRes.irritationDelta,
      curiosityDelta: localRes.curiosityDelta,
      newTopic: localRes.newTopic
    });
  }
}

export const chatService = new ChatService();
