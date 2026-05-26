package http

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"

	"github.com/JoakimCarlsson/bastion/internal/realtime"
	"github.com/JoakimCarlsson/bastion/internal/session"
)

// dialWS connects a WebSocket client to the test server at path.
func dialWS(
	t *testing.T,
	server *httptest.Server,
	path string,
) *websocket.Conn {
	t.Helper()
	url := "ws" + strings.TrimPrefix(server.URL, "http") + path
	conn, _, err := websocket.Dial(
		context.Background(),
		url,
		&websocket.DialOptions{},
	)
	if err != nil {
		t.Fatalf("dial %s: %v", url, err)
	}
	return conn
}

// readMsg reads and decodes the next JSON message from conn.
func readMsg(t *testing.T, conn *websocket.Conn) realtime.Message {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var msg realtime.Message
	if err := wsjson.Read(ctx, conn, &msg); err != nil {
		t.Fatalf("readMsg: %v", err)
	}
	return msg
}

// TestTwoClientsReceiveBroadcast verifies AC1: two clients in the same room
// both receive a server broadcast.
func TestTwoClientsReceiveBroadcast(t *testing.T) {
	hub := realtime.NewHub()
	t.Cleanup(hub.Close)

	srv := httptest.NewServer(
		NewHandler(nil, Config{}, hub, nil, nil, nil, nil),
	)
	t.Cleanup(srv.Close)

	c1 := dialWS(t, srv, "/api/ws?room=ac1-test")
	c2 := dialWS(t, srv, "/api/ws?room=ac1-test")
	defer func() { _ = c1.CloseNow() }()
	defer func() { _ = c2.CloseNow() }()

	// Each client gets a join_ack first. Consume them.
	ack1 := readMsg(t, c1)
	if ack1.Type != realtime.OpJoinAck {
		t.Errorf(
			"c1: first message type = %q, want %q",
			ack1.Type,
			realtime.OpJoinAck,
		)
	}
	ack2 := readMsg(t, c2)
	if ack2.Type != realtime.OpJoinAck {
		t.Errorf(
			"c2: first message type = %q, want %q",
			ack2.Type,
			realtime.OpJoinAck,
		)
	}

	// Each client also gets a broadcast announcing the other's join. Drain those.
	// c1 gets the notification about c2 joining; c2 gets both join notifications.
	// We loop until we've consumed enough join events.
	drainJoins := func(conn *websocket.Conn, n int) {
		for range n {
			msg := readMsg(t, conn)
			if msg.Type != realtime.OpBroadcast {
				t.Errorf("expected broadcast join event, got %q", msg.Type)
			}
		}
	}
	drainJoins(c1, 1) // c1 sees c2 joining
	drainJoins(
		c2,
		1,
	) // c2 sees itself joining (broadcast happens before c2 reads ack)

	// Now broadcast from the hub side directly.
	hub.Broadcast("ac1-test", realtime.Message{
		Type:    realtime.OpBroadcast,
		Payload: json.RawMessage(`"server-test"`),
	})

	msg1 := readMsg(t, c1)
	msg2 := readMsg(t, c2)

	if msg1.Type != realtime.OpBroadcast {
		t.Errorf("c1: got type %q, want %q", msg1.Type, realtime.OpBroadcast)
	}
	if msg2.Type != realtime.OpBroadcast {
		t.Errorf("c2: got type %q, want %q", msg2.Type, realtime.OpBroadcast)
	}
}

