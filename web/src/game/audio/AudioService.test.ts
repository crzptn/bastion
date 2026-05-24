/**
 * AudioService unit tests (vitest, env='node').
 *
 * Stubs AudioContext and localStorage on globalThis so the service under test
 * never touches the real browser APIs.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAudioService } from './AudioService';

// ---------------------------------------------------------------------------
// Minimal AudioContext stub
// ---------------------------------------------------------------------------

function makeOscStub() {
  return {
    type: 'sine' as OscillatorType,
    frequency: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
    onended: null as (() => void) | null,
  };
}

function makeGainStub(initialValue = 0) {
  return {
    gain: { value: initialValue, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function makeContextStub() {
  const masterGain = makeGainStub(1);
  const osc = makeOscStub();
  const nodeGain = makeGainStub();

  return {
    state: 'running' as AudioContextState,
    currentTime: 0,
    destination: {},
    createOscillator: vi.fn(() => osc),
    createGain: vi.fn()
      .mockReturnValueOnce(masterGain)   // first call = master gain
      .mockImplementation(() => makeGainStub()), // subsequent = per-note gain
    resume: vi.fn().mockResolvedValue(undefined),
    _masterGain: masterGain,
    _osc: osc,
    _nodeGain: nodeGain,
  };
}

// ---------------------------------------------------------------------------
// localStorage stub
// ---------------------------------------------------------------------------

function makeLocalStorageStub() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    _store: store,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let lsStub: ReturnType<typeof makeLocalStorageStub>;

beforeEach(() => {
  lsStub = makeLocalStorageStub();
  vi.stubGlobal('localStorage', lsStub);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// AC1: exports and no framework imports
// ---------------------------------------------------------------------------

describe('AC1 — exports and purity', () => {
  it('createAudioService is exported and returns an AudioService', () => {
    const svc = createAudioService({ contextFactory: () => { throw new Error('no ctx'); } });
    expect(typeof svc.play).toBe('function');
    expect(typeof svc.unlock).toBe('function');
    expect(typeof svc.setMasterVolume).toBe('function');
    expect(typeof svc.setMuted).toBe('function');
    expect(typeof svc.getMasterVolume).toBe('function');
    expect(typeof svc.getMuted).toBe('function');
  });

  it('AudioService.ts has no react or three imports', () => {
    const src = readFileSync(
      resolve(__dirname, 'AudioService.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/from ['"]react/);
    expect(src).not.toMatch(/from ['"]three/);
    expect(src).not.toMatch(/from ['"]@react-three/);
  });
});

// ---------------------------------------------------------------------------
// AC5: localStorage persistence
// ---------------------------------------------------------------------------

describe('AC5 — localStorage persistence', () => {
  it('reads volume from localStorage on construction', () => {
    lsStub._store['bastion.audio'] = JSON.stringify({ volume: 0.42, muted: false });
    const svc = createAudioService();
    expect(svc.getMasterVolume()).toBeCloseTo(0.42);
  });

  it('reads muted from localStorage on construction', () => {
    lsStub._store['bastion.audio'] = JSON.stringify({ volume: 1, muted: true });
    const svc = createAudioService();
    expect(svc.getMuted()).toBe(true);
  });

  it('writes volume+muted to localStorage when setMasterVolume is called', () => {
    const svc = createAudioService({ storageKey: 'test.audio' });
    svc.setMasterVolume(0.7);
    expect(lsStub.setItem).toHaveBeenCalledWith(
      'test.audio',
      expect.stringContaining('"volume":0.7'),
    );
  });

  it('writes muted to localStorage when setMuted is called', () => {
    const svc = createAudioService({ storageKey: 'test.audio' });
    svc.setMuted(true);
    const lastCall = lsStub.setItem.mock.calls.at(-1) as [string, string];
    const saved = JSON.parse(lastCall[1]) as { muted: boolean };
    expect(saved.muted).toBe(true);
  });

  it('fresh service (second instance) reads back persisted values', () => {
    // First service sets volume
    const svc1 = createAudioService({ storageKey: 'persist.test' });
    svc1.setMasterVolume(0.55);
    svc1.setMuted(true);
    // Second service reads them back via the same stub store
    const svc2 = createAudioService({ storageKey: 'persist.test' });
    expect(svc2.getMasterVolume()).toBeCloseTo(0.55);
    expect(svc2.getMuted()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC6: context-construction failure → no throw, no-op play
// ---------------------------------------------------------------------------

describe('AC6 — graceful degradation when context fails', () => {
  it('does not throw when contextFactory throws', () => {
    expect(() => {
      const svc = createAudioService({ contextFactory: () => { throw new Error('no AudioContext'); } });
      svc.unlock();
    }).not.toThrow();
  });

  it('play() is a no-op when context failed', () => {
    const svc = createAudioService({ contextFactory: () => { throw new Error('no AudioContext'); } });
    svc.unlock();
    expect(() => svc.play('tower_fire_archer')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// AC7: lazy AudioContext — not created until unlock() then play()
// ---------------------------------------------------------------------------

describe('AC7 — lazy AudioContext creation', () => {
  it('does NOT call contextFactory on construction', () => {
    const factory = vi.fn(() => makeContextStub() as unknown as AudioContext);
    createAudioService({ contextFactory: factory });
    expect(factory).not.toHaveBeenCalled();
  });

  it('does NOT call contextFactory on play() before unlock()', () => {
    const factory = vi.fn(() => makeContextStub() as unknown as AudioContext);
    const svc = createAudioService({ contextFactory: factory });
    svc.play('enemy_hit');
    expect(factory).not.toHaveBeenCalled();
  });

  it('calls contextFactory exactly once on first unlock()', () => {
    const factory = vi.fn(() => makeContextStub() as unknown as AudioContext);
    const svc = createAudioService({ contextFactory: factory });
    svc.unlock();
    expect(factory).toHaveBeenCalledTimes(1);
    // second unlock is a no-op
    svc.unlock();
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('play() after unlock() uses the created context', () => {
    const ctxStub = makeContextStub();
    const factory = vi.fn(() => ctxStub as unknown as AudioContext);
    const svc = createAudioService({ contextFactory: factory });
    svc.unlock();
    svc.play('tower_fire_archer');
    expect(ctxStub.createOscillator).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AC8: volume clamping and mute round-trip
// ---------------------------------------------------------------------------

describe('AC8 — volume/mute getters and setters', () => {
  it('clamps volume to 0 at minimum', () => {
    const svc = createAudioService();
    svc.setMasterVolume(-5);
    expect(svc.getMasterVolume()).toBe(0);
  });

  it('clamps volume to 1 at maximum', () => {
    const svc = createAudioService();
    svc.setMasterVolume(99);
    expect(svc.getMasterVolume()).toBe(1);
  });

  it('stores exact value within [0,1]', () => {
    const svc = createAudioService();
    svc.setMasterVolume(0.6);
    expect(svc.getMasterVolume()).toBeCloseTo(0.6);
  });

  it('muted round-trip: set true then false', () => {
    const svc = createAudioService();
    expect(svc.getMuted()).toBe(false);
    svc.setMuted(true);
    expect(svc.getMuted()).toBe(true);
    svc.setMuted(false);
    expect(svc.getMuted()).toBe(false);
  });

  it('setMasterVolume updates masterGain.gain.value', () => {
    const ctxStub = makeContextStub();
    const svc = createAudioService({ contextFactory: () => ctxStub as unknown as AudioContext });
    svc.unlock();
    svc.setMasterVolume(0.5);
    expect(ctxStub._masterGain.gain.value).toBeCloseTo(0.5);
  });

  it('setMuted(true) zeroes masterGain.gain.value', () => {
    const ctxStub = makeContextStub();
    const svc = createAudioService({ contextFactory: () => ctxStub as unknown as AudioContext });
    svc.unlock();
    svc.setMuted(true);
    expect(ctxStub._masterGain.gain.value).toBe(0);
  });
});
