import React, { useState } from 'react';
import { AvatarExpression, EmotionalState } from '../types';
import { KURISU_CANON } from '../data/kurisuCanon';
import {
  UserCheck,
  Brain,
  Sparkles,
  Zap,
  Globe,
  Flame,
  Heart,
  MessageSquare,
  FlaskConical,
  Coffee,
  Shield,
  Eye,
  Terminal,
  ChevronRight
} from 'lucide-react';

interface PersonalityMapPanelProps {
  emotions: EmotionalState;
  onSetExpression: (expr: AvatarExpression) => void;
}

export const PersonalityMapPanel: React.FC<PersonalityMapPanelProps> = ({
  emotions,
  onSetExpression
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'relationships' | 'expressions' | 'channel'>('overview');

  const expressionsList: { id: AvatarExpression; label: string; desc: string; icon: string }[] = [
    { id: 'neutral', label: 'Спокойная / Скептик', desc: 'Обычное аналитическое состояние с перекрещенными руками', icon: '😐' },
    { id: 'flustered', label: 'Смущенная / Цундэрэ', desc: 'Краснеет при комплиментах или упоминании «Кристина»', icon: '😳' },
    { id: 'whiteboard_explain', label: 'Научный Доклад', desc: 'Увлеченно чертит уравнения нейронных сетей на доске', icon: '📝' },
    { id: 'dr_pepper_break', label: 'Перерыв на Dr. Pepper', desc: 'Пьет любимый газированный напиток умников', icon: '🥤' },
    { id: 'channel_lurker', label: 'Режим @channel', desc: 'Спорит на форуме под ником KuriGohan', icon: '💻' },
    { id: 'objection_shout', label: 'Научное Возражение', desc: '«Не называй меня Ассистенткой!»', icon: '🗯️' },
    { id: 'tired', label: 'Усталость / Сон', desc: 'Спит после ночных тестов в лаборатории', icon: '😴' },
    { id: 'smug', label: 'Ухмылка / Довольная', desc: 'Уверенность в своей научной правоте', icon: '😏' },
    { id: 'tender', label: 'Теплый взгляды', desc: 'Искренняя поддержка и забота без язвительности', icon: '🥺' }
  ];

  return (
    <div className="bg-[#0A0A12]/80 border border-white/10 rounded-2xl p-5 text-slate-100 shadow-2xl backdrop-blur-md flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="pb-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-[0.2em] font-mono flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#FF3B30]" />
            Карта Личности и Каноничный Профиль Курису
          </h3>
          <p className="text-xs text-white/60 mt-0.5">
            18 лет • Нейробиолог Brain Research Institute • Лаборант #004 (Future Gadget Lab)
          </p>
        </div>

        {/* Sub-Tabs */}
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10 text-xs font-mono">
          {[
            { id: 'overview', label: 'Обзор', icon: Brain },
            { id: 'relationships', label: 'Связи', icon: Heart },
            { id: 'expressions', label: 'Мимика', icon: Eye },
            { id: 'channel', label: '@channel', icon: Terminal }
          ].map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === t.id
                    ? 'bg-[#FF3B30] text-white font-medium shadow-[0_0_10px_rgba(255,59,48,0.4)]'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Body */}
      <div className="mt-4 flex-1 overflow-y-auto pr-1 space-y-4">
        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Top Persona Banner */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-[#FF3B30] uppercase tracking-widest font-bold">
                  Имя: {KURISU_CANON.japaneseName} ({KURISU_CANON.name})
                </span>
                <h4 className="text-base font-bold text-white font-serif">
                  Макисэ Курису — Вундеркинд Нейробиологии
                </h4>
                <p className="text-xs text-white/70 max-w-xl font-sans">
                  Закончила университет в США в 17 лет. Автор диссертации по оцифровке человеческой памяти в информационные импульсы. Работает над проектом Amadeus.
                </p>
              </div>

              <div className="bg-black/40 p-3 rounded-xl border border-white/10 flex flex-col items-end font-mono text-xs">
                <span className="text-white/40 text-[10px]">Кодовое имя</span>
                <span className="text-[#00FF94] font-bold">Ассистент #004</span>
                <span className="text-white/40 text-[10px] mt-1">Отношение к никнейму</span>
                <span className="text-[#FF3B30] text-[11px]">«Не называй меня Кристиной!»</span>
              </div>
            </div>

            {/* Core Attributes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-1">
                <span className="text-[#5AC8FA] font-bold block flex items-center gap-1.5">
                  <FlaskConical className="w-3.5 h-3.5" /> Научный Профиль
                </span>
                <p className="text-[#D0D0DC] text-[11px] font-sans">
                  Теоретическая физика, квантовая механика, синаптическая пластичность гиппокампа, геометрия черных дыр Керра.
                </p>
              </div>

              <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-1">
                <span className="text-[#FF3B30] font-bold block flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5" /> Психотип (Цундэрэ)
                </span>
                <p className="text-[#D0D0DC] text-[11px] font-sans">
                  Логичная и строго прагматичная в спорах. Смущается при искренней похвале, маскируя неловкость легким сарказмом.
                </p>
              </div>

              <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-1">
                <span className="text-amber-300 font-bold block flex items-center gap-1.5">
                  <Coffee className="w-3.5 h-3.5" /> Любимые Предметы
                </span>
                <p className="text-[#D0D0DC] text-[11px] font-sans">
                  Dr. Pepper (напиток интеллектуалов), пудинг, научные статьи, анонимные дискуссии на форуме @channel.
                </p>
              </div>
            </div>

            {/* Catchphrases */}
            <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-2">
              <span className="text-[11px] font-mono text-white/50 uppercase tracking-wider font-bold">
                Каноничные Фразы и Коронные Выражения:
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-serif italic text-white/80">
                {KURISU_CANON.catchphrases.map((phrase, i) => (
                  <div key={i} className="bg-black/30 p-2.5 rounded-lg border border-white/5 flex items-start gap-2">
                    <span className="text-[#FF3B30] font-mono text-[10px] font-bold">#{i + 1}</span>
                    <span>«{phrase}»</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 2. RELATIONSHIPS TAB */}
        {activeTab === 'relationships' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-2">
              <div className="flex items-center justify-between font-mono">
                <span className="text-[#FF3B30] font-bold text-xs">Окабэ Ринтаро (Хооин Кёма)</span>
                <span className="text-[10px] text-white/40">Основатель Лаборатории #001</span>
              </div>
              <p className="text-xs text-white/80 font-sans leading-relaxed">
                Постоянно спорит с ним из-за его безумных речей про «Комитет 300» и пафосного тона. Однако глубоко уважает его решимость ради спасения друзей и испытывает к нему сильные чувства, о которых стесняется говорить напрямую.
              </p>
            </div>

            <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-2">
              <div className="flex items-center justify-between font-mono">
                <span className="text-[#00FF94] font-bold text-xs">Маюри Шиина</span>
                <span className="text-[10px] text-white/40">Лаборант #002</span>
              </div>
              <p className="text-xs text-white/80 font-sans leading-relaxed">
                Курису очень тепло относится к Маюри. Всегда заботится о ней, хотя иногда от смущения соглашается на её просьбы примерить горничную форму MayQueen.
              </p>
            </div>

            <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-2">
              <div className="flex items-center justify-between font-mono">
                <span className="text-[#5AC8FA] font-bold text-xs">Итару Хашида (Дару)</span>
                <span className="text-[10px] text-white/40">Супер-хакер #003</span>
              </div>
              <p className="text-xs text-white/80 font-sans leading-relaxed">
                Признает его непревзойденный хакерский талант, но регулярно раздражается на его пошлые шутки и эроге-референсы.
              </p>
            </div>

            <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-2">
              <div className="flex items-center justify-between font-mono">
                <span className="text-amber-300 font-bold text-xs">Доктор Накабати (Отец)</span>
                <span className="text-[10px] text-white/40">Сложный конфликт</span>
              </div>
              <p className="text-xs text-white/80 font-sans leading-relaxed">
                Зависть отца к научному гению собственной дочери привела к разрыву отношений. Разговор об отце вызывает у Курису глубокую боль и уязвимость.
              </p>
            </div>
          </div>
        )}

        {/* 3. EXPRESSIONS GALLERY TAB */}
        {activeTab === 'expressions' && (
          <div className="space-y-3">
            <span className="text-[11px] font-mono text-white/50 uppercase tracking-wider block font-bold">
              Интерактивное тестирование визуальных эмоций 3D Аватара Курису:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {expressionsList.map(item => (
                <button
                  key={item.id}
                  onClick={() => onSetExpression(item.id)}
                  className="bg-white/5 hover:bg-[#FF3B30]/20 border border-white/10 hover:border-[#FF3B30] p-3 rounded-xl text-left transition-all flex flex-col gap-1 group active:scale-95 shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-[10px] font-mono text-[#FF3B30] opacity-0 group-hover:opacity-100 transition-opacity">
                      [Включить]
                    </span>
                  </div>
                  <span className="text-xs font-bold text-white font-mono">{item.label}</span>
                  <span className="text-[10px] text-white/60 font-sans">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 4. @CHANNEL TAB */}
        {activeTab === 'channel' && (
          <div className="bg-[#050508] border border-white/10 rounded-xl p-4 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#00FF94]" />
                <span className="font-bold text-white">Анонимный Тред @channel</span>
              </div>
              <span className="text-[10px] text-[#00FF94] bg-[#00FF94]/10 px-2 py-0.5 rounded border border-[#00FF94]/30">
                User: KuriGohan_and_Kamehameha
              </span>
            </div>

            <div className="space-y-2 bg-black/40 p-3 rounded-lg border border-white/5 text-[11px] leading-relaxed">
              <p className="text-white/40">
                &gt;&gt; 742 Anonymous: "Путешествия во времени невозможно реализовать из-за парадокса дедушки!"
              </p>
              <p className="text-[#FF3B30] font-bold">
                &gt;&gt; 743 KuriGohan_and_Kamehameha:
                "Ты явно не читал статьи по мировой линии Керровской микро-черной дыры! Парадокс дедушки разрешается смещением вектора дивергенции на другую мировую линию в пределах одного аттрактора! Изучи сначала теоретическую физику перед тем как писать этот бред."
              </p>
            </div>

            <p className="text-[11px] text-white/50 italic font-sans">
              *Курису отрицает любое участие в форумах @channel, сильно смущаясь если кто-то упоминает никнейм KuriGohan.*
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
