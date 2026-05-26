# Bastion Real-time WebSocket Protocol

## Overview

The Bastion WebSocket protocol provides two capabilities over a single endpoint:

1. **Room broadcast** — generic fan-out for lobby presence and chat.
2. **Session sync** — server-authoritative game state delivery for co-op sessions.

## Endpoint

```
GET /api/ws?room=<roomId>&session=<sessionId>
```

| Parameter  | Required | Description                                                         |
|------------|----------|---------------------------------------------------------------------|
| `room`     | yes      | Room ID for fan-out. Use the `session_id` for co-op rooms.          |
| `session`  | no       | Session ID. When provided, `player_action` frames are routed to the session manager. |

## Protocol version

`ProtocolVersion = 2` (bumped from 1 in issue #16).

Every message carries `"version": 2` in the envelope.

## Message envelope

```json
{
  "type":    "<opcode>",
  "payload": <any JSON value>,
  "version": 2
}
```

## Opcodes

### Server to client

| Opcode           | Description                                                       |
|------------------|-------------------------------------------------------------------|
| `join_ack`       | Sent on connect. Payload: {"room":"<id>","client_id":"<id>"}.     |
| `broadcast`      | Generic room broadcast.                                           |
| `state_snapshot` | Full RunState snapshot. Payload: see Snapshot payload below.      |
| `phase_change`   | Phase transition. Payload: {"from":"prep","to":"combat"}.         |
| `pong`           | Response to ping.                                                 |
| `error`          | Server-side error; connection will be closed.                     |

### Client to server

| Opcode          | Description                                                        |
|-----------------|--------------------------------------------------------------------|
| `ping`          | Keep-alive. Server responds with pong.                             |
| `broadcast`     | Fan-out to all room members.                                       |
| `player_action` | Submit a game intent. Payload: see Intent payload below.           |

## Snapshot payload (state_snapshot)

```json
{
  "id":           "session-uuid",
  "gold":         100,
  "base_hp":      20,
  "wave_index":   0,
  "phase":        "prep",
  "towers":       [],
  "enemies":      [],
  "wave_progress": null,
  "next_enemy_id": 0,
  "tick":         42
}
```

### Phase values

| Value      | Meaning                                          |
|------------|--------------------------------------------------|
| prep       | Between waves — towers can be placed.            |
| combat     | Wave in progress — enemies are spawning/moving.  |
| gameover   | Base HP reached 0.                               |
| victory    | All waves cleared.                               |

### Tower object

```json
{
  "id":                  "archer-0-6",
  "def_id":              "archer",
  "x":                   0,
  "y":                   6,
  "cooldown_remaining":  0.0
}
```

### Enemy object

```json
{
  "id":                   "enemy-0",
  "def_id":               "goblin",
  "distance_travelled":   2.5,
  "hp":                   30
}
```

## Intent payload (player_action)

```json
{
  "kind":       "place_tower",
  "player_id":  "player-uuid",
  "def_id":     "archer",
  "x":          0,
  "y":          6
}
```

| Kind          | Required fields                     |
|---------------|-------------------------------------|
| place_tower   | def_id, x, y, player_id             |
| start_wave    | player_id                           |

## REST endpoint

GET /api/sessions/{id}/snapshot

Returns the current state_snapshot payload for the session, or 404 with {"error":"session_not_found"}.

## Tick rate

The server runs a fixed-step tick loop at 30 Hz (one tick per 33ms approx).
A state_snapshot message is broadcast to all room members on every tick.

## Session resource model

Gold, BaseHP, and lives are a **single shared pool** per session. There is no
per-player accounting. Every `state_snapshot` broadcasts the same values to
all subscribers of the session room; two connected clients always see identical
gold and BaseHP.

### Intent membership rule

An intent submitted with a `player_id` that is **not in the session's
registered playerIDs** is silently dropped before any state mutation occurs.
An empty `player_id` is also rejected. Only the players who joined the session
via `POST /api/sessions` (or equivalent lobby hand-off) can affect the shared
resource pool.

This is enforced server-side in `internal/session/manager.go` →
`applyIntent`. No error is returned to the sender — the drop is silent so that
network replays and stale frames cannot cause visible error states on the
client.

## Security

- Origin checking is disabled for M3 (InsecureSkipVerify: true).
- Intent authorisation is limited to session membership — only registered
  players may submit intents that mutate shared resources (gold, base HP).
- Full per-player auth (JWT, session tokens) is out of scope for M3.
