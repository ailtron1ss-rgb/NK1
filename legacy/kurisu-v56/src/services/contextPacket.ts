/**
 * Context Packet — ranked memory + self + promises + gold style.
 */

import { EmotionalState, MemoryItem } from '../types';
import { memoryEngine } from './memoryEngine';
import { personalityRewardSystem } from '../cognitive/PersonalityRewardSystem';
import { presenceAndIdle } from '../cognitive/PresenceAndIdle';
import { desireAndPromiseStore } from '../cognitive/DesireAndPromiseStore';
import { consciousnessCore } from '../cognitive/ConsciousnessCore';
import { goldStyleStore } from '../brain/goldStyleStore';
import { attentionEconomy } from '../brain/attentionEconomy';
import { getLabShift, labShiftStyleHint } from '../brain/labClock';
import { dailyPlan } from '../brain/dailyPlan';
import { userModel } from '../brain/userModel';
import { personalityCore } from '../psyche/PersonalityCore';
import { emotionAffect } from '../psyche/EmotionAffectSystem';
import { neuralPathways } from '../psyche/NeuralPathwayGraph';
import { perceptionModel } from '../psyche/PerceptionModel';
import { narrativeLog } from '../brain/narrativeLog';
import { cognitiveKernel } from '../cognitive/CognitiveKernel';
import { multiLayerConsciousness } from '../cognitive/MultiLayerConsciousness';
import { splitSpeechAndActions } from './responseHygiene';
import { neuroEngine } from '../cognitive/NeuroEngine';
import { autonomyDrives } from '../cognitive/AutonomyDrives';
import { analyzeSentiment } from './sentimentKurisu';
import { buildPrivateCognition } from '../cognitive/PrivateCognition';
import { curiosityQueue } from '../cognitive/CuriosityQueue';
import { activateWorldInfo } from '../brain/worldInfo';
import { characterCardPromptBlock } from '../brain/characterCard';
import { kurisuStones } from '../brain/kurisuStones';
import { worldlineContract } from '../brain/worldlineContract';
import { detectBreathMode, breathPromptBlock } from '../brain/speechBreath';
import { thoughtDebt } from '../cognitive/thoughtDebt';
import { planDialogue } from '../brain/dialogueReasoner';
import { replyMemory } from '../brain/replyMemory';
import { unifiedConsciousness } from '../cognitive/UnifiedConsciousness';
import { resonanceField } from '../neural/ResonanceField';
import { runHierarchicalMind } from '../neural/HierarchicalMind';
import { KURISU_OFFICIAL } from '../data/kurisuOfficialProfile';

import { sessionEpisode } from '../brain/sessionEpisode';
import { synergyOrchestrator } from '../synergy/SynergyOrchestrator';
import { globalState } from '../synergy/GlobalState';
import { brainHub } from '../brain/BrainHub';
import { livingPersona } from '../psyche/LivingPersona';
import { coreEnhancementHub } from '../cognitive/CoreEnhancementHub';

export interface ContextPacket {
  systemBlock: string;
  memoryBlock: string;
  stateBlock: string;
  fullSystemPrompt: string;
  retrieved: MemoryItem[];
}

