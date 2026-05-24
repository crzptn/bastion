import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { getOrCreatePlayerId, getOrCreateDisplayName, setDisplayName } from './playerIdentity';

// ---------------------------------------------------------------------------
// Mock localStorage in node environment
// ---------------------------------------------------------------------------

function makeMockStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  } as Storage;
}

let mockStorage: Storage;

beforeEach(() => {
  mockStorage = makeMockStorage();
  vi.stubGlobal('localStorage', mockStorage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// getOrCreatePlayerId
// ---------------------------------------------------------------------------

describe('getOrCreatePlayerId', () => {
  it('generates a UUID on first call', () => {
    const id = getOrCreatePlayerId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns the same value on repeated calls (persistence)', () => {
    const id1 = getOrCreatePlayerId();
    const id2 = getOrCreatePlayerId();
    expect(id1).toBe(id2);
  });

  it('persists to localStorage', () => {
    const id = getOrCreatePlayerId();
    expect(mockStorage.getItem('bastion_player_id')).toBe(id);
  });

  it('re-uses an existing value from localStorage', () => {
    mockStorage.setItem('bastion_player_id', 'preset-id');
    const id = getOrCreatePlayerId();
    expect(id).toBe('preset-id');
  });
});

// ---------------------------------------------------------------------------
// getOrCreateDisplayName
// ---------------------------------------------------------------------------

describe('getOrCreateDisplayName', () => {
  it('returns empty string when nothing stored and no fallback', () => {
    const name = getOrCreateDisplayName();
    expect(name).toBe('');
  });

  it('returns and persists fallback when nothing stored', () => {
    const name = getOrCreateDisplayName('Alice');
    expect(name).toBe('Alice');
    expect(mockStorage.getItem('bastion_display_name')).toBe('Alice');
  });

  it('returns existing value when already stored', () => {
    mockStorage.setItem('bastion_display_name', 'Bob');
    const name = getOrCreateDisplayName('Alice');
    expect(name).toBe('Bob');
  });
});

// ---------------------------------------------------------------------------
// setDisplayName
// ---------------------------------------------------------------------------

describe('setDisplayName', () => {
  it('persists name to localStorage', () => {
    setDisplayName('Charlie');
    expect(mockStorage.getItem('bastion_display_name')).toBe('Charlie');
  });

  it('overwrites previous name', () => {
    setDisplayName('Charlie');
    setDisplayName('Delta');
    expect(mockStorage.getItem('bastion_display_name')).toBe('Delta');
  });
});
