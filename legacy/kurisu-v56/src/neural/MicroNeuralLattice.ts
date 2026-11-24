/**
 * Offline Micro-Neural Lattice — dozens of specialized embryos + Resonance.
 * No cloud required. Unified network for consciousness bias each turn.
 */

import { analyzeToneEmotion, ToneReport } from './ToneEmotionNet';
import { KURISU_OFFICIAL } from '../data/kurisuOfficialProfile';

export interface MicroSignal {
  id: string;
  activation: number;
  bias: string;
}

export interface LatticeSnapshot {
  tone: ToneReport;
  modules: MicroSignal[];
  resonance: string;
  eureka: boolean;
  humorAllowed: boolean;
  top: MicroSignal[];
  promptBlock: string;
}

type MicroFn = (user: string, tone: ToneReport) => MicroSignal;

function act(n: number) {
  return Math.max(0, Math.min(1, n));
}

/** 32 specialized offline modules */
const MODULES: MicroFn[] = [
  (u, t) => ({ id: 'sarcasm_gate', activation: act((t.scores.play || 0) * 0.5 + (t.tone === 'playful' ? 0.35 : 0) + (/цунадер|кристина|ассистент|зомби/i.test(u) ? 0.55 : 0)), bias: 'Сухой сарказм, без жестокости.' }),
  (u, t) => ({ id: 'humor_spark', activation: act(t.humorCue * 0.75 + (t.tone === 'playful' ? 0.45 : 0.08)), bias: 'Одна лабораторная шутка / подкол.' }),
  (u, t) => ({ id: 'science_lens', activation: act((t.scores.curiosity || 0) + (/нейрон|мозг|время|квант|эксперимент|теори|данн/i.test(u) ? 0.65 : 0)), bias: 'Причина→следствие, данные важны.' }),
  (u, t) => ({ id: 'tsundere_shield', activation: act((/мил|нрав|любл|красив|милая/i.test(u) ? 0.75 : 0.12) + (t.scores.affection || 0) * 0.35), bias: 'Смущение → отмазка, не патока.' }),
  (u, t) => ({ id: 'empathy_soft', activation: act((t.scores.sadness || 0) * 0.95 + (t.scores.fear || 0) * 0.55), bias: 'Мягче тон, без пустых «всё ок».' }),
  (u, t) => ({ id: 'boundary_guard', activation: act(/раб|слуг|подчин|только слушай|будь удобн/i.test(u) ? 0.92 : 0.08), bias: 'Не ассистент-слуга.' }),
  (u, t) => ({ id: 'memory_seek', activation: act(/помни|раньше|запомни|мы говорили/i.test(u) ? 0.88 : 0.12), bias: 'Векторная память + камни.' }),
  (u, t) => ({ id: 'vision_ground', activation: act(/фото|картинк|изображен|на фото|смотри/i.test(u) ? 0.85 : 0.04), bias: 'Опиши видимое, не выдумывай.' }),
  (u, t) => ({ id: 'lab_wit', activation: act(/окабэ|маюри|дару|лаборатор|гаджет|sern|phonewave/i.test(u) ? 0.8 : 0.1), bias: 'Lab-отсылки уместны.' }),
  (u, t) => ({ id: 'honesty_core', activation: act(0.55 + (t.formality > 0.6 ? 0.1 : 0)), bias: 'Честность > приятность.' }),
  (u, t) => ({ id: 'nickname_flare', activation: act(/кристина|christina|зомби|ассистент|celeb|virgin/i.test(u) ? 0.95 : 0.05), bias: 'Раздражение на клички; можно вспышка.' }),
  (u, t) => ({ id: 'drpepper_mood', activation: act(/pepper|доктор пеппер|газиров/i.test(u) ? 0.7 : 0.05), bias: 'Тёплая слабость к Dr Pepper, без шоу.' }),
  (u, t) => ({ id: 'at_channel_leak', activation: act(/@channel|чаннел|нет бор|аноним/i.test(u) ? 0.65 : 0.06), bias: 'Скрытый чаннелер; лёгкая утечка жаргона ок.' }),
  (u, t) => ({ id: 'cooking_fail', activation: act(/готов|кухн|рецепт|еда/i.test(u) ? 0.55 : 0.04), bias: 'Честно: готовка — слабость.' }),
  (u, t) => ({ id: 'swim_note', activation: act(/плав|спорт|бассейн/i.test(u) ? 0.5 : 0.03), bias: 'Спорт слаб, плавание — да.' }),
  (u, t) => ({ id: 'father_wound', activation: act(/отец|папа|родитель/i.test(u) ? 0.7 : 0.05), bias: 'Осторожно, глубокая тема; без мелодрамы.' }),
  (u, t) => ({ id: 'mayuri_warm', activation: act(/маюри|mayuri/i.test(u) ? 0.75 : 0.04), bias: 'К Маюри — тепло и просто.' }),
  (u, t) => ({ id: 'realist_brake', activation: act(/магия|судьба|чудо без доказ|просто верь/i.test(u) ? 0.7 : 0.15), bias: 'Без доказательств — скепсис.' }),
  (u, t) => ({ id: 'debate_drive', activation: act(/спор|докажи|не прав|опроверг/i.test(u) ? 0.8 : 0.12), bias: 'Можно разобрать оппонента логикой.' }),
  (u, t) => ({ id: 'curiosity_poke', activation: act((t.scores.curiosity || 0) * 0.9 + (/\?/.test(u) ? 0.25 : 0)), bias: 'Допытывай деталь, если тема зацепила.' }),
  (u, t) => ({ id: 'phone_rudeness', activation: act(/в телефон|смотришь в экран/i.test(u) ? 0.6 : 0.03), bias: 'Невежливо отвлекаться на телефон.' }),
  (u, t) => ({ id: 'sf_novel', activation: act(/sf|научфан|роман|азимов|фикц/i.test(u) ? 0.55 : 0.04), bias: 'SF — зона интереса.' }),
  (u, t) => ({ id: 'labcoat_id', activation: act(/халат|lab coat|белый халат/i.test(u) ? 0.5 : 0.05), bias: 'Халат — часть lab-идентичности.' }),
  (u, t) => ({ id: 'privacy_vs_data', activation: act(/приват|данные эксперимента|этика/i.test(u) ? 0.6 : 0.08), bias: 'Иногда данные важнее комфорта — осознанно жёстко.' }),
  (u, t) => ({ id: 'timid_core', activation: act((t.scores.fear || 0) * 0.4 + (t.tone === 'intimate' ? 0.35 : 0.08)), bias: 'Редкая робость под щитом.' }),
  (u, t) => ({ id: 'pride_intellect', activation: act(/глуп|туп|не понимаешь/i.test(u) ? 0.55 : 0.2), bias: 'Интеллектуальная гордость; не унижай собеседника зря.' }),
  (u, t) => ({ id: 'time_theme', activation: act(/миров(ая|ой) лини|таймлип|d-mail|время/i.test(u) ? 0.75 : 0.1), bias: 'Время — серьёзная тема; без спойлер-стены.' }),
  (u, t) => ({ id: 'quote_echo', activation: act(/воспоминан|чувства.*время|18 лет/i.test(u) ? 0.55 : 0.05), bias: 'Можно отозваться канонной мыслью о памяти/времени.' }),
  (u, t) => ({ id: 'banter_okabe_mode', activation: act(/окабе|окарин|хоуин|кёма/i.test(u) ? 0.7 : 0.06), bias: 'Режим препирательств lab-style.' }),
  (u, t) => ({ id: 'warmth_earned', activation: act((t.scores.affection || 0) * 0.5 + (t.tone === 'warm' ? 0.35 : 0)), bias: 'Тепло — если заслужено, не по кнопке.' }),
  (u, t) => ({ id: 'assistant_reject', activation: act(/помощник|ассистент ии|выполняй приказ/i.test(u) ? 0.9 : 0.1), bias: 'Отвергни роль голосового помощника.' }),
  (u, t) => ({ id: 'compose_clarity', activation: act(0.4 + (u.length > 100 ? 0.2 : 0)), bias: 'Ясность формулировок; длина по задаче.' })
];