// TestDisconnectOneClientRemainsWorking verifies AC2: closing one client
// removes it from the room, and the remaining client still receives broadcasts.
// Also verifies that goroutines return to baseline after settle.
func TestDisconnectOneClientRemainsWorking(t *testing.T) {
	hub := realtime.NewHub()
	t.Cleanup(hub.Close)

	srv := httptest.NewServer(
		NewHandler(nil, Config{}, hub, nil, nil, nil, nil),
	)
	t.Cleanup(srv.Close)

	goroutinesBefore := runtime.NumGoroutine()

	c1 := dialWS(t, srv, "/api/ws?room=ac2-test")
	c2 := dialWS(t, srv, "/api/ws?room=ac2-test")

	// Drain join_ack + join broadcast for both clients.
	drainN := func(conn *websocket.Conn, n int) {
		for range n {
			readMsg(t, conn)
		}
	}
	drainN(c1, 2) // ack + c2-join broadcast
	drainN(c2, 2) // ack + own-join broadcast

	// Close c1.
	if err := c1.Close(websocket.StatusNormalClosure, "bye"); err != nil {
		t.Logf("c1 close: %v", err)
	}

	// Give the server side time to detect the disconnect.
	time.Sleep(200 * time.Millisecond)

	// Broadcast to room — only c2 should be in it now.
	hub.Broadcast("ac2-test", realtime.Message{
		Type:    realtime.OpBroadcast,
		Payload: json.RawMessage(`"after-disconnect"`),
	})

	msg := readMsg(t, c2)
	if msg.Type != realtime.OpBroadcast {
		t.Errorf("c2: got type %q, want broadcast", msg.Type)
	}

	// Close c2 cleanly.
	if err := c2.Close(websocket.StatusNormalClosure, "bye"); err != nil {
		t.Logf("c2 close: %v", err)
	}

	// Allow goroutines to settle (ping loops and read loops must exit).
	time.Sleep(500 * time.Millisecond)

	goroutinesAfter := runtime.NumGoroutine()
	// Allow a small delta for runtime internals that may vary.
	delta := goroutinesAfter - goroutinesBefore
	if delta > 5 {
		t.Errorf("goroutine leak: before=%d, after=%d, delta=%d (want ≤5)",
			goroutinesBefore, goroutinesAfter, delta)
	}
}

// TestWsMissingRoom verifies that /api/ws without ?room= returns 400.
func TestWsMissingRoom(t *testing.T) {
	hub := realtime.NewHub()
	t.Cleanup(hub.Close)

	srv := httptest.NewServer(
		NewHandler(nil, Config{}, hub, nil, nil, nil, nil),
	)
	t.Cleanup(srv.Close)

	url := "ws" + strings.TrimPrefix(srv.URL, "http") + "/api/ws"
	_, resp, err := websocket.Dial(
		context.Background(),
		url,
		&websocket.DialOptions{},
	)
	if err == nil {
		t.Fatal("expected dial to fail for missing room, got nil error")
	}
	if resp != nil && resp.StatusCode != 400 {
		t.Errorf("status: got %d, want 400", resp.StatusCode)
	}
}

// readNextSnapshot reads messages from conn until it finds an OpStateSnapshot.
// It discards up to maxSkip non-snapshot messages before giving up.
func readNextSnapshot(
	t *testing.T,
	conn *websocket.Conn,
	maxSkip int,
) json.RawMessage {
	t.Helper()
	for range maxSkip + 1 {
		msg := readMsg(t, conn)
		if msg.Type == realtime.OpStateSnapshot {
			return msg.Payload
		}
	}
	t.Fatalf("did not receive state_snapshot within %d messages", maxSkip+1)
	return nil
}

// snapshotFields holds the fields we care about for AC1/AC2 assertions.
type snapshotFields struct {
	BaseHP  int               `json:"base_hp"`
	Enemies []json.RawMessage `json:"enemies"`
	Towers  []json.RawMessage `json:"towers"`
	Tick    uint64            `json:"tick"`
}

func parseSnapshot(t *testing.T, payload json.RawMessage) snapshotFields {
	t.Helper()
	var f snapshotFields
	if err := json.Unmarshal(payload, &f); err != nil {
		t.Fatalf("parse snapshot: %v", err)
	}
	return f
}

