import { describe, expect, it } from 'vitest';
import { ENEMY_DEFS, createInitialRunState } from '../constants';
import { STARTER_MAP } from '../maps/starter';
import type { EnemyInstance, RunState } from '../types';
import { spawnWave, tickEnemies } from './enemies';
import { pathLength, positionAtDistance } from './path';

const MINI_PATH = { waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }] as const };

function makeGoblin(id: string, distanceTravelled = 0): EnemyInstance {
  return { id, defId: 'goblin', distanceTravelled, hp: ENEMY_DEFS.goblin.hp };
}

describe('pathLength', () => {
  it('returns 35 for the starter map', () => {
    expect(pathLength(STARTER_MAP.path)).toBeCloseTo(35);
  });

  it('returns 0 for a single-waypoint path', () => {
    expect(pathLength({ waypoints: [{ x: 0, y: 0 }] as const })).toBe(0);
  });

  it('returns the correct length for the mini path', () => {
    expect(pathLength(MINI_PATH)).toBeCloseTo(10);
  });
});

describe('positionAtDistance', () => {
  it('returns the first waypoint at distance 0', () => {
    const pos = positionAtDistance(MINI_PATH, 0);
    expect(pos.x).toBeCloseTo(0);
    expect(pos.y).toBeCloseTo(0);
  });

  it('returns the last waypoint at total length', () => {
    const pos = positionAtDistance(MINI_PATH, 10);
    expect(pos.x).toBeCloseTo(10);
    expect(pos.y).toBeCloseTo(0);
  });

  it('clamps to first waypoint for negative distance', () => {
    const pos = positionAtDistance(MINI_PATH, -5);
    expect(pos.x).toBeCloseTo(0);
    expect(pos.y).toBeCloseTo(0);
  });

  it('interpolates the midpoint correctly', () => {
    const pos = positionAtDistance(MINI_PATH, 5);
    expect(pos.x).toBeCloseTo(5);
    expect(pos.y).toBeCloseTo(0);
  });

  it('returns interpolated position on second segment of starter map', () => {
    const pos = positionAtDistance(STARTER_MAP.path, 6);
    expect(pos.x).toBeCloseTo(4);
    expect(pos.y).toBeCloseTo(5);
  });
});

describe('spawnWave', () => {
  it('appends enemies to state without mutating input', () => {
    const state = createInitialRunState();
    const original = [...state.enemies];
    const enemy = makeGoblin('e1');
    const next = spawnWave(state, [enemy]);
    expect(next.enemies).toHaveLength(1);
    expect(next.enemies[0]).toBe(enemy);
    expect(state.enemies).toEqual(original);
  });

  it('does not change phase', () => {
    const state = createInitialRunState();
    const next = spawnWave(state, [makeGoblin('e1')]);
    expect(next.phase).toBe('prep');
  });

  it('appends to existing enemies', () => {
    const state: RunState = {
      ...createInitialRunState(),
      enemies: [makeGoblin('e1')],
    };
    const next = spawnWave(state, [makeGoblin('e2')]);
    expect(next.enemies).toHaveLength(2);
  });
});

describe('tickEnemies', () => {
  it('is a no-op when phase is prep', () => {
    const state: RunState = {
      ...createInitialRunState(),
      phase: 'prep',
      enemies: [makeGoblin('e1')],
    };
    const next = tickEnemies(state, MINI_PATH, 0.5);
    expect(next).toBe(state);
  });

  it('is a no-op when phase is gameover', () => {
    const state: RunState = {
      ...createInitialRunState(),
      phase: 'gameover',
      enemies: [makeGoblin('e1')],
    };
    const next = tickEnemies(state, MINI_PATH, 0.5);
    expect(next).toBe(state);
  });

  it('advances enemy distanceTravelled by speed * dt', () => {
    const state: RunState = {
      ...createInitialRunState(),
      phase: 'combat',
      enemies: [makeGoblin('e1', 0)],
    };
    const next = tickEnemies(state, MINI_PATH, 0.5);
    expect(next.enemies[0].distanceTravelled).toBeCloseTo(
      ENEMY_DEFS.goblin.speed * 0.5,
    );
  });

  it('removes enemy and decrements baseHp when reaching path end', () => {
    const state: RunState = {
      ...createInitialRunState(),
      phase: 'combat',
      baseHp: 10,
      enemies: [makeGoblin('e1', 9.5)],
    };
    const next = tickEnemies(state, MINI_PATH, 1);
    expect(next.enemies).toHaveLength(0);
    expect(next.baseHp).toBe(9);
  });

  it('sets phase to gameover when baseHp reaches 0', () => {
    const goblins = Array.from({ length: 3 }, (_, i) =>
      makeGoblin(`e${i}`, 9.9),
    );
    const state: RunState = {
      ...createInitialRunState(),
      phase: 'combat',
      baseHp: 2,
      enemies: goblins,
    };
    const next = tickEnemies(state, MINI_PATH, 1);
    expect(next.baseHp).toBeLessThanOrEqual(0);
    expect(next.phase).toBe('gameover');
  });

  it('does not mutate input state', () => {
    const state: RunState = {
      ...createInitialRunState(),
      phase: 'combat',
      enemies: [makeGoblin('e1', 0)],
    };
    const enemiesBefore = state.enemies;
    tickEnemies(state, MINI_PATH, 0.5);
    expect(state.enemies).toBe(enemiesBefore);
  });
});
