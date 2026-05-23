import { describe, expect, it } from 'vitest';
import { ENEMY_DEFS, TOWER_DEFS, createInitialRunState } from '../constants';
import type { EnemyInstance, RunState, TowerInstance } from '../types';
import { tickCombat } from './combat';

// Minimal straight horizontal path: x=0..10, y=0
const MINI_PATH = { waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }] as const };

function makeGoblin(id: string, distanceTravelled = 0): EnemyInstance {
  return { id, defId: 'goblin', distanceTravelled, hp: ENEMY_DEFS.goblin.hp };
}

// Tower at (0,0) => center (0.5, 0.5), archer range=5
function makeTower(
  id: string,
  x: number,
  y: number,
  defId = 'archer',
  cooldownRemaining = 0,
): TowerInstance {
  return { id, defId, x, y, cooldownRemaining };
}

function combatState(overrides: Partial<RunState> = {}): RunState {
  return {
    ...createInitialRunState(),
    phase: 'combat',
    ...overrides,
  };
}

// ------------------------------------------------------------------ no-ops
describe('tickCombat – phase gates', () => {
  it('is a no-op (same reference) when phase is prep', () => {
    const state: RunState = {
      ...createInitialRunState(),
      phase: 'prep',
      enemies: [makeGoblin('e1')],
      towers: [makeTower('t1', 0, 0)],
    };
    const next = tickCombat(state, MINI_PATH, 0.016, 1000);
    expect(next).toBe(state);
  });

  it('is a no-op (same reference) when phase is gameover', () => {
    const state: RunState = {
      ...createInitialRunState(),
      phase: 'gameover',
      enemies: [makeGoblin('e1')],
      towers: [makeTower('t1', 0, 0)],
    };
    const next = tickCombat(state, MINI_PATH, 0.016, 1000);
    expect(next).toBe(state);
  });

  it('returns same reference when there are no towers', () => {
    const state = combatState({ enemies: [makeGoblin('e1')] });
    const next = tickCombat(state, MINI_PATH, 0.016, 1000);
    expect(next).toBe(state);
  });

  it('returns same reference when there are no enemies', () => {
    const state = combatState({ towers: [makeTower('t1', 0, 0)] });
    const next = tickCombat(state, MINI_PATH, 0.016, 1000);
    expect(next).toBe(state);
  });
});

// ------------------------------------------------------------------ targeting
describe('tickCombat – targeting', () => {
  it('targets an enemy within range and reduces hp', () => {
    // Tower at (0,0), center (0.5,0.5). Goblin at distance=0 => pos (0,0). Range=5. Distance = hypot(0.5,0.5) ≈ 0.7 <= 5
    const state = combatState({
      towers: [makeTower('t1', 0, 0, 'archer', 0)],
      enemies: [makeGoblin('e1', 0)],
    });
    const archerDamage = TOWER_DEFS.archer.damage; // 8
    const next = tickCombat(state, MINI_PATH, 0.016, 1000);
    expect(next.enemies).toHaveLength(1);
    expect(next.enemies[0].hp).toBe(ENEMY_DEFS.goblin.hp - archerDamage);
  });

  it('does not damage an enemy out of range', () => {
    // Tower at (0,0), center (0.5,0.5). Archer range=5. Enemy at distance=6 => pos (6,0). Distance = hypot(5.5,0.5) ≈ 5.52 > 5
    const state = combatState({
      towers: [makeTower('t1', 0, 0, 'archer', 0)],
      enemies: [makeGoblin('e1', 6)],
    });
    const next = tickCombat(state, MINI_PATH, 0.016, 1000);
    expect(next.enemies[0].hp).toBe(ENEMY_DEFS.goblin.hp);
  });

  it('selects the furthest-along enemy when multiple are in range', () => {
    // Two goblins in range; target must be the one with higher distanceTravelled
    const state = combatState({
      towers: [makeTower('t1', 0, 0, 'archer', 0)],
      enemies: [makeGoblin('e1', 0), makeGoblin('e2', 2)],
    });
    const next = tickCombat(state, MINI_PATH, 0.016, 1000);
    // e2 (dist=2) is the priority target
    const e1 = next.enemies.find((e) => e.id === 'e1')!;
    const e2 = next.enemies.find((e) => e.id === 'e2')!;
    expect(e2.hp).toBeLessThan(ENEMY_DEFS.goblin.hp);
    expect(e1.hp).toBe(ENEMY_DEFS.goblin.hp); // not hit
  });
});

