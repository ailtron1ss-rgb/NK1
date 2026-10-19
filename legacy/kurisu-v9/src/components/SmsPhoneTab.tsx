/**
 * Dedicated SMS & Phone Call Communications Center for Makise Kurisu ("Amadeus Mobile").
 * Provides full SMS inbox/outbox history, interactive SMS messaging, simulated phone calls,
 * and live autonomous location tracking (walks around Akihabara, Dr. Pepper breaks, @channel).
 */

import React, { useState, useEffect } from 'react';
import { SMSNotification, notificationEngine } from '../services/notificationEngine';
import { autonomousEngine, KurisuAutonomousState } from '../services/autonomousEngine';
import { chatService } from '../services/chatService';
import { ttsEngine } from '../services/ttsEngine';
import { AppState } from '../types';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Send,
  CheckCheck,
  MapPin,
  Coffee,
  Sparkles,
  Volume2,
  Trash2,
  Bell,
  Cpu,
  Compass,
  MessageCircle
} from 'lucide-react';

interface SmsPhoneTabProps {
  appState: AppState;
  onPlayAudio: (text: string) => void;
}

export const SmsPhoneTab: React.FC<SmsPhoneTabProps> = ({ appState, onPlayAudio }) => {
  const [messages, setMessages] = useState<SMSNotification[]>([]);
  const [autoState, setAutoState] = useState<KurisuAutonomousState>(autonomousEngine.getState());
  const [smsInput, setSmsInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Phone Call Modal state
  const [isInPhoneCall, setIsInPhoneCall] = useState(false);
  const [callStatus, setCallStatus] = useState<'calling' | 'connected' | 'ended'>('calling');
  const [callDurationSec, setCallDurationSec] = useState(0);

  // Subscribe to notification & autonomous updates
  useEffect(() => {
    const unsubNotes = notificationEngine.subscribe(notes => {
      setMessages([...notes]);
    });
    const unsubAuto = autonomousEngine.subscribe(st => {
      setAutoState({ ...st });
    });
    return () => {
      unsubNotes();
      unsubAuto();
    };
  }, []);

  // Timer for phone call duration
  useEffect(() => {
    let interval: any = null;
    if (isInPhoneCall && callStatus === 'connected') {
      interval = setInterval(() => {
        setCallDurationSec(prev => prev + 1);
      }, 1000);
    } else {
      setCallDurationSec(0);
    }
    return () => clearInterval(interval);
  }, [isInPhoneCall, callStatus]);

  // Send interactive SMS to Kurisu
  const handleSendSMS = async () => {
    if (!smsInput.trim() || isSending) return;

    const userText = smsInput.trim();
    setSmsInput('');
    setIsSending(true);

    // Add user SMS to notification stream
    notificationEngine.sendNotification('Вы (СМС)', userText, 'sms', false);

    try {
      // Get Kurisu SMS response
      const response = await chatService.sendMessage(
        `[СМС сообщение от пользователя]: ${userText}`,
        [userText],
        [],
        appState.emotions
      );

      // Kurisu replies via SMS
      notificationEngine.sendSMS(
        `Макисэ Курису • ${autoState.statusIcon} ${autoState.currentLocation}`,
        response.text,
        response.expression
      );

      if (appState.voice.autoSpeak) {
        onPlayAudio(response.text);
      }
    } catch (e) {
      notificationEngine.sendSMS(
        'Макисэ Курису • 📡 Amadeus Network',
        'Соединение нестабильно... Но я получила твое СМС.'
      );
    } finally {
      setIsSending(false);
    }
  };

  // Start simulated phone call
  const handleStartCall = () => {
    setIsInPhoneCall(true);
    setCallStatus('calling');

    setTimeout(() => {
      setCallStatus('connected');
      const callGreeting = "Алло? Макисэ на связи... Что-то случилось в лаборатории, или ты просто решил позвонить?";
      ttsEngine.speak(callGreeting, appState.voice);
    }, 2000);
  };

  const handleEndCall = () => {
    ttsEngine.stop();
    setCallStatus('ended');
    setTimeout(() => {
      setIsInPhoneCall(false);
    }, 1000);
  };

  const formatCallTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="bg-[#0A0A12]/80 border border-white/10 rounded-2xl p-4 sm:p-5 text-slate-100 shadow-2xl backdrop-blur-md flex flex-col h-full max-h-[800px]">
      {/* Header & Amadeus Phone Badge */}
      <div className="pb-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] font-mono flex items-center gap-2">
            <Phone className="w-4 h-4 text-[#00FF94]" />
            Amadeus Communications Center (СМС & Звонки)
          </h3>
          <p className="text-xs text-white/70 mt-0.5">
            Прямой канал связи с мобильным терминалом Макисэ Курису
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Make Phone Call Button */}
          <button
            onClick={handleStartCall}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#00FF94]/15 hover:bg-[#00FF94]/25 text-[#00FF94] border border-[#00FF94]/40 font-mono text-xs font-bold rounded-xl shadow-[0_0_12px_rgba(0,255,148,0.2)] transition-all active:scale-95"
            title="Совершить голосовой вызов Amadeus"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            Позвонить Курису
          </button>

          {/* Clear All SMS */}
          <button
            onClick={() => notificationEngine.clearAll()}
            className="p-1.5 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/80 rounded-lg border border-white/10 transition-all"
            title="Очистить историю СМС"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Autonomous Life Activity & Location Widget */}
      <div className="my-3 bg-gradient-to-r from-white/5 to-white/10 border border-white/10 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#00FF94]/10 border border-[#00FF94]/30 flex items-center justify-center text-lg shrink-0">
            {autoState.statusIcon}
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-bold font-mono text-[#00FF94]">
              <MapPin className="w-3 h-3 text-[#00FF94]" />
              <span>{autoState.currentLocation}</span>
              <span className="text-white/30">•</span>
              <span className="text-white/50 text-[10px]">{autoState.locationDetails}</span>
            </div>
            <p className="text-xs text-white/80 mt-0.5">{autoState.currentActivity}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={() => autonomousEngine.evaluateProactiveThought(appState.emotions, true)}
            className="px-2.5 py-1 bg-[#00FF94]/10 hover:bg-[#00FF94]/20 text-[#00FF94] text-[11px] font-mono rounded-lg border border-[#00FF94]/30 flex items-center gap-1 transition-all shadow-[0_0_8px_rgba(0,255,148,0.2)]"
            title="Спровоцировать проактивную мысль Курису на основе времени суток и эмоций"
          >
            <Sparkles className="w-3 h-3 text-[#00FF94]" />
            💭 Проактивная мысль
          </button>
          <button
            onClick={() => autonomousEngine.runSpontaneousStep(true)}
            className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white/70 text-[11px] font-mono rounded-lg border border-white/10 flex items-center gap-1 transition-all"
            title="Отправить Курису на прогулку / сменить локацию"
          >
            <Compass className="w-3 h-3 text-[#5AC8FA]" />
            Прогулка
          </button>
          <button
            onClick={() => autonomousEngine.triggerDrinkDrPepper()}
            className="px-2.5 py-1 bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF3B30] text-[11px] font-mono rounded-lg border border-[#FF3B30]/30 flex items-center gap-1 transition-all"
            title="Угостить Dr. Pepper"
          >
            <Coffee className="w-3 h-3" />
            Dr. Pepper ({autoState.drPepperStock})
          </button>
        </div>
      </div>

      {/* Messages Inbox Stream */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 my-2 min-h-[250px]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-white/30 py-12">
            <MessageCircle className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-xs font-mono">История СМС сообщений пуста</p>
            <p className="text-[11px] text-white/20 mt-1">
              Курису отправит вам СМС во время прогулки или исследований
            </p>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`p-3 rounded-xl border transition-all ${
                msg.title.includes('Вы')
                  ? 'bg-[#5AC8FA]/10 border-[#5AC8FA]/30 ml-8'
                  : 'bg-white/5 border-white/10 mr-4'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-bold font-mono text-[#00FF94] flex items-center gap-1">
                  {msg.title.includes('Вы') ? '📱 ' : '📩 '}
                  {msg.title}
                </span>
                <span className="text-[10px] text-white/40 font-mono">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-xs text-white/90 leading-relaxed">{msg.body}</p>
            </div>
          ))
        )}
      </div>

      {/* SMS Reply Input Form */}
      <div className="pt-3 border-t border-white/10 flex gap-2">
        <input
          type="text"
          value={smsInput}
          onChange={e => setSmsInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSendSMS()}
          placeholder="Написать СМС для Курису..."
          disabled={isSending}
          className="flex-1 bg-white/5 border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#00FF94] transition-all font-sans"
        />
        <button
          onClick={handleSendSMS}
          disabled={isSending || !smsInput.trim()}
          className="px-4 py-2 bg-[#00FF94] hover:bg-[#00FF94]/80 disabled:opacity-40 text-black font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Отправить</span>
        </button>
      </div>

      {/* Simulated Phone Call Modal */}
      {isInPhoneCall && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-between p-8 font-mono animate-fadeIn">
          {/* Header Status */}
          <div className="text-center mt-6 space-y-2">
            <span className="text-xs text-[#00FF94] bg-[#00FF94]/10 border border-[#00FF94]/30 px-3 py-1 rounded-full uppercase tracking-widest">
              Amadeus Mobile Call Session
            </span>
            <h2 className="text-2xl font-bold text-white mt-2">Макисэ Курису</h2>
            <p className="text-xs text-white/50">Институт Нейробиологии / Lab Gadget #004</p>
          </div>

          {/* Call Status Avatar / Pulse */}
          <div className="flex flex-col items-center justify-center my-auto">
            <div className="relative">
              <div className={`w-32 h-32 rounded-full border-2 flex items-center justify-center bg-gradient-to-b from-[#FF3B30]/20 to-[#00FF94]/20 ${
                callStatus === 'calling' ? 'border-[#5AC8FA] animate-pulse' : 'border-[#00FF94] shadow-[0_0_30px_rgba(0,255,148,0.5)]'
              }`}>
                <Cpu className="w-16 h-16 text-[#00FF94]" />
              </div>
            </div>

            <div className="mt-6 text-center">
              {callStatus === 'calling' && (
                <p className="text-sm text-[#5AC8FA] animate-bounce">Вызов Amadeus Terminal...</p>
              )}
              {callStatus === 'connected' && (
                <div>
                  <p className="text-sm text-[#00FF94] font-bold">Вызов активен</p>
                  <p className="text-lg text-white mt-1">{formatCallTime(callDurationSec)}</p>
                </div>
              )}
              {callStatus === 'ended' && (
                <p className="text-sm text-red-400">Звонок завершен</p>
              )}
            </div>
          </div>

          {/* End Call Button */}
          <div className="mb-8">
            <button
              onClick={handleEndCall}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.6)] transition-all active:scale-90"
              title="Завершить вызов"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
