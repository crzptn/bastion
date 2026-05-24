# Bastion Realtime Protocol

**Protocol version:** 1  
**Transport:** WebSocket (RFC 6455), text frames, JSON payloads.

---

## Transport

Connect with a standard WebSocket upgrade:

```
GET /api/ws?room=<room-id>  HTTP/1.1
Upgrade: websocket
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `room`    | yes      | Opaque room identifier. 400 Bad Request if missing. |

The server upgrades the connection and immediately sends a `join_ack` frame.

---

## Envelope

Every frame — both client-to-server and server-to-client — uses the same JSON envelope:

```json
{
  "type":    "<opcode>",
  "payload": <any JSON value or null>,
  "version": 1
}
```

| Field     | Type             | Description |
|-----------|------------------|-------------|
| `type`    | string           | One of the opcodes listed below. |
| `payload` | JSON value       | Opcode-specific body. May be `null` or omitted. |
| `version` | integer          | Protocol version. Always `1` in the current implementation (`ProtocolVersion` constant). |

The server stamps `version: 1` on every outbound frame. Clients should include `version: 1` on every inbound frame (currently informational only).

---

## Opcodes

| Opcode        | Direction         | Description |
|---------------|-------------------|-------------|
| `join`        | client → server   | Reserved for future explicit join requests. Currently unused — joining is implicit on connection. |
| `leave`       | client → server   | Reserved for future explicit leave requests. Currently unused — leaving is implicit on disconnect. |
| `join_ack`    | server → client   | Sent immediately after upgrade. Confirms the room and assigned client ID. |
| `broadcast`   | bidirectional     | Generic broadcast. Client sends → rebroadcast to room. Server sends → message from hub. |
| `ping`        | client → server   | Application-level ping. Server replies with `pong`. |
| `pong`        | server → client   | Application-level pong reply. |
| `error`       | server → client   | Sent to all clients in a room on hub shutdown. |

---

## Opcode Payloads

### `join_ack` (server → client)

```json
{
  "type": "join_ack",
  "payload": {
    "room":      "my-room",
    "client_id": "conn-42"
  },
  "version": 1
}
```

### `broadcast` — join event (server → client)

Emitted to the room whenever a new client connects:

```json
{
  "type": "broadcast",
  "payload": {
    "event":     "join",
    "client_id": "conn-42"
  },
  "version": 1
}
```

### `broadcast` — client rebroadcast (client → server → room)

Clients send a `broadcast` frame to fan it out to every other peer in the room:

```json
{
  "type": "broadcast",
  "payload": { "msg": "hello everyone" },
  "version": 1
}
```

Server fans the same envelope (including the original `payload`) out to all clients in the room, including the sender.

### `ping` / `pong`

```json
{ "type": "ping", "version": 1 }
{ "type": "pong", "version": 1 }
```

---

## Heartbeat

The server sends a WebSocket-level ping frame every **30 seconds**. If the pong is not received within **5 seconds**, the server cancels the connection context and closes the socket. The client must honour WebSocket pings at the protocol level (browsers do this automatically).

Additionally, clients may send an application-level `ping` opcode at any time; the server replies with a `pong` opcode immediately.

Read deadline per frame: **60 seconds**. A client that does not send any frame for 60 seconds will be disconnected.

---

## Close codes

| Code | Meaning |
|------|---------|
| 1000 `StatusNormalClosure` | Clean disconnect initiated by either side. |
| 1001 `StatusGoingAway`     | Not currently used. |

On server shutdown the hub broadcasts an `error` opcode to all connected clients and then calls `Close(StatusNormalClosure)` on each connection.

---

## Authentication (stub)

Authentication is a non-goal for M3. The endpoint accepts any connection. Future milestones will gate on a bearer token query parameter or cookie.

---

## Example session

```
Client                              Server
  |── GET /api/ws?room=lobby ────►  |
  |◄── 101 Switching Protocols ──── |
  |◄── {"type":"join_ack",...} ───── |
  |◄── {"type":"broadcast","payload":{"event":"join",...}} ──(room broadcast)
  |── {"type":"broadcast","payload":{"msg":"hi"}} ──►|
  |◄── {"type":"broadcast","payload":{"msg":"hi"}} ──(echo to all including sender)
  |── {"type":"ping"} ───────────► |
  |◄── {"type":"pong"} ──────────── |
  |── [close 1000] ───────────────► |
```