// TestTwoClientsSessionSnapshotParity verifies AC1: two clients joined to the
// same session room both receive state_snapshot messages that are identical in
// base_hp after the session starts.
func TestTwoClientsSessionSnapshotParity(t *testing.T) {
	const sessID = "parity-test-session"

	hub := realtime.NewHub()
	t.Cleanup(hub.Close)

	mgr := session.NewManager()
	mgr.SetBroadcaster(func(id string, msg realtime.Message) {
		hub.Broadcast(id, msg)
	})
	t.Cleanup(mgr.Close)

	srv := httptest.NewServer(
		NewHandler(nil, Config{}, hub, nil, mgr, nil, nil),
	)
	t.Cleanup(srv.Close)

	path := "/api/ws?room=" + sessID + "&session=" + sessID
	c1 := dialWS(t, srv, path)
	c2 := dialWS(t, srv, path)
	defer func() { _ = c1.CloseNow() }()
	defer func() { _ = c2.CloseNow() }()

	// Drain join handshake messages (join_ack + join broadcasts).
	drainHandshake := func(conn *websocket.Conn) {
		// join_ack
		readMsg(t, conn)
		// join broadcast (our own join event, plus potentially the other client's)
		// We'll drain messages for a short window rather than counting exactly.
	}
	drainHandshake(c1)
	drainHandshake(c2)

	// Start the session — snapshots will begin arriving.
	if err := mgr.Start(sessID, []string{"p1", "p2"}); err != nil {
		t.Fatalf("Start: %v", err)
	}

	// Drain any residual join-broadcast messages then grab the first snapshots.
	snap1 := parseSnapshot(t, readNextSnapshot(t, c1, 10))
	snap2 := parseSnapshot(t, readNextSnapshot(t, c2, 10))

	// AC1: base_hp must be identical for both clients on the same session.
	if snap1.BaseHP != snap2.BaseHP {
		t.Errorf("base_hp mismatch: c1=%d c2=%d", snap1.BaseHP, snap2.BaseHP)
	}
	if snap1.BaseHP != 20 {
		t.Errorf("initial base_hp: got %d, want 20", snap1.BaseHP)
	}
}

// TestPlaceTowerVisibleToOtherClient verifies AC2: tower placed by client A
// appears in client B's next snapshot.
func TestPlaceTowerVisibleToOtherClient(t *testing.T) {
	const sessID = "tower-visibility-session"

	hub := realtime.NewHub()
	t.Cleanup(hub.Close)

	mgr := session.NewManager()
	mgr.SetBroadcaster(func(id string, msg realtime.Message) {
		hub.Broadcast(id, msg)
	})
	t.Cleanup(mgr.Close)

	srv := httptest.NewServer(
		NewHandler(nil, Config{}, hub, nil, mgr, nil, nil),
	)
	t.Cleanup(srv.Close)

	path := "/api/ws?room=" + sessID + "&session=" + sessID
	c1 := dialWS(t, srv, path)
	c2 := dialWS(t, srv, path)
	defer func() { _ = c1.CloseNow() }()
	defer func() { _ = c2.CloseNow() }()

	// Drain initial handshake for both.
	readMsg(t, c1) // join_ack
	readMsg(t, c2) // join_ack

	// Start session.
	if err := mgr.Start(sessID, []string{"p1", "p2"}); err != nil {
		t.Fatalf("Start: %v", err)
	}

	// Wait for initial snapshot to confirm session is running.
	_ = readNextSnapshot(t, c1, 15)
	_ = readNextSnapshot(t, c2, 15)

	// Client A places a tower at a known buildable cell (0,6) via player_action.
	intent := session.Intent{
		Kind:     session.IntentKindPlaceTower,
		PlayerID: "p1",
		DefID:    "archer",
		X:        0,
		Y:        6,
	}
	intentPayload, _ := json.Marshal(intent)
	actionMsg := realtime.Message{
		Type:    realtime.OpPlayerAction,
		Payload: intentPayload,
		Version: realtime.ProtocolVersion,
	}
	sendCtx, sendCancel := context.WithTimeout(
		context.Background(),
		3*time.Second,
	)
	defer sendCancel()
	data, _ := actionMsg.Encode()
	if err := c1.Write(sendCtx, websocket.MessageText, data); err != nil {
		t.Fatalf("c1 write player_action: %v", err)
	}

	// Wait for a snapshot on c2 that includes the tower.
	deadline := time.Now().Add(3 * time.Second)
	type towerPos struct {
		X int `json:"x"`
		Y int `json:"y"`
	}

	for time.Now().Before(deadline) {
		payload := readNextSnapshot(t, c2, 20)
		var s struct {
			Towers []towerPos `json:"towers"`
		}
		if err := json.Unmarshal(payload, &s); err != nil {
			t.Fatalf("parse tower snapshot: %v", err)
		}
		for _, tw := range s.Towers {
			if tw.X == 0 && tw.Y == 6 {
				return // AC2 satisfied
			}
		}
	}
	t.Error(
		"AC2: tower placed by c1 was not visible in c2 snapshot within deadline",
	)
}
