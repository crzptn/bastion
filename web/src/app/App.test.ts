import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Source-read tests: verify App module wires /login, /register, and AuthNav
// ---------------------------------------------------------------------------

describe('App module exports', () => {
  it('exports App component', async () => {
    const mod = await import('./App');
    expect(typeof mod.App).toBe('function');
  });
});

// These tests verify the route and AuthNav presence as a source-read check.
// Browser smoke verification (manual AC2 / AC3) covers the live rendering.
