/**
 * Enemy simulation module.
 *
 * dt contract: callers must clamp dt before passing (recommended max: 1/30 s).
 * Speeds are in grid cells per second. enemyPosition returns float grid
 * coordinates; the renderer scales by cellSize to convert to canvas pixels.
 */
import type { EnemyInstance, Path, RunState } from '../types';
import { ENEMY_DEFS } from '../constants';
import { headingAtDistance, pathLength, positionAtDistance } from './path';

export function spawnWave(state: RunState, enemies: EnemyInstance[]): RunState {
  return { ...state, enemies: [...state.enemies, ...enemies] };
}

export function tickEnemies(
  state: RunState,
  path: Path,
  dtSeconds: number,
): RunState {
  if (state.phase !== 'combat') return state;

  const total = pathLength(path);
  const surviving: EnemyInstance[] = [];
  let leaks = 0;

  for (const enemy of state.enemies) {
    const def = ENEMY_DEFS[enemy.defId];
    const speed = def ? def.speed : 1;
    const next = enemy.distanceTravelled + speed * dtSeconds;
    if (next >= total) {
      leaks += 1;
    } else {
      surviving.push({ ...enemy, distanceTravelled: next });
    }
  }

  const newBaseHp = state.baseHp - leaks;
  return {
    ...state,
    enemies: surviving,
    baseHp: newBaseHp,
    phase: newBaseHp <= 0 ? 'gameover' : state.phase,
  };
}

export function enemyPosition(
  enemy: EnemyInstance,
  path: Path,
): { x: number; y: number } {
  return positionAtDistance(path, enemy.distanceTravelled);
}

/**
 * Returns the unit direction vector of the path segment the enemy is currently
 * traversing. Pure render-only helper — does not mutate simulation state.
 */
export function enemyHeading(
  enemy: EnemyInstance,
  path: Path,
): { dx: number; dy: number } {
  return headingAtDistance(path, enemy.distanceTravelled);
}
