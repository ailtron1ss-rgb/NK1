/**
 * Autonomous Initiative Engine.
 *
 * No simulated locations, walking, inventory or virtual-world RPG state.
 * It models only conversational initiative: idle reflections, topic callbacks
 * and time-aware messages. Heavy generation is delegated to ChatService.
 */
import { notificationEngine } from './notificationEngine';
import { energyBudget } from '../brain/energyBudget';
import { EmotionalState, AvatarExpression } from '../types';
import { livingPersona } from '../psyche/LivingPersona';

export interface KurisuAutonomousState {
  currentActivity: string;
  lastUpdate: number;
  energyLevel: number;
  activeResearchTopic: string;
  statusIcon: string;
}

export interface ProactiveThought {
  id: string;
  text: string;
  expression: AvatarExpression;
  title: string;
  category: 'time_of_day' | 'emotional_spike' | 'spontaneous_idea' | 'research_eureka';
  timeOfDayLabel: string;
  triggerReason: string;
  timestamp: number;
}

export function getTimeOfDayPeriod(): { period: 'morning' | 'afternoon' | 'evening' | 'late_night'; label: string } {
  const d = new Date();
  const hour = d.getHours();
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (hour >= 5 && hour < 12) return { period: 'morning', label: `Утро (${timeStr})` };
  if (hour >= 12 && hour < 17) return { period: 'afternoon', label: `День (${timeStr})` };
  if (hour >= 17 && hour < 23) return { period: 'evening', label: `Вечер (${timeStr})` };
  return { period: 'late_night', label: `Поздняя ночь (${timeStr})` };
}

class AutonomousEngine {
  private state: KurisuAutonomousState = {
    currentActivity: 'обдумывает текущую тему разговора',
    lastUpdate: Date.now(),
    energyLevel: 85,
    activeResearchTopic: 'текущий вопрос пользователя',
    statusIcon: '🧠'
  };
  private proactiveListeners: ((thought: ProactiveThought) => void)[] = [];
  private thoughtHistory: ProactiveThought[] = [];
  private lastThoughtTime = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.schedule();
  }

  subscribe(listener: (state: KurisuAutonomousState) => void) {
    listener(this.state);
    return () => {};
  }

  onProactiveThought(listener: (thought: ProactiveThought) => void) {
    this.proactiveListeners.push(listener);
    return () => {
      this.proactiveListeners = this.proactiveListeners.filter(l => l !== listener);
    };
  }

  getState() { return { ...this.state }; }
  getThoughtHistory() { return [...this.thoughtHistory]; }

  evaluateProactiveThought(emotions: EmotionalState, force = false): ProactiveThought | null {
    if (!force && !energyBudget.canAutonomous()) return null;
    const now = Date.now();
    if (!force && now - this.lastThoughtTime < 5 * 60 * 1000) return null;

    const time = getTimeOfDayPeriod();
    const persona = livingPersona.get();
    let text: string;
    let expression: AvatarExpression = 'thinking';
    let category: ProactiveThought['category'] = 'spontaneous_idea';
    let reason = 'долгая пауза в разговоре';

    if (emotions.curiosity > 70) {
      category = 'research_eureka';
      expression = 'whiteboard_explain';
      reason = `высокое любопытство (${emotions.curiosity})`;
      text = 'У меня появилась мысль по нашей последней теме. Не факт, что она верная, но она достаточно интересная, чтобы её проверить.';
    } else if (emotions.irritation > 65) {
      category = 'emotional_spike';
      expression = 'sarcastic';
      reason = `раздражение (${emotions.irritation})`;
      text = 'Знаешь, что меня сейчас раздражает? Незакрытая мысль. Я предпочитаю либо довести её до вывода, либо честно признать, что данных не хватает.';
    } else if (emotions.trust > 65 && persona.relationship.familiarity > 0.15) {
      category = 'emotional_spike';
      expression = 'tender';
      reason = 'устойчивый контакт';
      text = 'Я поймала себя на том, что снова прокручиваю наш прошлый разговор. Забавно, как некоторые темы не отпускают даже после того, как диалог закончился.';
    } else {
      category = 'time_of_day';
      expression = time.period === 'late_night' ? 'tired' : 'thinking';
      reason = `время: ${time.period}`;
      text = time.period === 'late_night'
        ? 'Уже поздно. Я бы не стала делать вид, что бесконечная концентрация бесплатна. Но если у тебя ещё есть мысль — я слушаю.'
        : 'Я всё ещё держу нашу последнюю тему в голове. Если хочешь, можем продолжить с того места, где остановились.';
    }

    const thought: ProactiveThought = {
      id: `thought_${Date.now().toString(36)}`,
      text,
      expression,
      title: 'Инициатива',
      category,
      timeOfDayLabel: time.label,
      triggerReason: reason,
      timestamp: now
    };
    this.lastThoughtTime = now;
    this.thoughtHistory.unshift(thought);
    this.thoughtHistory = this.thoughtHistory.slice(0, 20);
    this.state.currentActivity = 'сформировала инициативную мысль';
    this.state.lastUpdate = now;
    this.proactiveListeners.forEach(l => l(thought));
    return thought;
  }

  runSpontaneousStep(emotions: EmotionalState) {
    return this.evaluateProactiveThought(emotions);
  }

  triggerDrinkDrPepper() {
    this.state.currentActivity = 'сделала короткий перерыв';
    this.state.lastUpdate = Date.now();
    try { notificationEngine.sendNotification('Короткий перерыв', 'Курису сделала короткий перерыв.', 'system', false); } catch {}
  }

  private schedule() {
    if (typeof window === 'undefined') return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.state.energyLevel = Math.max(20, this.state.energyLevel - 1);
      this.schedule();
    }, 5 * 60 * 1000);
  }
}

export const autonomousEngine = new AutonomousEngine();
