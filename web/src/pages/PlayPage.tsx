import { useEffect, useRef, useState } from 'react';
import {
  ENEMY_DEFS,
  STARTER_MAP,
  TOWER_DEFS,
  createInitialRunState,
  placeTower,
  spawnWave,
  tickCombat,
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
  const [selectedTowerId, setSelectedTowerId] = useState<string>('archer');
  const lastTsRef = useRef<number | null>(null);

  useEffect(() => {
    let rafId: number;

    const loop = (ts: number) => {
      if (lastTsRef.current !== null) {
        const rawDt = (ts - lastTsRef.current) / 1000;
        const dt = Math.min(rawDt, MAX_DT);
        // Order: move enemies first (tickEnemies), then resolve tower combat
        // (tickCombat) so towers see updated positions before firing this frame.
        setRunState((s) => tickCombat(tickEnemies(s, STARTER_MAP.path, dt), STARTER_MAP.path, dt));
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

  function handleCellClick(pos: { x: number; y: number }) {
    const def = TOWER_DEFS[selectedTowerId];
    if (!def) return;
    setRunState((s) => placeTower(s, def, pos.x, pos.y, STARTER_MAP.grid).state);
  }

  const towerDefs = Object.values(TOWER_DEFS);
  const selectedDef = TOWER_DEFS[selectedTowerId];

  return (
    <section className="flex flex-col gap-4" style={{ height: 'calc(100vh - 8rem)' }}>
      <div className="flex items-center gap-6 flex-wrap">
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
        <span className="text-sm text-yellow-400">
          gold: <strong>{runState.gold}</strong>
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
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-400">Towers:</span>
        {towerDefs.map((def) => {
          const canAfford = runState.gold >= def.cost;
          const isSelected = def.id === selectedTowerId;
          return (
            <button
              key={def.id}
              onClick={() => setSelectedTowerId(def.id)}
              className={[
                'px-3 py-1 text-sm rounded border transition-colors',
                isSelected
                  ? 'border-yellow-400 bg-yellow-900 text-yellow-200'
                  : 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600',
                !canAfford ? 'opacity-50' : '',
              ].join(' ')}
            >
              {def.name} ({def.cost}g)
            </button>
          );
        })}
        {selectedDef && (
          <span className="text-xs text-gray-500 ml-2">
            Selected: {selectedDef.name} — dmg {selectedDef.damage}, range {selectedDef.range}
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <GameCanvas
          map={STARTER_MAP}
          towers={runState.towers}
          enemies={runState.enemies}
          onCellClick={handleCellClick}
        />
      </div>
    </section>
  );
}
