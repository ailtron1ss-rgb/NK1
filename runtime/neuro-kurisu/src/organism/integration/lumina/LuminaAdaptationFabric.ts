import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { sha256Stable } from '../../core/StableSerialization.ts';
import { tokenizeUnicodeTerms } from '../../core/UnicodeTokenizer.ts';

export type LuminaToolRisk = 'read_only' | 'write_local' | 'execute' | 'browser' | 'outbound' | 'self_modifying';
export type LuminaChannel = 'ui' | 'http' | 'mcp' | 'discord' | 'whatsapp' | 'telegram' | 'sdk' | 'generic';

export interface LuminaCapabilityProfile {
  id: string;
  label: string;
  risk: LuminaToolRisk;
  channels: LuminaChannel[];
  enabled: boolean;
  requiresConfirmation: boolean;
  adapter: string;
  notes: string;
}

export interface LuminaSearchRecord {
  id: string;
  kind: 'memory' | 'goal' | 'skill' | 'belief' | 'trace' | 'identity' | 'chat' | 'tool';
  text: string;
  at: number;
  source: string;
}

export interface LuminaSearchHit extends LuminaSearchRecord {
  score: number;
  matchedTerms: string[];
}

export interface LuminaIdempotencyEntry {
  key: string;
  createdAt: number;
  expiresAt: number;
  resultHash?: string;
  result?: unknown;
}

export interface LuminaAdaptationState {
  version: 1;
  source: { name: string; version: string; integratedAt: string; mode: 'canonical-adapter' };
  capabilities: LuminaCapabilityProfile[];
  search: { queries: number; hits: number; indexedRecords: number; lastQuery: string; lastAt: number };
  idempotency: { checks: number; hits: number; commits: number; entries: LuminaIdempotencyEntry[] };
  channels: Record<LuminaChannel, { enabled: boolean; requests: number; lastAt: number }>;
  browser: { provider: 'playwright-adapter'; available: boolean; sessionCount: number; lastAt: number; note: string };
  voice: { tts: boolean; stt: boolean; lastAction: string; lastAt: number };
  policy: { allowed: number; denied: number; confirmationRequired: number; lastCapability: string; lastChannel: string; lastReason: string };
}

const sha256 = (value: unknown) => sha256Stable(value, 'legacy');
const tokenize = (value: string) => tokenizeUnicodeTerms(value, { includeUnderscore: true, includeHyphen: true });

export function defaultLuminaAdaptationState(): LuminaAdaptationState {
  const channel = (enabled=true) => ({ enabled, requests: 0, lastAt: 0 });
  return {
    version: 1,
    source: { name: 'lumina-main', version: 'adapted-surface-1', integratedAt: '2026-10-08', mode: 'canonical-adapter' },
    capabilities: [
      { id:'memory.search.exact', label:'Exact memory/project search', risk:'read_only', channels:['ui','http','sdk','mcp'], enabled:true, requiresConfirmation:false, adapter:'CanonicalSearchIndex', notes:'Lexical/exact retrieval over canonical runtime projections.' },
      { id:'tool.read', label:'Read canonical state', risk:'read_only', channels:['ui','http','sdk','mcp'], enabled:true, requiresConfirmation:false, adapter:'CapabilityGateway', notes:'Read-only diagnostics and snapshots.' },
      { id:'tool.write_local', label:'Write local runtime state', risk:'write_local', channels:['ui','http','sdk'], enabled:true, requiresConfirmation:true, adapter:'ActionGateway', notes:'Uses existing canonical persistence owner.' },
      { id:'tool.execute', label:'Execute governed action', risk:'execute', channels:['ui','http','sdk','mcp'], enabled:true, requiresConfirmation:true, adapter:'ActionGateway+OutcomeVerification', notes:'Outcome must be verified before learning promotion.' },
      { id:'browser.session', label:'Browser session adapter', risk:'browser', channels:['ui','http','sdk','mcp'], enabled:true, requiresConfirmation:true, adapter:'BrowserPolicy/Playwright-compatible seam', notes:'Policy and session seam are active; external Playwright worker remains optional.' },
      { id:'channel.outbound', label:'Outbound channel envelope', risk:'outbound', channels:['ui','http','sdk','mcp','discord','whatsapp','telegram'], enabled:true, requiresConfirmation:true, adapter:'WillChannelAdapter', notes:'Outbound is explicit, auditable and ACK/replay aware.' },
      { id:'self.modify.proposal', label:'Self-modification proposal', risk:'self_modifying', channels:['ui','http','sdk'], enabled:true, requiresConfirmation:true, adapter:'DevelopmentalGovernance', notes:'Proposal only unless existing promotion gates approve.' },
    ],
    search: { queries:0, hits:0, indexedRecords:0, lastQuery:'', lastAt:0 },
    idempotency: { checks:0, hits:0, commits:0, entries:[] },
    channels: {
      ui:channel(true), http:channel(true), mcp:channel(true), discord:channel(true), whatsapp:channel(true), telegram:channel(true), sdk:channel(true), generic:channel(true),
    },
    browser: { provider:'playwright-adapter', available:false, sessionCount:0, lastAt:0, note:'Policy/session seam is canonical; no hidden browser owner is created.' },
    voice: { tts:true, stt:true, lastAction:'', lastAt:0 },
    policy: { allowed:0, denied:0, confirmationRequired:0, lastCapability:'', lastChannel:'', lastReason:'' },
  };
}

