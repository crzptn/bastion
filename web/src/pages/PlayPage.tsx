import { STARTER_MAP, TOWER_DEFS, WAVES, useGameSession } from '../game';
import { GameCanvasThree } from '../game/render/GameCanvasThree';

// ---------------------------------------------------------------------------
// EndScreen overlay — rendered over the canvas on 'gameover' or 'victory'
// ---------------------------------------------------------------------------
interface EndScreenProps {
  phase: 'gameover' | 'victory';
  waveIndex: number;
  onRestart: () => void;
}

function EndScreen({ phase, waveIndex, onRestart }: EndScreenProps) {
  const isGameOver = phase === 'gameover';
  const wavesCleared = WAVES.length;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 flex flex-col items-center gap-4 shadow-2xl max-w-sm w-full mx-4">
        {isGameOver ? (
          <>
            <h3 className="text-3xl font-bold text-red-500 uppercase tracking-widest">
              Game Over
            </h3>
            <p className="text-gray-300 text-center">
              Your base fell on wave{' '}
              <strong className="text-white">{waveIndex + 1}</strong> of{' '}
              {WAVES.length}.
            </p>
          </>
        ) : (
          <>
            <h3 className="text-3xl font-bold text-yellow-400 uppercase tracking-widest">
              Victory!
            </h3>
            <p className="text-gray-300 text-center">
              You cleared all{' '}
              <strong className="text-white">{wavesCleared}</strong> waves!
            </p>
          </>
        )}
        <button
          className="mt-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded transition-colors"
          onClick={onRestart}
        >
          Restart
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HowToPlay — collapsible help panel
// ---------------------------------------------------------------------------
function HowToPlay() {
  return (
    <details className="text-sm text-gray-400 border border-gray-700 rounded p-3 mt-1">
      <summary className="cursor-pointer font-medium text-gray-300 select-none">
        How to play
      </summary>
      <ul className="mt-2 list-disc list-inside space-y-1">
        <li>
          Select a tower from the bar below the HUD, then click a buildable cell
          (lighter squares) to place it.
        </li>
        <li>
          Press <strong>Start wave</strong> to release the next wave of enemies.
        </li>
        <li>Towers fire automatically — survive until all enemies are defeated.</li>
        <li>
          Earn <strong>gold</strong> for each kill; gold is spent when placing
          towers.
        </li>
        <li>
          Enemies that reach the end damage your <strong>Base HP</strong>. Reach
          0 and it&apos;s game over.
        </li>
      </ul>
    </details>
  );
}

// ---------------------------------------------------------------------------
// PlayPage
// ---------------------------------------------------------------------------
export function PlayPage() {
  const { state, startWave, placeTowerAt, restart, selectedTowerId, setSelectedTowerId } =
    useGameSession();

  const towerDefs = Object.values(TOWER_DEFS);
  const selectedDef = TOWER_DEFS[selectedTowerId];

  const isStartWaveDisabled =
    state.phase !== 'prep' || state.waveIndex >= WAVES.length;

  const waveDisplay = `${Math.min(state.waveIndex + 1, WAVES.length)} / ${WAVES.length}`;

  const showEndScreen = state.phase === 'gameover' || state.phase === 'victory';

  return (
    <section className="flex flex-col gap-3" style={{ height: 'calc(100vh - 8rem)' }}>
      {/* HUD */}
      <div className="flex items-center gap-6 flex-wrap">
        <h2 className="text-xl font-semibold">Play</h2>
        <span className="text-sm text-gray-400">
          Wave: <strong>{waveDisplay}</strong>
        </span>
        <span className="text-sm text-yellow-400">
          Gold: <strong>{state.gold}</strong>
        </span>
        <span className="text-sm text-red-400">
          Base HP: <strong>{state.baseHp}</strong>
        </span>
        <span className="text-sm text-gray-400">
          Phase: <strong>{state.phase}</strong>
        </span>
        <button
          className={[
            'px-3 py-1 text-sm rounded',
            isStartWaveDisabled
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white',
          ].join(' ')}
          onClick={startWave}
          disabled={isStartWaveDisabled}
        >
          Start wave
        </button>
        <button
          className="px-3 py-1 text-sm bg-gray-600 rounded hover:bg-gray-500"
          onClick={restart}
        >
          New game
        </button>
      </div>

      {/* Tower selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-400">Towers:</span>
        {towerDefs.map((def) => {
          const canAfford = state.gold >= def.cost;
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
            Selected: {selectedDef.name} — dmg {selectedDef.damage}, range{' '}
            {selectedDef.range}
          </span>
        )}
      </div>

      {/* Canvas + overlay */}
      <div className="flex-1 min-h-0 relative">
        {showEndScreen && (
          <EndScreen
            phase={state.phase as 'gameover' | 'victory'}
            waveIndex={state.waveIndex}
            onRestart={restart}
          />
        )}
        <GameCanvasThree
          map={STARTER_MAP}
          towers={state.towers}
          enemies={state.enemies}
          onCellClick={placeTowerAt}
        />
      </div>

      {/* How to play */}
      <HowToPlay />
    </section>
  );
}
