import { describe, expect, it } from 'vitest';
import { createInitialRunState } from '../constants';
import { tickEnemies } from './enemies';
import { WAVES, startWave, tickWaves } from './waves';
import type { RunState } from '../types';

// Minimal path used for tickEnemies gameover tests
const MINI_PATH = { waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }] as const };

function prepState(overrides: Partial<RunState> = {}): RunState {
  return { ...createInitialRunState(), phase: 'prep', ...overrides };
}

// ------------------------------------------------------------------ WAVES table
describe('WAVES table', () => {
  it('has at least 3 entries', () => {
    expect(WAVES.length).toBeGreaterThanOrEqual(3);
  });

  it('escalates enemy count across waves', () => {
    // Each wave should have at least as many enemies as the previous
    for (let i = 1; i < WAVES.length; i++) {
      const prevCount = WAVES[i - 1].enemies.reduce((s, e) => s + e.count, 0);
      const currCount = WAVES[i].enemies.reduce((s, e) => s + e.count, 0);
      expect(currCount).toBeGreaterThan(prevCount);
    }
  });

  it('each wave has at least one enemy group', () => {
    for (const wave of WAVES) {
      expect(wave.enemies.length).toBeGreaterThanOrEqual(1);
      for (const group of wave.enemies) {
        expect(group.count).toBeGreaterThan(0);
        expect(group.interval).toBeGreaterThan(0);
      }
    }
  });
});

// ------------------------------------------------------------------ startWave
describe('startWave', () => {
  it('transitions phase from prep to combat', () => {
    const state = prepState();
    const next = startWave(state);
    expect(next.phase).toBe('combat');
  });

  it('populates waveProgress from the current wave definition', () => {
    const state = prepState({ waveIndex: 0 });
    const next = startWave(state);
    expect(next.waveProgress).not.toBeNull();
    const totalExpected = WAVES[0].enemies.reduce((s, e) => s + e.count, 0);
    const totalInQueue = next.waveProgress!.spawnQueue.reduce(
      (s, p) => s + p.remaining,
      0,
    );
    expect(totalInQueue).toBe(totalExpected);
  });

  it('is a no-op when phase is not prep', () => {
    const state: RunState = { ...createInitialRunState(), phase: 'combat' };
    const next = startWave(state);
    expect(next).toBe(state);
  });

  it('is a no-op when phase is gameover', () => {
    const state: RunState = { ...createInitialRunState(), phase: 'gameover' };
    const next = startWave(state);
    expect(next).toBe(state);
  });

  it('is a no-op when waveIndex is past the last wave', () => {
    const state = prepState({ waveIndex: WAVES.length });
    const next = startWave(state);
    expect(next).toBe(state);
  });

  it('is a no-op when baseHp <= 0', () => {
    const state = prepState({ baseHp: 0 });
    const next = startWave(state);
    expect(next).toBe(state);
  });
});

// ------------------------------------------------------------------ tickWaves – no-ops
describe('tickWaves – phase gates', () => {
  it('is a no-op (same reference) when phase is prep', () => {
    const state = prepState();
    const next = tickWaves(state, 0.016);
    expect(next).toBe(state);
  });

  it('is a no-op (same reference) when phase is gameover', () => {
    const state: RunState = { ...createInitialRunState(), phase: 'gameover' };
    const next = tickWaves(state, 0.016);
    expect(next).toBe(state);
  });

  it('is a no-op when waveProgress is null during combat', () => {
    // Edge case: combat without progress (should not occur normally, but be safe)
    const state: RunState = { ...createInitialRunState(), phase: 'combat', waveProgress: null };
    const next = tickWaves(state, 0.016);
    expect(next).toBe(state);
  });
});