export class LuminaAdaptationFabric {
  private state = defaultLuminaAdaptationState();
  restore(raw?: Partial<LuminaAdaptationState> | null) {
    const d = defaultLuminaAdaptationState();
    const input = raw ?? {};
    this.state = {
      ...d,
      ...input,
      source: { ...d.source, ...(input.source ?? {}) },
      capabilities: Array.isArray(input.capabilities) && input.capabilities.length ? input.capabilities as LuminaCapabilityProfile[] : d.capabilities,
      search: { ...d.search, ...(input.search ?? {}) },
      idempotency: { ...d.idempotency, ...(input.idempotency ?? {}), entries: Array.isArray(input.idempotency?.entries) ? input.idempotency.entries.slice(-512) : d.idempotency.entries },
      channels: { ...d.channels, ...(input.channels ?? {}) },
      browser: { ...d.browser, ...(input.browser ?? {}) },
      voice: { ...d.voice, ...(input.voice ?? {}) },
      policy: { ...d.policy, ...(input.policy ?? {}) },
    };
  }
  snapshot(): LuminaAdaptationState { return structuredClone(this.state); }
  capabilities(channel?: LuminaChannel) {
    const rows = this.state.capabilities.filter(c => !channel || c.channels.includes(channel));
    return rows.map(c => ({ ...c }));
  }
  authorizeCapability(id:string, channel:LuminaChannel, confirmed=false) {
    const profile=this.state.capabilities.find(c=>c.id===id);
    this.state.policy.lastCapability=id; this.state.policy.lastChannel=channel;
    if(!profile){ this.state.policy.denied++; this.state.policy.lastReason='unknown-capability'; return {allowed:false,reason:'unknown-capability',capability:id,channel}; }
    if(!profile.enabled){ this.state.policy.denied++; this.state.policy.lastReason='disabled'; return {allowed:false,reason:'disabled',capability:id,channel}; }
    if(!profile.channels.includes(channel)){ this.state.policy.denied++; this.state.policy.lastReason='channel-not-allowed'; return {allowed:false,reason:'channel-not-allowed',capability:id,channel}; }
    if(profile.requiresConfirmation && !confirmed){ this.state.policy.confirmationRequired++; this.state.policy.lastReason='confirmation-required'; return {allowed:false,reason:'confirmation-required',capability:id,channel}; }
    this.state.policy.allowed++; this.state.policy.lastReason='allowed';
    return {allowed:true,reason:'allowed',capability:id,channel,risk:profile.risk};
  }
  setCapabilityEnabled(id:string, enabled:boolean){
    const row=this.state.capabilities.find(c=>c.id===id); if(!row) return false; row.enabled=Boolean(enabled); return true;
  }
  async validateWebTarget(rawUrl:string){
    let url:URL;
    try{ url=new URL(rawUrl); }catch{return {allowed:false,reason:'invalid-url',url:rawUrl};}
    if(!['https:','http:'].includes(url.protocol)) return {allowed:false,reason:'scheme-not-allowed',url:url.toString()};
    const host=url.hostname.toLowerCase();
    const forbiddenHost=/^(localhost|.*\.localhost)$/i.test(host) || host.endsWith('.local');
    if(forbiddenHost) return {allowed:false,reason:'local-hostname',host};
    const addrs=[]; try{ for(const row of await lookup(host,{all:true})) addrs.push(row.address); }catch{return {allowed:false,reason:'dns-resolution-failed',host};}
    const blocked=(addr:string)=>{
      const version=isIP(addr);
      if(version===4){ const o=addr.split('.').map(Number); return o[0]===10 || (o[0]===172&&o[1]>=16&&o[1]<=31) || (o[0]===192&&o[1]===168) || o[0]===127 || (o[0]===169&&o[1]===254) || o[0]>=224 || (o[0]===100&&o[1]>=64&&o[1]<=127) || o[0]===0; }
      if(version===6){ const h=addr.toLowerCase(); return h==='::1' || h==='::' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80:') || h.startsWith('ff'); }
      return true;
    };
    const denied=addrs.find(blocked); if(denied) return {allowed:false,reason:'private-or-special-address',host,addresses:addrs,blockedAddress:denied};
    return {allowed:true,url:url.toString(),host,addresses:addrs};
  }
  recordChannel(channel: LuminaChannel) {
    const slot = this.state.channels[channel] ?? { enabled:true, requests:0, lastAt:0 };
    slot.requests += 1;
    slot.lastAt = Date.now();
    this.state.channels[channel] = slot;
  }
  idempotencyKey(input: unknown): string { return `lumina:${sha256(input)}`; }
  beginIdempotent(key: string, ttlMs=10*60_000) {
    const now = Date.now();
    this.state.idempotency.checks++;
    this.state.idempotency.entries = this.state.idempotency.entries.filter(e => e.expiresAt > now);
    const existing = this.state.idempotency.entries.find(e => e.key === key);
    if (existing) { this.state.idempotency.hits++; return { fresh:false, key, existing:structuredClone(existing) }; }
    this.state.idempotency.entries.push({ key, createdAt:now, expiresAt:now+Math.max(1000,ttlMs) });
    this.state.idempotency.entries = this.state.idempotency.entries.slice(-512);
    return { fresh:true, key };
  }
  commitIdempotent(key:string, result:unknown) {
    const row = this.state.idempotency.entries.find(e=>e.key===key);
    if (!row) return false;
    row.resultHash = sha256(result);
    row.result = structuredClone(result);
    this.state.idempotency.commits++;
    return true;
  }
  search(records:LuminaSearchRecord[], query:string, limit=12): { query:string; hits:LuminaSearchHit[]; indexedRecords:number } {
    const normalized = String(query ?? '').trim();
    const terms = [...new Set(tokenize(normalized))];
    this.state.search.queries++;
    this.state.search.indexedRecords = records.length;
    this.state.search.lastQuery = normalized;
    this.state.search.lastAt = Date.now();
    if (!terms.length) return { query:normalized, hits:[], indexedRecords:records.length };
    const hits = records.map((record):LuminaSearchHit => {
      const hay = record.text.toLocaleLowerCase().normalize('NFKC');
      const matchedTerms = terms.filter(term=>hay.includes(term));
      const exactBoost = hay.includes(normalized.toLocaleLowerCase()) ? .45 : 0;
      const density = matchedTerms.length / Math.max(1, terms.length);
      const recency = Math.max(0, 1 - Math.abs(Date.now()-record.at)/Math.max(86_400_000*30,1));
      return { ...record, score: Math.min(1, density*.7 + exactBoost + recency*.15), matchedTerms };
    }).filter(hit=>hit.matchedTerms.length>0).sort((a,b)=>b.score-a.score || b.at-a.at).slice(0,Math.max(1,Math.min(50,limit)));
    this.state.search.hits += hits.length;
    return { query:normalized, hits, indexedRecords:records.length };
  }
  setBrowserAvailable(available:boolean, note?:string) { this.state.browser.available = Boolean(available); if (note) this.state.browser.note = note; }
  recordBrowserSession() { this.state.browser.sessionCount++; this.state.browser.lastAt=Date.now(); }
  recordVoice(action:string) { this.state.voice.lastAction=action; this.state.voice.lastAt=Date.now(); }
  diagnostics() { return { ...this.snapshot(), channelUsage:Object.fromEntries(Object.entries(this.state.channels).map(([k,v])=>[k,{...v}])) }; }
}
