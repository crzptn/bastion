/**
 * Tower combat simulation module.
 *
 * Targeting algorithm: "furthest along path" — each tower picks the in-range
 * enemy with the highest `distanceTravelled`. This minimises leaks by
 * focusing fire on enemies closest to the base exit.
 *
 * Fire cadence: each tower fires at most once per tick (deterministic), gated
 * by `cooldownRemaining`. Even if overflow is large (e.g. high-fireRate tower
 * or accumulated negative cooldown), only one shot is taken per tick. This
 * prevents frame-rate-dependent burst damage and keeps tests stable.
 *
 * dt contract: callers must clamp dt before passing (recommended max: 1/30 s).
 * This module does not re-clamp, matching the tickEnemies contract.
 *
 * No React. No DOM imports. Pure TypeScript — safe to unit-test in Node/jsdom.
 */

import type { EnemyInstance, Path, RunState, TowerInstance } from '../types';
import { ENEMY_DEFS, TOWER_DEFS } from '../constants';
import { enemyPosition } from './enemies';

/**
 * Advance combat for one tick. Returns the same state reference when phase is
 * not 'combat' (mirrors tickEnemies behaviour for prep and gameover).
 */
export function tickCombat(
  state: RunState,
  path: Path,
  dtSeconds: number,
): RunState {
  if (state.phase !== 'combat') return state;
  if (state.towers.length === 0 || state.enemies.length === 0) return state;

  // Working mutable copies so we can track hp changes within this tick
  // without mutating the original state arrays.
  const hpMap = new Map<string, number>(state.enemies.map((e) => [e.id, e.hp]));
  const newCooldowns = new Map<string, number>(
    state.towers.map((t) => [t.id, t.cooldownRemaining]),
  );

  let goldEarned = 0;

  for (const tower of state.towers) {
    const def = TOWER_DEFS[tower.defId];
    if (!def) continue;

    // Decrement cooldown
    const prevCooldown = newCooldowns.get(tower.id)!;
    const nextCooldown = prevCooldown - dtSeconds;
    newCooldowns.set(tower.id, nextCooldown);

    // Not ready to fire yet
    if (nextCooldown > 0) continue;

    // Find the furthest-along (highest distanceTravelled) in-range enemy
    // that is still alive this tick.
    const towerCx = tower.x + 0.5;
    const towerCy = tower.y + 0.5;
    let bestEnemy: EnemyInstance | null = null;
    let bestDist = -1;

    for (const enemy of state.enemies) {
      const currentHp = hpMap.get(enemy.id);
      if (currentHp === undefined || currentHp <= 0) continue; // already dead this tick

      const pos = enemyPosition(enemy, path);
      const dist = Math.hypot(towerCx - pos.x, towerCy - pos.y);
      if (dist <= def.range && enemy.distanceTravelled > bestDist) {
        bestDist = enemy.distanceTravelled;
        bestEnemy = enemy;
      }
    }

    if (bestEnemy === null) continue;

    // Fire: apply instant damage
    const prevHp = hpMap.get(bestEnemy.id)!;
    const newHp = prevHp - def.damage;
    hpMap.set(bestEnemy.id, newHp);

    if (newHp <= 0) {
      const enemyDef = ENEMY_DEFS[bestEnemy.defId];
      if (enemyDef) {
        goldEarned += enemyDef.reward;
      }
    }

    // Reset cooldown to 1/fireRate after firing (once per tick)
    newCooldowns.set(tower.id, 1 / def.fireRate);
  }

  // If nothing changed, return same reference to avoid unnecessary re-renders.
  const anyDead = state.enemies.some((e) => (hpMap.get(e.id) ?? 1) <= 0);
  const anyDamaged = state.enemies.some((e) => {
    const newHp = hpMap.get(e.id);
    return newHp !== undefined && newHp !== e.hp;
  });
  const anyCooldownChanged = state.towers.some(
    (t) => newCooldowns.get(t.id) !== t.cooldownRemaining,
  );

  if (!anyDead && !anyDamaged && !anyCooldownChanged && goldEarned === 0) {
    return state;
  }

  // Build new enemies array: filter out dead, update hp for damaged
  const nextEnemies: EnemyInstance[] = [];
  for (const enemy of state.enemies) {
    const newHp = hpMap.get(enemy.id) ?? enemy.hp;
    if (newHp <= 0) continue; // killed — remove from board
    nextEnemies.push(newHp === enemy.hp ? enemy : { ...enemy, hp: newHp });
  }

  // Build new towers array with updated cooldowns
  const nextTowers: TowerInstance[] = state.towers.map((t) => {
    const newCd = newCooldowns.get(t.id)!;
    return newCd === t.cooldownRemaining ? t : { ...t, cooldownRemaining: newCd };
  });

  return {
    ...state,
    enemies: nextEnemies,
    towers: nextTowers,
    gold: state.gold + goldEarned,
  };
}
