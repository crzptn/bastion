/**
 * useGameAudio — diffs RunState each render and fires the correct SFX.
 *
 * Trigger map:
 *   tower lastFiredAt rising edge → tower_fire_<defId>  (fallback: tower_fire_archer)
 *   enemy hp drop (still alive)   → enemy_hit
 *   enemy removed + baseHp same   → enemy_die
 *   enemy removed + baseHp drop   → leak (silent — per non-goals)
 *   phase combat → victory        → victory
 *   phase combat → gameover       → defeat
 *
 * Exposed callbacks for wiring from PlayPage:
 *   onUserGesture()  — call on any click; unlocks AudioContext
 *   onTowerPlaced()  — call after successful tower placement
 *   onWaveStart()    — call from Start-wave handler
 *
 * No Three.js, no @react-three imports.
 */

import { useEffect, useRef } from 'react';
import type { RunState } from '../types';
import type { AudioService, SfxId } from './AudioService';

const VALID_SFX = new Set<string>([
  'tower_fire_archer',
  'tower_fire_cannon',
  'enemy_hit',
  'enemy_die',
  'tower_place',
  'wave_start',
  'victory',
  'defeat',
]);

export function towerFireSfx(defId: string): SfxId {
  const candidate = `tower_fire_${defId}`;
  return VALID_SFX.has(candidate) ? (candidate as SfxId) : 'tower_fire_archer';
}

/**
 * Pure function that computes which SFX to fire given a state transition.
 * Exported for unit-testing without React hooks.
 */
export function diffRunState(prev: RunState, next: RunState): SfxId[] {
  const sfx: SfxId[] = [];

  // Tower fire: rising edge on lastFiredAt
  for (const tower of next.towers) {
    const prevTower = prev.towers.find((t) => t.id === tower.id);
    const prevLastFired = prevTower?.lastFiredAt ?? 0;
    const currLastFired = tower.lastFiredAt ?? 0;
    if (currLastFired > prevLastFired) {
      sfx.push(towerFireSfx(tower.defId));
    }
  }

  // Enemy events
  const prevEnemyMap = new Map(prev.enemies.map((e) => [e.id, e]));
  const currEnemySet = new Set(next.enemies.map((e) => e.id));

  // hp drop on surviving enemies → enemy_hit
  for (const enemy of next.enemies) {
    const prevEnemy = prevEnemyMap.get(enemy.id);
    if (prevEnemy && enemy.hp < prevEnemy.hp) {
      sfx.push('enemy_hit');
    }
  }

  // removed enemies
  for (const prevEnemy of prev.enemies) {
    if (!currEnemySet.has(prevEnemy.id)) {
      if (next.baseHp < prev.baseHp) {
        // leak — silent (per non-goals)
      } else {
        sfx.push('enemy_die');
      }
    }
  }

  // Phase transitions
  if (prev.phase === 'combat' && next.phase === 'victory') {
    sfx.push('victory');
  } else if (prev.phase === 'combat' && next.phase === 'gameover') {
    sfx.push('defeat');
  }

  return sfx;
}

export interface GameAudioHandlers {
  onUserGesture(): void;
  onTowerPlaced(): void;
  onWaveStart(): void;
}

export function useGameAudio(state: RunState, service: AudioService): GameAudioHandlers {
  const prevRef = useRef<RunState | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = state;

    if (prev === null) return; // first render — nothing to diff

    const sfxList = diffRunState(prev, state);
    for (const id of sfxList) {
      service.play(id);
    }
  });

  return {
    onUserGesture(): void {
      service.unlock();
    },
    onTowerPlaced(): void {
      service.play('tower_place');
    },
    onWaveStart(): void {
      service.play('wave_start');
    },
  };
}
