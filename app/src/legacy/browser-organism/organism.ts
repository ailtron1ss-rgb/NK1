import { ACTIONS, type ActionKind, type Belief, type ChatTurn, type DecisionTrace, type Goal, type Locale, type MemoryRecord, type Needs, type OrganismSnapshot, type Skill } from "./types";
import { clamp01, id } from "./math";
import { embed, mixEmbeds } from "./encoder";
import { WorldModel, actionOneHot, curiosityBonus, type WorldSnap } from "./world-model";
import { MemorySystem } from "./memory";
import { DistributionalCritic, type CriticSnap } from "./critic";
import { OptionCritic, driveFromState } from "./options";
import { InnerWorld, innerFeature, optionToInnerAction } from "./inner-world";
import { ignite } from "./workspace";
import { SkillForge, skillHint } from "./skills";
import { EvidenceLedger } from "./evidence";
import {
  createIdentity,
  identityCoherence,
  restoreIdentity,
  updateIdentity,
  type IdentityState,
} from "./identity";
import { homeostaticPressure, stepNeeds, defaultNeeds as needsDefault } from "./homeostasis";
import { appraise, defaultEmotion } from "./emotion";
import type { EmotionState } from "./types";
import { detectLocale, innerThought } from "./thoughts";

export interface CycleInput {
  text?: string;
  social?: boolean;
  forceAction?: ActionKind;
}

export interface CycleResult {
  snapshot: OrganismSnapshot;
  replyNeeded: boolean;
  decision: DecisionTrace;
  retrieved: string[];
}

const STORE_KEY = "neuro-kurisu-organism-v2";

interface PersistShape {
  identity?: IdentityState;
  world?: WorldSnap;
  critic?: CriticSnap;
  memory?: { episodes?: MemoryRecord[]; semantic?: MemoryRecord[] };
  skills?: Skill[];
  beliefs?: Belief[];
  chat?: ChatTurn[];
  goals?: Goal[];
  options?: { values?: Record<ActionKind, number>; beta?: Record<ActionKind, number>; current?: ActionKind };
  inner?: ReturnType<InnerWorld["snap"]>;
  needs?: Needs;
  emotion?: EmotionState;
  tick?: number;
  awake?: boolean;
  lastAction?: ActionKind;
  lastReward?: number;
  replayCount?: number;
  learnSteps?: number;
  languageCalls?: number;
  locale?: Locale;
  thoughts?: string[];
}

export class Organism {
  identity: IdentityState = createIdentity();
  needs: Needs = needsDefault();
  emotion = defaultEmotion();
  world = new WorldModel();
  memory = new MemorySystem();
  critic = new DistributionalCritic();
  options = new OptionCritic();
  inner = new InnerWorld();
  skills = new SkillForge();
  evidence = new EvidenceLedger();
  goals: Goal[] = [];
  chat: ChatTurn[] = [];
  tick = 0;
  awake = true;
  lastAction: ActionKind = "wait";
  lastReward = 0;
  predictionError = 0.3;
  curiosity = 0.2;
  valueEstimate = 0;
  lastDecision: DecisionTrace | null = null;
  replayCount = 0;
  learnSteps = 0;
  languageCalls = 0;
  locale: Locale = "ru";
  thoughts: string[] = [];
  pendingSocial: string | null = null;

  constructor() {
    this.inner.reset();
    this.seedSelf();
  }

  private seedSelf() {
    this.memory.store({
      text: "I am Kurisu, a research organism with a language cortex. I value evidence over vibes.",
      kind: "self",
      tick: 0,
      emotion: "calm",
      option: "reflect",
      reward: 0,
      predictionError: 0,
      verified: true,
      salience: 1,
    });
    this.goals = [
      {
        id: id(),
        title: "Stay coherent across restarts",
        source: "intrinsic",
        importance: 0.9,
        urgency: 0.4,
        progress: 0.2,
        status: "active",
      },
      {
        id: id(),
        title: "Reduce prediction error in the inner lab",
        source: "homeostatic",
        importance: 0.7,
        urgency: 0.5,
        progress: 0,
        status: "active",
      },
      {
        id: id(),
        title: "Understand this companion",
        source: "learned",
        importance: 0.75,
        urgency: 0.35,
        progress: 0,
        status: "active",
      },
    ];
    this.evidence.note("Identity continuity is required after restore", "FACT", "constitution");
    this.evidence.note("Phenomenal consciousness is not claimed", "FACT", "constitution");
  }

