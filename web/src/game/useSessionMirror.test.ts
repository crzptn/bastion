/**
 * Tests for the pure snapshotToRunState helper in useSessionMirror.
 *
 * Pattern: pure-helper export + source-read tests (#67).
 * No React, no DOM — runs in bun:test.
 */

import { describe, expect, it } from 'vitest';
import { snapshotToRunState } from './useSessionMirror';
import type { SnapshotPayload } from '../lib/wsOpcodes';

const baseSnap: SnapshotPayload = {
  id: 'sess-1',
  gold: 100,
  base_hp: 20,
  wave_index: 0,
  phase: 'prep',
  towers: [],
  enemies: [],
  wave_progress: null,
  next_enemy_id: 0,
  tick: 0,
};

describe('snapshotToRunState', () => {
  it('maps scalar fields correctly', () => {
    const state = snapshotToRunState(baseSnap);
    expect(state.gold).toBe(100);
    expect(state.baseHp).toBe(20);
    expect(state.waveIndex).toBe(0);
    expect(state.phase).toBe('prep');
    expect(state.nextEnemyId).toBe(0);
  });

  it('maps empty arrays', () => {
    const state = snapshotToRunState(baseSnap);
    expect(state.towers).toEqual([]);
    expect(state.enemies).toEqual([]);
    expect(state.waveProgress).toBeNull();
  });

  it('maps tower fields from snake_case to camelCase', () => {
    const snap: SnapshotPayload = {
      ...baseSnap,
      towers: [{ id: 'archer-0-6', def_id: 'archer', x: 0, y: 6, cooldown_remaining: 0.5 }],
    };
    const state = snapshotToRunState(snap);
    expect(state.towers).toHaveLength(1);
    const t = state.towers[0];
    expect(t.id).toBe('archer-0-6');
    expect(t.defId).toBe('archer');
    expect(t.x).toBe(0);
    expect(t.y).toBe(6);
    expect(t.cooldownRemaining).toBe(0.5);
  });

  it('maps enemy fields from snake_case to camelCase', () => {
    const snap: SnapshotPayload = {
      ...baseSnap,
      enemies: [{ id: 'enemy-0', def_id: 'goblin', distance_travelled: 2.5, hp: 30 }],
    };
    const state = snapshotToRunState(snap);
    expect(state.enemies).toHaveLength(1);
    const e = state.enemies[0];
    expect(e.id).toBe('enemy-0');
    expect(e.defId).toBe('goblin');
    expect(e.distanceTravelled).toBe(2.5);
    expect(e.hp).toBe(30);
  });

  it('maps wave_progress when present', () => {
    const snap: SnapshotPayload = {
      ...baseSnap,
      phase: 'combat',
      wave_progress: {
        spawn_queue: [{ def_id: 'goblin', remaining: 3, interval: 1.5 }],
        time_until_next_spawn: 0.8,
      },
    };
    const state = snapshotToRunState(snap);
    expect(state.waveProgress).not.toBeNull();
    expect(state.waveProgress!.timeUntilNextSpawn).toBe(0.8);
    expect(state.waveProgress!.spawnQueue).toHaveLength(1);
    expect(state.waveProgress!.spawnQueue[0].defId).toBe('goblin');
    expect(state.waveProgress!.spawnQueue[0].remaining).toBe(3);
  });

  it('is deterministic — same input yields identical output (AC1)', () => {
    const s1 = snapshotToRunState(baseSnap);
    const s2 = snapshotToRunState(baseSnap);
    expect(s1).toEqual(s2);
  });
});
