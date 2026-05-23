import { useEffect, useRef, useState } from 'react';
import {
  ENEMY_DEFS,
  STARTER_MAP,
  createInitialRunState,
  spawnWave,
  tickEnemies,
} from '../game';
import type { EnemyInstance, RunState } from '../game';
import { GameCanvas } from '../game/render/GameCanvas';

const MAX_DT = 1 / 30;

function buildDebugWave(): EnemyInstance[] {
  return Array.from({ length: 5 }, (_, i) => ({
    id: `${Date.now()}-${i}`,
    defId: 'goblin',
    distanceTravelled: 0,
    hp: ENEMY_DEFS.goblin.hp,
  }));
}

export function PlayPage() {
  const [runState, setRunState] = useState<RunState>(createInitialRunState);
  const lastTsRef = useRef<number | null>(null);

  useEffect(() => {
    let rafId: number;

    const loop = (ts: number) => {
      if (lastTsRef.current !== null) {
        const rawDt = (ts - lastTsRef.current) / 1000;
        const dt = Math.min(rawDt, MAX_DT);
        setRunState((s) => tickEnemies(s, STARTER_MAP.path, dt));
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

  function handleSpawnWave() {
    setRunState((s) =>
      spawnWave({ ...s, phase: 'combat' }, buildDebugWave()),
    );
  }

  function handleReset() {
    setRunState(createInitialRunState());
  }

  return (
    <section className="flex flex-col gap-4" style={{ height: 'calc(100vh - 8rem)' }}>
      <div className="flex items-center gap-6">
        <h2 className="text-xl font-semibold">Play</h2>
        <span className="text-sm text-gray-400">
          phase: <strong>{runState.phase}</strong>
        </span>
        <span className="text-sm text-gray-400">
          base hp: <strong>{runState.baseHp}</strong>
        </span>
        <span className="text-sm text-gray-400">
          enemies: <strong>{runState.enemies.length}</strong>
        </span>
        <button
          className="px-3 py-1 text-sm bg-blue-600 rounded hover:bg-blue-500"
          onClick={handleSpawnWave}
        >
          Spawn wave
        </button>
        <button
          className="px-3 py-1 text-sm bg-gray-600 rounded hover:bg-gray-500"
          onClick={handleReset}
        >
          Reset
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <GameCanvas
          map={STARTER_MAP}
          enemies={runState.enemies}
          onCellClick={(pos) => console.log('cell', pos)}
        />
      </div>
    </section>
  );
}
