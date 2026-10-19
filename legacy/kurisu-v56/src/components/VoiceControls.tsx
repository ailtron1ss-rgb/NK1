import React, { useEffect, useRef, useState } from 'react';
import { voiceConversation } from '../services/voiceConversation';
import { interruptSpeech } from '../services/speechInterrupt';

interface Props {
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  thoughtsOn: boolean;
  onToggleThoughts: () => void;
  onVoiceText: (text: string) => void;
  /** When continuous mode gets transcript — usually same as onVoiceText */
  onConversationTranscript?: (text: string) => void;
  conversationMode?: boolean;
  onToggleConversation?: () => void;
  isSpeaking?: boolean;
}

export const VoiceControls: React.FC<Props> = ({
  voiceEnabled,
  onToggleVoice,
  thoughtsOn,
  onToggleThoughts,
  onVoiceText,
  onConversationTranscript,
  conversationMode = false,
  onToggleConversation,
  isSpeaking = false
}) => {
  const [listening, setListening] = useState(false);
  const [convStatus, setConvStatus] = useState('idle');
  const recRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'ru-RU';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (ev: any) => {
      const text = ev.results?.[0]?.[0]?.transcript;
      if (text) onVoiceText(text);
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
  }, [onVoiceText]);

  // Continuous conversation session
  useEffect(() => {
    if (!conversationMode) {
      voiceConversation.stop();
      setConvStatus('idle');
      return;
    }
    if (!voiceEnabled) {
      // force voice on for conversation
    }
    voiceConversation.start({
      onTranscript: async (text) => {
        await (onConversationTranscript || onVoiceText)(text);
      },
      onStatus: s => setConvStatus(s),
      onError: msg => console.warn('[voiceConv]', msg)
    });
    return () => voiceConversation.stop();
  }, [conversationMode, onConversationTranscript, onVoiceText, voiceEnabled]);

  useEffect(() => {
    if (!conversationMode) return;
    if (isSpeaking) voiceConversation.notifySpeakingStart();
    else voiceConversation.notifySpeakingEnd();
  }, [isSpeaking, conversationMode]);

  const pushToTalk = () => {
    if (conversationMode) return; // continuous owns mic
    if (!recRef.current) {
      alert('Распознавание речи недоступно. Открой в Chrome.');
      return;
    }
    if (listening) {
      try {
        recRef.current.stop();
      } catch {
        /* */
      }
      setListening(false);
      return;
    }
    setListening(true);
    try {
      recRef.current.start();
    } catch {
      setListening(false);
    }
  };

  const statusLabel =
    convStatus === 'listening'
      ? '🔴 слушаю'
      : convStatus === 'processing'
        ? '…думаю'
        : convStatus === 'speaking'
          ? '🔊 говорю'
          : 'диалог';

  return (
    <div className="flex flex-wrap gap-2 px-2 py-1.5 border-t border-white/10 bg-black/30 items-center">
      <button
        type="button"
        onClick={onToggleVoice}
        className={`text-[10px] font-mono px-2 py-1 rounded border ${
          voiceEnabled ? 'border-[#00FF94]/40 text-[#00FF94]' : 'border-white/20 text-white/50'
        }`}
      >
        Голос: {voiceEnabled ? 'вкл' : 'выкл'}
      </button>
      <button
        type="button"
        onClick={onToggleThoughts}
        className={`text-[10px] font-mono px-2 py-1 rounded border ${
          thoughtsOn ? 'border-[#5AC8FA]/40 text-[#5AC8FA]' : 'border-white/20 text-white/50'
        }`}
      >
        Мысли: {thoughtsOn ? 'вкл' : 'выкл'}
      </button>
      <button
        type="button"
        onClick={pushToTalk}
        disabled={conversationMode}
        className={`text-[10px] font-mono px-3 py-1 rounded border ${
          listening ? 'border-[#FF3B30] text-[#FF3B30] animate-pulse' : 'border-white/25 text-white/80'
        } disabled:opacity-40`}
      >
        {listening ? '…слушаю' : '🎤 Разово'}
      </button>
      <button
        type="button"
        onClick={() => interruptSpeech()}
        className="text-[10px] font-mono px-2 py-1 rounded border border-white/20 text-white/70"
        title="Остановить речь"
      >
        ⏹ Стоп
      </button>
      {onToggleConversation && (
        <button
          type="button"
          onClick={onToggleConversation}
          className={`text-[10px] font-mono px-3 py-1 rounded border ${
            conversationMode
              ? 'border-[#FF3B30] bg-[#FF3B30]/15 text-[#FF3B30] animate-pulse'
              : 'border-[#FF9F0A]/40 text-[#FF9F0A]'
          }`}
        >
          {conversationMode ? statusLabel : '📞 Диалог'}
        </button>
      )}
    </div>
  );
};
