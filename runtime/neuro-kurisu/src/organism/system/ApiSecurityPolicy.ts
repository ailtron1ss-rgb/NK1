export interface ApiSecurityDecision { allowed: boolean; status: number; reason: string; }
const LOOPBACK = new Set(['127.0.0.1','::1','localhost']);
export function isLoopbackHost(host: string): boolean { return LOOPBACK.has(String(host||'').trim().toLowerCase()); }
export function authorizeApiRequest(host: string, path: string, authorization?: string, expectedToken = process.env.NEURO_API_TOKEN || ''): ApiSecurityDecision {
  if (path === '/health' || path === '/api/health') return { allowed:true,status:200,reason:'public-health' };
  if (isLoopbackHost(host) && !expectedToken) return { allowed:true,status:200,reason:'loopback-research-mode' };
  if (!expectedToken) return { allowed:false,status:503,reason:'remote-api-token-not-configured' };
  if (!authorization?.startsWith('Bearer ')) return { allowed:false,status:401,reason:'missing-bearer-token' };
  const presented=authorization.slice(7);
  if (!presented || presented.length!==expectedToken.length) return {allowed:false,status:403,reason:'invalid-bearer-token'};
  let diff=0; for(let i=0;i<expectedToken.length;i++) diff |= expectedToken.charCodeAt(i)^presented.charCodeAt(i);
  return diff===0?{allowed:true,status:200,reason:'authenticated'}:{allowed:false,status:403,reason:'invalid-bearer-token'};
}
