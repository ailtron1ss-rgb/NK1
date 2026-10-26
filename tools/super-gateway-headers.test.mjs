import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGatewayUpstreamHeaders } from './super-gateway-headers.mjs';

test('gateway rewrites Host for the upstream while preserving the public host and port', () => {
  const headers = buildGatewayUpstreamHeaders({
    host: '127.0.0.1:8080',
    accept: 'text/html',
  }, '127.0.0.1', 8081);
  assert.equal(headers.host, '127.0.0.1:8081');
  assert.equal(headers['x-forwarded-host'], '127.0.0.1:8080');
  assert.equal(headers['x-forwarded-proto'], 'http');
  assert.equal(headers.accept, 'text/html');
});

test('gateway origin metadata follows an explicit trusted transport protocol', () => {
  const headers = buildGatewayUpstreamHeaders({ host: 'kurisu.example:8443' }, '127.0.0.1', 3310, 'https');
  assert.equal(headers.host, '127.0.0.1:3310');
  assert.equal(headers['x-forwarded-host'], 'kurisu.example:8443');
  assert.equal(headers['x-forwarded-proto'], 'https');
});

test('gateway preserves HTTPS set by the trusted local TLS terminator', () => {
  const headers = buildGatewayUpstreamHeaders({
    host: 'kurisu.example:8443',
    'x-forwarded-proto': 'https',
  }, '127.0.0.1', 8081);
  assert.equal(headers.host, '127.0.0.1:8081');
  assert.equal(headers['x-forwarded-host'], 'kurisu.example:8443');
  assert.equal(headers['x-forwarded-proto'], 'https');
});

test('unsupported forwarded-proto values fail closed to plain HTTP when no trusted override is supplied', () => {
  const headers = buildGatewayUpstreamHeaders({
    host: '127.0.0.1:8080',
    'x-forwarded-proto': 'https, http',
  }, '127.0.0.1', 8081);
  assert.equal(headers['x-forwarded-proto'], 'http');
  assert.throws(() => buildGatewayUpstreamHeaders({}, '127.0.0.1', 8081, 'javascript'), /forwarded protocol must be http or https/);
});

test('missing public host does not forward a forged or empty host value', () => {
  const headers = buildGatewayUpstreamHeaders({ accept: '*/*', 'x-forwarded-host': 'attacker.example' }, '127.0.0.1', 8765);
  assert.equal(headers.host, '127.0.0.1:8765');
  assert.equal(Object.hasOwn(headers, 'x-forwarded-host'), false);
});

test('invalid upstream destinations are rejected before a request is constructed', () => {
  assert.throws(() => buildGatewayUpstreamHeaders({}, '', 8081), /upstream host is required/);
  assert.throws(() => buildGatewayUpstreamHeaders({}, '127.0.0.1', 65536), /upstream port/);
  assert.throws(() => buildGatewayUpstreamHeaders(null, '127.0.0.1', 8081), /source request headers/);
});