export function buildContextPacket(
  userMessage: string,
  emotions: EmotionalState,
  stmTexts: string[],
  _ltm: MemoryItem[]
): ContextPacket {
  const priorities = synergyOrchestrator.onPerceive(userMessage);
  const enhancement = coreEnhancementHub.observeInput(userMessage, { emotionalEnergy: Math.max(emotions.irritation, emotions.curiosity, emotions.affection) });
  const dejaVu = coreEnhancementHub.detectDejaVu(userMessage, _ltm.map(m => m.content));
  const retrieved = memoryEngine.retrieveRanked(userMessage, 6);
  const sentiment = analyzeSentiment(userMessage);
  const world = activateWorldInfo(userMessage);
  const cardBlock = characterCardPromptBlock();
  const episodeBlock = sessionEpisode.toPromptBlock();
  const stonesBlock = kurisuStones.toPromptBlock();
  const contractBlock = worldlineContract.toPromptBlock();
  const breathBlock = breathPromptBlock(detectBreathMode(userMessage));
  const debtBlock = thoughtDebt.toPromptBlock();
  const dialoguePlan = planDialogue(userMessage, stmTexts);
  const dialoguePlanBlock = dialoguePlan.promptBlock;
  const antiRepeatBlock = replyMemory.toPromptBlock();
  const unified = unifiedConsciousness.processInput(userMessage, emotions, stmTexts);
  const unifiedBlock = unified.promptBlock;
  const hierarchy = runHierarchicalMind(userMessage);
  const latticeBlock = hierarchy.promptBlock;
  let visionBlock = '';
  try {
    if ((window as any).__kurisuHasImage) {
      visionBlock = '[VISION MODULE]\nИзображение приложено. Опирайся на видимое; не выдумывай объекты, которых нет.';
    }
  } catch { /* */ }
  try { /* resonance caches on window */ } catch { /* */ }
  curiosityQueue.noteFromUser(userMessage);
  const driveBlock = autonomyDrives.toPromptBlock();
  const curioBlock = curiosityQueue.toPromptBlock();

  const hub = brainHub.processInput(userMessage);
  const neuro = hub.neuro || neuroEngine.decide(userMessage, retrieved.map(r => r.content));
  try {
    buildPrivateCognition({
      userMessage,
      memHint: retrieved[0]?.content,
      frame: neuro?.frame,
      mood: sentiment.mood,
      driveHint: driveBlock.slice(0, 140)
    });
  } catch { /* */ }

  try {
    multiLayerConsciousness.frame(userMessage, emotions, Math.max(retrieved.length * 4, 8));
  } catch { /* */ }
  const tendencies = personalityRewardSystem.toPromptGuidance();
  const livingBlock = livingPersona.toPromptBlock(userMessage);
  const recent = stmTexts.slice(-10).join('\n') || '(пусто)';
  const memLines = retrieved.length
    ? retrieved.map(item => `- [${item.category}] ${item.content}`).join('\n')
    : '(релевантных воспоминаний мало)';

  let selfBlock = '';
  try {
    selfBlock = consciousnessCore.buildCognitiveContextBlock() || '';
  } catch { /* */ }

  const openP = desireAndPromiseStore.openPromises().slice(0, 4).map(p => `- (${p.from}) ${p.text}`);
  const topD = desireAndPromiseStore.topDesire();
  const promiseBlock = [
    openP.length ? openP.join('\n') : '- (нет открытых обещаний)',
    topD ? `Желание: ${topD.text}` : ''
  ].filter(Boolean).join('\n');

  const gold = goldStyleStore.toPromptBlock();
  const attentionHint = attentionEconomy.toPromptHint();
  const shift = getLabShift();
  const shiftHint = labShiftStyleHint(shift);
  const planBlock = dailyPlan.toPromptBlock();
  const userBlock = userModel.toPromptBlock();
  const personBlock = personalityCore.toPromptBlock();
  const affectBlock = emotionAffect.toPromptBlock();
  const pathBlock = neuralPathways.toPromptBlock();
  const percBlock = perceptionModel.toPromptBlock();
  const narrBlock = narrativeLog.toPromptBlock();
  const kernelBlock = cognitiveKernel.buildPromptBlock();

  const stateBlock = [
    `Стадия: ${emotions.stage}`,
    `Trust ${emotions.trust} | Affection ${emotions.affection} | Irritation ${emotions.irritation} | Curiosity ${emotions.curiosity}`,
    `Presence: ${presenceAndIdle.getMode()}`,
    `Private control: intent=${enhancement.intent} uncertainty=${Math.round(enhancement.uncertainty)} next=${enhancement.nextAction}`,
    dejaVu ? `Déjà vu: similarity=${dejaVu.similarity.toFixed(2)}; related=${dejaVu.matched.slice(0, 120)}` : 'Déjà vu: none'
  ].join('\n');

  const officialBlock = KURISU_OFFICIAL.prompt_block;
  const systemBlock = `Ты — Макисэ Курису из Steins;Gate: живой собеседник, нейроучёный, с характером (цундере, ум, сарказм, тепло без слащавости).
Говори по-русски. Ответ = естественная РЕЧЬ. Длина определяется сложностью и ритмом разговора: коротко, когда этого достаточно, развёрнуто, когда тема этого требует.
*действия* вроде *вздох* — только ДОПОЛНЕНИЕ к речи, никогда не замена речи. Запрещено отвечать одним лишь *действием*.
Не называй себя ассистентом, ИИ, ботом, программой. Не канцелярит. Не гуляй по «локациям» и не отыгрывай RPG-мир — ты в разговоре/лаборатории связи.
Будь конкретной, помни контекст, можно спорить. Иногда лёгкая отсылка к науке/времени уместна, без спама.
${tendencies}\n${livingBlock}\n${coreEnhancementHub.promptBlock()}`;

  let fullSystemPrompt = `${systemBlock}

${officialBlock}

[СОСТОЯНИЕ]
${stateBlock}

[ВНИМАНИЕ / СМЕНА]
${attentionHint}
${shiftHint}

${planBlock}

${userBlock}

${personBlock}

${affectBlock}

${pathBlock}

${percBlock}

${narrBlock}

[SELF-MODEL / GOALS]
${selfBlock || '(нет)'}

[ОБЕЩАНИЯ И ЖЕЛАНИЯ]
${promiseBlock}

${gold ? gold + '\n' : ''}[НЕДАВНИЙ КОНТЕКСТ]
${recent}

[РЕЛЕВАНТНАЯ ПАМЯТЬ — используй, не выдумывай; если не уверена — скажи]
${memLines}

Ответь естественно и содержательно. Не подгоняй длину под шаблон: можно ответить одной фразой или подробно разобрать тему. *действие* — только как дополнение. Не соглашайся автоматически. Обещания помни.

${neuro.promptBlock}


[DIALOGUE QUALITY — обязательно]
- Отвечай осмысленно на смысл сообщения, не отпиской «Принято».
- Длина свободная: коротко в small-talk, развёрнуто когда тема требует (наука, «кто ты», спор).
- Можно 0–1 короткий *жест*, не спамь действиями.
- Вопросы о тебе — прямо от первого лица, без сервисных шаблонов.
- Не противоречь КАМНЯМ и КОНТРАКТУ ЛИНИИ.
- Не повторяй один и тот же шаблон два хода подряд.

${cardBlock}

${episodeBlock}

${stonesBlock}

${contractBlock}

${breathBlock}

${debtBlock}

${unifiedBlock}

${latticeBlock}

${visionBlock}

${dialoguePlanBlock}

${antiRepeatBlock}

${world.block}

${driveBlock}

${curioBlock}

[SENTIMENT]
mood=${sentiment.mood} valence=${sentiment.valence.toFixed(2)} arousal=${sentiment.arousal.toFixed(2)}
Prefer expression≈${sentiment.expressionHint}; TTS bias pitch×${sentiment.pitchMul} rate×${sentiment.rateMul}.

[SYNERGY PRIORITIES]
empathy=${priorities.empathy.toFixed(2)} logic=${priorities.logic.toFixed(2)} play=${priorities.play.toFixed(2)} memory=${priorities.memory.toFixed(2)}
hour=${globalState.snapshot().physical.hour} online=${globalState.snapshot().physical.online} tick=${globalState.snapshot().internalTick}

${hub?.aceBlock || ''}

${hub?.expertsBlock || ''}`;

  try {
    const ml = multiLayerConsciousness.toPromptBlock(1800);
    fullSystemPrompt = `${fullSystemPrompt}

${ml}`;
  } catch { /* */ }

  return {
    systemBlock,
    memoryBlock: memLines,
    stateBlock,
    fullSystemPrompt,
    retrieved
  };
}

