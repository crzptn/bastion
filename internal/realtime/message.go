// Package realtime implements the server-side WebSocket hub for the Bastion
// multiplayer protocol. This package is pure domain — no net/http imports.
package realtime

import "encoding/json"

// ProtocolVersion is stamped into every outbound envelope.
// Bumped to 2 for the server-authoritative session sync opcodes.
const ProtocolVersion = 2

// Opcode constants for the wire protocol.
const (
	OpJoin          = "join"
	OpLeave         = "leave"
	OpJoinAck       = "join_ack"
	OpBroadcast     = "broadcast"
	OpPing          = "ping"
	OpPong          = "pong"
	OpError         = "error"
	OpStateSnapshot = "state_snapshot"
	OpPlayerAction  = "player_action"
	OpPhaseChange   = "phase_change"
)

// Message is the wire envelope for every frame exchanged over the WebSocket.
//
//	{
//	  "type":    "<opcode>",
//	  "payload": <any JSON value>,
//	  "version": 1
//	}
type Message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
	Version int             `json:"version"`
}

// Encode serialises the Message to JSON bytes.
func (m Message) Encode() ([]byte, error) {
	m.Version = ProtocolVersion
	return json.Marshal(m)
}

// Decode parses JSON bytes into a Message.
func Decode(data []byte) (Message, error) {
	var m Message
	if err := json.Unmarshal(data, &m); err != nil {
		return Message{}, err
	}
	return m, nil
}
