import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// AC3 — validateLoginError maps AuthApiError codes to user-facing messages
// Source-read tests: import the pure helper and verify the mapping.
// ---------------------------------------------------------------------------

// We test the pure formatLoginError function exported from LoginPage.tsx.
// This avoids DOM/browser environment requirements while still covering the
// core logic that drives the text-red-400 error display.

describe('formatLoginError', () => {
  it('maps invalid_credentials to a friendly message', async () => {
    const { formatLoginError } = await import('./LoginPage');
    expect(formatLoginError('invalid_credentials')).toBe('Invalid username or password.');
  });

  it('maps invalid_input to a friendly message', async () => {
    const { formatLoginError } = await import('./LoginPage');
    expect(formatLoginError('invalid_input')).toBe('Username and password are required.');
  });

  it('returns a generic message for unknown codes', async () => {
    const { formatLoginError } = await import('./LoginPage');
    const msg = formatLoginError('some_unexpected_error');
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Source-read: LoginPage module exports what we expect
// ---------------------------------------------------------------------------

describe('LoginPage exports', () => {
  it('exports LoginPage component', async () => {
    const mod = await import('./LoginPage');
    expect(typeof mod.LoginPage).toBe('function');
  });

  it('exports formatLoginError function', async () => {
    const mod = await import('./LoginPage');
    expect(typeof mod.formatLoginError).toBe('function');
  });
});
