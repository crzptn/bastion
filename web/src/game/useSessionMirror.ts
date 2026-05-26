/**
 * useSessionMirror — React hook for server-authoritative co-op sessions.
 *
 * When a ?lobby=<sessionId> query parameter is present, PlayPage switches
 * from the local rAF sim loop (useGameSession) to this hook.
 *
 * Responsibilities:
 *   - Open a WebSocket connection to /api/ws?room=<id>&session=<id>
 *   - Replace local RunState with each incoming state_snapshot frame (AC3)
 *   - Expose sendIntent(Intent) for client→server actions (place_tower, start_wave)
 *   - The client MUST NOT mutate RunState locally when in a session (AC3)
 *
 * No sim logic lives here.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RunState, TowerInstance, EnemyInstance, WaveProgress } from './types';
import type { Intent, SnapshotPayload, WsMessage } from '../lib/wsOpcodes';
import { IntentKindPlaceTower, IntentKindStartWave, OpPlayerAction, OpStateSnapshot, PROTOCOL_VERSION } from '../lib/wsOpcodes';
import { createWsClient } from '../lib/wsClient';
import type { WsClient } from '../lib/wsClient';
import { createInitialRunState } from './constants';

// ---------------------------------------------------------------------------
// Snapshot → RunState adapter
// ---------------------------------------------------------------------------

/**
 * snapshotToRunState converts a SnapshotPayload (snake_case JSON from the
 * server) into the client-side RunState shape.
 *
 * This is the snapshot reconciliation predicate tested in useSessionMirror.test.ts.
 * Exported for unit-testing per the pure-helper pattern from #67.
 */
export function snapshotToRunState(snap: SnapshotPayload): RunState {
  const towers: TowerInstance[] = snap.towers.map((t) => ({
    id: t.id,
    defId: t.def_id,
    x: t.x,
    y: t.y,
    cooldownRemaining: t.cooldown_remaining,
  }));

  const enemies: EnemyInstance[] = snap.enemies.map((e) => ({
    id: e.id,
    defId: e.def_id,
    distanceTravelled: e.distance_travelled,
    hp: e.hp,
  }));

  let waveProgress: WaveProgress | null = null;
  if (snap.wave_progress) {
    waveProgress = {
      spawnQueue: snap.wave_progress.spawn_queue.map((ps) => ({
        defId: ps.def_id,
        remaining: ps.remaining,
        interval: ps.interval,
      })),
      timeUntilNextSpawn: snap.wave_progress.time_until_next_spawn,
    };
  }

  return {
    gold: snap.gold,
    baseHp: snap.base_hp,
    waveIndex: snap.wave_index,
    phase: snap.phase as RunState['phase'],
    towers,
    enemies,
    waveProgress,
    nextEnemyId: snap.next_enemy_id,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface SessionMirror {
  /** The latest RunState from the server. Read-only for the client. */
  state: RunState;
  /** Send a place_tower intent to the server. */
  placeTowerAt: (pos: { x: number; y: number }, defId: string, playerId: string) => void;
  /** Send a start_wave intent to the server. */
  requestStartWave: (playerId: string) => void;
  /** Whether the WebSocket connection is currently open. */
  connected: boolean;
}

export function useSessionMirror(sessionId: string): SessionMirror {
  const [state, setState] = useState<RunState>(createInitialRunState);
  const [connected, setConnected] = useState(false);
  const clientRef = useRef<WsClient | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const client = createWsClient({
      roomId: sessionId,
      sessionId,
      onMessage(msg: WsMessage) {
        if (msg.type === OpStateSnapshot && msg.payload) {
          const snap = msg.payload as SnapshotPayload;
          setState(snapshotToRunState(snap));
        }
      },
      onClose() {
        setConnected(false);
      },
    });

    clientRef.current = client;
    setConnected(true);

    return () => {
      client.close();
      clientRef.current = null;
      setConnected(false);
    };
  }, [sessionId]);

  const sendIntent = useCallback((intent: Intent) => {
    const client = clientRef.current;
    if (!client) return;
    client.send({
      type: OpPlayerAction,
      payload: intent,
      version: PROTOCOL_VERSION,
    });
  }, []);

  const placeTowerAt = useCallback(
    (pos: { x: number; y: number }, defId: string, playerId: string) => {
      sendIntent({
        kind: IntentKindPlaceTower,
        player_id: playerId,
        def_id: defId,
        x: pos.x,
        y: pos.y,
      });
    },
    [sendIntent],
  );

  const requestStartWave = useCallback(
    (playerId: string) => {
      sendIntent({ kind: IntentKindStartWave, player_id: playerId });
    },
    [sendIntent],
  );

  return { state, placeTowerAt, requestStartWave, connected };
}