// ------------------------------------------------------------------ kill + reward
describe('tickCombat – kill and gold reward', () => {
  it('removes enemy and adds reward gold when hp drops to 0', () => {
    const archerDamage = TOWER_DEFS.archer.damage; // 8
    // Create a low-hp goblin that will die in one shot
    const dyingGoblin: EnemyInstance = { id: 'e1', defId: 'goblin', distanceTravelled: 0, hp: archerDamage };
    const state = combatState({
      gold: 100,
      towers: [makeTower('t1', 0, 0, 'archer', 0)],
      enemies: [dyingGoblin],
    });
    const next = tickCombat(state, MINI_PATH, 0.016, 1000);
    expect(next.enemies).toHaveLength(0);
    expect(next.gold).toBe(100 + ENEMY_DEFS.goblin.reward); // +10
  });

  it('removes enemy when hp drops below 0 (overkill)', () => {
    const tinyGoblin: EnemyInstance = { id: 'e1', defId: 'goblin', distanceTravelled: 0, hp: 1 };
    const state = combatState({
      gold: 100,
      towers: [makeTower('t1', 0, 0, 'cannon', 0)], // cannon dmg=20 > 1
      enemies: [tinyGoblin],
    });
    const next = tickCombat(state, MINI_PATH, 0.016, 1000);
    expect(next.enemies).toHaveLength(0);
    expect(next.gold).toBe(100 + ENEMY_DEFS.goblin.reward);
  });

  it('does not award negative gold (reward is always non-negative)', () => {
    const state = combatState({
      gold: 50,
      towers: [makeTower('t1', 0, 0, 'archer', 0)],
      enemies: [{ id: 'e1', defId: 'goblin', distanceTravelled: 0, hp: TOWER_DEFS.archer.damage }],
    });
    const next = tickCombat(state, MINI_PATH, 0.016, 1000);
    expect(next.gold).toBeGreaterThanOrEqual(50);
  });
});

// ------------------------------------------------------------------ cooldown
describe('tickCombat – cooldown', () => {
  it('does not fire when cooldownRemaining > 0', () => {
    const state = combatState({
      towers: [makeTower('t1', 0, 0, 'archer', 0.5)], // cooldown still active
      enemies: [makeGoblin('e1', 0)],
    });
    const next = tickCombat(state, MINI_PATH, 0.016, 1000);
    expect(next.enemies[0].hp).toBe(ENEMY_DEFS.goblin.hp); // no damage
  });

  it('decrements cooldown by dt each tick', () => {
    const state = combatState({
      towers: [makeTower('t1', 0, 0, 'archer', 0.5)],
      enemies: [makeGoblin('e1', 0)],
    });
    const next = tickCombat(state, MINI_PATH, 0.1, 1000);
    const updatedTower = next.towers.find((t) => t.id === 't1')!;
    expect(updatedTower.cooldownRemaining).toBeCloseTo(0.4);
  });

  it('fires on first tick when cooldown reaches 0, then resets cooldown', () => {
    // cooldown exactly 0 => fires immediately
    const state = combatState({
      towers: [makeTower('t1', 0, 0, 'archer', 0)],
      enemies: [makeGoblin('e1', 0)],
    });
    const next = tickCombat(state, MINI_PATH, 0.016, 1000);
    const updatedTower = next.towers.find((t) => t.id === 't1')!;
    // After firing, cooldown resets to 1/fireRate = 1/1.5 ≈ 0.667
    expect(updatedTower.cooldownRemaining).toBeCloseTo(1 / TOWER_DEFS.archer.fireRate);
    expect(next.enemies[0].hp).toBe(ENEMY_DEFS.goblin.hp - TOWER_DEFS.archer.damage);
  });

  it('fires exactly once per tick regardless of overflow', () => {
    // High fireRate tower: even if cooldown went well negative, fire only once
    const state = combatState({
      towers: [makeTower('t1', 0, 0, 'archer', -10)], // way overdue
      enemies: [makeGoblin('e1', 0)],
    });
    const next = tickCombat(state, MINI_PATH, 0.016, 1000);
    // Still only one shot worth of damage
    expect(next.enemies[0].hp).toBe(ENEMY_DEFS.goblin.hp - TOWER_DEFS.archer.damage);
  });
});

