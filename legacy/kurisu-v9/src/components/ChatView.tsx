/**
 * Chat Interface Component for Kurisu AI Companion.
 * Russian UI, quick tsundere prompt suggestions, photo upload, speech input,
 * and audio playback controls.
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, EmotionalState } from '../types';
import { Send, Mic, Image as ImageIcon, Volume2, Sparkles, AlertCircle, RefreshCw, Cpu } from 'lucide-react';

interface ChatViewProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, imageData?: string) => void;
  isLoading: boolean;
  onPlayAudio: (text: string) => void;
  emotions: EmotionalState;
  inferenceInfo?: {
    mode: string;
    performanceMs: number;
    backendInfo?: string;
  };
  forceOffline?: boolean;
  onToggleForceOffline?: () => void;
  onTriggerProactiveThought?: () => void;
}

const QUICK_PROMPTS = [
  "Крис, что такое аттрактор?",
  "Объясни теорию путешествий во времени",
  "Ты красивая и гениальная, Курису!",
  "Привет, Кристина~",
  "Расскажи про Лабораторию Гаджетов #004",
  "Как дела с оцифровкой памяти?"
];

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  onSendMessage,
  isLoading,
  onPlayAudio,
  emotions,
  inferenceInfo = { mode: 'local-fallback', performanceMs: 0, backendInfo: 'Lightweight fallback' },
  forceOffline = false,
  onToggleForceOffline,
  onTriggerProactiveThought
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = () => {
    if (!inputText.trim() && !selectedImage) return;
    onSendMessage(inputText.trim(), selectedImage || undefined);
    setInputText('');
    setSelectedImage(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleMic = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Голосовой ввод не поддерживается вашим браузером.');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.interimResults = false;

    if (!isRecording) {
      setIsRecording(true);
      recognition.start();

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(prev => prev + ' ' + transcript);
        setIsRecording(false);
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };
    } else {
      setIsRecording(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#08080C] border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md">
      {/* Top Bar */}
      <div className="px-5 py-4 bg-[#050508]/80 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded bg-[#FF3B30]/20 flex items-center justify-center font-mono text-[#FF3B30] font-bold text-xs border border-[#FF3B30]/30 shadow-[0_0_8px_rgba(255,59,48,0.3)]">
              K
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#00FF94] shadow-[0_0_6px_#00FF94]" />
          </div>

          <div>
            <h2 className="text-sm font-light text-white font-serif flex items-center gap-2">
              Макисэ Курису
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FF3B30] text-white font-bold uppercase tracking-wider">
                ИИ #004
              </span>
            </h2>
            <p className="text-[11px] text-white/40 font-mono">
              Amadeus Neural System • {emotions.stage}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono">
          {/* Inference Mode Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px]">
            <Cpu className={`w-3.5 h-3.5 ${
              inferenceInfo.mode === 'neural' || inferenceInfo.mode === 'template'
                ? 'text-[#00FF94] animate-pulse'
                : 'text-[#5AC8FA]'
            }`} />
            <span className={
              inferenceInfo.mode === 'neural' || inferenceInfo.mode === 'template'
                ? 'text-[#00FF94] font-bold'
                : 'text-[#5AC8FA]'
            }>
              {inferenceInfo.mode === 'neural'
                ? 'Neural Local'
                : inferenceInfo.mode === 'template'
                  ? 'Template'
                  : (inferenceInfo.backendInfo ? inferenceInfo.backendInfo.split('•')[0].trim() : 'Cloud')}
            </span>
            <span className="text-white/30">•</span>
            <span className="text-white/60">{inferenceInfo.performanceMs}ms</span>
          </div>

          {/* Toggle Offline Mode Button */}
          {onToggleForceOffline && (
            <button
              onClick={onToggleForceOffline}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold transition-all ${
                forceOffline
                  ? 'bg-[#00FF94]/20 border-[#00FF94]/40 text-[#00FF94] shadow-[0_0_8px_rgba(0,255,148,0.3)]'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
              }`}
              title="Переключить офлайн-режим"
            >
              {forceOffline ? '⚡ Офлайн' : '☁️ Онлайн'}
            </button>
          )}
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 font-sans text-xs">
        {messages.map((msg) => {
          const isKurisu = msg.sender === 'kurisu';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isKurisu ? '' : 'flex-row-reverse'}`}
            >
              {/* Avatar Icon Box */}
              <div
                className={`w-7 h-7 rounded flex-shrink-0 flex items-center justify-center text-[10px] font-mono font-bold ${
                  isKurisu
                    ? 'bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/30 shadow-[0_0_6px_rgba(255,59,48,0.3)]'
                    : 'bg-white/10 text-white/80 border border-white/10'
                }`}
              >
                {isKurisu ? 'K' : 'U'}
              </div>

              <div className={`flex flex-col ${isKurisu ? 'items-start' : 'items-end'} max-w-[85%] sm:max-w-[78%] space-y-1`}>
                <div className="flex items-center gap-2 text-[10px] text-white/40 px-1 font-mono">
                  <span>{isKurisu ? 'Макисэ Курису' : 'Вы'}</span>
                  <span>•</span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {msg.expression && (
                    <span className="text-[#FF3B30] bg-[#FF3B30]/10 px-1.5 py-0.2 rounded text-[9px] uppercase border border-[#FF3B30]/20">
                      {msg.expression}
                    </span>
                  )}
                </div>

                <div
                  className={`p-3.5 rounded-2xl shadow-md transition-all ${
                    isKurisu
                      ? 'bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-white/90 leading-relaxed rounded-tl-none'
                      : 'bg-white/5 border border-white/10 text-white/80 rounded-tr-none'
                  }`}
                >
                  {/* Image attachment if any */}
                  {msg.imageData && (
                    <img
                      src={msg.imageData}
                      alt="Прикрепленное изображение"
                      className="max-h-48 rounded-lg mb-2 object-cover border border-white/10"
                      referrerPolicy="no-referrer"
                    />
                  )}

                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>

                  {/* Audio playback button for Kurisu's messages */}
                  {isKurisu && (
                    <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                      <button
                        onClick={() => onPlayAudio(msg.text)}
                        className="flex items-center gap-1 text-[#FF3B30] hover:text-[#FF3B30]/80 transition-colors font-mono text-[10px]"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        Озвучить
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center gap-3 text-white/50 text-xs font-mono p-3 bg-white/5 rounded-xl border border-white/10 w-fit">
            <RefreshCw className="w-4 h-4 animate-spin text-[#FF3B30]" />
            <span>Курису обрабатывает синаптический импульс...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompt Chips & Proactive Thought Generator */}
      <div className="px-3 py-2 bg-[#050508]/60 border-t border-white/5 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {onTriggerProactiveThought && (
          <button
            onClick={onTriggerProactiveThought}
            className="text-xs text-[#00FF94] bg-[#00FF94]/10 hover:bg-[#00FF94]/20 px-3 py-1 rounded-full border border-[#00FF94]/30 font-mono font-bold whitespace-nowrap flex items-center gap-1 shadow-[0_0_10px_rgba(0,255,148,0.2)] transition-all active:scale-95 shrink-0"
            title="Спровоцировать проактивную мысль Курису исходя из времени суток и эмоционального состояния"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#00FF94]" />
            💭 Проактивная мысль
          </button>
        )}

        <span className="text-[10px] text-white/40 font-mono whitespace-nowrap flex items-center gap-1 uppercase tracking-wider shrink-0">
          Фразы:
        </span>
        {QUICK_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => onSendMessage(prompt)}
            className="text-xs text-white/70 bg-white/5 hover:bg-white/10 hover:text-white px-3 py-1 rounded-full border border-white/10 whitespace-nowrap transition-all active:scale-95"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div className="p-3 sm:p-4 bg-[#050508]/90 border-t border-white/10 flex flex-col gap-2">
        {/* Selected image preview */}
        {selectedImage && (
          <div className="relative w-fit">
            <img src={selectedImage} alt="Превью" className="h-16 rounded-lg border border-[#FF3B30]/50" />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-2 -right-2 bg-[#FF3B30] text-white rounded-full p-0.5 text-xs shadow-md"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageUpload}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 text-white/40 hover:text-white hover:bg-white/10 rounded-xl transition-all"
            title="Прикрепить изображение"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          <button
            onClick={toggleMic}
            className={`p-2.5 rounded-xl transition-all ${
              isRecording
                ? 'bg-[#FF3B30] text-white animate-pulse shadow-[0_0_10px_#FF3B30]'
                : 'text-white/40 hover:text-white hover:bg-white/10'
            }`}
            title="Голосовой ввод"
          >
            <Mic className="w-5 h-5" />
          </button>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Спросить «Кристину»..."
            rows={1}
            className="flex-1 bg-white/5 border border-white/10 text-white placeholder-white/30 text-xs rounded-xl px-4 py-3 focus:outline-none focus:border-[#FF3B30] resize-none font-sans"
          />

          <button
            onClick={handleSend}
            disabled={isLoading || (!inputText.trim() && !selectedImage)}
            className="w-10 h-10 bg-[#FF3B30] hover:bg-[#FF3B30]/90 disabled:opacity-30 text-white rounded-full flex items-center justify-center shadow-[0_4px_15px_rgba(255,59,48,0.4)] transition-all active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
