import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { canStart } from './LobbyRoomPage';
import type { LobbyDTO } from '../lib/api/lobby';

// ---------------------------------------------------------------------------
// canStart — pure helper tests (AC4)
// ---------------------------------------------------------------------------

function makeOpenLobby(overrides: Partial<LobbyDTO> = {}): LobbyDTO {
  return {
    id: 'lobby-1',
    name: 'Test',
    host_player_id: 'host-id',
    max_players: 4,
    status: 'open',
    players: [{ player_id: 'host-id', display_name: 'Host', slot: 0, joined_at: '2026-01-01T00:00:00Z' }],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('canStart', () => {
  it('returns true for host with open lobby and at least 1 player', () => {
    const lobby = makeOpenLobby();
    expect(canStart(lobby, 'host-id')).toBe(true);
  });

  it('returns false when viewer is not the host', () => {
    const lobby = makeOpenLobby();
    expect(canStart(lobby, 'other-player')).toBe(false);
  });

  it('returns false when lobby status is not open', () => {
    const lobby = makeOpenLobby({ status: 'in_game' });
    expect(canStart(lobby, 'host-id')).toBe(false);
  });

  it('returns false when lobby is closed', () => {
    const lobby = makeOpenLobby({ status: 'closed' });
    expect(canStart(lobby, 'host-id')).toBe(false);
  });

  it('returns false when lobby is starting', () => {
    const lobby = makeOpenLobby({ status: 'starting' });
    expect(canStart(lobby, 'host-id')).toBe(false);
  });

  it('returns false when players list is empty', () => {
    const lobby = makeOpenLobby({ players: [] });
    expect(canStart(lobby, 'host-id')).toBe(false);
  });

  it('returns true with multiple players present', () => {
    const lobby = makeOpenLobby({
      players: [
        { player_id: 'host-id', display_name: 'Host', slot: 0, joined_at: '2026-01-01T00:00:00Z' },
        { player_id: 'player-2', display_name: 'P2', slot: 1, joined_at: '2026-01-01T00:00:00Z' },
      ],
    });
    expect(canStart(lobby, 'host-id')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Source-read assertion — auto-navigate branch for guests (AC4)
// ---------------------------------------------------------------------------

const srcPath = path.resolve(__dirname, 'LobbyRoomPage.tsx');
const source = fs.readFileSync(srcPath, 'utf8');

describe('LobbyRoomPage source — auto-navigate guest when in_game', () => {
  it('contains auto-navigate branch for in_game status', () => {
    expect(source).toContain("status === 'in_game'");
  });

  it('navigates to /play?lobby= with session_id', () => {
    expect(source).toMatch(/navigate\(`\/play\?lobby=\$\{.*session_id.*\}`\)/);
  });

  it('auto-navigate only triggers for non-host (guest check)', () => {
    // The auto-navigate block must include a check that the viewer is NOT the host
    expect(source).toContain('host_player_id !== playerId');
  });
});

// ---------------------------------------------------------------------------
// Source-read assertion — Start button navigates host (AC4)
// ---------------------------------------------------------------------------

describe('LobbyRoomPage source — host Start navigation', () => {
  it('navigates to /play?lobby= when startLobby returns session_id', () => {
    expect(source).toContain('navigate(`/play?lobby=${updated.session_id}`)');
  });
});
