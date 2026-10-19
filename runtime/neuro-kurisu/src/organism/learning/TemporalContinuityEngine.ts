export type TemporalGapClass = 'none'|'seconds'|'minutes'|'hours'|'days'|'weeks'|'months'|'years';

export interface TemporalSession {
  id: string;
  startedAt: number;
  endedAt: number|null;
  reason: string;
  clean: boolean;
}

export interface TemporalContinuityState {
  version: 1;
  firstSeenAt: number;
  lastCheckpointAt: number;
  lastActiveAt: number;
  lastSessionEndedAt: number;
  totalActiveMs: number;
  totalOfflineMs: number;
  sessionCount: number;
  interruptionCount: number;
  currentSessionId: string;
  gapSincePreviousMs: number;
  gapSincePreviousClass: TemporalGapClass;
  lastGapSummary: string;
  lastCalendarContext: CalendarContext;
  sessions: TemporalSession[];
}

export interface CalendarContext {
  now: number;
  iso: string;
  localDate: string;
  localTime: string;
  timezone: string;
  timezoneOffsetMinutes: number;
  unixMs: number;
  dayOfWeek: string;
  hour: number;
}

const clampMs = (value:number) => Number.isFinite(value) ? Math.max(0, value) : 0;
const gapClass = (ms:number): TemporalGapClass => {
  if (ms < 5_000) return 'none';
  if (ms < 60_000) return 'seconds';
  if (ms < 3_600_000) return 'minutes';
  if (ms < 86_400_000) return 'hours';
  if (ms < 7 * 86_400_000) return 'days';
  if (ms < 31 * 86_400_000) return 'weeks';
  if (ms < 366 * 86_400_000) return 'months';
  return 'years';
};

let lastCalendarAt = Number.NaN;
let lastCalendarContext: CalendarContext|undefined;

export function calendarContext(at = Date.now()): CalendarContext {
  if (lastCalendarContext && lastCalendarAt === at) return { ...lastCalendarContext };
  const d = new Date(at);
  const pad = (n:number) => String(n).padStart(2,'0');
  const localDate = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const localTime = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const context = {
    now: at,
    iso: d.toISOString(),
    localDate,
    localTime,
    timezone,
    timezoneOffsetMinutes: -d.getTimezoneOffset(),
    unixMs: at,
    dayOfWeek: d.toLocaleDateString(undefined,{weekday:'long'}),
    hour: d.getHours(),
  };
  lastCalendarAt = at;
  lastCalendarContext = context;
  return { ...context };
}

export function defaultTemporalContinuity(at = Date.now()): TemporalContinuityState {
  const context = calendarContext(at);
  return {
    version: 1,
    firstSeenAt: at,
    lastCheckpointAt: at,
    lastActiveAt: at,
    lastSessionEndedAt: 0,
    totalActiveMs: 0,
    totalOfflineMs: 0,
    sessionCount: 0,
    interruptionCount: 0,
    currentSessionId: '',
    gapSincePreviousMs: 0,
    gapSincePreviousClass: 'none',
    lastGapSummary: 'initial-session',
    lastCalendarContext: context,
    sessions: [],
  };
}

export class TemporalContinuityEngine {
  private state: TemporalContinuityState = defaultTemporalContinuity();

  restore(raw: Partial<TemporalContinuityState>|null|undefined, now = Date.now()): void {
    const base = defaultTemporalContinuity(now);
    this.state = {
      ...base,
      ...(raw ?? {}),
      lastCalendarContext: { ...base.lastCalendarContext, ...(raw?.lastCalendarContext ?? {}) },
      sessions: Array.isArray(raw?.sessions) ? raw!.sessions!.slice(0,128) : [],
    };
  }

  startSession(at = Date.now(), reason = 'process-start'): TemporalContinuityState {
    const prior = this.state.lastCheckpointAt || this.state.lastActiveAt || this.state.firstSeenAt || at;
    const gap = Math.max(0, at - prior);
    const previousWasOpen = Boolean(this.state.currentSessionId);
    if (gap > 0 && this.state.sessionCount > 0) {
      this.state.totalOfflineMs += gap;
      this.state.gapSincePreviousMs = gap;
      this.state.gapSincePreviousClass = gapClass(gap);
      this.state.lastGapSummary = `${this.describeGap(gap)} since previous checkpoint`;
      if (previousWasOpen) this.state.interruptionCount += 1;
    } else {
      this.state.gapSincePreviousMs = 0;
      this.state.gapSincePreviousClass = 'none';
      this.state.lastGapSummary = 'no-gap';
    }
    this.state.currentSessionId = `${at.toString(36)}-${Math.random().toString(36).slice(2,10)}`;
    this.state.sessionCount += 1;
    this.state.lastActiveAt = at;
    this.state.lastCheckpointAt = at;
    this.state.lastSessionEndedAt = 0;
    this.state.lastCalendarContext = calendarContext(at);
    this.state.sessions = [{ id:this.state.currentSessionId, startedAt:at, endedAt:null, reason, clean:false }, ...this.state.sessions].slice(0,128);
    return this.snapshot();
  }

  heartbeat(at = Date.now()): void {
    const delta = Math.max(0, at - this.state.lastActiveAt);
    this.state.totalActiveMs += Math.min(delta, 10 * 60_000);
    this.state.lastActiveAt = at;
    this.state.lastCheckpointAt = at;
    this.state.lastCalendarContext = calendarContext(at);
  }

  checkpoint(at = Date.now()): void {
    this.heartbeat(at);
  }

  endSession(at = Date.now(), reason = 'shutdown', clean = true): TemporalContinuityState {
    this.heartbeat(at);
    const session = this.state.sessions.find(s => s.id === this.state.currentSessionId);
    if (session) {
      session.endedAt = at;
      session.clean = clean;
      session.reason = reason;
    }
    this.state.lastSessionEndedAt = at;
    this.state.currentSessionId = '';
    this.state.lastCheckpointAt = at;
    this.state.lastCalendarContext = calendarContext(at);
    return this.snapshot();
  }

  currentContext(at = Date.now()): CalendarContext { return calendarContext(at); }
  snapshot(): TemporalContinuityState { return structuredClone(this.state); }

  describeGap(ms:number): string {
    const safe = clampMs(ms);
    if (safe < 60_000) return `${Math.round(safe/1000)} seconds`;
    if (safe < 3_600_000) return `${Math.round(safe/60_000)} minutes`;
    if (safe < 86_400_000) return `${Math.round(safe/3_600_000)} hours`;
    if (safe < 7*86_400_000) return `${Math.round(safe/86_400_000)} days`;
    if (safe < 31*86_400_000) return `${Math.round(safe/(7*86_400_000))} weeks`;
    if (safe < 366*86_400_000) return `${Math.round(safe/(30*86_400_000))} months`;
    return `${(safe/(365*86_400_000)).toFixed(1)} years`;
  }
}
