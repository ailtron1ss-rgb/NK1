/**
 * Speech Synthesis Engine for Kurisu AI Companion.
 * Combines Web Speech API with pitch/speed adjustments and Gemini TTS server proxy.
 */

import { VoiceSettings } from '../types';

export class TTSEngine {
  private synth: SpeechSynthesis | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private isSpeakingInternal: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    return this.synth.getVoices();
  }

  public speak(
    text: string,
    settings: VoiceSettings,
    onStart?: () => void,
    onEnd?: () => void,
    onBoundary?: (charIndex: number) => void
  ): void {
    this.stop(); // stop any current playback

    // Try server Gemini TTS first if available or fallback to Web Speech
    this.speakWebSpeech(text, settings, onStart, onEnd, onBoundary);
  }

  private speakWebSpeech(
    text: string,
    settings: VoiceSettings,
    onStart?: () => void,
    onEnd?: () => void,
    onBoundary?: (charIndex: number) => void
  ): void {
    if (!this.synth) {
      console.warn('SpeechSynthesis is not supported in this environment.');
      return;
    }

    const cleanText = text.replace(/[*#_~`]/g, '').trim();
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Apply pitch (+5% = ~1.1) and speed (0.95x) as requested
    let pitch = settings.pitch || 1.1;
    let rate = settings.speed || 0.95;
    try {
      // dynamic import avoid cycle — use global affect if present
      const aff = (window as any).__kurisuAffect as
        | { irritation?: number; affection?: number; curiosity?: number }
        | undefined;
      if (aff) {
        const adj = applyEmotionToVoice({ pitch, speed: rate }, aff);
        pitch = adj.pitch;
        rate = adj.speed;
      }
    } catch { /* */ }
    try {
      const s = (window as any).__kurisuSentiment;
      if (s?.pitchMul) pitch *= s.pitchMul;
      if (s?.rateMul) rate *= s.rateMul;
    } catch { /* */ }
    utterance.pitch = Math.max(0.6, Math.min(1.5, pitch));
    utterance.rate = Math.max(0.7, Math.min(1.4, rate));
    utterance.volume = settings.volume ?? 1.0;

    // Pick best Russian or female voice
    const voices = this.synth.getVoices();
    let selectedVoice: SpeechSynthesisVoice | null = null;

    if (settings.voiceName) {
      selectedVoice = voices.find(v => v.name === settings.voiceName) || null;
    }

    if (!selectedVoice) {
      // Find Russian voice
      selectedVoice = voices.find(v => v.lang.startsWith('ru')) ||
                      voices.find(v => v.name.toLowerCase().includes('female')) ||
                      voices[0] || null;
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang || 'ru-RU';
    } else {
      utterance.lang = 'ru-RU';
    }

    utterance.onstart = () => {
      this.isSpeakingInternal = true;
      if (onStart) onStart();
    };

    utterance.onend = () => {
      this.isSpeakingInternal = false;
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      // Ignore normal speech cancellations and interruptions
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.warn('TTS playback note:', e.error || 'speech_ended');
      }
      this.isSpeakingInternal = false;
      if (onEnd) onEnd();
    };

    if (onBoundary) {
      utterance.onboundary = (event) => {
        onBoundary(event.charIndex);
      };
    }

    this.synth.speak(utterance);
  }

  public async speakServerTTS(
    text: string,
    onStart?: () => void,
    onEnd?: () => void
  ): Promise<boolean> {
    try {
      this.stop();
      const response = await fetch('/api/kurisu/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!response.ok) return false;
      const data = await response.json();
      if (!data.audio) return false;

      const audioSrc = `data:audio/mp3;base64,${data.audio}`;
      this.currentAudio = new Audio(audioSrc);

      this.currentAudio.onplay = () => {
        this.isSpeakingInternal = true;
        if (onStart) onStart();
      };

      this.currentAudio.onended = () => {
        this.isSpeakingInternal = false;
        if (onEnd) onEnd();
      };

      this.currentAudio.onerror = () => {
        this.isSpeakingInternal = false;
        if (onEnd) onEnd();
      };

      await this.currentAudio.play();
      return true;
    } catch (e) {
      console.error('Server TTS error:', e);
      return false;
    }
  }

  public stop(): void {
    if (this.synth) {
      this.synth.cancel();
    }
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.isSpeakingInternal = false;
  }

  public isSpeaking(): boolean {
    return this.isSpeakingInternal || (this.synth ? this.synth.speaking : false);
  }
}

export const ttsEngine = new TTSEngine();


/** Map internal emotion to pitch/rate for Web Speech API */
export function applyEmotionToVoice(
  base: { pitch: number; rate?: number; speed?: number },
  emotions: { irritation?: number; affection?: number; curiosity?: number }
) {
  let pitch = base.pitch;
  let speed = base.speed ?? base.rate ?? 1;
  if ((emotions.irritation ?? 0) > 60) { pitch -= 0.05; speed += 0.08; }
  if ((emotions.affection ?? 0) > 65) { pitch += 0.06; speed -= 0.05; }
  if ((emotions.curiosity ?? 0) > 70) { pitch += 0.03; speed += 0.04; }
  return {
    pitch: Math.max(0.6, Math.min(1.4, pitch)),
    speed: Math.max(0.7, Math.min(1.3, speed))
  };
}