// ------------------------------------------------------------------ multi-tower
describe('tickCombat – multi-tower scenario', () => {
  it('two towers in range both fire and can eliminate the whole wave', () => {
    // Wave of goblins each at hp=archer.damage so one shot kills each
    // Two towers, two goblins in range
    const archerDamage = TOWER_DEFS.archer.damage;
    const enemies: EnemyInstance[] = [
      { id: 'e1', defId: 'goblin', distanceTravelled: 0, hp: archerDamage },
      { id: 'e2', defId: 'goblin', distanceTravelled: 1, hp: archerDamage },
    ];
    const state = combatState({
      gold: 0,
      towers: [
        makeTower('t1', 0, 0, 'archer', 0),
        makeTower('t2', 0, 1, 'archer', 0), // also in range
      ],
      enemies,
    });
    const next = tickCombat(state, MINI_PATH, 0.016, 1000);
    expect(next.enemies).toHaveLength(0);
    expect(next.gold).toBe(ENEMY_DEFS.goblin.reward * 2);
  });

  it('dead enemies are not targeted again by subsequent towers in same tick', () => {
    // One goblin with exact 1hp. Two towers fire in order. Second tower should not find a live target.
    const tinyGoblin: EnemyInstance = { id: 'e1', defId: 'goblin', distanceTravelled: 0, hp: 1 };
    const state = combatState({
      gold: 0,
      towers: [
        makeTower('t1', 0, 0, 'archer', 0),
        makeTower('t2', 1, 0, 'archer', 0),
      ],
      enemies: [tinyGoblin],
    });
    const next = tickCombat(state, MINI_PATH, 0.016, 1000);
    expect(next.enemies).toHaveLength(0);
    // Gold should be awarded exactly once (not twice)
    expect(next.gold).toBe(ENEMY_DEFS.goblin.reward);
  });
});

// ------------------------------------------------------------------ immutability
describe('tickCombat – immutability', () => {
  it('does not mutate the input state', () => {
    const goblin = makeGoblin('e1', 0);
    const tower = makeTower('t1', 0, 0, 'archer', 0);
    const state = combatState({ towers: [tower], enemies: [goblin] });
    const originalEnemies = state.enemies;
    const originalTowers = state.towers;
    tickCombat(state, MINI_PATH, 0.016, 1000);
    expect(state.enemies).toBe(originalEnemies);
    expect(state.towers).toBe(originalTowers);
    expect(goblin.hp).toBe(ENEMY_DEFS.goblin.hp);
  });
});

// ------------------------------------------------------------------ VFX timestamps
describe('tickCombat – VFX timestamps', () => {
  it('sets lastFiredAt on a tower that fires', () => {
    const state = combatState({
      towers: [makeTower('t1', 0, 0, 'archer', 0)],
      enemies: [makeGoblin('e1', 0)],
    });
    const next = tickCombat(state, MINI_PATH, 0.016, 1000);
    const t = next.towers.find((t) => t.id === 't1')!;
    expect(t.lastFiredAt).toBe(1000);
  });

  it('sets lastHitAt on a damaged-but-alive enemy', () => {
    const state = combatState({
      towers: [makeTower('t1', 0, 0, 'archer', 0)],
      enemies: [makeGoblin('e1', 0)],
    });
    const next = tickCombat(state, MINI_PATH, 0.016, 1000);
    expect(next.enemies).toHaveLength(1);
    expect(next.enemies[0].lastHitAt).toBe(1000);
  });

  it('preserves prior lastFiredAt when tower is in cooldown', () => {
    const tower: TowerInstance = { id: 't1', defId: 'archer', x: 0, y: 0, cooldownRemaining: 0.5, lastFiredAt: 500 };
    const state = combatState({
      towers: [tower],
      enemies: [makeGoblin('e1', 0)],
    });
    const next = tickCombat(state, MINI_PATH, 0.016, 1000);
    const updated = next.towers.find((t) => t.id === 't1')!;
    expect(updated.lastFiredAt).toBe(500);
  });

  it('damage numbers are unchanged after adding nowMs parameter', () => {
    const state = combatState({
      towers: [makeTower('t1', 0, 0, 'archer', 0)],
      enemies: [makeGoblin('e1', 0)],
    });
    const next = tickCombat(state, MINI_PATH, 0.016, 1000);
    expect(next.enemies[0].hp).toBe(ENEMY_DEFS.goblin.hp - TOWER_DEFS.archer.damage);
  });
});
