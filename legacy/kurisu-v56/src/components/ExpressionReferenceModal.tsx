/**
 * Reference Inspector Modal & Canonical Expression Catalog for Makise Kurisu.
 * Contains data & interactive triggers for all 32 canonical expressions from the 4 reference images.
 */

import React, { useState } from 'react';
import { AvatarExpression } from '../types';
import { Sparkles, X, Check, Sliders, Image as ImageIcon, Info, Zap, Camera } from 'lucide-react';

interface ExpressionReferenceModalProps {
  currentExpression: AvatarExpression;
  onSelectExpression: (expr: AvatarExpression) => void;
  onClose: () => void;
}

export interface ExpressionReferenceItem {
  id: AvatarExpression;
  label: string;
  gridSource: 'Image 1 (Anime Classic)' | 'Image 2 (Sunset & Art)' | 'Image 3 (Street & World Lines)' | 'Image 4 (Lab & Amadeus)';
  category: 'Академическая' | 'Цундэрэ' | 'Лабораторная' | 'Личная / Эмоциональная';
  description: string;
  icon: string;
  blendShapes: {
    blush: number; // 0.0 - 1.0
    browRaise: number; // -1.0 (furrowed) to 1.0 (raised)
    eyeOpen: number; // 0.0 (closed) to 1.2 (wide)
    mouthShape: 'smile' | 'frown' | 'pout' | 'open' | 'shout' | 'grimace' | 'neutral';
    headTiltZ: number; // radians
    headYawY: number; // radians
    headPitchX: number; // radians
  };
  particles?: string;
  comicOverlay?: 'speed_lines' | 'spotlight' | 'sunset_glow' | 'rain_droplets' | 'heart_burst' | 'none';
}