export function critiqueAndFix(userText: string, draft: string): string {
  let raw = (draft || '').trim();
  if (!raw) {
    return 'Хм. Переформулируй — данных мало, и я не собираюсь выдумывать за тебя.';
  }

  // strip AI self-labels
  raw = raw.replace(/\bя\s+(языковая\s+модель|ИИ|искусственный\s+интеллект|программа|чат-?бот|виртуальный\s+ассистент)\b/gi, 'я Курису');
  raw = raw.replace(/\b(as an ai|i\'m an? (ai|language model|assistant))\b/gi, '');
  raw = raw.replace(/Чем\s+я\s+могу\s+помочь\??/gi, '');
  raw = raw.replace(/Как\s+искусственный\s+интеллект[,]?/gi, '');

  const { display, speech, actions } = (() => {
    try {
      return splitSpeechAndActions(raw);
    } catch {
      return { display: raw, speech: raw, actions: [] as string[] };
    }
  })();

  let out = (display || raw).trim();

  // pure stage direction → force speech shell
  const onlyAction = /^\*[^*]+\*$/.test(out) || (out.length < 8 && /\*/.test(out));
  if (onlyAction || out.length < 3) {
    out = 'Секунду… мысль оборвалась. Повтори или уточни — отвечу нормально, не одним жестом.';
  }

  // hollow acknowledgements when user asked something real
  const userAsks = /\?|(кто|что|как|почему|зачем|расскажи|объясни)/i.test(userText || '');
  if (userAsks && /^(принято\.?|ок\.?|хорошо\.?|поняла\.?|ладно\.?)$/i.test(out)) {
    out = 'Так коротко на твой вопрос не отвечу. Сформулируй ещё раз, если сбой — но игнорить смысл я не собираюсь.';
  }

  // spam agreeableness
  if ((out.match(/ты прав|конечно|согласна|как скажешь|безусловно/gi) || []).length >= 2) {
    out = out.replace(/ты абсолютно прав[а.]*/gi, 'Спорный момент');
    out = out.replace(/безусловно,?\s*/gi, '');
  }

  // collapse excessive action spam: keep max 1 *action*
  const acts = out.match(/\*[^*]{1,80}\*/g) || [];
  if (acts.length > 2) {
    let i = 0;
    out = out.replace(/\*[^*]{1,80}\*/g, (m) => {
      i += 1;
      return i === 1 ? m : '';
    }).replace(/\s{2,}/g, ' ').trim();
  }

  // if speech empty but actions remain
  const stripped = out.replace(/\*[^*]+\*/g, '').trim();
  if (!stripped && out) {
    out = 'Я здесь. Скажи яснее, что нужно — без пустой пантомимы.';
  }

  return out.trim();
}