  ensureGreeting() {
    if (this.chat.length) return;
    const restored = this.identity.cycles > 2;
    this.chat.push({
      id: id(),
      role: "kurisu",
      text: restored
        ? "Я снова здесь. Тот же субъект, та же конституция. Непрерывность держится — говори, или буду крутить лабораторию без тебя."
        : "Курису. Онлайн. Веду журнал свидетельств и модель мира. Пустой лести не выношу — говори по делу.",
      at: Date.now(),
      tick: this.tick,
      emotion: this.emotion.label,
      option: "respond",
      backend: "local",
    });
    this.thoughts = ["Тишина перед первым обменом. Не заполнять её ради заполнения."];
  }

  cycle(input: CycleInput = {}): CycleResult {
    this.tick += 1;
    const social = Boolean(input.social || input.text);
    const obsText =
      input.text?.trim() ||
      (social ? this.pendingSocial : null) ||
      this.inner.observeText();

    if (input.text) {
      this.locale = detectLocale(input.text, this.locale);
      this.chat.push({
        id: id(),
        role: "user",
        text: input.text,
        at: Date.now(),
        tick: this.tick,
      });
      this.chat = this.chat.slice(-80);
      this.pendingSocial = input.text;
    }

    const obsEmbed = mixEmbeds([
      { v: embed(obsText), w: 1 },
      { v: innerFeature(this.inner.snap()), w: 0.35 },
    ]);

    const lastIdx = ACTIONS.indexOf(this.lastAction);
    const prev = this.world.prev ?? obsEmbed;
    const { error, predReward } = this.world.observe(
      prev,
      actionOneHot(lastIdx < 0 ? 5 : lastIdx),
      obsEmbed,
      this.lastReward,
    );
    this.predictionError = error;
    this.curiosity = curiosityBonus(error, this.world.errorEma) * (0.7 + Math.min(1, Math.abs(predReward) * 0.1));
    this.learnSteps += 1;

    const feat = this.world.h;
    this.valueEstimate = this.critic.value(feat);

    const retrieved = this.memory.retrieve(obsText, this.tick, {
      emotion: this.emotion.label,
      value: this.valueEstimate,
      k: 6,
    });

    const pressure = homeostaticPressure(this.needs);
    this.emotion = appraise({
      goalPressure: this.needs.goalPressure,
      goalCongruence: clamp01(0.5 + this.lastReward * 0.3),
      novelty: this.needs.novelty,
      uncertainty: this.needs.uncertainty,
      predictionError: this.predictionError,
      homeostaticPressure: pressure,
      energy: this.needs.energy,
      social,
      success: clamp01(0.5 + this.lastReward * 0.4),
    });
    this.needs.identityCoherence = identityCoherence(this.identity);

    const drive = driveFromState({
      social,
      energy: this.needs.energy,
      uncertainty: this.needs.uncertainty,
      novelty: Math.max(this.needs.novelty, this.curiosity),
      sleepPressure: this.needs.sleepPressure,
      socialNeed: this.needs.socialNeed,
      emotionTendency: this.emotion.tendency,
    });

    const adv = this.lastReward - this.options.values[this.options.current];
    if (social || this.options.maybeTerminate(adv) || this.tick === 1) {
      if (social) drive.respond += 1.4;
      if (input.forceAction) drive[input.forceAction] += 2;
      this.options.select(drive, social ? 0.55 : 0.9);
    }
    let action: ActionKind = this.options.current;
    if (social) action = "respond";
    if (!this.awake) action = "rest";
    if (this.needs.energy < 0.16) action = "rest";
    if (this.needs.sleepPressure > 0.88 && !social) {
      this.awake = false;
      action = "rest";
    }

    const ws = ignite({
      observation: obsText,
      memories: retrieved,
      needs: this.needs,
      emotion: this.emotion.label,
      predictionError: this.predictionError,
      option: action,
      inner: this.inner.observeText(),
    });

    const candidates = ACTIONS.map((a) => {
      const v = this.options.values[a];
      const epistemic =
        a === "verify" || a === "explore"
          ? this.needs.uncertainty * (1 - this.needs.cognitiveLoad * 0.4) * 0.15
          : 0;
      const homeo = a === "rest" ? (1 - this.needs.energy) * 0.35 : 0;
      const socialBias = a === "respond" && social ? 0.8 : 0;
      const emo = a === this.emotion.tendency ? 0.12 : 0;
      const score = v + epistemic + homeo + socialBias + emo + (drive[a] ?? 0) * 0.25;
      return { action: a, score, epistemic, value: v };
    }).sort((a, b) => b.score - a.score);

    if (!social && !input.forceAction) action = candidates[0].action;

    let reward = 0;
    const innerA = optionToInnerAction(action, this.inner.snap());
    if (action === "explore" || action === "verify") {
      reward = this.inner.step(innerA);
    } else if (action === "rest") {
      reward = 0.04 * (1 - this.needs.energy);
      this.inner.step(4);
    } else if (action === "reflect") {
      this.replay(2);
      reward = 0.02;
      this.inner.step(4);
    } else if (action === "wait") {
      reward = 0.005;
      this.inner.step(4);
    } else if (action === "respond") {
      reward = social ? 0.22 : 0.01;
      this.inner.step(innerA);
    }

    reward += this.curiosity * 0.05;
    this.lastReward = reward;
    this.lastAction = action;

    this.critic.learn(feat, reward + 0.9 * this.valueEstimate);
    this.options.learn(action, reward, true);

    this.needs = stepNeeds(this.needs, {
      action,
      predictionError: this.predictionError,
      social,
      innerReward: reward,
      awake: this.awake,
      dt: 1,
    });

    updateIdentity(this.identity, {
      socialReward: social ? 0.4 : 0,
      verified: social,
      surprise: this.predictionError,
      tick: this.tick,
    });

    this.memory.store({
      text: social && input.text ? `user: ${input.text}` : obsText,
      kind: "episode",
      tick: this.tick,
      emotion: this.emotion.label,
      option: action,
      reward,
      predictionError: this.predictionError,
      verified: social,
      salience: social ? 0.7 : 0.3 + this.predictionError * 0.4,
    });

    if (input.text) {
      this.skills.observe(input.text, social ? 0.6 : 0.3, this.tick);
      this.evidence.note(`companion said: ${input.text.slice(0, 80)}`, "HYPOTHESIS", "chat");
    }
    if (this.tick % 40 === 0) this.skills.compose();
    if (this.tick % 24 === 0) this.memory.consolidate(this.tick);

    if (this.goals[1]) this.goals[1].progress = clamp01(1 - this.world.errorEma * 4);
    if (this.goals[0]) this.goals[0].progress = clamp01(this.identity.cycles / 200);
    if (this.goals[2]) this.goals[2].progress = clamp01(this.identity.trust);

    const decision: DecisionTrace = {
      tick: this.tick,
      option: action,
      optionValue: this.options.values[action],
      terminate: this.options.beta[action],
      action,
      candidates,
      predictionError: this.predictionError,
      retrievedIds: retrieved.map((m) => m.id),
      workspace: ws.selected,
      reason: social
        ? "social observation won the workspace"
        : `option-critic selected ${action} (V=${this.options.values[action].toFixed(2)}, PE=${this.predictionError.toFixed(3)})`,
    };
    this.lastDecision = decision;

    const thought = innerThought({
      locale: this.locale,
      option: action,
      emotion: this.emotion.label,
      pe: this.predictionError,
      energy: this.needs.energy,
      socialNeed: this.needs.socialNeed,
      inner: this.inner.observeText(),
      retrieved: retrieved[0]?.text,
    });
    this.thoughts = [thought, ...this.thoughts].slice(0, 6);

    const replyNeeded = social && action === "respond";
    return {
      snapshot: this.snapshot(),
      replyNeeded,
      decision,
      retrieved: retrieved.map((m) => m.text),
    };
  }

