export interface ApiSecurityDecision { allowed: boolean; status: number; reason: string; }
export interface ApiConnectionContext {
  /** Peer address from the TCP socket (`req.socket.remoteAddress`). */
  remoteAddress?: string;
  /** Raw `x-forwarded-for` header, when present. */
  forwardedFor?: string | string[];
  /** Raw `forwarded` header, when present. */
  forwarded?: string;
}
const LOOPBACK = new Set(['127.0.0.1','::1','localhost']);

export function isLoopbackHost(host: string): boolean { return LOOPBACK.has(String(host||'').trim().toLowerCase()); }

/** Loopback check for a socket peer address, including IPv4-mapped IPv6 (`::ffff:127.0.0.1`). */
export function isLoopbackAddress(address?: string): boolean {
  const value = String(address ?? '').trim().toLowerCase();
  if (!value) return false;
  const bare = value.startsWith('::ffff:') ? value.slice(7) : value;
  return bare === '::1' || bare === '127.0.0.1' || /^127\./.test(bare);
}

export function authorizeApiRequest(host: string, path: string, authorization?: string, expectedToken = process.env.NEURO_API_TOKEN || '', connection?: ApiConnectionContext): ApiSecurityDecision {
  if (path === '/health' || path === '/api/health') return { allowed:true,status:200,reason:'public-health' };
  // A request forwarded by a reverse proxy carries proxy headers. Such a request is not a
  // local research session even when the socket peer is loopback, so it must authenticate.
  const forwardedParts: string[] = [];
  for (const value of [connection?.forwardedFor, connection?.forwarded]) {
    const text = (Array.isArray(value) ? value.join(',') : String(value ?? '')).trim();
    if (text) forwardedParts.push(text);
  }
  const forwarded = forwardedParts.join(',');
  const socketLoopback = connection?.remoteAddress ? isLoopbackAddress(connection.remoteAddress) : isLoopbackHost(host);
  if (socketLoopback && !forwarded && !expectedToken) return { allowed:true,status:200,reason:'loopback-research-mode' };
  if (!expectedToken) return { allowed:false,status:503,reason:'remote-api-token-not-configured' };
  if (!authorization?.startsWith('Bearer ')) return { allowed:false,status:401,reason:'missing-bearer-token' };
  const presented=authorization.slice(7);
  if (!presented || presented.length!==expectedToken.length) return {allowed:false,status:403,reason:'invalid-bearer-token'};
  let diff=0; for(let i=0;i<expectedToken.length;i++) diff |= expectedToken.charCodeAt(i)^presented.charCodeAt(i);
  return diff===0?{allowed:true,status:200,reason:'authenticated'}:{allowed:false,status:403,reason:'invalid-bearer-token'};
}
