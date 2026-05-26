/**
 * WebSocket opcode constants — must match internal/realtime/message.go.
 *
 * ProtocolVersion 2 adds state_snapshot, player_action, phase_change for
 * server-authoritative session sync (issue #16).
 */

export const PROTOCOL_VERSION = 2;

export const OpJoin = 'join';
export const OpLeave = 'leave';
export const OpJoinAck = 'join_ack';
export const OpBroadcast = 'broadcast';
export const OpPing = 'ping';
export const OpPong = 'pong';
export const OpError = 'error';

/** Server → client: full RunState snapshot. Payload: SnapshotPayload */
export const OpStateSnapshot = 'state_snapshot';

/** Client → server: a player intent. Payload: Intent */
export const OpPlayerAction = 'player_action';

/** Server → client: phase transition notification. Payload: { from, to } */
export const OpPhaseChange = 'phase_change';

// ---- Intent kind constants (mirrors internal/session/session.go) ----

export const IntentKindPlaceTower = 'place_tower';
export const IntentKindStartWave = 'start_wave';

// ---- Wire types ----

export interface WsMessage {
  type: string;
  payload?: unknown;
  version: number;
}

export interface Intent {
  kind: string;
  player_id: string;
  def_id?: string;
  x?: number;
  y?: number;
}

export interface SnapshotPayload {
  id: string;
  gold: number;
  base_hp: number;
  wave_index: number;
  phase: string;
  towers: SnapshotTower[];
  enemies: SnapshotEnemy[];
  wave_progress?: SnapshotWaveProgress | null;
  next_enemy_id: number;
  tick: number;
}

export interface SnapshotTower {
  id: string;
  def_id: string;
  x: number;
  y: number;
  cooldown_remaining: number;
}

export interface SnapshotEnemy {
  id: string;
  def_id: string;
  distance_travelled: number;
  hp: number;
}

export interface SnapshotWaveProgress {
  spawn_queue: SnapshotPendingSpawn[];
  time_until_next_spawn: number;
}

export interface SnapshotPendingSpawn {
  def_id: string;
  remaining: number;
  interval: number;
}
