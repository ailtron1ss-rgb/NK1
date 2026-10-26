import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveGatewayBindHost } from './super-gateway-config.mjs';

test('gateway defaults to loopback for local development', () => {
  assert.equal(resolveGatewayBindHost(undefined), '127.0.0.1');
  assert.equal(resolveGatewayBindHost('   '), '127.0.0.1');
});

test('gateway only publishes on all interfaces when explicitly configured', () => {
  assert.equal(resolveGatewayBindHost('0.0.0.0'), '0.0.0.0');
  assert.equal(resolveGatewayBindHost('127.0.0.1'), '127.0.0.1');
});

test('gateway rejects implicit non-loopback hostnames and addresses', () => {
  assert.throws(() => resolveGatewayBindHost('localhost'), /must be 127\.0\.0\.1/);
  assert.throws(() => resolveGatewayBindHost('192.168.1.50'), /must be 127\.0\.0\.1/);
});