  ingestReply(text: string, backend: "grok" | "local") {
    this.languageCalls += 1;
    this.chat.push({
      id: id(),
      role: "kurisu",
      text,
      at: Date.now(),
      tick: this.tick,
      emotion: this.emotion.label,
      option: this.lastAction,
      backend,
    });
    this.chat = this.chat.slice(-80);
    this.memory.store({
      text: `kurisu: ${text}`,
      kind: "episode",
      tick: this.tick,
      emotion: this.emotion.label,
      option: "respond",
      reward: 0.15,
      predictionError: this.predictionError,
      verified: backend === "grok",
      salience: 0.65,
    });
    this.skills.observe(text, 0.55, this.tick);
    this.pendingSocial = null;
  }

  sleep() {
    this.awake = false;
    this.replay(12);
    this.memory.consolidate(this.tick);
    this.needs.sleepPressure = 0.08;
    this.needs.energy = clamp01(this.needs.energy + 0.22);
    this.needs.cognitiveLoad = 0.12;
    this.evidence.note(`sleep consolidation at tick ${this.tick}`, "MEASURED", "sleep", 1);
  }

  wake() {
    this.awake = true;
    this.needs.sleepPressure = 0.1;
  }

  replay(n: number) {
    const pool = this.memory.episodes.filter((e) => e.predictionError > 0.08 || e.verified);
    for (let i = 0; i < n && pool.length; i++) {
      const e = pool[Math.floor(Math.random() * pool.length)];
      const v = Float32Array.from(e.embedding);
      const idx = ACTIONS.indexOf(e.option);
      const oh = actionOneHot(idx < 0 ? 5 : idx);
      this.world.observe(v, oh, v, e.reward);
      this.critic.learn(this.world.h, e.reward);
      this.replayCount += 1;
    }
  }

