/**
 * useGameSession — React hook that owns RunState and the rAF game loop.
 *
 * Tick order per frame:
 *   1. tickWaves  — emit pending spawns
 *   2. tickEnemies — move enemies, detect leaks / gameover
 *   3. tickCombat  — towers fire on updated positions
 *
 * dt is clamped to MAX_DT (1/30 s) before each tick.
 * The loop halts when phase is 'gameover' or 'victory'.
 *
 * No sim logic lives here. Import graph: React + ../game barrel.
 */

import { useEffect, useRef, useState } from 'react';
import {
  STARTER_MAP,
  TOWER_DEFS,
  createInitialRunState,
  placeTower,
  startWave as simStartWave,
  tickCombat,
  tickEnemies,
  tickWaves,
} from './index';
import type { RunState } from './types';

const MAX_DT = 1 / 30;

export interface GameSession {
  state: RunState;
  startWave: () => void;
  placeTowerAt: (pos: { x: number; y: number }) => void;
  restart: () => void;
  selectedTowerId: string;
  setSelectedTowerId: (id: string) => void;
}

export function useGameSession(): GameSession {
  const [runState, setRunState] = useState<RunState>(createInitialRunState);
  const [selectedTowerId, setSelectedTowerId] = useState<string>('archer');
  const lastTsRef = useRef<number | null>(null);

  useEffect(() => {
    let rafId: number;

    const loop = (ts: number) => {
      if (lastTsRef.current !== null) {
        const rawDt = (ts - lastTsRef.current) / 1000;
        const dt = Math.min(rawDt, MAX_DT);

        setRunState((s) => {
          if (s.phase === 'gameover' || s.phase === 'victory') return s;
          return tickCombat(
            tickEnemies(tickWaves(s, dt), STARTER_MAP.path, dt),
            STARTER_MAP.path,
            dt,
          );
        });
      }
      lastTsRef.current = ts;
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      lastTsRef.current = null;
    };
  }, []);

  function startWave() {
    setRunState((s) => simStartWave(s));
  }

  function placeTowerAt(pos: { x: number; y: number }) {
    const def = TOWER_DEFS[selectedTowerId];
    if (!def) return;
    setRunState((s) => placeTower(s, def, pos.x, pos.y, STARTER_MAP.grid).state);
  }

  function restart() {
    setRunState(createInitialRunState());
  }

  return {
    state: runState,
    startWave,
    placeTowerAt,
    restart,
    selectedTowerId,
    setSelectedTowerId,
  };
}
