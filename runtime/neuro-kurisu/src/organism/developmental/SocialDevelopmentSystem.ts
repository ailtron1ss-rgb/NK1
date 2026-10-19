/** B288 compatibility owner: canonical social-brain state is B288SocialPredictiveSelfOtherBrain. Keep this module until retirement criteria in reports/B288_SOCIAL_DUPLICATE_CONSOLIDATION_MAP_RU.md are satisfied. */
import { randomUUID } from 'node:crypto';

export interface PersonHypothesis {
  id: string;
  label: string;
  probability: number;
  evidence: string[];
  updatedAt: number;
}

export interface SocialPersonModel {
  id: string;
  displayName: string;
  trust: number;
  predictability: number;
  warmth: number;
  guardedness: number;
  beliefs: string[];
  preferences: string[];
  sharedProjects: string[];
  openCommitments: string[];
  conflicts: string[];
  hypotheses: PersonHypothesis[];
  interactionCount: number;
  predictionErrorMean: number;
  lastAt: number;
}

export interface SocialPredictionTicket {
  id: string;
  personId: string;
  predictedNeed: string;
  predictedValence: number;
  confidence: number;
  actualNeed?: string;
  actualValence?: number;
  error?: number;
  resolvedAt?: number;
  at: number;
}

export interface SocialDevelopmentState {
  version: 2;
  persons: SocialPersonModel[];
  predictions: SocialPredictionTicket[];
  repairHistory: Array<{ id: string; personId: string; commitmentId: string; diagnosis: string; compensation: string; at: number }>;
  relationalSelf: Array<{ personId: string; role: string; currentSelfDescription: string; confidence: number; updatedAt: number }>;
  socialPredictionError: number;
  lastContextAt: number;
}

const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export const defaultSocialDevelopment = (): SocialDevelopmentState => ({
  version: 2,
  persons: [],
  predictions: [],
  repairHistory: [],
  relationalSelf: [],
  socialPredictionError: 0.25,
  lastContextAt: 0,
});

function parseNeed(text: string): string {
  if (/помог|сделай|можешь|нужно|please|could you|can you/i.test(text)) return 'assistance';
  if (/почему|как|что|зачем|why|how|what/i.test(text)) return 'information';
  if (/скуч|одиноко|поговор|lonely|talk/i.test(text)) return 'connection';
  return 'dialogue';
}

function parseValence(text: string): number {
  if (/спасибо|отлично|здорово|люблю|great|thanks|love/i.test(text)) return 0.65;
  if (/плохо|страшно|груст|ненавиж|bad|afraid|sad|hate/i.test(text)) return -0.45;
  return 0.05;
}

export class SocialDevelopmentSystem {
  private state = defaultSocialDevelopment();

  restore(input: SocialDevelopmentState | undefined): void {
    this.state = {
      ...defaultSocialDevelopment(),
      ...(input ?? {}),
      version: 2,
      persons: Array.isArray(input?.persons) ? input.persons.slice(0, 64) : [],
      predictions: Array.isArray(input?.predictions) ? input.predictions.slice(0, 256) : [],
      repairHistory: Array.isArray(input?.repairHistory) ? input.repairHistory.slice(0, 128) : [],
      relationalSelf: Array.isArray(input?.relationalSelf) ? input.relationalSelf.slice(0, 64) : [],
    };
  }

  ensurePerson(personId: string, displayName = personId): SocialPersonModel {
    let person = this.state.persons.find(item => item.id === personId);
    if (!person) {
      person = {
        id: personId,
        displayName,
        trust: 0.5,
        predictability: 0.5,
        warmth: 0.5,
        guardedness: 0.35,
        beliefs: [],
        preferences: [],
        sharedProjects: [],
        openCommitments: [],
        conflicts: [],
        hypotheses: [],
        interactionCount: 0,
        predictionErrorMean: 0.25,
        lastAt: Date.now(),
      };
      this.state.persons.unshift(person);
    }
    return person;
  }

