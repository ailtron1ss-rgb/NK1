/**
 * Permissioned web search — prefers Termux server proxy, falls back to direct.
 */

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchRequest {
  id: string;
  query: string;
  reason: string;
  createdAt: number;
  status: 'pending' | 'allowed' | 'denied' | 'done' | 'error';
  results?: SearchHit[];
  error?: string;
}

const POLICY_KEY = 'kurisu_search_policy';
export type SearchPolicy = 'ask' | 'session_allow' | 'always_deny';

export function getSearchPolicy(): SearchPolicy {
  return (localStorage.getItem(POLICY_KEY) as SearchPolicy) || 'ask';
}

export function setSearchPolicy(p: SearchPolicy) {
  localStorage.setItem(POLICY_KEY, p);
}

let sessionAllowUntil = 0;

export function allowSearchSession(minutes = 10) {
  sessionAllowUntil = Date.now() + minutes * 60_000;
  setSearchPolicy('session_allow');
}

export function isSearchCurrentlyAllowed(): boolean {
  const p = getSearchPolicy();
  if (p === 'always_deny') return false;
  if (p === 'session_allow' && Date.now() < sessionAllowUntil) return true;
  if (p === 'session_allow' && Date.now() >= sessionAllowUntil) {
    setSearchPolicy('ask');
    return false;
  }
  return false;
}

export function createSearchRequest(query: string, reason: string): SearchRequest {
  return {
    id: `sr_${Date.now().toString(36)}`,
    query: query.slice(0, 200),
    reason: reason.slice(0, 200),
    createdAt: Date.now(),
    status: 'pending'
  };
}

export async function executeSearch(query: string): Promise<SearchHit[]> {
  const q = query.slice(0, 200);
  // 1) Server proxy (Termux Express) — no CORS
  try {
    const res = await fetch('/api/kurisu/search?q=' + encodeURIComponent(q));
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.hits) && data.hits.length) {
        return data.hits.map((h: any) => ({
          title: String(h.title || ''),
          url: String(h.url || ''),
          snippet: String(h.snippet || '')
        }));
      }
    }
  } catch {
    /* fall through */
  }

  // 2) Direct (often CORS-blocked in mobile browsers)
  try {
    const url = 'https://duckduckgo.com/html/?q=' + encodeURIComponent(q);
    const res = await fetch(url);
    const html = await res.text();
    const hits: SearchHit[] = [];
    const re = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([^<]*)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && hits.length < 5) {
      hits.push({ url: m[1], title: m[2].trim(), snippet: '' });
    }
    if (hits.length) return hits;
  } catch {
    /* fall through */
  }

  return [
    {
      title: 'Поиск: открой вручную',
      url: 'https://duckduckgo.com/?q=' + encodeURIComponent(q),
      snippet: 'Прокси и прямой запрос недоступны'
    }
  ];
}

export function formatHitsForPrompt(hits: SearchHit[]): string {
  if (!hits.length) return '(пусто)';
  return hits
    .map((h, i) => `${i + 1}. ${h.title}\n   ${h.url}\n   ${h.snippet || ''}`.trim())
    .join('\n');
}
