import { useEffect, useRef, useState } from 'react';
import {
  STARTER_MAP,
  TOWER_DEFS,
  WAVES,
  createInitialRunState,
  placeTower,
  startWave,
  tickCombat,
  tickEnemies,
  tickWaves,
} from '../game';
import type { RunState } from '../game';
import { GameCanvas } from '../game/render/GameCanvas';

const MAX_DT = 1 / 30;

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
        // Order per frame:
        //   1. tickWaves — emit pending spawns (enemies start at distance 0)
        //   2. tickEnemies — move enemies and detect leaks / gameover
        //   3. tickCombat — towers fire on updated positions
        setRunState((s) => {
          if (s.phase === 'gameover') return s;
          return tickCombat(tickEnemies(tickWaves(s, dt), STARTER_MAP.path, dt), STARTER_MAP.path, dt);
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

  function handleStartWave() {
    setRunState((s) => startWave(s));
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

  const isStartWaveDisabled =
    runState.phase !== 'prep' ||
    runState.waveIndex >= WAVES.length;

  const waveDisplay = `${Math.min(runState.waveIndex + 1, WAVES.length)} / ${WAVES.length}`;

  return (
    <section className="flex flex-col gap-4" style={{ height: 'calc(100vh - 8rem)' }}>
      {/* HUD */}
      <div className="flex items-center gap-6 flex-wrap">
        <h2 className="text-xl font-semibold">Play</h2>
        <span className="text-sm text-gray-400">
          Wave: <strong>{waveDisplay}</strong>
        </span>
        <span className="text-sm text-yellow-400">
          Gold: <strong>{runState.gold}</strong>
        </span>
        <span className="text-sm text-red-400">
          Base HP: <strong>{runState.baseHp}</strong>
        </span>
        <span className="text-sm text-gray-400">
          Phase: <strong>{runState.phase}</strong>
        </span>
        {runState.phase === 'gameover' && (
          <span className="text-sm font-bold text-red-500 uppercase tracking-widest">
            GAME OVER
          </span>
        )}
        <button
          className={[
            'px-3 py-1 text-sm rounded',
            isStartWaveDisabled
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white',
          ].join(' ')}
          onClick={handleStartWave}
          disabled={isStartWaveDisabled}
        >
          Start wave
        </button>
        <button
          className="px-3 py-1 text-sm bg-gray-600 rounded hover:bg-gray-500"
          onClick={handleReset}
        >
          Reset
        </button>
      </div>

      {/* Tower selector */}
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

      {/* Canvas */}
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
