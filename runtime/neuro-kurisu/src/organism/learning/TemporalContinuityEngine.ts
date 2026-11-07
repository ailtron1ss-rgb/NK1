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
const fin=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:typeof v==='string'&&v.trim().length?Number(v):NaN;return Number.isFinite(n)?n:(Number.isFinite(f)?f:0);};
const GAP_CLASSES:readonly TemporalGapClass[]=['none','seconds','minutes','hours','days','weeks','months','years'];
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
    const src:Record<string,unknown>=(raw&&typeof raw==='object')?raw as unknown as Record<string,unknown>:{};
    const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};
    const ctxObj=(read('lastCalendarContext')&&typeof read('lastCalendarContext')==='object')?read('lastCalendarContext') as Record<string,unknown>:{};
    const sessions=Array.isArray(read('sessions'))?(read('sessions') as unknown[]).filter((x):x is Record<string,unknown>=>Boolean(x&&typeof x==='object')).map(s=>({id:typeof s.id==='string'?s.id.slice(0,80):'',startedAt:clampMs(Number(s.startedAt)),endedAt:typeof s.endedAt==='number'&&Number.isFinite(s.endedAt)&&s.endedAt>=0?s.endedAt:null,reason:typeof s.reason==='string'?s.reason.slice(0,160):'',clean:Boolean(s.clean)})).slice(0,128):[];
    // Every ms field is clamped non-negative and the gap class is validated, so a
    // corrupt snapshot cannot produce a negative lifetime or an unknown class that
    // would misreport continuity to the rest of the organism.
    this.state = {
      version: 1,
      firstSeenAt: clampMs(fin(read('firstSeenAt'), base.firstSeenAt)),
      lastCheckpointAt: clampMs(fin(read('lastCheckpointAt'), base.lastCheckpointAt)),
      lastActiveAt: clampMs(fin(read('lastActiveAt'), base.lastActiveAt)),
      lastSessionEndedAt: clampMs(fin(read('lastSessionEndedAt'), base.lastSessionEndedAt)),
      totalActiveMs: clampMs(fin(read('totalActiveMs'), base.totalActiveMs)),
      totalOfflineMs: clampMs(fin(read('totalOfflineMs'), base.totalOfflineMs)),
      sessionCount: Math.max(0, Math.floor(fin(read('sessionCount'), base.sessionCount))),
      interruptionCount: Math.max(0, Math.floor(fin(read('interruptionCount'), base.interruptionCount))),
      currentSessionId: typeof read('currentSessionId')==='string'?(read('currentSessionId') as string).slice(0,80):base.currentSessionId,
      gapSincePreviousMs: clampMs(fin(read('gapSincePreviousMs'), base.gapSincePreviousMs)),
      gapSincePreviousClass: GAP_CLASSES.includes(read('gapSincePreviousClass') as TemporalGapClass)?read('gapSincePreviousClass') as TemporalGapClass:base.gapSincePreviousClass,
      lastGapSummary: typeof read('lastGapSummary')==='string'?(read('lastGapSummary') as string).slice(0,240):base.lastGapSummary,
      lastCalendarContext: {
        now: clampMs(fin(ctxObj.now, base.lastCalendarContext.now)),
        iso: typeof ctxObj.iso==='string'?ctxObj.iso.slice(0,40):base.lastCalendarContext.iso,
        localDate: typeof ctxObj.localDate==='string'?ctxObj.localDate.slice(0,20):base.lastCalendarContext.localDate,
        localTime: typeof ctxObj.localTime==='string'?ctxObj.localTime.slice(0,20):base.lastCalendarContext.localTime,
        timezone: typeof ctxObj.timezone==='string'?ctxObj.timezone.slice(0,80):base.lastCalendarContext.timezone,
        timezoneOffsetMinutes: fin(ctxObj.timezoneOffsetMinutes, base.lastCalendarContext.timezoneOffsetMinutes),
        unixMs: clampMs(fin(ctxObj.unixMs, base.lastCalendarContext.unixMs)),
        dayOfWeek: typeof ctxObj.dayOfWeek==='string'?ctxObj.dayOfWeek.slice(0,20):base.lastCalendarContext.dayOfWeek,
        hour: Math.max(0, Math.min(23, Math.floor(fin(ctxObj.hour, base.lastCalendarContext.hour)))),
      },
      sessions,
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
