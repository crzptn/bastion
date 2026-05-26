import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { STARTER_MAP, TOWER_DEFS, WAVES, useGameSession } from '../game';
import { createAudioService, useGameAudio } from '../game/audio';
import { GameCanvasThree } from '../game/render/GameCanvasThree';
import { useSessionMirror } from '../game/useSessionMirror';
import { getOrCreatePlayerId } from '../lib/playerIdentity';

// ---------------------------------------------------------------------------
// Module-level AudioService singleton (created once per module load; lazy ctx)
// ---------------------------------------------------------------------------
const audioService = createAudioService();

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
  const [searchParams] = useSearchParams();
  const lobbyId = searchParams.get('lobby');

  // Always call both hooks (React rules). The active one is chosen below.
  const soloSession = useGameSession();
  // When lobbyId is present, use the session mirror; pass empty string to
  // disable the WS connection in solo mode (hook will no-op).
  const sessionMirror = useSessionMirror(lobbyId ?? '');

  const isCoopMode = lobbyId !== null && lobbyId !== '';

  // Unified interface — the rest of the component is blind to the mode.
  const state = isCoopMode ? sessionMirror.state : soloSession.state;
  const selectedTowerId = soloSession.selectedTowerId;
  const setSelectedTowerId = soloSession.setSelectedTowerId;

  // Audio volume UI state — initialised from the service (which reads localStorage)
  const [volume, setVolume] = useState<number>(() => Math.round(audioService.getMasterVolume() * 100));
  const [muted, setMuted] = useState<boolean>(() => audioService.getMuted());

  // Wire audio hook — diffs state each render and fires SFX
  const { onUserGesture, onTowerPlaced, onWaveStart } = useGameAudio(state, audioService);

  const towerDefs = Object.values(TOWER_DEFS);
  const selectedDef = TOWER_DEFS[selectedTowerId];

  const isStartWaveDisabled =
    state.phase !== 'prep' || state.waveIndex >= WAVES.length;

  const waveDisplay = `${Math.min(state.waveIndex + 1, WAVES.length)} / ${WAVES.length}`;

  const showEndScreen = state.phase === 'gameover' || state.phase === 'victory';

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const pct = Number(e.target.value);
    setVolume(pct);
    audioService.setMasterVolume(pct / 100);
  }

  function handleMuteToggle() {
    const next = !muted;
    setMuted(next);
    audioService.setMuted(next);
  }

  function handleStartWave() {
    onUserGesture();
    onWaveStart();
    if (isCoopMode) {
      const playerId = getOrCreatePlayerId();
      sessionMirror.requestStartWave(playerId);
    } else {
      soloSession.startWave();
    }
  }

  function handleTowerSelect(id: string) {
    onUserGesture();
    setSelectedTowerId(id);
  }

  function handleCellClick(pos: { x: number; y: number }) {
    onUserGesture();
    if (isCoopMode) {
      const playerId = getOrCreatePlayerId();
      sessionMirror.placeTowerAt(pos, selectedTowerId, playerId);
      onTowerPlaced();
    } else {
      soloSession.placeTowerAt(pos);
      onTowerPlaced();
    }
  }

  return (
    <section className="flex flex-col gap-3" style={{ height: 'calc(100vh - 8rem)' }}>
      {/* Co-op session banner — shown when ?lobby=<id> is in the URL */}
      {isCoopMode && (
        <div className="rounded bg-blue-900 border border-blue-700 px-4 py-2 text-sm text-blue-200 flex items-center gap-2">
          <span className="font-medium">Co-op session:</span>
          <code className="text-blue-100 text-xs">{lobbyId}</code>
          <span className={`text-xs ml-auto ${sessionMirror.connected ? 'text-green-400' : 'text-yellow-400'}`}>
            {sessionMirror.connected ? 'Live' : 'Connecting…'}
          </span>
        </div>
      )}
      {/* HUD */}
      <div className="flex items-center gap-6 flex-wrap">
        <h2 className="text-xl font-semibold">Play</h2>
        <span className="text-sm text-gray-400">
          Wave: <strong>{waveDisplay}</strong>
        </span>
        <span className="text-sm text-yellow-400">
          {isCoopMode ? 'Shared Gold' : 'Gold'}: <strong>{state.gold}</strong>
        </span>
        <span className="text-sm text-red-400">
          {isCoopMode ? 'Shared Base HP' : 'Base HP'}: <strong>{state.baseHp}</strong>
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
          onClick={handleStartWave}
          disabled={isStartWaveDisabled}
        >
          Start wave
        </button>
        {!isCoopMode && (
          <button
            className="px-3 py-1 text-sm bg-gray-600 rounded hover:bg-gray-500"
            onClick={soloSession.restart}
          >
            New game
          </button>
        )}

        {/* Audio controls */}
        <div className="flex items-center gap-2 ml-auto">
          <label htmlFor="volume-slider" className="text-xs text-gray-400 sr-only">
            Volume
          </label>
          <input
            id="volume-slider"
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={handleVolumeChange}
            className="w-20 accent-blue-500 cursor-pointer"
            aria-label="Master volume"
          />
          <span className="text-xs text-gray-400 w-8 text-right">{volume}%</span>
          <button
            aria-pressed={muted}
            onClick={handleMuteToggle}
            className={[
              'px-2 py-1 text-xs rounded border transition-colors',
              muted
                ? 'border-red-500 bg-red-900 text-red-200'
                : 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600',
            ].join(' ')}
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? 'Muted' : 'Sound'}
          </button>
        </div>
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
              onClick={() => handleTowerSelect(def.id)}
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
            onRestart={soloSession.restart}
          />
        )}
        <GameCanvasThree
          map={STARTER_MAP}
          towers={state.towers}
          enemies={state.enemies}
          onCellClick={handleCellClick}
        />
      </div>

      {/* How to play */}
      <HowToPlay />
    </section>
  );
}
