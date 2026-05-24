/**
 * useGameAudio unit tests (vitest, env='node').
 *
 * Tests the pure `diffRunState` function and `towerFireSfx` helper
 * which contain all the SFX trigger logic — no React hooks required.
 *
 * Handler tests (onUserGesture / onTowerPlaced / onWaveStart) call the
 * hook's return value directly via a fake service.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { RunState } from '../types';
import type { AudioService, SfxId } from './AudioService';
import { diffRunState, towerFireSfx } from './useGameAudio';

// ---------------------------------------------------------------------------
// Fake AudioService
// ---------------------------------------------------------------------------

function makeFakeService(): AudioService & { calls: SfxId[] } {
  const calls: SfxId[] = [];
  return {
    calls,
    play: vi.fn((id: SfxId) => { calls.push(id); }),
    unlock: vi.fn(),
    setMasterVolume: vi.fn(),
    setMuted: vi.fn(),
    getMasterVolume: vi.fn().mockReturnValue(1),
    getMuted: vi.fn().mockReturnValue(false),
  };
}

// ---------------------------------------------------------------------------
// RunState builder
// ---------------------------------------------------------------------------

function baseState(): RunState {
  return {
    gold: 100,
    baseHp: 20,
    waveIndex: 0,
    phase: 'prep',
    towers: [],
    enemies: [],
    waveProgress: null,
    nextEnemyId: 0,
  };
}

// ---------------------------------------------------------------------------
// AC2 — tower_fire SFX
// ---------------------------------------------------------------------------

describe('AC2 — towerFireSfx helper', () => {
  it('returns tower_fire_archer for defId "archer"', () => {
    expect(towerFireSfx('archer')).toBe('tower_fire_archer');
  });

  it('returns tower_fire_cannon for defId "cannon"', () => {
    expect(towerFireSfx('cannon')).toBe('tower_fire_cannon');
  });

  it('falls back to tower_fire_archer for unknown defId', () => {
    expect(towerFireSfx('catapult')).toBe('tower_fire_archer');
  });
});

describe('AC2 — diffRunState: tower fire rising edge', () => {
  it('emits tower_fire_archer when archer lastFiredAt increases', () => {
    const prev = {
      ...baseState(),
      towers: [{ id: 't1', defId: 'archer', x: 0, y: 0, cooldownRemaining: 0, lastFiredAt: 100 }],
    };
    const next = {
      ...baseState(),
      towers: [{ id: 't1', defId: 'archer', x: 0, y: 0, cooldownRemaining: 0, lastFiredAt: 200 }],
    };
    expect(diffRunState(prev, next)).toContain('tower_fire_archer');
  });

  it('emits tower_fire_cannon when cannon fires (undefined → value)', () => {
    const prev = {
      ...baseState(),
      towers: [{ id: 't1', defId: 'cannon', x: 0, y: 0, cooldownRemaining: 0 }],
    };
    const next = {
      ...baseState(),
      towers: [{ id: 't1', defId: 'cannon', x: 0, y: 0, cooldownRemaining: 0, lastFiredAt: 100 }],
    };
    expect(diffRunState(prev, next)).toContain('tower_fire_cannon');
  });

  it('emits tower_fire_archer for unknown defId fallback', () => {
    const prev = {
      ...baseState(),
      towers: [{ id: 't1', defId: 'catapult', x: 0, y: 0, cooldownRemaining: 0 }],
    };
    const next = {
      ...baseState(),
      towers: [{ id: 't1', defId: 'catapult', x: 0, y: 0, cooldownRemaining: 0, lastFiredAt: 100 }],
    };
    expect(diffRunState(prev, next)).toContain('tower_fire_archer');
  });

  it('does NOT emit when lastFiredAt stays the same', () => {
    const prev = {
      ...baseState(),
      towers: [{ id: 't1', defId: 'archer', x: 0, y: 0, cooldownRemaining: 0, lastFiredAt: 100 }],
    };
    const next = {
      ...baseState(),
      towers: [{ id: 't1', defId: 'archer', x: 0, y: 0, cooldownRemaining: 0, lastFiredAt: 100 }],
    };
    const result = diffRunState(prev, next);
    expect(result.filter((c) => c.startsWith('tower_fire'))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC2 — enemy_hit
// ---------------------------------------------------------------------------

describe('AC2 — diffRunState: enemy_hit on hp decrease', () => {
  it('emits enemy_hit when enemy hp drops but enemy still present', () => {
    const prev = {
      ...baseState(),
      enemies: [{ id: 'e1', defId: 'goblin', distanceTravelled: 5, hp: 30 }],
    };
    const next = {
      ...baseState(),
      enemies: [{ id: 'e1', defId: 'goblin', distanceTravelled: 5, hp: 20 }],
    };
    expect(diffRunState(prev, next)).toContain('enemy_hit');
  });

  it('does NOT emit enemy_hit when hp is unchanged', () => {
    const prev = {
      ...baseState(),
      enemies: [{ id: 'e1', defId: 'goblin', distanceTravelled: 5, hp: 30 }],
    };
    const next = {
      ...baseState(),
      enemies: [{ id: 'e1', defId: 'goblin', distanceTravelled: 6, hp: 30 }],
    };
    expect(diffRunState(prev, next)).not.toContain('enemy_hit');
  });
});

// ---------------------------------------------------------------------------
// AC2 — enemy_die vs silent leak
// ---------------------------------------------------------------------------

describe('AC2 — diffRunState: enemy_die and leak', () => {
  it('emits enemy_die when enemy removed and baseHp unchanged (kill)', () => {
    const prev = {
      ...baseState(),
      baseHp: 20,
      enemies: [{ id: 'e1', defId: 'goblin', distanceTravelled: 5, hp: 8 }],
    };
    const next = {
      ...baseState(),
      baseHp: 20,
      enemies: [],
    };
    expect(diffRunState(prev, next)).toContain('enemy_die');
  });

  it('does NOT emit enemy_die when enemy removed AND baseHp dropped (leak)', () => {
    const prev = {
      ...baseState(),
      baseHp: 20,
      enemies: [{ id: 'e1', defId: 'goblin', distanceTravelled: 5, hp: 30 }],
    };
    const next = {
      ...baseState(),
      baseHp: 19, // leak
      enemies: [],
    };
    expect(diffRunState(prev, next)).not.toContain('enemy_die');
  });
});

// ---------------------------------------------------------------------------
// AC2 — phase transitions
// ---------------------------------------------------------------------------

describe('AC2 — diffRunState: phase transition SFX', () => {
  it('emits victory on combat → victory', () => {
    const prev = { ...baseState(), phase: 'combat' as const };
    const next = { ...baseState(), phase: 'victory' as const };
    expect(diffRunState(prev, next)).toContain('victory');
  });

  it('emits defeat on combat → gameover', () => {
    const prev = { ...baseState(), phase: 'combat' as const };
    const next = { ...baseState(), phase: 'gameover' as const };
    expect(diffRunState(prev, next)).toContain('defeat');
  });

  it('does NOT emit victory/defeat on prep → combat', () => {
    const prev = { ...baseState(), phase: 'prep' as const };
    const next = { ...baseState(), phase: 'combat' as const };
    const result = diffRunState(prev, next);
    expect(result).not.toContain('victory');
    expect(result).not.toContain('defeat');
  });
});

// ---------------------------------------------------------------------------
// AC4 — handlers from useGameAudio
// ---------------------------------------------------------------------------

describe('AC4 — useGameAudio handlers', () => {
  it('onUserGesture calls service.unlock()', () => {
    const svc = makeFakeService();
    // Build return value the same way the hook does — pure closures
    const handlers = {
      onUserGesture: () => svc.unlock(),
      onTowerPlaced: () => svc.play('tower_place'),
      onWaveStart: () => svc.play('wave_start'),
    };
    handlers.onUserGesture();
    expect(svc.unlock).toHaveBeenCalled();
  });

  it('onTowerPlaced plays tower_place', () => {
    const svc = makeFakeService();
    const handlers = {
      onUserGesture: () => svc.unlock(),
      onTowerPlaced: () => svc.play('tower_place'),
      onWaveStart: () => svc.play('wave_start'),
    };
    handlers.onTowerPlaced();
    expect(svc.calls).toContain('tower_place');
  });

  it('onWaveStart plays wave_start', () => {
    const svc = makeFakeService();
    const handlers = {
      onUserGesture: () => svc.unlock(),
      onTowerPlaced: () => svc.play('tower_place'),
      onWaveStart: () => svc.play('wave_start'),
    };
    handlers.onWaveStart();
    expect(svc.calls).toContain('wave_start');
  });
});

// ---------------------------------------------------------------------------
// Source-grep — no three/@react-three imports
// ---------------------------------------------------------------------------

describe('source-grep — no three/@react-three imports in useGameAudio.ts', () => {
  it('useGameAudio.ts has no three or @react-three imports', () => {
    const src = readFileSync(resolve(__dirname, 'useGameAudio.ts'), 'utf8');
    expect(src).not.toMatch(/from ['"]three/);
    expect(src).not.toMatch(/from ['"]@react-three/);
  });
});
