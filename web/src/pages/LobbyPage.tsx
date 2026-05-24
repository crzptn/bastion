import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createLobby,
  joinLobby,
  listOpenLobbies,
  LobbyApiError,
  type LobbyDTO,
} from '../lib/api/lobby';
import { getOrCreatePlayerId, getOrCreateDisplayName, setDisplayName } from '../lib/playerIdentity';

// ---------------------------------------------------------------------------
// LobbyPage — index view: create, list, and join by id
// ---------------------------------------------------------------------------

export function LobbyPage() {
  const navigate = useNavigate();
  const playerId = getOrCreatePlayerId();

  // Create form state
  const [lobbyName, setLobbyName] = useState('');
  const [displayName, setDisplayNameState] = useState(() => getOrCreateDisplayName());
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Join by id state
  const [joinId, setJoinId] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  // Open lobbies list
  const [openLobbies, setOpenLobbies] = useState<LobbyDTO[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchOpenLobbies() {
    try {
      const lobbies = await listOpenLobbies();
      setOpenLobbies(lobbies);
      setListError(null);
    } catch {
      setListError('Failed to load open lobbies');
    }
  }

  useEffect(() => {
    void fetchOpenLobbies();
    pollingRef.current = setInterval(() => {
      void fetchOpenLobbies();
    }, 5000);
    return () => {
      if (pollingRef.current !== null) clearInterval(pollingRef.current);
    };
  }, []);

  function persistDisplayName(name: string) {
    setDisplayNameState(name);
    if (name) setDisplayName(name);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!lobbyName.trim()) {
      setCreateError('Lobby name is required');
      return;
    }
    setCreateError(null);
    setCreating(true);
    try {
      const lobby = await createLobby({
        name: lobbyName.trim(),
        host_player_id: playerId,
        display_name: displayName.trim() || 'Player',
        max_players: maxPlayers,
      });
      navigate(`/lobby/${lobby.id}`);
    } catch (err) {
      if (err instanceof LobbyApiError) {
        setCreateError(err.message);
      } else {
        setCreateError('Failed to create lobby');
      }
      setCreating(false);
    }
  }

  async function handleJoinById(e: React.FormEvent) {
    e.preventDefault();
    if (!joinId.trim()) {
      setJoinError('Lobby ID is required');
      return;
    }
    setJoinError(null);
    setJoining(true);
    try {
      await joinLobby(joinId.trim(), {
        player_id: playerId,
        display_name: displayName.trim() || 'Player',
      });
      navigate(`/lobby/${joinId.trim()}`);
    } catch (err) {
      if (err instanceof LobbyApiError) {
        setJoinError(err.message);
      } else {
        setJoinError('Failed to join lobby');
      }
      setJoining(false);
    }
  }

  async function handleJoinFromList(lobbyId: string) {
    setJoinError(null);
    setJoining(true);
    try {
      await joinLobby(lobbyId, {
        player_id: playerId,
        display_name: displayName.trim() || 'Player',
      });
      navigate(`/lobby/${lobbyId}`);
    } catch (err) {
      if (err instanceof LobbyApiError) {
        setJoinError(err.message);
      } else {
        setJoinError('Failed to join lobby');
      }
      setJoining(false);
    }
  }

  return (
    <section className="space-y-8">
      <h2 className="text-xl font-semibold">Lobby</h2>

      {/* Display name — shared across create and join */}
      <div className="space-y-1">
        <label className="block text-sm text-slate-300 font-medium" htmlFor="display-name">
          Your display name
        </label>
        <input
          id="display-name"
          type="text"
          className="w-full max-w-xs rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="e.g. Alice"
          value={displayName}
          onChange={(e) => persistDisplayName(e.target.value)}
        />
      </div>

      {/* Create lobby */}
      <div className="space-y-3">
        <h3 className="text-base font-medium text-slate-200">Create a new lobby</h3>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="space-y-1">
            <label className="block text-sm text-slate-400" htmlFor="lobby-name">
              Lobby name
            </label>
            <input
              id="lobby-name"
              type="text"
              className="w-full max-w-xs rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. My Lobby"
              value={lobbyName}
              onChange={(e) => setLobbyName(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm text-slate-400" htmlFor="max-players">
              Max players
            </label>
            <select
              id="max-players"
              className="rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
            >
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </div>

          {createError && <p className="text-red-400 text-sm">{createError}</p>}

          <button
            type="submit"
            className={[
              'px-4 py-2 text-sm rounded font-medium transition-colors',
              creating
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white',
            ].join(' ')}
            disabled={creating}
          >
            {creating ? 'Creating…' : 'Create lobby'}
          </button>
        </form>
      </div>

      {/* Join by id */}
      <div className="space-y-3">
        <h3 className="text-base font-medium text-slate-200">Join by lobby code</h3>
        <form onSubmit={handleJoinById} className="space-y-3">
          <div className="flex gap-2 items-center flex-wrap">
            <input
              type="text"
              className="w-64 rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Paste lobby code…"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
            />
            <button
              type="submit"
              className={[
                'px-4 py-2 text-sm rounded font-medium transition-colors',
                joining
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-200',
              ].join(' ')}
              disabled={joining}
            >
              {joining ? 'Joining…' : 'Join'}
            </button>
          </div>
          {joinError && <p className="text-red-400 text-sm">{joinError}</p>}
        </form>
      </div>

      {/* Open lobbies list */}
      <div className="space-y-3">
        <h3 className="text-base font-medium text-slate-200">Open lobbies</h3>
        {listError && <p className="text-red-400 text-sm">{listError}</p>}
        {openLobbies.length === 0 ? (
          <p className="text-slate-500 text-sm">No open lobbies right now.</p>
        ) : (
          <ul className="space-y-2">
            {openLobbies.map((lobby) => (
              <li
                key={lobby.id}
                className="flex items-center justify-between rounded bg-slate-800 border border-slate-700 px-4 py-3 gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{lobby.name}</p>
                  <p className="text-xs text-slate-400">
                    {lobby.players.length} / {lobby.max_players} players
                  </p>
                </div>
                <button
                  className="px-3 py-1 text-sm rounded bg-blue-700 hover:bg-blue-600 text-white font-medium shrink-0 transition-colors disabled:opacity-50"
                  onClick={() => handleJoinFromList(lobby.id)}
                  disabled={joining}
                >
                  Join
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
