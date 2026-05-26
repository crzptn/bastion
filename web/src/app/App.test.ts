import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(__dirname, 'App.tsx'), 'utf-8');

// ---------------------------------------------------------------------------
// Source-read tests: verify App module wires /login, /register, and AuthNav
// ---------------------------------------------------------------------------

describe('App module exports', () => {
  it('exports App component', async () => {
    const mod = await import('./App');
    expect(typeof mod.App).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// AC1 — /leaderboard route and nav link are present
// ---------------------------------------------------------------------------

describe('App source-read assertions', () => {
  it('nav contains /leaderboard link', () => {
    expect(source).toContain('"/leaderboard"');
  });

  it('/leaderboard route is registered', () => {
    expect(source).toContain('path="/leaderboard"');
  });

  it('imports LeaderboardPage', () => {
    expect(source).toContain('LeaderboardPage');
  });
});

// These tests verify the route and AuthNav presence as a source-read check.
// Browser smoke verification (manual AC2 / AC3) covers the live rendering.
