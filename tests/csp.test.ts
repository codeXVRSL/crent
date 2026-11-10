import { describe, expect, it } from 'vitest';
import { buildCsp, makeNonce } from '../lib/csp';

describe('buildCsp', () => {
  const csp = buildCsp('abc', { supabaseUrl: 'https://xyz.supabase.co' });
  it('only runs scripts with the nonce and forbids framing', () => {
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
  it('allows Supabase over https and websockets', () => {
    expect(csp).toContain('https://xyz.supabase.co');
    expect(csp).toContain('wss://xyz.supabase.co');
  });
  it('upgrades insecure requests only on https deployments', () => {
    expect(csp).toContain('upgrade-insecure-requests');
    expect(buildCsp('n', { supabaseUrl: 'http://127.0.0.1:54321' })).not.toContain('upgrade-insecure-requests');
  });
  it('makes a fresh nonce each time', () => {
    expect(makeNonce()).not.toBe(makeNonce());
    expect(makeNonce()).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});