  observeTurn(personId: string, text: string, identityContext = 'trusted-contact'): SocialPredictionTicket {
    const person = this.ensurePerson(personId, personId);
    const predictedNeed = parseNeed(text);
    const predictedValence = parseValence(text);
    const ticket: SocialPredictionTicket = {
      id: randomUUID(),
      personId,
      predictedNeed,
      predictedValence,
      confidence: clamp(0.42 + person.trust * 0.32 + person.predictability * 0.16),
      at: Date.now(),
    };
    person.interactionCount += 1;
    person.lastAt = Date.now();
    if (identityContext && !person.beliefs.includes(identityContext)) person.beliefs = [identityContext, ...person.beliefs].slice(0, 24);
    person.hypotheses = [
      { id: randomUUID(), label: predictedNeed, probability: ticket.confidence, evidence: [text.slice(0, 180)], updatedAt: Date.now() },
      ...person.hypotheses,
    ].slice(0, 6);
    this.state.predictions = [ticket, ...this.state.predictions].slice(0, 256);
    this.state.lastContextAt = Date.now();
    return structuredClone(ticket);
  }

  feedback(personId: string, actualNeed: string, actualValence: number, ticketId?: string): number {
    const ticket = ticketId
      ? this.state.predictions.find(item => item.id === ticketId && item.personId === personId)
      : this.state.predictions.find(item => item.personId === personId && item.actualNeed == null);
    if (ticket?.actualNeed != null) return Number(ticket.error ?? 0);
    const person = this.ensurePerson(personId, personId);
    if (!ticket) return 0;
    const valenceError = Math.abs(ticket.predictedValence - actualValence);
    const needError = ticket.predictedNeed === actualNeed ? 0 : 1;
    const error = clamp(needError * 0.7 + valenceError * 0.3);
    ticket.actualNeed = actualNeed;
    ticket.actualValence = actualValence;
    ticket.error = error;
    ticket.resolvedAt = Date.now();
    person.predictionErrorMean = clamp(person.predictionErrorMean * 0.88 + error * 0.12);
    person.predictability = clamp(person.predictability * 0.92 + (1 - error) * 0.08);
    this.state.socialPredictionError = clamp(this.state.socialPredictionError * 0.9 + error * 0.1);
    return error;
  }

  linkSharedProject(personId: string, projectId: string): void {
    const person = this.ensurePerson(personId, personId);
    if (!person.sharedProjects.includes(projectId)) person.sharedProjects = [projectId, ...person.sharedProjects].slice(0, 24);
  }

  linkCommitment(personId: string, commitmentId: string): void {
    const person = this.ensurePerson(personId, personId);
    if (!person.openCommitments.includes(commitmentId)) person.openCommitments = [commitmentId, ...person.openCommitments].slice(0, 24);
  }

  observeOutcome(personId: string, success: number, conflict = false): void {
    const person = this.ensurePerson(personId, personId);
    const result = clamp(success);
    person.trust = clamp(person.trust * 0.9 + result * 0.1);
    person.warmth = clamp(person.warmth * 0.92 + result * 0.08);
    person.guardedness = clamp(1 - person.trust * 0.7 + (conflict ? 0.08 : 0));
    if (conflict) person.conflicts = [`interaction:${Date.now()}`, ...person.conflicts].slice(0, 24);
    this.state.relationalSelf = [
      { personId, role: 'trusted-contact', currentSelfDescription: person.trust > 0.7 ? 'direct-and-supportive' : 'cautious-and-observant', confidence: person.predictability, updatedAt: Date.now() },
      ...this.state.relationalSelf.filter(item => item.personId !== personId),
    ].slice(0, 64);
  }

  repairCommitment(personId: string, commitmentId: string, diagnosis: string, compensation: string): void {
    const person = this.ensurePerson(personId, personId);
    person.openCommitments = person.openCommitments.filter(id => id !== commitmentId);
    this.state.repairHistory = [{ id: randomUUID(), personId, commitmentId, diagnosis, compensation, at: Date.now() }, ...this.state.repairHistory].slice(0, 128);
    person.trust = clamp(person.trust * 0.94 + 0.04);
  }

  socialBias(personId: string): number {
    const person = this.state.persons.find(item => item.id === personId);
    if (!person) return 0;
    return clamp((person.trust - 0.5) * 0.08 + (person.predictability - 0.5) * 0.04);
  }

  summary(){const user=this.state.persons.find(item=>item.id==='user');return{version:2,personCount:this.state.persons.length,socialPredictionError:this.state.socialPredictionError,predictionCount:this.state.predictions.length,repairCount:this.state.repairHistory.length,user:user?{trust:user.trust,predictability:user.predictability,warmth:user.warmth,guardedness:user.guardedness,interactionCount:user.interactionCount,predictionErrorMean:user.predictionErrorMean,openCommitments:user.openCommitments.length,conflicts:user.conflicts.length}:null};}
  snapshot(): SocialDevelopmentState { return structuredClone(this.state); }
}