export const canonRefCatalog: ExpressionReferenceItem[] = [
  // GRID 1: Anime Classic (8 Expressions)
  {
    id: 'chin_rest',
    label: '1. Раздумья за столом',
    gridSource: 'Image 1 (Anime Classic)',
    category: 'Академическая',
    description: 'Подпирает щеку ладонью, внимательный задумчивый взгляд фиолетовых глаз.',
    icon: '💭',
    blendShapes: { blush: 0.1, browRaise: -0.1, eyeOpen: 0.9, mouthShape: 'neutral', headTiltZ: -0.15, headYawY: -0.1, headPitchX: 0.1 },
    particles: 'formulas'
  },
  {
    id: 'confident_crossed',
    label: '2. Скрещенные руки',
    gridSource: 'Image 1 (Anime Classic)',
    category: 'Цундэрэ',
    description: 'Уверенная поза со скрещенными руками в лаборатории.',
    icon: '😏',
    blendShapes: { blush: 0.0, browRaise: 0.2, eyeOpen: 1.0, mouthShape: 'smile', headTiltZ: 0.05, headYawY: -0.05, headPitchX: -0.05 }
  },
  {
    id: 'flustered',
    label: '3. Цундэрэ Вспышка',
    gridSource: 'Image 1 (Anime Classic)',
    category: 'Цундэрэ',
    description: 'Яркий румянец, опущенные руки, смущенный взгляд вниз.',
    icon: '😳',
    blendShapes: { blush: 0.9, browRaise: -0.4, eyeOpen: 0.7, mouthShape: 'pout', headTiltZ: -0.2, headYawY: 0.2, headPitchX: 0.15 },
    particles: 'sweat_drop',
    comicOverlay: 'spotlight'
  },
  {
    id: 'passionate_shout',
    label: '4. Научный спор (Objection!)',
    gridSource: 'Image 1 (Anime Classic)',
    category: 'Академическая',
    description: 'Громкий возглас и возражение в споре о путешествиях во времени.',
    icon: '📢',
    blendShapes: { blush: 0.3, browRaise: -0.6, eyeOpen: 1.1, mouthShape: 'shout', headTiltZ: 0.0, headYawY: 0.0, headPitchX: 0.1 },
    comicOverlay: 'speed_lines'
  },
  {
    id: 'head_on_desk',
    label: '5. Спит на столе',
    gridSource: 'Image 1 (Anime Classic)',
    category: 'Лабораторная',
    description: 'Уставшая за пересчетом формул, спит на столе в кресле.',
    icon: '😴',
    blendShapes: { blush: 0.2, browRaise: 0.0, eyeOpen: 0.0, mouthShape: 'neutral', headTiltZ: -0.2, headYawY: 0.2, headPitchX: 0.4 },
    particles: 'zzz'
  },
  {
    id: 'surprised',
    label: '6. Внезапное открытие',
    gridSource: 'Image 1 (Anime Classic)',
    category: 'Академическая',
    description: 'Широко открытые глаза и удивление при обнаружении PhoneWave.',
    icon: '😲',
    blendShapes: { blush: 0.1, browRaise: 0.8, eyeOpen: 1.2, mouthShape: 'open', headTiltZ: 0.0, headYawY: 0.0, headPitchX: -0.1 }
  },
  {
    id: 'whiteboard_explain',
    label: '7. Доска с формулами',
    gridSource: 'Image 1 (Anime Classic)',
    category: 'Академическая',
    description: 'Чертит уравнения черной дыры Керра на маркерной доске.',
    icon: '📝',
    blendShapes: { blush: 0.0, browRaise: 0.3, eyeOpen: 1.0, mouthShape: 'smile', headTiltZ: 0.1, headYawY: 0.3, headPitchX: 0.0 },
    particles: 'formulas'
  },
  {
    id: 'phone_texting',
    label: '8. Экран Amadeus',
    gridSource: 'Image 1 (Anime Classic)',
    category: 'Лабораторная',
    description: 'Смотрит в экран красного смартфона с задумчивым лицом.',
    icon: '📱',
    blendShapes: { blush: 0.1, browRaise: -0.2, eyeOpen: 0.85, mouthShape: 'frown', headTiltZ: -0.1, headYawY: 0.0, headPitchX: 0.25 }
  },

  // GRID 2: Sunset & High Art (8 Expressions)
  {
    id: 'sarcastic',
    label: '9. Поправление очков',
    gridSource: 'Image 2 (Sunset & Art)',
    category: 'Цундэрэ',
    description: 'Поправляет красные очки с легкой ироничной ухмылкой.',
    icon: '👓',
    blendShapes: { blush: 0.1, browRaise: 0.4, eyeOpen: 0.9, mouthShape: 'smile', headTiltZ: 0.1, headYawY: -0.1, headPitchX: -0.05 }
  },
  {
    id: 'channel_lurker',
    label: '10. Чтение @channel',
    gridSource: 'Image 2 (Sunset & Art)',
    category: 'Личная / Эмоциональная',
    description: 'Прячет телефон, когда ее застали за чтением анонимного форума.',
    icon: '🤫',
    blendShapes: { blush: 0.6, browRaise: 0.2, eyeOpen: 1.0, mouthShape: 'pout', headTiltZ: -0.1, headYawY: 0.2, headPitchX: 0.1 },
    particles: 'sweat_drop'
  },
  {
    id: 'reach_out',
    label: '11. Протягивает руку',
    gridSource: 'Image 2 (Sunset & Art)',
    category: 'Личная / Эмоциональная',
    description: 'Страстный жест поддержки — протягивает руку навстречу Окабэ.',
    icon: '🫱',
    blendShapes: { blush: 0.2, browRaise: 0.3, eyeOpen: 1.05, mouthShape: 'open', headTiltZ: 0.0, headYawY: 0.0, headPitchX: 0.1 },
    comicOverlay: 'speed_lines'
  },
  {
    id: 'dr_pepper_break',
    label: '12. Перерыв с Dr. Pepper',
    gridSource: 'Image 2 (Sunset & Art)',
    category: 'Лабораторная',
    description: 'Держит баночку напитка гениев на закатном солнце.',
    icon: '🥤',
    blendShapes: { blush: 0.2, browRaise: 0.1, eyeOpen: 0.95, mouthShape: 'smile', headTiltZ: 0.08, headYawY: 0.05, headPitchX: 0.0 },
    comicOverlay: 'sunset_glow'
  },
  {
    id: 'steeple_hands',
    label: '13. Замок из пальцев',
    gridSource: 'Image 2 (Sunset & Art)',
    category: 'Академическая',
    description: 'Сложила ладони домиком у подбородка, глубокий анализ гипотезы.',
    icon: '🧠',
    blendShapes: { blush: 0.0, browRaise: -0.3, eyeOpen: 0.85, mouthShape: 'neutral', headTiltZ: 0.0, headYawY: 0.0, headPitchX: 0.1 },
    particles: 'formulas',
    comicOverlay: 'spotlight'
  },
  {
    id: 'over_shoulder',
    label: '14. Взгляд через плечо',
    gridSource: 'Image 2 (Sunset & Art)',
    category: 'Личная / Эмоциональная',
    description: 'Меланхоличный взгляд назад во время дождя.',
    icon: '🌧️',
    blendShapes: { blush: 0.1, browRaise: -0.1, eyeOpen: 0.9, mouthShape: 'neutral', headTiltZ: -0.05, headYawY: 0.85, headPitchX: 0.0 },
    comicOverlay: 'rain_droplets'
  },
  {
    id: 'happy_open_arms',
    label: '15. Радушный привет',
    gridSource: 'Image 2 (Sunset & Art)',
    category: 'Личная / Эмоциональная',
    description: 'Искренняя тёплая улыбка с разведенными в приветствии руками.',
    icon: '✨',
    blendShapes: { blush: 0.4, browRaise: 0.4, eyeOpen: 0.8, mouthShape: 'smile', headTiltZ: 0.1, headYawY: 0.0, headPitchX: -0.05 },
    particles: 'sparkles'
  },

  // GRID 3: Street & World Lines (8 Expressions)
  {
    id: 'sunset_melancholy',
    label: '16. Закат на крыше',
    gridSource: 'Image 3 (Street & World Lines)',
    category: 'Личная / Эмоциональная',
    description: 'Одиноко стоит на крыше Radi-Kaikan на фоне оранжевого заката.',
    icon: '🌇',
    blendShapes: { blush: 0.2, browRaise: -0.2, eyeOpen: 0.85, mouthShape: 'neutral', headTiltZ: -0.1, headYawY: 0.3, headPitchX: 0.1 },
    comicOverlay: 'sunset_glow'
  },
  {
    id: 'sad_rain',
    label: '17. Одиночество под дождем',
    gridSource: 'Image 3 (Street & World Lines)',
    category: 'Личная / Эмоциональная',
    description: 'Обнимает плечи во время проливного дождя в Акихабаре.',
    icon: '☔',
    blendShapes: { blush: 0.1, browRaise: -0.5, eyeOpen: 0.75, mouthShape: 'frown', headTiltZ: -0.15, headYawY: 0.0, headPitchX: 0.2 },
    comicOverlay: 'rain_droplets'
  },
  {
    id: 'time_travel_panic',
    label: '18. Колебание аттрактора',
    gridSource: 'Image 3 (Street & World Lines)',
    category: 'Академическая',
    description: 'Фон шестеренок времени и мигающего счетчика дивергенции.',
    icon: '⏰',
    blendShapes: { blush: 0.0, browRaise: 0.6, eyeOpen: 1.2, mouthShape: 'grimace', headTiltZ: 0.0, headYawY: 0.0, headPitchX: -0.1 },
    comicOverlay: 'speed_lines'
  },
  {
    id: 'smug_genius',
    label: '19. Ухмылка гения',
    gridSource: 'Image 3 (Street & World Lines)',
    category: 'Цундэрэ',
    description: 'Гордо заявляет о своей публикации в научном журнале Science.',
    icon: '💡',
    blendShapes: { blush: 0.2, browRaise: 0.5, eyeOpen: 0.9, mouthShape: 'smile', headTiltZ: 0.15, headYawY: -0.1, headPitchX: -0.1 },
    particles: 'sparkles'
  },
  {
    id: 'tsundere_denial',
    label: '20. Отрицание симпатии',
    gridSource: 'Image 3 (Street & World Lines)',
    category: 'Цундэрэ',
    description: 'Резко отворачивается: "Я сделала это ради науки, а не ради тебя!"',
    icon: '😤',
    blendShapes: { blush: 0.8, browRaise: -0.3, eyeOpen: 0.7, mouthShape: 'pout', headTiltZ: -0.2, headYawY: -0.6, headPitchX: 0.1 },
    particles: 'sweat_drop'
  },

  // GRID 4: Lab & Amadeus (8 Expressions)
  {
    id: 'face_cover_gasp',
    label: '21. Испуг / Смущение',
    gridSource: 'Image 4 (Lab & Amadeus)',
    category: 'Цундэрэ',
    description: 'Закрывает лицо обеими ладонями от неожиданного комплимента.',
    icon: '🙈',
    blendShapes: { blush: 1.0, browRaise: 0.5, eyeOpen: 1.1, mouthShape: 'open', headTiltZ: -0.1, headYawY: 0.0, headPitchX: 0.2 },
    particles: 'heart_burst',
    comicOverlay: 'spotlight'
  },
  {
    id: 'pout',
    label: '22. Надутые губы',
    gridSource: 'Image 4 (Lab & Amadeus)',
    category: 'Цундэрэ',
    description: 'Надула щеки из-за очередной шутки Окабэ про «Кристину».',
    icon: '😠',
    blendShapes: { blush: 0.5, browRaise: -0.4, eyeOpen: 0.8, mouthShape: 'pout', headTiltZ: -0.1, headYawY: 0.1, headPitchX: 0.0 }
  },
  {
    id: 'shocked',
    label: '23. Шок Amadeus',
    gridSource: 'Image 4 (Lab & Amadeus)',
    category: 'Академическая',
    description: 'Обоснование уязвимости в квантовой сшивке нейронов.',
    icon: '⚡',
    blendShapes: { blush: 0.0, browRaise: 0.9, eyeOpen: 1.3, mouthShape: 'shout', headTiltZ: 0.0, headYawY: 0.0, headPitchX: -0.15 },
    comicOverlay: 'speed_lines'
  },
  {
    id: 'sleepy',
    label: '24. Дремота за ПК',
    gridSource: 'Image 4 (Lab & Amadeus)',
    category: 'Лабораторная',
    description: 'Медленно слипаются глаза перед монитором компьютера.',
    icon: '🥱',
    blendShapes: { blush: 0.1, browRaise: -0.1, eyeOpen: 0.2, mouthShape: 'neutral', headTiltZ: -0.15, headYawY: 0.1, headPitchX: 0.3 },
    particles: 'zzz'
  },
  {
    id: 'embarrassed_hide',
    label: '25. Прячется в халат',
    gridSource: 'Image 4 (Lab & Amadeus)',
    category: 'Цундэрэ',
    description: 'Утыкается носом в воротник халата, пытаясь скрыть улыбку.',
    icon: '🧣',
    blendShapes: { blush: 0.85, browRaise: -0.2, eyeOpen: 0.6, mouthShape: 'smile', headTiltZ: -0.1, headYawY: 0.2, headPitchX: 0.25 }
  },
  {
    id: 'laughing',
    label: '26. Искренний смех',
    gridSource: 'Image 4 (Lab & Amadeus)',
    category: 'Личная / Эмоциональная',
    description: 'Задорно смеется над неудачной шуткой Дару.',
    icon: '😄',
    blendShapes: { blush: 0.4, browRaise: 0.5, eyeOpen: 0.0, mouthShape: 'smile', headTiltZ: 0.15, headYawY: 0.0, headPitchX: -0.1 },
    particles: 'sparkles'
  },
  {
    id: 'tender_glance',
    label: '27. Нежный взгляд',
    gridSource: 'Image 4 (Lab & Amadeus)',
    category: 'Личная / Эмоциональная',
    description: 'Тихий мягкий взгляд при высоком уровне доверия (>80%).',
    icon: '💗',
    blendShapes: { blush: 0.4, browRaise: 0.2, eyeOpen: 0.85, mouthShape: 'smile', headTiltZ: 0.12, headYawY: -0.05, headPitchX: 0.0 },
    particles: 'heart_burst'
  },
  {
    id: 'reading_paper',
    label: '28. Изучение статьи',
    gridSource: 'Image 4 (Lab & Amadeus)',
    category: 'Академическая',
    description: 'Внимательно читает распечатку статьи о синаптических импульсах.',
    icon: '📄',
    blendShapes: { blush: 0.0, browRaise: -0.2, eyeOpen: 0.9, mouthShape: 'neutral', headTiltZ: -0.05, headYawY: 0.0, headPitchX: 0.2 }
  },
  {
    id: 'drinking_coffee',
    label: '29. Кофе из автомата',
    gridSource: 'Image 4 (Lab & Amadeus)',
    category: 'Лабораторная',
    description: 'Держит теплую кружку черного кофе.',
    icon: '☕',
    blendShapes: { blush: 0.2, browRaise: 0.1, eyeOpen: 0.9, mouthShape: 'smile', headTiltZ: 0.05, headYawY: 0.1, headPitchX: 0.05 }
  },
  {
    id: 'lab_lurker',
    label: '30. Ночное дежурство',
    gridSource: 'Image 4 (Lab & Amadeus)',
    category: 'Лабораторная',
    description: 'Синий отблеск экрана на лице во время ночных симуляций.',
    icon: '🖥️',
    blendShapes: { blush: 0.0, browRaise: -0.3, eyeOpen: 0.85, mouthShape: 'neutral', headTiltZ: 0.0, headYawY: 0.0, headPitchX: 0.1 },
    comicOverlay: 'spotlight'
  },
  {
    id: 'dark_steeple',
    label: '31. Тайный замысел',
    gridSource: 'Image 4 (Lab & Amadeus)',
    category: 'Академическая',
    description: 'Тени на лице и пальцы замочком при обсуждении Комитета 300.',
    icon: '🕶️',
    blendShapes: { blush: 0.0, browRaise: -0.5, eyeOpen: 0.75, mouthShape: 'neutral', headTiltZ: 0.0, headYawY: 0.0, headPitchX: 0.15 },
    comicOverlay: 'spotlight'
  },
  {
    id: 'neutral',
    label: '32. Спокойное наблюдение',
    gridSource: 'Image 1 (Anime Classic)',
    category: 'Академическая',
    description: 'Базовое состояние спокойного научного наблюдения.',
    icon: '👁️',
    blendShapes: { blush: 0.0, browRaise: 0.0, eyeOpen: 1.0, mouthShape: 'neutral', headTiltZ: 0.0, headYawY: 0.0, headPitchX: 0.0 }
  }
];