// ------------------------------------------------------------------ tickWaves – spawn queue
describe('tickWaves – spawn queue draining', () => {
  it('does not spawn before the first interval elapses', () => {
    const state = startWave(prepState({ waveIndex: 0 }));
    // Use a small dt that won't trigger a spawn (interval is typically 1s+)
    const next = tickWaves(state, 0.01);
    expect(next.enemies.length).toBe(0);
  });

  it('spawns one enemy when the interval elapses', () => {
    // Build a state with waveProgress containing a single spawn entry with interval=1
    const state: RunState = {
      ...createInitialRunState(),
      phase: 'combat',
      waveProgress: {
        spawnQueue: [{ defId: 'goblin', remaining: 2, interval: 1 }],
        timeUntilNextSpawn: 1,
      },
    };
    // Apply exactly 1s dt -> should emit one enemy
    const next = tickWaves(state, 1);
    expect(next.enemies.length).toBe(1);
    expect(next.enemies[0].defId).toBe('goblin');
    // One remaining in queue
    expect(next.waveProgress!.spawnQueue[0].remaining).toBe(1);
  });

  it('spawns multiple enemies when enough time passes for multiple intervals', () => {
    // interval=0.5s, 3 remaining. dt=1.0s -> 2 spawns
    const state: RunState = {
      ...createInitialRunState(),
      phase: 'combat',
      waveProgress: {
        spawnQueue: [{ defId: 'goblin', remaining: 3, interval: 0.5 }],
        timeUntilNextSpawn: 0.5,
      },
    };
    const next = tickWaves(state, 1.0);
    expect(next.enemies.length).toBe(2);
    expect(next.waveProgress!.spawnQueue[0].remaining).toBe(1);
  });

  it('uses nextEnemyId counter for deterministic ids', () => {
    const state: RunState = {
      ...createInitialRunState(),
      phase: 'combat',
      nextEnemyId: 5,
      waveProgress: {
        spawnQueue: [{ defId: 'goblin', remaining: 2, interval: 0.5 }],
        timeUntilNextSpawn: 0.5,
      },
    };
    const next = tickWaves(state, 1.0);
    expect(next.enemies[0].id).toBe('enemy-5');
    expect(next.enemies[1].id).toBe('enemy-6');
    expect(next.nextEnemyId).toBe(7);
  });

  it('spawned enemy starts at distanceTravelled=0 with correct hp', () => {
    const state: RunState = {
      ...createInitialRunState(),
      phase: 'combat',
      waveProgress: {
        spawnQueue: [{ defId: 'goblin', remaining: 1, interval: 1 }],
        timeUntilNextSpawn: 1,
      },
    };
    const next = tickWaves(state, 1);
    expect(next.enemies[0].distanceTravelled).toBe(0);
    expect(next.enemies[0].hp).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------------ tickWaves – wave clear
describe('tickWaves – wave clear transition', () => {
  it('transitions to prep and increments waveIndex when queue empty and no enemies', () => {
    // Queue empty, no enemies on board -> wave is cleared
    const state: RunState = {
      ...createInitialRunState(),
      phase: 'combat',
      waveIndex: 0,
      enemies: [],
      waveProgress: {
        spawnQueue: [],
        timeUntilNextSpawn: 0,
      },
    };
    const next = tickWaves(state, 0.016);
    expect(next.phase).toBe('prep');
    expect(next.waveIndex).toBe(1);
    expect(next.waveProgress).toBeNull();
  });

  it('does NOT transition to prep while enemies are still alive even if queue is empty', () => {
    const state: RunState = {
      ...createInitialRunState(),
      phase: 'combat',
      waveIndex: 0,
      enemies: [{ id: 'e1', defId: 'goblin', distanceTravelled: 0, hp: 30 }],
      waveProgress: {
        spawnQueue: [],
        timeUntilNextSpawn: 0,
      },
    };
    const next = tickWaves(state, 0.016);
    expect(next.phase).toBe('combat');
    expect(next.waveIndex).toBe(0);
  });

  it('does NOT transition to prep while spawns are still pending even if board is empty', () => {
    const state: RunState = {
      ...createInitialRunState(),
      phase: 'combat',
      waveIndex: 0,
      enemies: [],
      waveProgress: {
        spawnQueue: [{ defId: 'goblin', remaining: 1, interval: 2 }],
        timeUntilNextSpawn: 2,
      },
    };
    const next = tickWaves(state, 0.016);
    expect(next.phase).toBe('combat');
    expect(next.waveIndex).toBe(0);
  });

  it('increments waveIndex correctly across multiple waves', () => {
    // Simulate clearing wave 0 then wave 1
    let state: RunState = {
      ...createInitialRunState(),
      phase: 'combat',
      waveIndex: 0,
      enemies: [],
      waveProgress: { spawnQueue: [], timeUntilNextSpawn: 0 },
    };
    state = tickWaves(state, 0.016);
    expect(state.waveIndex).toBe(1);

    // Start next wave
    state = startWave(state);
    expect(state.phase).toBe('combat');
    expect(state.waveIndex).toBe(1);
  });
});

// ------------------------------------------------------------------ gameover
describe('gameover – sim short-circuit', () => {
  it('tickWaves is a no-op when phase is gameover', () => {
    const state: RunState = {
      ...createInitialRunState(),
      phase: 'gameover',
      waveProgress: {
        spawnQueue: [{ defId: 'goblin', remaining: 5, interval: 1 }],
        timeUntilNextSpawn: 0,
      },
    };
    const next = tickWaves(state, 1);
    expect(next).toBe(state);
    expect(next.enemies.length).toBe(0); // no new spawns
  });

  it('tickEnemies sets phase to gameover when leaks drive baseHp to 0', () => {
    // Enemy past the path end -> will leak on next tick
    const state: RunState = {
      ...createInitialRunState(),
      phase: 'combat',
      baseHp: 1,
      enemies: [{ id: 'e1', defId: 'goblin', distanceTravelled: 9.9, hp: 30 }],
      waveProgress: null,
    };
    const next = tickEnemies(state, MINI_PATH, 1);
    expect(next.baseHp).toBeLessThanOrEqual(0);
    expect(next.phase).toBe('gameover');
  });

  it('subsequent tickWaves after gameover leaves state unchanged', () => {
    const state: RunState = {
      ...createInitialRunState(),
      phase: 'gameover',
      waveProgress: { spawnQueue: [{ defId: 'goblin', remaining: 3, interval: 0.5 }], timeUntilNextSpawn: 0 },
    };
    const next1 = tickWaves(state, 0.5);
    const next2 = tickWaves(next1, 0.5);
    expect(next1).toBe(state);
    expect(next2).toBe(state);
  });
});
