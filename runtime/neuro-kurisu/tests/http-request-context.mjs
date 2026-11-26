import assert from 'node:assert/strict';
import {
  createRequestContext,
  firstForwardedAddress,
  formatAccessLog,
  isProxiedRequest,
  parseOriginAllowlist,
  parseAddressAllowlist,
  parseToggle,
  resolveClientAddress,
  resolveCorsOrigin,
} from '../src/server/http-request-context.mjs';

assert.equal(parseToggle('1'), true);
assert.equal(parseToggle('true'), true);
assert.equal(parseToggle('0'), false);
assert.equal(parseToggle(''), false);
assert.equal(parseToggle('', true), true);

assert.equal(firstForwardedAddress('203.0.113.7, 10.0.0.1'), '203.0.113.7');
assert.equal(firstForwardedAddress(['198.51.100.2']), '198.51.100.2');
assert.equal(firstForwardedAddress(undefined), '');

const proxiedReq = { socket: { remoteAddress: '127.0.0.1' }, headers: { 'x-forwarded-for': '203.0.113.7' } };
const directReq = { socket: { remoteAddress: '198.51.100.9' }, headers: {} };

assert.equal(resolveClientAddress(proxiedReq), '127.0.0.1');
assert.equal(resolveClientAddress(proxiedReq, { trustProxy: true }), '127.0.0.1', 'untrusted proxy headers must not change client identity');
assert.equal(resolveClientAddress(proxiedReq, { trustProxy: true, trustedProxyAddresses: parseAddressAllowlist('127.0.0.1') }), '203.0.113.7');
assert.equal(resolveClientAddress({ socket: { remoteAddress: '198.51.100.9' }, headers: { 'x-forwarded-for': '203.0.113.7' } }, { trustProxy: true, trustedProxyAddresses: parseAddressAllowlist('127.0.0.1') }), '198.51.100.9');
assert.equal(resolveClientAddress(directReq, { trustProxy: true }), '198.51.100.9');
assert.equal(resolveClientAddress({ headers: {} }), 'unknown');
assert.equal(isProxiedRequest(proxiedReq), true);
assert.equal(isProxiedRequest(directReq), false);
assert.equal(isProxiedRequest({ headers: { forwarded: 'for=203.0.113.7' } }), true);

const allowlist = parseOriginAllowlist('https://app.example.com, https://staging.example.com');
assert.equal(resolveCorsOrigin('https://app.example.com', allowlist), 'https://app.example.com');
assert.equal(resolveCorsOrigin('https://evil.example.com', allowlist), '');
assert.equal(resolveCorsOrigin('https://app.example.com', parseOriginAllowlist('')), '');
assert.equal(resolveCorsOrigin(undefined, allowlist), '');

const context = createRequestContext(
  { method: 'post', url: '/api/organism/ui-snapshot?token=secret', socket: { remoteAddress: '127.0.0.1' }, headers: { 'x-forwarded-for': '203.0.113.7' } },
  { trustProxy: true, trustedProxyAddresses: parseAddressAllowlist('127.0.0.1'), requestIdFactory: () => 'req-test' },
);
assert.equal(context.requestId, 'req-test');
assert.equal(context.method, 'POST');
assert.equal(context.pathname, '/api/organism/ui-snapshot');
assert.equal(context.clientAddress, '203.0.113.7');
assert.equal(context.proxied, true);

const line = formatAccessLog({ ...context, status: 200, durationMs: 7 });
const parsed = JSON.parse(line);
assert.equal(parsed.requestId, 'req-test');
assert.equal(parsed.path, '/api/organism/ui-snapshot');
assert.equal(line.includes('token=secret'), false);
assert.equal(parsed.status, 200);
assert.equal(parsed.durationMs, 7);
assert.equal(formatAccessLog({ ...context, status: 500, errorCode: 'internal-error' }).includes('internal-error'), true);

console.log('HTTP_REQUEST_CONTEXT=PASS');
