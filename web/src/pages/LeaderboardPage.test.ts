/**
 * LeaderboardPage source-read test — verifies imports, table element, and
 * column labels. Plus unit tests for the exported formatDuration helper.
 *
 * Pattern: pure source-read assertion (LEARNING #67). No DOM rendering required
 * for the structural checks.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(__dirname, 'LeaderboardPage.tsx'), 'utf-8');

// ---------------------------------------------------------------------------
// AC1 — source-read assertions
// ---------------------------------------------------------------------------

describe('LeaderboardPage source-read assertions', () => {
  it('imports getLeaderboard from ../lib/api/scores', () => {
    expect(source).toContain("from '../lib/api/scores'");
    expect(source).toContain('getLeaderboard');
  });

  it('renders a <table> element', () => {
    expect(source).toMatch(/<table/);
  });

  it('references rank column', () => {
    expect(source).toMatch(/[Rr]ank/);
  });

  it('references username column', () => {
    expect(source).toMatch(/[Uu]sername/);
  });

  it('references wave column', () => {
    expect(source).toMatch(/[Ww]ave/);
  });

  it('exports formatDuration helper', () => {
    expect(source).toContain('export function formatDuration');
  });

  it('handles loading state', () => {
    expect(source).toMatch(/[Ll]oading/);
  });

  it('handles empty state', () => {
    expect(source).toMatch(/[Ee]mpty|[Nn]o (entries|scores)/i);
  });

  it('handles error state', () => {
    expect(source).toMatch(/[Ee]rror/);
  });
});

// ---------------------------------------------------------------------------
// AC1 — formatDuration unit tests
// ---------------------------------------------------------------------------

describe('formatDuration', () => {
  // Dynamic import so tests still work without the file existing on disk at
  // collection time (vitest collects lazily).
  async function getFormatter() {
    const mod = await import('./LeaderboardPage');
    return mod.formatDuration;
  }

  it('formats sub-minute durations as seconds only', async () => {
    const fmt = await getFormatter();
    expect(fmt(30000)).toBe('0m 30s');
  });

  it('formats exactly one minute', async () => {
    const fmt = await getFormatter();
    expect(fmt(60000)).toBe('1m 0s');
  });

  it('formats 90 seconds', async () => {
    const fmt = await getFormatter();
    expect(fmt(90000)).toBe('1m 30s');
  });

  it('formats 0 ms as 0m 0s', async () => {
    const fmt = await getFormatter();
    expect(fmt(0)).toBe('0m 0s');
  });

  it('formats large durations correctly', async () => {
    const fmt = await getFormatter();
    // 5 minutes 15 seconds = 315000 ms
    expect(fmt(315000)).toBe('5m 15s');
  });
});