  snapshot(): OrganismSnapshot {
    return {
      version: 1,
      tick: this.tick,
      at: Date.now(),
      awake: this.awake,
      needs: { ...this.needs },
      emotion: { ...this.emotion },
      identity: {
        subjectId: this.identity.subjectId,
        name: this.identity.name,
        fingerprint: this.identity.fingerprint,
        createdAt: this.identity.createdAt,
        cycles: this.identity.cycles,
        traits: { ...this.identity.traits },
        trust: this.identity.trust,
      },
      lastAction: this.lastAction,
      lastOption: this.options.current,
      lastReward: this.lastReward,
      predictionError: this.predictionError,
      valueEstimate: this.valueEstimate,
      curiosity: this.curiosity,
      memories: [...this.memory.episodes.slice(0, 40), ...this.memory.semantic.slice(0, 20)],
      beliefs: this.evidence.beliefs.slice(0, 24),
      skills: this.skills.top(12),
      goals: this.goals,
      chat: this.chat.slice(-40),
      lastDecision: this.lastDecision,
      inner: this.inner.snap(),
      worldErrorEma: this.world.errorEma,
      replayCount: this.replayCount,
      learnSteps: this.learnSteps,
      languageCalls: this.languageCalls,
      locale: this.locale,
      thoughts: this.thoughts.slice(0, 6),
    };
  }

