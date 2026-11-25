import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { authorizeApiRequest,isLoopbackHost } from '../src/organism/system/ApiSecurityPolicy.ts';
assert.equal(isLoopbackHost('127.0.0.1'),true); assert.equal(isLoopbackHost('0.0.0.0'),false);
assert.equal(authorizeApiRequest('127.0.0.1','/api/organism/status').allowed,true);
assert.equal(authorizeApiRequest('0.0.0.0','/api/organism/status').status,503);
assert.equal(authorizeApiRequest('0.0.0.0','/api/organism/status',undefined,'secret').status,401);
assert.equal(authorizeApiRequest('0.0.0.0','/api/organism/status','Bearer wrong','secret').status,403);
assert.equal(authorizeApiRequest('0.0.0.0','/api/organism/status','Bearer secret','secret').allowed,true);
assert.equal(authorizeApiRequest('0.0.0.0','/health').allowed,true);

const serverSource = await readFile(new URL('../src/server/server.mjs', import.meta.url), 'utf8');
const routeIndex = serverSource.indexOf('async function route(req, res)');
assert.ok(routeIndex >= 0, 'the production HTTP route must remain discoverable for the security contract');
const routeSource = serverSource.slice(routeIndex);
const rateLimitIndex = routeSource.indexOf('const rate = consumeRateLimit(req, url.pathname)');
const authIndex = routeSource.indexOf('const auth = authorizeApiRequest(HOST, url.pathname, req.headers.authorization)');
assert.ok(rateLimitIndex >= 0 && authIndex >= 0 && rateLimitIndex < authIndex,
  'rate limiting must run before API authorization so failed/missing bearer attempts are bounded');
const rateLimitFunction = serverSource.slice(serverSource.indexOf('function consumeRateLimit('), serverSource.indexOf('const VISION_BACKEND'));
assert.ok(rateLimitFunction.includes("req.socket?.remoteAddress"),
  'rate limiting must use the transport peer address');
assert.ok(!rateLimitFunction.includes('x-forwarded-for'),
  'untrusted forwarded-for headers must not let callers rotate their own rate-limit identity');
assert.ok(rateLimitFunction.includes("pathName === '/health' || pathName === '/api/health'"),
  'health endpoints remain exempt from general API traffic throttling');


import { BoundedRateLimiter } from '../src/server/bounded-rate-limiter.mjs';
{
  const limiter = new BoundedRateLimiter({ windowMs: 10_000, limit: 2, maxKeys: 3 });
  assert.equal(limiter.consume('peer-a', 1_000).allowed, true);
  assert.equal(limiter.consume('peer-a', 1_001).allowed, true);
  const blocked = limiter.consume('peer-a', 1_002);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSec, 10);
  limiter.consume('peer-b', 1_003);
  limiter.consume('peer-c', 1_004);
  limiter.consume('peer-a', 1_005);
  limiter.consume('peer-d', 1_006);
  assert.equal(limiter.size, 3, 'bucket storage must remain bounded under high-cardinality peer churn');
  assert.equal(limiter.consume('peer-d', 1_007).allowed, true);
  assert.equal(limiter.consume('peer-a', 11_100).allowed, true, 'expired fixed windows must reset');
  assert.ok(limiter.size <= 3);
  assert.equal(limiter.consume('peer-clock-rollback', 500).allowed, true,
    'clock rollback must reset the bucket without negative retry deadlines');
}

console.log('API_SECURITY=PASS');