export const ExpressionReferenceModal: React.FC<ExpressionReferenceModalProps> = ({
  currentExpression,
  onSelectExpression,
  onClose
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Все');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'catalog' | 'image_grids'>('catalog');

  const categories = ['Все', 'Академическая', 'Цундэрэ', 'Лабораторная', 'Личная / Эмоциональная'];

  const filteredItems = canonRefCatalog.filter(item => {
    const matchesCategory = selectedCategory === 'Все' || item.category === selectedCategory;
    const matchesSearch = item.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const activeItem = canonRefCatalog.find(i => i.id === currentExpression) || canonRefCatalog[0];

  return (
    <div className="fixed inset-0 bg-[#050508]/90 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[#0A0A12] border border-[#FF3B30]/40 rounded-2xl max-w-4xl w-full p-4 sm:p-6 shadow-[0_0_60px_rgba(255,59,48,0.2)] space-y-4 text-slate-100 font-sans my-auto max-h-[92vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#FF3B30]/20 border border-[#FF3B30]/40 text-[#FF3B30] shadow-[0_0_12px_rgba(255,59,48,0.3)]">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold font-mono text-white tracking-wide">
                  Каталог Каноничных Поз и Эмоций (32 Арта Курису)
                </h3>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/40 font-bold uppercase">
                  Steins;Gate Spec
                </span>
              </div>
              <p className="text-xs text-white/60">
                Полная парадигма блендшейпов, морф-таргетов и 2D слоев на основе 4 эталонных арт-сеток
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white/60 hover:text-white text-xs font-mono px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all cursor-pointer flex items-center gap-1"
          >
            <X className="w-4 h-4" /> Закрыть
          </button>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 p-1 bg-white/5 border border-white/10 rounded-xl font-mono text-xs shrink-0">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-all cursor-pointer ${
              activeTab === 'catalog'
                ? 'bg-[#FF3B30]/20 border border-[#FF3B30]/50 text-white shadow-[0_0_10px_rgba(255,59,48,0.2)]'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-[#FF3B30]" />
            <span>Интерактивный Каталог (32 Позы)</span>
          </button>

          <button
            onClick={() => setActiveTab('image_grids')}
            className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-all cursor-pointer ${
              activeTab === 'image_grids'
                ? 'bg-[#00FF94]/20 border border-[#00FF94]/50 text-white shadow-[0_0_10px_rgba(0,255,148,0.2)]'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5 text-[#00FF94]" />
            <span>4 Эталонных Арт-Сетки (32 Эмоции)</span>
          </button>
        </div>

        {/* TAB 1: CATALOG OF 32 POSES */}
        {activeTab === 'catalog' && (
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col min-h-0">
            {/* Filter & Search Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
              {/* Category Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 font-mono text-[11px]">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg border transition-all whitespace-nowrap cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-[#FF3B30]/30 border-[#FF3B30] text-white font-bold shadow-[0_0_8px_rgba(255,59,48,0.3)]'
                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск позы или эмоции..."
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-1 text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-[#FF3B30] w-full sm:w-48"
              />
            </div>

            {/* Active Selected Expression Diagnostic Inspector Card */}
            <div className="bg-gradient-to-r from-white/5 via-[#0A0A12] to-white/5 border border-[#FF3B30]/30 rounded-xl p-3 shrink-0 grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
              <div>
                <div className="text-[10px] text-[#FF3B30] uppercase font-bold flex items-center gap-1">
                  <span>{activeItem.icon}</span> {activeItem.label}
                </div>
                <div className="text-white text-xs font-sans font-semibold mt-1">
                  {activeItem.description}
                </div>
                <div className="text-[10px] text-white/40 mt-1">
                  Источник: {activeItem.gridSource}
                </div>
              </div>

              <div className="space-y-1.5 bg-black/40 p-2.5 rounded-lg border border-white/10 text-[10px]">
                <div className="text-[#00FF94] font-bold uppercase flex items-center gap-1">
                  <Sliders className="w-3 h-3" /> Векторы Блендшейпов (Morph Targets):
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-white/70">
                  <div>Румянец (Blush): <span className="text-white font-bold">{Math.round(activeItem.blendShapes.blush * 100)}%</span></div>
                  <div>Брови (Brows): <span className="text-white font-bold">{activeItem.blendShapes.browRaise}</span></div>
                  <div>Глаза (Eye Open): <span className="text-white font-bold">{activeItem.blendShapes.eyeOpen}</span></div>
                  <div>Рот (Mouth): <span className="text-white font-bold">{activeItem.blendShapes.mouthShape}</span></div>
                </div>
              </div>

              <div className="space-y-1.5 bg-black/40 p-2.5 rounded-lg border border-white/10 text-[10px] flex flex-col justify-between">
                <div>
                  <div className="text-[#5AC8FA] font-bold uppercase flex items-center gap-1">
                    <Zap className="w-3 h-3" /> 2D Слои и Частицы:
                  </div>
                  <div className="text-white/70 mt-1">
                    Частицы: <span className="text-white font-bold">{activeItem.particles || 'Стандартные'}</span>
                  </div>
                  <div className="text-white/70">
                    Эффект Кадра: <span className="text-white font-bold">{activeItem.comicOverlay || 'Нет'}</span>
                  </div>
                </div>

                <button
                  onClick={() => onSelectExpression(activeItem.id)}
                  className="w-full py-1.5 bg-[#FF3B30] hover:bg-[#FF3B30]/90 text-white font-bold text-[11px] rounded-lg shadow-[0_0_10px_rgba(255,59,48,0.4)] transition-all cursor-pointer flex items-center justify-center gap-1 mt-1"
                >
                  <Check className="w-3.5 h-3.5" /> Применить эту позу к 3D модели
                </button>
              </div>
            </div>

            {/* Grid of 32 Pose Items */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 overflow-y-auto pr-1 flex-1 min-h-0">
              {filteredItems.map((item) => {
                const isActive = item.id === currentExpression;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectExpression(item.id)}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer font-sans relative group ${
                      isActive
                        ? 'bg-[#FF3B30]/25 border-[#FF3B30] text-white shadow-[0_0_12px_rgba(255,59,48,0.35)]'
                        : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="flex items-center gap-1.5">
                          <span className="text-base">{item.icon}</span>
                          <span className="truncate">{item.label}</span>
                        </span>
                        {isActive && <Check className="w-3.5 h-3.5 text-[#00FF94] shrink-0" />}
                      </div>
                      <p className="text-[10px] text-white/50 line-clamp-2 mt-1 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between text-[9px] font-mono text-white/40">
                      <span className="truncate">{item.category}</span>
                      <span className="text-[#FF3B30] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                        Тест →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: REFERENCE IMAGE GRIDS INSPECTOR */}
        {activeTab === 'image_grids' && (
          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs space-y-1">
              <div className="font-bold font-mono text-[#00FF94] flex items-center gap-1.5">
                <Camera className="w-4 h-4" /> 4 Каноничных Арт-Сеток (32 Эмоциональных Состояния)
              </div>
              <p className="text-white/70 text-[11px]">
                3D-аватар Макисэ Курису откалиброван точно по пропорциям, мимике, форме челки, цвету волос и позам из данных 4 изображений.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-black/50 border border-white/10 rounded-xl p-2.5 space-y-2">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="text-[#FF3B30] font-bold">Сетка 1: Аниме Классика (8 Поз)</span>
                  <span className="text-[10px] text-white/40">Steins;Gate Anime</span>
                </div>
                <div className="text-[11px] text-white/60 space-y-1">
                  <div>• 1. Раздумья за столом (chin_rest)</div>
                  <div>• 2. Скрещенные руки (confident_crossed)</div>
                  <div>• 3. Цундэрэ Вспышка (flustered)</div>
                  <div>• 4. Научный спор (passionate_shout)</div>
                  <div>• 5. Спит на столе (head_on_desk)</div>
                  <div>• 6. Внезапное открытие (surprised)</div>
                  <div>• 7. Доска с формулами (whiteboard_explain)</div>
                  <div>• 8. Экран Amadeus (phone_texting)</div>
                </div>
              </div>

              <div className="bg-black/50 border border-white/10 rounded-xl p-2.5 space-y-2">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="text-[#5AC8FA] font-bold">Сетка 2: Закат и Высокий Арт (8 Поз)</span>
                  <span className="text-[10px] text-white/40">High-Res Render</span>
                </div>
                <div className="text-[11px] text-white/60 space-y-1">
                  <div>• 9. Поправление очков (sarcastic)</div>
                  <div>• 10. Чтение @channel (channel_lurker)</div>
                  <div>• 11. Протягивает руку (reach_out)</div>
                  <div>• 12. Перерыв с Dr. Pepper (dr_pepper_break)</div>
                  <div>• 13. Замок из пальцев (steeple_hands)</div>
                  <div>• 14. Взгляд через плечо (over_shoulder)</div>
                  <div>• 15. Радушный привет (happy_open_arms)</div>
                  <div>• 16. Закат на крыше (sunset_melancholy)</div>
                </div>
              </div>

              <div className="bg-black/50 border border-white/10 rounded-xl p-2.5 space-y-2">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="text-amber-300 font-bold">Сетка 3: Улицы Акихабары и Дождь (8 Поз)</span>
                  <span className="text-[10px] text-white/40">Attractor World Lines</span>
                </div>
                <div className="text-[11px] text-white/60 space-y-1">
                  <div>• 17. Одиночество под дождем (sad_rain)</div>
                  <div>• 18. Колебание аттрактора (time_travel_panic)</div>
                  <div>• 19. Ухмылка гения (smug_genius)</div>
                  <div>• 20. Отрицание симпатии (tsundere_denial)</div>
                  <div>• 21. Полный рост на улице (neutral)</div>
                  <div>• 22. Прогулка у Radi-Kaikan</div>
                  <div>• 23. Балкон на закате</div>
                  <div>• 24. Фон с шестеренками времени</div>
                </div>
              </div>

              <div className="bg-black/50 border border-white/10 rounded-xl p-2.5 space-y-2">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="text-[#00FF94] font-bold">Сетка 4: Лаборатория и Amadeus (8 Поз)</span>
                  <span className="text-[10px] text-white/40">Amadeus OS Core</span>
                </div>
                <div className="text-[11px] text-white/60 space-y-1">
                  <div>• 25. Испуг / Смущение (face_cover_gasp)</div>
                  <div>• 26. Надутые губы (pout)</div>
                  <div>• 27. Шок Amadeus (shocked)</div>
                  <div>• 28. Дремота за ПК (sleepy)</div>
                  <div>• 29. Прячется в халат (embarrassed_hide)</div>
                  <div>• 30. Искренний смех (laughing)</div>
                  <div>• 31. Нежный взгляд (tender_glance)</div>
                  <div>• 32. Изучение статьи (reading_paper)</div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
