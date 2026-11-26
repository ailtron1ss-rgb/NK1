import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { authorizeApiRequest,isLoopbackHost,isLoopbackAddress } from '../src/organism/system/ApiSecurityPolicy.ts';
assert.equal(isLoopbackHost('127.0.0.1'),true); assert.equal(isLoopbackHost('0.0.0.0'),false);
assert.equal(isLoopbackAddress('::ffff:127.0.0.1'),true); assert.equal(isLoopbackAddress('::1'),true); assert.equal(isLoopbackAddress('10.0.0.5'),false); assert.equal(isLoopbackAddress(undefined),false);
assert.equal(authorizeApiRequest('127.0.0.1','/api/organism/status').allowed,true);
assert.equal(authorizeApiRequest('0.0.0.0','/api/organism/status').status,503);
assert.equal(authorizeApiRequest('0.0.0.0','/api/organism/status',undefined,'secret').status,401);
assert.equal(authorizeApiRequest('0.0.0.0','/api/organism/status','Bearer wrong','secret').status,403);
assert.equal(authorizeApiRequest('0.0.0.0','/api/organism/status','Bearer secret','secret').allowed,true);
assert.equal(authorizeApiRequest('0.0.0.0','/health').allowed,true);
// A reverse proxy on the same host makes the socket peer loopback. Forwarded requests must
// still authenticate, otherwise every remote client inherits local research access.
assert.equal(authorizeApiRequest('127.0.0.1','/api/organism/status',undefined,'',{remoteAddress:'127.0.0.1',forwardedFor:'203.0.113.7'}).status,503);
assert.equal(authorizeApiRequest('127.0.0.1','/api/organism/status',undefined,'secret',{remoteAddress:'127.0.0.1',forwardedFor:'203.0.113.7'}).status,401);
assert.equal(authorizeApiRequest('127.0.0.1','/api/organism/status','Bearer secret','secret',{remoteAddress:'127.0.0.1',forwardedFor:'203.0.113.7'}).allowed,true);
assert.equal(authorizeApiRequest('127.0.0.1','/api/organism/status',undefined,'',{remoteAddress:'127.0.0.1',forwarded:'for=203.0.113.7'}).status,503);
assert.equal(authorizeApiRequest('127.0.0.1','/api/organism/status',undefined,'',{remoteAddress:'127.0.0.1'}).allowed,true);
assert.equal(authorizeApiRequest('127.0.0.1','/api/organism/status',undefined,'',{remoteAddress:'10.0.0.5'}).status,503);

assert.equal(isLoopbackAddress('::ffff:127.0.0.1'),true);
assert.equal(isLoopbackAddress('::1'),true);
assert.equal(isLoopbackAddress('10.0.0.5'),false);
assert.equal(isLoopbackAddress(undefined),false);
assert.equal(authorizeApiRequest('127.0.0.1','/api/organism/status',undefined,'',{remoteAddress:'127.0.0.1',forwardedFor:'203.0.113.7'}).status,503);
assert.equal(authorizeApiRequest('127.0.0.1','/api/organism/status',undefined,'secret',{remoteAddress:'127.0.0.1',forwardedFor:'203.0.113.7'}).status,401);
assert.equal(authorizeApiRequest('127.0.0.1','/api/organism/status','Bearer secret','secret',{remoteAddress:'127.0.0.1',forwardedFor:'203.0.113.7'}).allowed,true);
assert.equal(authorizeApiRequest('127.0.0.1','/api/organism/status',undefined,'',{remoteAddress:'127.0.0.1',forwarded:'for=203.0.113.7'}).status,503);
assert.equal(authorizeApiRequest('127.0.0.1','/api/organism/status',undefined,'',{remoteAddress:'10.0.0.5'}).status,503);
const serverSource = await readFile(new URL('../src/server/server.mjs', import.meta.url), 'utf8');
const routeSource = serverSource.slice(serverSource.indexOf('async function route(req, res)'));
const rateIndex = routeSource.indexOf('const rate = consumeRateLimit(context.clientAddress, url.pathname)');
const authIndex = routeSource.indexOf('const auth = authorizeApiRequest(');
assert.ok(rateIndex >= 0 && authIndex >= 0 && rateIndex < authIndex, 'rate limit must run before API authorization');
const rateBody = serverSource.slice(serverSource.indexOf('function consumeRateLimit('), serverSource.indexOf('function applyCorsHeaders('));
assert.ok(rateBody.includes('API_RATE_LIMITER.consume(String(clientAddress || 'unknown'))'));
assert.ok(!rateBody.includes('x-forwarded-for'), 'rate limiter must not inspect raw forwarded headers');

console.log('API_SECURITY=PASS');
