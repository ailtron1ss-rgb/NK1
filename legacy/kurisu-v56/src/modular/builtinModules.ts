import { BrainModule, HubContext, ModuleContribution } from './types';
import { moduleManager } from './ModuleManager';
import { aceMemory } from './AceMemory';
import { neuroEngine } from '../cognitive/NeuroEngine';

function base(id: BrainModule['id'], name: string, description: string, cost: number, contribute: BrainModule['contribute']): BrainModule {
  return {
    id,
    name,
    description,
    status: 'active',
    cost,
    activate() {
      this.status = 'active';
    },
    deactivate() {
      this.status = 'disabled';
    },
    contribute
  };
}

const reservoir = base('reservoir', 'Reservoir (STM)', 'Краткий контекст и тема', 2, (ctx: HubContext) => {
  const recent = ctx.stm.slice(-4);
  return {
    moduleId: 'reservoir',
    notes: recent.length ? recent.map(s => s.slice(0, 80)) : ['контекст тонкий'],
    styleHints: [],
    memoryHints: recent,
    weight: 1.2
  };
});

const somatic = base('somatic', 'Somatic (Emotion)', 'Эмоциональное смещение ответа', 2, (ctx: HubContext) => {
  const e = neuroEngine.getEmotions();
  const notes = [
    `happy=${e.happiness.toFixed(2)} sad=${e.sadness.toFixed(2)} irrit=${e.irritation.toFixed(2)}`
  ];
  const styleHints: string[] = [];
  if (e.irritation > 50) styleHints.push('тон суше, меньше шуток');
  if (e.sadness > 45) styleHints.push('мягче, без издёвки');
  if (e.curiosity > 55) styleHints.push('можно задать уточняющий вопрос');
  return { moduleId: 'somatic', notes, styleHints, memoryHints: [], weight: 1.1 };
});

const hypergraph = base('hypergraph', 'Hypergraph Memory', 'Ассоциации ACE', 3, (ctx: HubContext) => {
  const rows = aceMemory.retrieve(ctx.userMessage, 4);
  return {
    moduleId: 'hypergraph',
    notes: rows.map(r => r.text.slice(0, 70)),
    styleHints: [],
    memoryHints: rows.map(r => r.text),
    weight: 1.3
  };
});

const personality = base('personality', 'Personality', 'Traits Курису', 1, () => {
  const t = neuroEngine.getTraits();
  return {
    moduleId: 'personality',
    notes: [`sarcasm=${t.sarcasm} intellect=${t.intellect} empathy=${t.empathy}`],
    styleHints: [
      t.sarcasm > 0.7 ? 'лёгкий сарказм уместен' : '',
      t.empathy > 0.55 ? 'не обесценивай чувства' : ''
    ].filter(Boolean),
    memoryHints: [],
    weight: 1.4
  };
});

/** MiCRo experts */
const language = base('language', 'Language Expert', 'Стиль речи', 2, () => ({
  moduleId: 'language',
  notes: ['живой русский, без канцелярита'],
  styleHints: ['естественная длина речи', '*действие* только гарнир'],
  memoryHints: [],
  weight: 1.0
}));

const logic = base('logic', 'Logic Expert', 'Структура рассуждения', 2, (ctx) => {
  const need = /(почему|как|докажи|логик|план)/i.test(ctx.userMessage);
  return {
    moduleId: 'logic',
    notes: need ? ['разложи по шагам'] : ['логика фоном'],
    styleHints: need ? ['чёткая структура: тезис → довод'] : [],
    memoryHints: [],
    weight: need ? 1.5 : 0.6
  };
});

const social = base('social', 'Social/Emotional Expert', 'Отношения', 2, (ctx) => {
  const need = /(устал|груст|спасибо|люблю|одинок|злюсь)/i.test(ctx.userMessage);
  return {
    moduleId: 'social',
    notes: need ? ['социальный приоритет'] : [],
    styleHints: need ? ['тепло без сюсюканья'] : [],
    memoryHints: [],
    weight: need ? 1.4 : 0.7
  };
});

const knowledge = base('knowledge', 'Knowledge Expert', 'Факты/наука', 2, (ctx) => {
  const need = /(наук|нерв|квант|ген|физик|хими)/i.test(ctx.userMessage);
  return {
    moduleId: 'knowledge',
    notes: need ? ['научный акцент'] : [],
    styleHints: need ? ['можно термин + простое объяснение'] : [],
    memoryHints: [],
    weight: need ? 1.4 : 0.5
  };
});

export function registerBuiltinModules() {
  [reservoir, somatic, hypergraph, personality, language, logic, social, knowledge].forEach(m =>
    moduleManager.register(m)
  );
}
