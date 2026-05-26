import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// AC1 — validateRegisterInput pure function unit tests
// ---------------------------------------------------------------------------

describe('validateRegisterInput', () => {
  it('returns ok: true for valid input', async () => {
    const { validateRegisterInput } = await import('./RegisterPage');
    const result = validateRegisterInput({ username: 'alice', password: 'secret123', confirm: 'secret123' });
    expect(result).toEqual({ ok: true });
  });

  it('returns error when username is empty', async () => {
    const { validateRegisterInput } = await import('./RegisterPage');
    const result = validateRegisterInput({ username: '', password: 'secret123', confirm: 'secret123' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });

  it('returns error when password is empty', async () => {
    const { validateRegisterInput } = await import('./RegisterPage');
    const result = validateRegisterInput({ username: 'alice', password: '', confirm: '' });
    expect(result.ok).toBe(false);
  });

  it('returns error when passwords do not match', async () => {
    const { validateRegisterInput } = await import('./RegisterPage');
    const result = validateRegisterInput({ username: 'alice', password: 'abc123', confirm: 'xyz999' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('match');
  });

  it('returns error when password is too short', async () => {
    const { validateRegisterInput } = await import('./RegisterPage');
    const result = validateRegisterInput({ username: 'alice', password: 'ab', confirm: 'ab' });
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Source-read: RegisterPage module exports
// ---------------------------------------------------------------------------

describe('RegisterPage exports', () => {
  it('exports RegisterPage component', async () => {
    const mod = await import('./RegisterPage');
    expect(typeof mod.RegisterPage).toBe('function');
  });

  it('exports validateRegisterInput function', async () => {
    const mod = await import('./RegisterPage');
    expect(typeof mod.validateRegisterInput).toBe('function');
  });
});
