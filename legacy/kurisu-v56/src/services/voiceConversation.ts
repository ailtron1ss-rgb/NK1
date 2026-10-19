/**
 * Real-time voice conversation loop for mobile WebView / Chrome.
 * Flow: listen (STT) → onTranscript → (App sends chat) → TTS → listen again.
 * Barge-in: stopping TTS when user starts speaking again.
 */

type Status = 'idle' | 'listening' | 'processing' | 'speaking';

export type VoiceConversationHandlers = {
  onTranscript: (text: string) => void | Promise<void>;
  onStatus?: (s: Status) => void;
  onError?: (msg: string) => void;
};

class VoiceConversation {
  private rec: any = null;
  private active = false;
  private handlers: VoiceConversationHandlers | null = null;
  private status: Status = 'idle';
  private restartTimer: number | null = null;

  private setStatus(s: Status) {
    this.status = s;
    this.handlers?.onStatus?.(s);
  }

  isActive() {
    return this.active;
  }

  getStatus() {
    return this.status;
  }

  private ensureRec() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return null;
    if (this.rec) return this.rec;
    const rec = new SR();
    rec.lang = 'ru-RU';
    rec.interimResults = false;
    rec.continuous = false; // one utterance per cycle — more reliable on Android
    rec.maxAlternatives = 1;
    rec.onresult = async (ev: any) => {
      const text = ev.results?.[0]?.[0]?.transcript?.trim();
      if (!text) {
        if (this.active) this.scheduleListen(400);
        return;
      }
      this.setStatus('processing');
      try {
        await this.handlers?.onTranscript(text);
      } catch (e) {
        this.handlers?.onError?.(String(e));
      }
      // App will call notifySpeakingEnd after TTS
    };
    rec.onerror = (ev: any) => {
      const err = ev?.error || 'stt_error';
      if (err === 'no-speech' || err === 'aborted') {
        if (this.active) this.scheduleListen(500);
        return;
      }
      this.handlers?.onError?.(String(err));
      if (this.active) this.scheduleListen(800);
    };
    rec.onend = () => {
      if (this.active && this.status === 'listening') {
        this.scheduleListen(300);
      }
    };
    this.rec = rec;
    return rec;
  }

  private scheduleListen(ms: number) {
    if (this.restartTimer) window.clearTimeout(this.restartTimer);
    this.restartTimer = window.setTimeout(() => {
      if (this.active && this.status !== 'speaking' && this.status !== 'processing') {
        this.startListen();
      }
    }, ms);
  }

  startListen() {
    const rec = this.ensureRec();
    if (!rec) {
      this.handlers?.onError?.('SpeechRecognition недоступен. Нужен Chrome.');
      return;
    }
    try {
      // stop any ongoing TTS for barge-in feel
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* */
      }
      rec.start();
      this.setStatus('listening');
    } catch {
      this.scheduleListen(600);
    }
  }

  /** Call when TTS starts */
  notifySpeakingStart() {
    this.setStatus('speaking');
    try {
      this.rec?.stop();
    } catch {
      /* */
    }
  }

  /** Call when TTS ends — resume listening if session active */
  notifySpeakingEnd() {
    if (!this.active) {
      this.setStatus('idle');
      return;
    }
    this.setStatus('idle');
    this.scheduleListen(350);
  }

  start(handlers: VoiceConversationHandlers) {
    this.handlers = handlers;
    this.active = true;
    this.startListen();
  }

  stop() {
    this.active = false;
    if (this.restartTimer) window.clearTimeout(this.restartTimer);
    try {
      this.rec?.stop();
    } catch {
      /* */
    }
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* */
    }
    this.setStatus('idle');
  }
}

export const voiceConversation = new VoiceConversation();
