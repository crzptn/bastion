/**
 * Wave simulation module.
 *
 * Owns the WAVES table, startWave helper, and tickWaves sim step.
 *
 * dt contract: callers must clamp dt before passing (recommended max: 1/30 s).
 * This module does not re-clamp, matching the tickEnemies / tickCombat contract.
 *
 * Spawn ids are derived from RunState.nextEnemyId (monotonically incrementing
 * integer) rather than Date.now() or Math.random() so that unit tests remain
 * fully deterministic.
 *
 * No React. No DOM imports. Pure TypeScript — safe to unit-test in Node/jsdom.
 * Import graph: only ../types and ../constants.
 */

import type { EnemyInstance, PendingSpawn, RunState, WaveDef, WaveProgress } from '../types';
import { ENEMY_DEFS } from '../constants';

// ---------------------------------------------------------------------------
// Wave table — at least 3 escalating waves (goblin counts: 5 / 8 / 12)
// ---------------------------------------------------------------------------

export const WAVES: readonly WaveDef[] = [
  {
    enemies: [{ defId: 'goblin', count: 5, interval: 1.5 }],
  },
  {
    enemies: [{ defId: 'goblin', count: 8, interval: 1.2 }],
  },
  {
    enemies: [{ defId: 'goblin', count: 12, interval: 1.0 }],
  },
] as const;

// ---------------------------------------------------------------------------
// startWave: transitions phase from 'prep' → 'combat' and populates the spawn queue
// ---------------------------------------------------------------------------

/**
 * Transitions the run state from 'prep' to 'combat', building the spawn queue
 * from WAVES[state.waveIndex].
 *
 * Returns the same state reference (no-op) when:
 *   - phase is not 'prep'
 *   - waveIndex is past the last entry in WAVES
 *   - baseHp is <= 0
 */
export function startWave(state: RunState): RunState {
  if (state.phase !== 'prep') return state;
  if (state.waveIndex >= WAVES.length) return state;
  if (state.baseHp <= 0) return state;

  const waveDef = WAVES[state.waveIndex];

  // Build a PendingSpawn entry per enemy group in the wave definition.
  // Each entry tracks how many of that defId remain to be emitted and the
  // per-spawn interval.
  const spawnQueue: PendingSpawn[] = waveDef.enemies.map((group) => ({
    defId: group.defId,
    remaining: group.count,
    interval: group.interval,
  }));

  // timeUntilNextSpawn starts at the interval of the first group so the first
  // enemy is emitted after one full interval (not on frame 0).
  const firstInterval = spawnQueue.length > 0 ? spawnQueue[0].interval : 0;

  const waveProgress: WaveProgress = {
    spawnQueue,
    timeUntilNextSpawn: firstInterval,
  };

  return { ...state, phase: 'combat', waveProgress };
}

// ---------------------------------------------------------------------------
// tickWaves: advance the spawn queue and emit enemies each frame
// ---------------------------------------------------------------------------

/**
 * Advance wave spawning for one sim tick.
 *
 * Must be called BEFORE tickEnemies each frame so that newly spawned enemies
 * begin at distanceTravelled=0 and are moved by tickEnemies in the same frame.
 *
 * Returns the same state reference when phase is not 'combat' or waveProgress
 * is null (mirrors the no-op contract of tickEnemies / tickCombat).
 *
 * Wave-clear detection: when spawnQueue is empty AND state.enemies is empty,
 * the wave is considered cleared. Phase returns to 'prep', waveIndex increments,
 * and waveProgress is set to null. Both conditions must hold simultaneously —
 * do not transition while spawns are still pending even if the board is empty.
 */
export function tickWaves(state: RunState, dtSeconds: number): RunState {
  if (state.phase !== 'combat') return state;
  if (state.waveProgress === null) return state;

  let { spawnQueue, timeUntilNextSpawn } = state.waveProgress;
  let { nextEnemyId } = state;
  const newEnemies: EnemyInstance[] = [];

  // Drain any spawns that are due this tick
  timeUntilNextSpawn -= dtSeconds;

  while (timeUntilNextSpawn <= 0 && spawnQueue.length > 0) {
    const head = spawnQueue[0];

    // Emit one enemy from the head of the queue
    const def = ENEMY_DEFS[head.defId];
    const hp = def ? def.hp : 1;
    newEnemies.push({
      id: `enemy-${nextEnemyId}`,
      defId: head.defId,
      distanceTravelled: 0,
      hp,
    });
    nextEnemyId += 1;

    // Decrement the remaining count for this group
    const nextRemaining = head.remaining - 1;

    if (nextRemaining <= 0) {
      // This group is exhausted — advance to next group
      spawnQueue = spawnQueue.slice(1);
      if (spawnQueue.length > 0) {
        // Reset timer to the next group's interval
        timeUntilNextSpawn += spawnQueue[0].interval;
      }
    } else {
      // Same group still has more enemies — advance timer by this group's interval
      spawnQueue = [{ ...head, remaining: nextRemaining }, ...spawnQueue.slice(1)];
      timeUntilNextSpawn += head.interval;
    }
  }

  const updatedEnemies = newEnemies.length > 0
    ? [...state.enemies, ...newEnemies]
    : state.enemies;

  // Wave-clear check: all spawns emitted AND no enemies alive on the board
  const allSpawned = spawnQueue.length === 0;
  const boardEmpty = updatedEnemies.length === 0;

  if (allSpawned && boardEmpty) {
    const nextWaveIndex = state.waveIndex + 1;
    const isFinalWave = nextWaveIndex >= WAVES.length;
    return {
      ...state,
      enemies: updatedEnemies,
      nextEnemyId,
      phase: isFinalWave ? 'victory' : 'prep',
      waveIndex: nextWaveIndex,
      waveProgress: null,
    };
  }

  return {
    ...state,
    enemies: updatedEnemies,
    nextEnemyId,
    waveProgress: { spawnQueue, timeUntilNextSpawn },
  };
}
