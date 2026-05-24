import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getLobby, leaveLobby, startLobby, LobbyApiError, type LobbyDTO } from '../lib/api/lobby';
import { getOrCreatePlayerId } from '../lib/playerIdentity';

// ---------------------------------------------------------------------------
// Pure helper — exported for unit testing
// ---------------------------------------------------------------------------

/**
 * canStart returns true iff:
 *   - viewer is the host
 *   - lobby is open (not already started/closed)
 *   - at least 1 player is present (the host alone counts)
 */
export function canStart(lobby: LobbyDTO, viewerPlayerId: string): boolean {
  return (
    lobby.host_player_id === viewerPlayerId &&
    lobby.status === 'open' &&
    lobby.players.length >= 1
  );
}

// ---------------------------------------------------------------------------
// LobbyRoomPage
// ---------------------------------------------------------------------------

export function LobbyRoomPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const playerId = getOrCreatePlayerId();

  const [lobby, setLobby] = useState<LobbyDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch and update lobby state
  async function fetchLobby() {
    if (!id) return;
    try {
      const data = await getLobby(id);
      setLobby(data);
      setError(null);

      // Auto-navigate guests when game starts
      if (data.status === 'in_game' && data.session_id && data.host_player_id !== playerId) {
        navigate(`/play?lobby=${data.session_id}`);
      }
    } catch (err) {
      if (err instanceof LobbyApiError) {
        setError(err.message);
      } else {
        setError('Failed to load lobby');
      }
    }
  }

  // Start polling on mount, stop on unmount
  useEffect(() => {
    void fetchLobby();
    pollingRef.current = setInterval(() => {
      void fetchLobby();
    }, 2000);

    return () => {
      if (pollingRef.current !== null) {
        clearInterval(pollingRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleLeave() {
    if (!id || !lobby) return;
    setLeaving(true);
    try {
      await leaveLobby(id, playerId);
      navigate('/lobby');
    } catch (err) {
      if (err instanceof LobbyApiError) {
        setError(err.message);
      } else {
        setError('Failed to leave lobby');
      }
      setLeaving(false);
    }
  }

  async function handleStart() {
    if (!id || !lobby) return;
    setStartError(null);
    setStarting(true);
    try {
      const updated = await startLobby(id, playerId);
      setLobby(updated);
      if (updated.session_id) {
        navigate(`/play?lobby=${updated.session_id}`);
      }
    } catch (err) {
      if (err instanceof LobbyApiError) {
        setStartError(err.message);
      } else {
        setStartError('Failed to start game');
      }
      setStarting(false);
    }
  }

  function handleCopy() {
    if (!lobby) return;
    void navigator.clipboard.writeText(lobby.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (error && !lobby) {
    return (
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Lobby</h2>
        <p className="text-red-400">{error}</p>
        <button
          className="px-3 py-1 text-sm rounded bg-slate-700 hover:bg-slate-600"
          onClick={() => navigate('/lobby')}
        >
          Back to lobby list
        </button>
      </section>
    );
  }

  if (!lobby) {
    return (
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Lobby</h2>
        <p className="text-slate-400">Loading…</p>
      </section>
    );
  }

  const isHost = lobby.host_player_id === playerId;
  const startAllowed = canStart(lobby, playerId);

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold">{lobby.name}</h2>
        <span
          className={[
            'text-xs px-2 py-1 rounded font-medium',
            lobby.status === 'open' ? 'bg-green-900 text-green-300' : 'bg-slate-700 text-slate-300',
          ].join(' ')}
        >
          {lobby.status}
        </span>
      </div>

      {/* Lobby ID copy */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-400">Lobby code:</span>
        <code className="bg-slate-800 px-2 py-0.5 rounded text-slate-200 text-xs">{lobby.id}</code>
        <button
          className="px-2 py-0.5 text-xs rounded bg-slate-700 hover:bg-slate-600"
          onClick={handleCopy}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Player roster */}
      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-2">
          Players ({lobby.players.length} / {lobby.max_players})
        </h3>
        {lobby.players.length === 0 ? (
          <p className="text-slate-500 text-sm">No players yet.</p>
        ) : (
          <ul className="space-y-1">
            {lobby.players.map((p) => (
              <li key={p.player_id} className="flex items-center gap-2 text-sm">
                <span className="text-slate-200">{p.display_name || p.player_id}</span>
                {p.player_id === lobby.host_player_id && (
                  <span className="text-xs text-yellow-400 font-medium">Host</span>
                )}
                {p.player_id === playerId && (
                  <span className="text-xs text-blue-400">(you)</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Error banners */}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {startError && <p className="text-red-400 text-sm">{startError}</p>}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {/* Host Start button */}
        {isHost && (
          <button
            className={[
              'px-4 py-2 text-sm rounded font-medium transition-colors',
              startAllowed && !starting
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed',
            ].join(' ')}
            onClick={handleStart}
            disabled={!startAllowed || starting}
          >
            {starting ? 'Starting…' : 'Start game'}
          </button>
        )}

        {/* Leave */}
        <button
          className={[
            'px-4 py-2 text-sm rounded transition-colors',
            leaving
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-300',
          ].join(' ')}
          onClick={handleLeave}
          disabled={leaving}
        >
          {leaving ? 'Leaving…' : 'Leave lobby'}
        </button>
      </div>
    </section>
  );
}