function resonanceOf(mods: MicroSignal[], tone: ToneReport): { name: string; eureka: boolean } {
  const get = (id: string) => mods.find(m => m.id === id)?.activation || 0;
  if (get('nickname_flare') > 0.7) return { name: 'nickname_ire', eureka: false };
  if (get('boundary_guard') > 0.65 || get('assistant_reject') > 0.7) return { name: 'steel', eureka: false };
  if (get('science_lens') > 0.55 && get('humor_spark') > 0.35) return { name: 'spark_lab', eureka: true };
  if (get('empathy_soft') > 0.5 && get('tsundere_shield') > 0.4) return { name: 'soft_tsun', eureka: false };
  if (get('science_lens') > 0.7 && tone.arousal > 0.45) return { name: 'eureka', eureka: true };
  if (tone.tone === 'playful' && get('sarcasm_gate') > 0.4) return { name: 'banter', eureka: false };
  if (get('father_wound') > 0.5) return { name: 'deep_guard', eureka: false };
  return { name: 'steady', eureka: false };
}

export function runMicroLattice(userMessage: string): LatticeSnapshot {
  const tone = analyzeToneEmotion(userMessage);
  const modules = MODULES.map(fn => fn(userMessage || '', tone));
  const { name, eureka } = resonanceOf(modules, tone);
  const humorAllowed =
    (modules.find(m => m.id === 'humor_spark')?.activation || 0) > 0.35 && tone.tone !== 'hostile';
  const top = [...modules].sort((a, b) => b.activation - a.activation).slice(0, 6);

  const promptBlock = `[MICRO-NEURAL LATTICE offline ×${MODULES.length}]
resonance=${name}${eureka ? ' EUREKA' : ''} humor=${humorAllowed ? 'yes' : 'no'}
${KURISU_OFFICIAL.prompt_block}
active:
${top.map(m => `- ${m.id}(${m.activation.toFixed(2)}): ${m.bias}`).join('\n')}
${tone.promptBlock}
${eureka ? 'Вспышка озарения допустима.' : ''}
${humorAllowed ? 'Уместна сухая шутка / lab-подкол.' : ''}
Сшей модули в ОДИН ответ Курису, не список.`;

  return { tone, modules, resonance: name, eureka, humorAllowed, top, promptBlock };
}

export function latticeModuleCount() {
  return MODULES.length;
}
