import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Stub localStorage via vi.stubGlobal (vitest env is 'node' — no native
// localStorage; same pattern as vi.stubGlobal('fetch', ...) in lobby.test.ts)
// ---------------------------------------------------------------------------

function makeLocalStorageStub() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      for (const k of Object.keys(store)) delete store[k];
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    _store: store,
  };
}

let localStorageStub: ReturnType<typeof makeLocalStorageStub>;

beforeEach(() => {
  localStorageStub = makeLocalStorageStub();
  vi.stubGlobal('localStorage', localStorageStub);
  // Re-import with fresh module state each test via isolateModules
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// AC1 — setSession persists token + username; subscribers are notified
// ---------------------------------------------------------------------------

describe('setSession', () => {
  it('stores token and username in localStorage', async () => {
    const { setSession } = await import('./authStore');
    setSession('tok-abc', 'alice');

    expect(localStorageStub.setItem).toHaveBeenCalledWith('bastion_auth_token', 'tok-abc');
    expect(localStorageStub.setItem).toHaveBeenCalledWith('bastion_auth_username', 'alice');
  });

  it('makes getToken and getUsername return the stored values', async () => {
    const { setSession, getToken, getUsername } = await import('./authStore');
    setSession('tok-xyz', 'bob');

    expect(getToken()).toBe('tok-xyz');
    expect(getUsername()).toBe('bob');
  });

  it('notifies subscribers when session is set', async () => {
    const { setSession, subscribe } = await import('./authStore');
    const listener = vi.fn();
    const unsub = subscribe(listener);

    setSession('tok-abc', 'alice');
    expect(listener).toHaveBeenCalledOnce();

    unsub();
  });
});

// ---------------------------------------------------------------------------
// AC2 — clearSession removes both keys; subscribers are notified
// ---------------------------------------------------------------------------

describe('clearSession', () => {
  it('removes both keys from localStorage', async () => {
    const { setSession, clearSession } = await import('./authStore');
    setSession('tok-abc', 'alice');
    clearSession();

    expect(localStorageStub.removeItem).toHaveBeenCalledWith('bastion_auth_token');
    expect(localStorageStub.removeItem).toHaveBeenCalledWith('bastion_auth_username');
  });

  it('makes getToken and getUsername return null after clear', async () => {
    const { setSession, clearSession, getToken, getUsername } = await import('./authStore');
    setSession('tok-abc', 'alice');
    clearSession();

    expect(getToken()).toBeNull();
    expect(getUsername()).toBeNull();
  });

  it('notifies subscribers when session is cleared', async () => {
    const { setSession, clearSession, subscribe } = await import('./authStore');
    setSession('tok-abc', 'alice');
    const listener = vi.fn();
    const unsub = subscribe(listener);

    clearSession();
    expect(listener).toHaveBeenCalledOnce();

    unsub();
  });
});

// ---------------------------------------------------------------------------
// subscribe — unsubscribe stops notifications
// ---------------------------------------------------------------------------

describe('subscribe', () => {
  it('stops notifying after unsubscribe', async () => {
    const { setSession, subscribe } = await import('./authStore');
    const listener = vi.fn();
    const unsub = subscribe(listener);
    unsub();

    setSession('tok-abc', 'alice');
    expect(listener).not.toHaveBeenCalled();
  });
});
