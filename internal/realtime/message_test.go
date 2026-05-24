package realtime

import (
	"encoding/json"
	"testing"
)

func TestEncodeStampsVersion(t *testing.T) {
	m := Message{Type: OpBroadcast, Payload: json.RawMessage(`"hello"`)}
	data, err := m.Encode()
	if err != nil {
		t.Fatalf("Encode: %v", err)
	}

	var out Message
	if err := json.Unmarshal(data, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if out.Version != ProtocolVersion {
		t.Errorf("Version: got %d, want %d", out.Version, ProtocolVersion)
	}
	if out.Type != OpBroadcast {
		t.Errorf("Type: got %q, want %q", out.Type, OpBroadcast)
	}
}

func TestDecodeRoundTrip(t *testing.T) {
	original := Message{
		Type:    OpJoinAck,
		Payload: json.RawMessage(`{"room":"lobby"}`),
		Version: ProtocolVersion,
	}
	data, err := original.Encode()
	if err != nil {
		t.Fatalf("Encode: %v", err)
	}

	decoded, err := Decode(data)
	if err != nil {
		t.Fatalf("Decode: %v", err)
	}
	if decoded.Type != original.Type {
		t.Errorf("Type: got %q, want %q", decoded.Type, original.Type)
	}
	if decoded.Version != ProtocolVersion {
		t.Errorf("Version: got %d, want %d", decoded.Version, ProtocolVersion)
	}
	if string(decoded.Payload) != string(original.Payload) {
		t.Errorf("Payload: got %s, want %s", decoded.Payload, original.Payload)
	}
}

func TestDecodeInvalidJSON(t *testing.T) {
	_, err := Decode([]byte(`not json`))
	if err == nil {
		t.Fatal("expected error for invalid JSON, got nil")
	}
}

func TestOpcodeConstants(t *testing.T) {
	// Ensures the opcode constant values are stable for the protocol doc.
	cases := []struct{ name, want string }{
		{"OpJoin", "join"},
		{"OpLeave", "leave"},
		{"OpJoinAck", "join_ack"},
		{"OpBroadcast", "broadcast"},
		{"OpPing", "ping"},
		{"OpPong", "pong"},
		{"OpError", "error"},
	}
	vals := map[string]string{
		"OpJoin":      OpJoin,
		"OpLeave":     OpLeave,
		"OpJoinAck":   OpJoinAck,
		"OpBroadcast": OpBroadcast,
		"OpPing":      OpPing,
		"OpPong":      OpPong,
		"OpError":     OpError,
	}
	for _, c := range cases {
		if got := vals[c.name]; got != c.want {
			t.Errorf("%s = %q, want %q", c.name, got, c.want)
		}
	}
}