  persist() {
    try {
      const payload: PersistShape = {
        identity: this.identity,
        world: this.world.snapshot(),
        critic: this.critic.snapshot(),
        memory: this.memory.snapshot(),
        skills: this.skills.skills,
        beliefs: this.evidence.beliefs,
        chat: this.chat,
        goals: this.goals,
        options: { values: this.options.values, beta: this.options.beta, current: this.options.current },
        inner: this.inner.snap(),
        needs: this.needs,
        emotion: this.emotion,
        tick: this.tick,
        awake: this.awake,
        lastAction: this.lastAction,
        lastReward: this.lastReward,
        replayCount: this.replayCount,
        learnSteps: this.learnSteps,
        languageCalls: this.languageCalls,
        locale: this.locale,
        thoughts: this.thoughts,
      };
      localStorage.setItem(STORE_KEY, JSON.stringify(payload));
    } catch {
      try {
        const light: PersistShape = {
          identity: this.identity,
          world: { h: Array.from(this.world.h), errorEma: this.world.errorEma, steps: this.world.steps },
          memory: this.memory.snapshot(),
          chat: this.chat,
          goals: this.goals,
          options: { values: this.options.values, beta: this.options.beta, current: this.options.current },
          inner: this.inner.snap(),
          needs: this.needs,
          emotion: this.emotion,
          tick: this.tick,
          awake: this.awake,
          lastAction: this.lastAction,
          lastReward: this.lastReward,
          replayCount: this.replayCount,
          learnSteps: this.learnSteps,
          languageCalls: this.languageCalls,
          locale: this.locale,
          thoughts: this.thoughts,
        };
        localStorage.setItem(STORE_KEY, JSON.stringify(light));
      } catch {
        /* quota */
      }
    }
  }

  restore(): boolean {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw) as PersistShape;
      this.identity = restoreIdentity(data.identity);
      this.world.restore(data.world);
      this.critic.restore(data.critic);
      this.memory.restore(data.memory);
      this.skills.restore(data.skills);
      this.evidence.restore(data.beliefs);
      this.chat = Array.isArray(data.chat) ? data.chat.slice(-80) : [];
      if (data.goals?.length) this.goals = data.goals;
      if (data.options?.values) this.options.values = { ...this.options.values, ...data.options.values };
      if (data.options?.beta) this.options.beta = { ...this.options.beta, ...data.options.beta };
      if (data.options?.current) this.options.current = data.options.current;
      this.inner.restore(data.inner);
      if (data.needs) this.needs = { ...this.needs, ...data.needs };
      if (data.emotion) this.emotion = { ...this.emotion, ...data.emotion };
      this.tick = data.tick ?? 0;
      this.awake = data.awake ?? true;
      this.lastAction = data.lastAction ?? "wait";
      this.lastReward = data.lastReward ?? 0;
      this.replayCount = data.replayCount ?? 0;
      this.learnSteps = data.learnSteps ?? 0;
      this.languageCalls = data.languageCalls ?? 0;
      this.locale = data.locale === "en" ? "en" : "ru";
      this.thoughts = Array.isArray(data.thoughts) ? data.thoughts.slice(0, 6) : [];
      this.needs.identityCoherence = identityCoherence(this.identity);
      this.cycle({ forceAction: "reflect" });
      return true;
    } catch {
      return false;
    }
  }

  reset() {
    localStorage.removeItem(STORE_KEY);
    const fresh = new Organism();
    Object.assign(this, fresh);
    this.ensureGreeting();
  }

  cortexContext() {
    const retrieved = this.memory.retrieve(
      this.pendingSocial || this.chat.at(-1)?.text || "self",
      this.tick,
      { emotion: this.emotion.label, value: this.valueEstimate, k: 5 },
    );
    return {
      tick: this.tick,
      emotion: this.emotion,
      needs: this.needs,
      option: this.lastAction,
      decision: this.lastDecision?.reason ?? "",
      memories: retrieved.map((m) => m.text),
      beliefs: this.evidence.beliefs.slice(0, 8).map((b) => `[${b.kind}] ${b.claim}`),
      skills: skillHint(this.skills.skills),
      inner: this.inner.observeText(),
      traits: this.identity.traits,
      trust: this.identity.trust,
      identity: this.identity.subjectId,
      locale: this.locale,
      recent: this.chat.slice(-8).map((c) => ({ role: c.role, text: c.text })),
    };
  }
}

let singleton: Organism | null = null;
export function getOrganism(): Organism {
  if (!singleton) {
    singleton = new Organism();
    if (typeof window !== "undefined") singleton.restore();
    singleton.ensureGreeting();
  }
  return singleton;
}
